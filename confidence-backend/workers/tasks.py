from workers.celery_app import celery_app
import torch
import json
import os
import tempfile
import librosa
import numpy as np
from ml.models.fusion import get_multimodal_predictor
from main import SessionLocal, UserBaseline

@celery_app.task(name="process_multimodal_session")
def process_multimodal_session(audio_hex: str, tensors_json: str, user_id: str = "anonymous", is_onboarding: bool = False):
    """
    Background worker task to execute the heavy PyTorch Multimodal Fusion model.
    Audio and tensors are passed serialized to prevent blocking the FastAPI Gateway.
    """
    print(f"[Worker] Starting Multimodal Interference Task")
    # 1. Deserialize payloads
    audio_bytes = bytes.fromhex(audio_hex)
    try:
        tensors_list = json.loads(tensors_json)
    except Exception:
        tensors_list = []
        
    try:
        # 2. Extract Raw PCM Float32 (Bypass FFmpeg/Librosa entirely)
        # We expect raw float32 arrays from the frontend ScriptProcessor at 16kHz
        sr = 16000
        y = np.frombuffer(audio_bytes, dtype=np.float32)
        
        if len(y) < 1600: # Less than 100ms of audio
            print(f"[Worker] Tiny signal: {len(y)} samples. Scoring 0.")
            return {"confidence_score": 0.0, "status": "insufficient_audio", "delta_score": 0.0}
            
        # Standardize for transformer (16kHz expected)
        audio_tensor = torch.tensor(y).unsqueeze(0).float() # (1, T)
        
        # 3. Format Vision Tensors
        if not tensors_list or len(tensors_list) == 0:
            vision_tensor = torch.zeros(1, 10, 52).float()
        else:
            vision_tensor = torch.tensor(tensors_list).unsqueeze(0).float() # (1, Seq, 52)
            
        # 4. Multimodal Deep Learning Fusion
        model = get_multimodal_predictor()
        with torch.no_grad():
            score_tensor, audio_feat, vision_feat = model(audio_tensor, vision_tensor)
            
        neural_score = float(score_tensor.item())

        # 5. HEURISTIC BRIDGE (Calibration for Phase 2/3)
        # Since the neural model is uncalibrated (untrained), we anchor it with 
        # empirical acoustic/visual features to make it "properly functioning"
        
        # Acoustic anchors
        rms = librosa.feature.rms(y=y)[0]
        avg_volume = np.mean(rms)
        zcr = np.mean(librosa.feature.zero_crossing_rate(y=y))
        
        # Simple pitch proxy (Pitch variance = confidence)
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        pitch_indices = magnitudes.argmax(axis=0)
        valid_pitches = pitches[pitch_indices, range(pitches.shape[1])]
        valid_pitches = valid_pitches[valid_pitches > 0]
        pitch_var = np.std(valid_pitches) if len(valid_pitches) > 1 else 0
        
        # Visual anchor (Stability of landmarks)
        if len(tensors_list) > 2:
            v_arr = np.array(tensors_list) # (Seq, 52)
            v_std = np.std(v_arr, axis=0).mean() # overall movement variance
        else:
            v_std = 0
            
        # Calibration Logic
        # neural_score is ~50. We modulate it.
        calibrated_score = neural_score
        
        # Confidence correlates with pitch variance and moderate volume
        if pitch_var > 40: calibrated_score += 20  # +20 for melodic range
        if avg_volume > 0.02: calibrated_score += 15 # +15 for projection
        if zcr > 0.05: calibrated_score += 10 # +10 for clear consonants
        if v_std < 0.03: calibrated_score += 5 # +5 for stable body language
        
        # Penalty for extreme silence only
        if avg_volume < 0.005: 
            calibrated_score = calibrated_score * 0.4 # Less aggressive crash
            
        final_score = float(max(0, min(100, calibrated_score)))
        
        # 6. Personalization Engine (Extracting Centroids)
        delta_score = 0.0
        
        # Convert tensors to numpy lists for JSON storage / mathematical delta
        a_cent = audio_feat.squeeze().numpy().tolist()
        v_cent = vision_feat.squeeze().numpy().tolist()
        
        db = SessionLocal()
        try:
            target_user = user_id if user_id and user_id != "anonymous" else "guest"
            baseline = db.query(UserBaseline).filter(UserBaseline.user_id == target_user).first()
            
            if is_onboarding or not baseline:
                # Save the new centroid
                if not baseline:
                    baseline = UserBaseline(user_id=target_user)
                baseline.acoustic_centroid = json.dumps(a_cent)
                baseline.vision_centroid = json.dumps(v_cent)
                baseline.baseline_score = final_score
                db.add(baseline)
                db.commit()
                print(f"[Worker] Saved new Deep Baseline for {target_user}")
            else:
                # Calculate Delta using simple Phase 3 cosine similarity (before real pgvector migration)
                try:
                    base_a = np.array(json.loads(baseline.acoustic_centroid))
                    curr_a = np.array(a_cent)
                    
                    dot_product = np.dot(base_a, curr_a)
                    similarity = dot_product / (np.linalg.norm(base_a) * np.linalg.norm(curr_a) + 1e-8)
                    
                    # Synthesize delta math based on similarity vs baseline score
                    # For simplicity, we compare raw baseline_score magnitude and similarity alignment
                    if similarity > 0.95:
                        delta_score = final_score - baseline.baseline_score
                    else:
                        # Heavy deviation from baseline, apply strict vector distance
                        distance_penalty = (1.0 - similarity) * 20.0
                        delta_score = (final_score - baseline.baseline_score) - distance_penalty
                except Exception as ve:
                    print(f"Vector math error: {ve}")
                    delta_score = final_score - (baseline.baseline_score or 50.0)
                    
        finally:
            db.close()

        print(f"[Worker] Fusion Complete - Confidence: {final_score:.1f} (Delta: {delta_score:.1f})")
        return {"confidence_score": final_score, "delta_score": delta_score, "status": "success"}

    except Exception as e:
        print(f"[Worker] Inference Error: {e}")
        import traceback
        traceback.print_exc()
        return {"confidence_score": 0.0, "status": "error", "message": str(e)}
    finally:
        pass
