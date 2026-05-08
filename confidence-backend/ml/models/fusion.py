import torch
import torch.nn as nn
from transformers import HubertModel
from ml.models.tcn_vision import TemporalConvNet

class MultimodalConfidenceNetwork(nn.Module):
    def __init__(self):
        super().__init__()
        # 1. Acoustic Embeddings (HuBERT)
        self.hubert = HubertModel.from_pretrained("facebook/hubert-base-ls960")
        self.audio_proj = nn.Linear(768, 256)
        
        # 2. Vision Embeddings (Temporal Convolution over MediaPipe vectors)
        # Assuming 52 flattened landmark floats as input
        self.vision_tcn = TemporalConvNet(num_features=52, hidden_channels=128, out_channels=256)
        
        # 3. Fusion Head (Linear concatenation for Phase 2)
        self.fusion_layer = nn.Sequential(
            nn.Linear(256 + 256, 128),
            nn.LayerNorm(128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, 1),
            nn.Sigmoid() # Outputs 0.0 to 1.0 (Multiply by 100 for score)
        )

    def forward(self, audio_wave, vision_tensors):
        # audio_wave shape: (Batch, sequence_length)
        # vision_tensors shape: (Batch, sequence_length, features)
        
        # Audio Pass
        audio_out = self.hubert(audio_wave).last_hidden_state # (B, T, 768)
        audio_emb = torch.mean(audio_out, dim=1)              # Mean pooling
        audio_feat = self.audio_proj(audio_emb)               # (B, 256)
        
        # Vision Pass
        vision_feat = self.vision_tcn(vision_tensors)         # (B, 256)
        
        # Fusion
        combined = torch.cat((audio_feat, vision_feat), dim=1) # (B, 512)
        score = self.fusion_layer(combined)                    # (B, 1)
        
        return score * 100.0, audio_feat, vision_feat

# Singleton instance for the worker
_predictor = None

def get_multimodal_predictor():
    global _predictor
    if _predictor is None:
        print("Loading Multimodal Fusion Model into memory...")
        _predictor = MultimodalConfidenceNetwork()
        _predictor.eval() 
        print("Multimodal Fusion Model loaded successfully.")
    return _predictor
