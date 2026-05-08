import torch
import torch.nn as nn
from transformers import HubertModel
import librosa
import tempfile
import os

class SimpleHuBERTPredictor(nn.Module):
    def __init__(self):
        super().__init__()
        # Load pre-trained HuBERT base model
        self.hubert = HubertModel.from_pretrained("facebook/hubert-base-ls960")
        
        # Simple untrained projection layer for Phase 1, strictly to output a 0-100 score
        # This proves the end-to-end streaming pipeline works without needing the full fusion system yet.
        self.score_head = nn.Sequential(
            nn.Linear(768, 128),
            nn.ReLU(),
            nn.Linear(128, 1),
            nn.Sigmoid()
        )
        
    def forward(self, waveform):
        # waveform shape: (batch, sequence_length)
        # Expected sample rate: 16kHz
        outputs = self.hubert(waveform).last_hidden_state # (B, T, 768)
        
        # Mean pooling across the time dimension
        pooled = torch.mean(outputs, dim=1) # (B, 768)
        
        raw_score = self.score_head(pooled) # (B, 1)
        return raw_score * 100.0

# Singleton instance for the FastAPI worker
_predictor = None

def get_hubert_predictor():
    global _predictor
    if _predictor is None:
        print("Loading HuBERT Model into memory...")
        _predictor = SimpleHuBERTPredictor()
        _predictor.eval() # Set to evaluation mode
        print("HuBERT Model loaded successfully.")
    return _predictor

def process_audio_buffer(audio_bytes: bytes) -> float:
    """
    Decodes raw webm bytes, runs HuBERT inference, and returns a confidence score.
    """
    # 1. Write bytes to temp file (librosa needs a file path)
    fd, temp_path = tempfile.mkstemp(suffix=".webm")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(audio_bytes)
            
        # 2. Resample to 16kHz for HuBERT
        y, sr = librosa.load(temp_path, sr=16000)
        
        if len(y) == 0:
            return 0.0
            
        # 3. Convert to Torch Tensor and add batch dimension
        waveform = torch.tensor(y).unsqueeze(0).float()
        
        # 4. Run Inference
        model = get_hubert_predictor()
        with torch.no_grad():
            score = model(waveform)
            
        return float(score.item())
        
    except Exception as e:
        print(f"HuBERT Inference Error: {e}")
        return 50.0  # Fallback gracefully
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception as cleanup_err:
                print(f"Failed to clean up temp file: {cleanup_err}")
