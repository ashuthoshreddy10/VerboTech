# Production ML Architecture Blueprint: VerboTech 2.0

## 1. System Modules & Architecture

### Frontend (React/Vite & WebAssembly)
*   **Responsibilities:** Capture browser audio/video, run lightweight MediaPipe (WASM) for local face tracking to save bandwidth, compress audio chunks, and stream binary payloads.
*   **I/O Contract:** `AudioBlob (WebM) + Float32Array (Landmarks) -> WebSocket`
*   **Tech:** `react`, `@mediapipe/tasks-vision`, `framer-motion`, `lucide-react`.

### Streaming Layer (WebSockets)
*   **Responsibilities:** Maintain persistent, low-latency stateful connections. Route incoming binary audio/tensor data into backend ingestion buffers.
*   **I/O Contract:** `Binary chunks -> FastAPI WebSockets -> Redis Pub/Sub or Kafka`
*   **Tech:** FastAPI `WebSocket` endpoint, `redis.asyncio` for buffering state.

### Backend Gateway (FastAPI)
*   **Responsibilities:** Auth validation via Firebase, WebSocket session state management, CRUD for historical sessions, DB routing. It does **zero** ML processing.
*   **I/O Contract:** `JSON Auth/REST -> PostgreSQL`, `WebSocket binary -> Redis buffer`

### Worker System (Celery / Redis)
*   **Responsibilities:** Dequeue complete or windowed audio buffers and tensor payloads from Redis, orchestrate pipeline execution on GPU/CPU nodes, and push results to Postgres.
*   **I/O Contract:** `Task(audio_uri, tensor_payload) -> DL Models -> Postgres(Result)`
*   **Tech:** `celery`, `redis` (broker), `boto3` (S3).

### ML Inference Pipelines & Fusion Model (PyTorch)
*   **Audio Pipeline:** Silero VAD (Voice Activity) -> RNNoise (Denoise) -> **HuBERT-Base** (Acoustic embeddings).
*   **Semantic Pipeline:** **Whisper-X** (Transcription + word-level timestamps) -> Light LLM (Llama 3 8B or GPT-4o-mini via API for structural analysis).
*   **Vision Pipeline:** Lightweight Temporal Convolutional Network (TCN) trained on 3D MediaPipe coordinate streams to extract micro-expression embeddings.
*   **Multimodal Fusion:** Cross-attention layer concatenating HuBERT, TCN, and Semantic embeddings to output a synthesized 0-100 Confidence Score and psychological vectors.

### Storage Layer
*   **Relational:** `PostgreSQL` (Sessions, Users, Metadata, Telemetry JSONBs).
*   **Object/Blob:** `AWS S3` or GCP Cloud Storage (Raw `.webm` files).
*   **In-Memory/Queue:** `Redis` (Active WebSocket frame buffering, Celery queues).

---

## 2. Production Tech Stack
*   **API Gateway:** FastAPI (Python 3.11, Uvicorn)
*   **Message Broker / State:** Redis (Async)
*   **Async Workers:** Celery
*   **Database:** PostgreSQL (SQLAlchemy + Alembic for migrations)
*   **Blob Storage:** AWS S3 (via Boto3)
*   **Deep Learning Framework:** PyTorch 2.x
*   **Model Weights:** 
    *   Audio: `facebook/hubert-base-ls960`
    *   ASR: `m-bain/whisperX` (for accurate timestamps)
    *   VAD: `silero-vad`

---

## 3. Production Folder Structure

```text
verbotech-backend/
├── api/
│   ├── routes/
│   │   ├── auth.py
│   │   ├── sessions.py
│   │   └── stream.py       # WebSocket routing
│   └── dependencies.py     # Auth checks, DB session yields
├── core/
│   ├── config.py           # Pydantic Settings
│   ├── database.py         # SQLAlchemy engine
│   └── redis_pool.py
├── ml/
│   ├── models/
│   │   ├── hubert_audio.py # PyTorch HuBERT wrapper
│   │   ├── tcn_vision.py   # PyTorch TCN for MediaPipe tensors
│   │   └── fusion.py       # Cross-attention fusion head
│   ├── pipelines/
│   │   ├── inference.py    # Ties models together for predicting
│   │   └── audio_prep.py   # Silero VAD + Resampling
│   └── weights/            # Local cache for .pt or ONNX files
├── workers/
│   ├── celery_app.py
│   └── tasks.py            # Background inference jobs
├── schemas/                # Pydantic validation
│   └── session.py
├── alembic/                # DB Migrations
├── tests/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── main.py                 # FastAPI application factory
```

---

## 4. Code Blueprints

### A. FastAPI WebSocket Gateway (`api/routes/stream.py`)
```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
# from core.redis_pool import get_redis

router = APIRouter()

@router.websocket("/ws/stream/{session_id}")
async def stream_telemetry(websocket: WebSocket, session_id: str):
    await websocket.accept()
    # redis = await get_redis()
    try:
        while True:
            # Expecting interleaved binary (audio chunk) and JSON (MediaPipe frames)
            message = await websocket.receive()
            if "bytes" in message:
                audio_chunk = message["bytes"]
                # Push to Redis list to buffer until 5-second window is reached
                # await redis.rpush(f"audio:{session_id}", audio_chunk)
            elif "text" in message:
                tensor_data = message["text"]
                # await redis.rpush(f"tensors:{session_id}", tensor_data)
                
            # Naive trigger: If buffer is large enough, fire Celery task for sliding window inference
    except WebSocketDisconnect:
        # User finished speaking. Dispatch final Celery aggregation task.
        # from workers.tasks import process_final_session
        # process_final_session.delay(session_id)
        pass
```

### B. Client Streaming Setup (React/Vite)
```javascript
// src/utils/useStreamingSession.js
import { useEffect, useRef } from "react";

export function useStreamingSession(sessionId, isRecording) {
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  useEffect(() => {
    if (!isRecording) return;
    
    wsRef.current = new WebSocket(`ws://localhost:8000/ws/stream/${sessionId}`);
    
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      // 250ms chunks for low-latency streaming
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(e.data); // Send raw binary audio
        }
      };
      mediaRecorderRef.current.start(250);
    });

    return () => {
      mediaRecorderRef.current?.stop();
      wsRef.current?.close();
    };
  }, [sessionId, isRecording]);
  
  // Expose a method for the MediaPipe loop to send tensors
  const sendVisualTensors = (tensorFloat32Array) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(Array.from(tensorFloat32Array)));
    }
  };

  return { sendVisualTensors };
}
```

### C. Multimodal Fusion Model (`ml/models/fusion.py`)
```python
import torch
import torch.nn as nn
from transformers import HubertModel

class MultimodalConfidenceNetwork(nn.Module):
    def __init__(self):
        super().__init__()
        # 1. Acoustic Embeddings (HuBERT)
        self.hubert = HubertModel.from_pretrained("facebook/hubert-base-ls960")
        self.audio_proj = nn.Linear(768, 256)
        
        # 2. Vision Embeddings (Temporal Convolution over MediaPipe vectors)
        # Assuming 52 flattened landmark floats as input
        self.vision_tcn = nn.Sequential(
            nn.Conv1d(in_channels=52, out_channels=128, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool1d(2),
            nn.Conv1d(in_channels=128, out_channels=256, kernel_size=3, padding=1),
            nn.AdaptiveAvgPool1d(1)
        )
        
        # 3. Fusion Head
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
        # vision_tensors shape: (Batch, channels, time)
        
        # Audio Pass
        audio_out = self.hubert(audio_wave).last_hidden_state # (B, T, 768)
        audio_emb = torch.mean(audio_out, dim=1)              # Mean pooling
        audio_feat = self.audio_proj(audio_emb)               # (B, 256)
        
        # Vision Pass
        vision_feat = self.vision_tcn(vision_tensors).squeeze(-1) # (B, 256)
        
        # Fusion
        combined = torch.cat((audio_feat, vision_feat), dim=1) # (B, 512)
        score = self.fusion_layer(combined)                    # (B, 1)
        
        return score * 100.0
```

### D. Celery Worker Inference Pipeline (`workers/tasks.py`)
```python
# from celery_app import celery
# from ml.pipelines.inference import evaluate_session
# import boto3

# @celery.task(bind=True, name="process_final_session")
def process_final_session(self, session_id: str):
    # 1. Reconstruct .webm from Redis buffers
    # audio_buffer, tensor_data = reconstruct_from_redis(session_id)
    
    # 2. Upload raw artifact to S3 for data flywheel
    # s3_uri = upload_to_s3(session_id, audio_buffer)
    
    # 3. ML Inference (Heavy compute)
    # runs Silero -> HuBERT -> TCN -> Fusion -> WhisperX
    # inference_results = evaluate_session(audio_buffer, tensor_data)
    
    # 4. Compute Personalization Delta
    # delta = compute_personalization_delta(session_id, inference_results["raw_score"])
    
    # 5. Save to Postgres
    # save_to_pg(session_id, inference_results, delta, s3_uri)
    
    return {"status": "success"} #, "score": inference_results["raw_score"]}
```

---

## 5. Personalization Engine

**The Concept:** A score of "65%" means nothing. What matters is "Did you deviate from your baseline?"
1. **Onboarding:** User completes a 30-second "Casual Introduction". We run the Multimodal Model on this.
2. **Storage:** We save the derived `audio_feat` and `vision_feat` (256-dim vectors) to Postgres in a `user_baselines` table.
3. **Delta Computation:** During a high-stress scenario, we compute the explicit drop/gain mathematically.

**Schema:**
```sql
CREATE TABLE user_baselines (
    user_id VARCHAR PRIMARY KEY,
    baseline_score FLOAT,
    acoustic_centroid Vector(256), -- Requires pgvector extension
    vision_centroid Vector(256),
    updated_at TIMESTAMP
);
```

---

## 6. Data Flywheel & Retraining

We must aggressively capture whether the model was right or wrong.

**Feedback API:**
`POST /api/feedback { session_id, perceived_score, ai_score, user_correction }`

**Retraining Pipeline:**
1. Nightly CRON job query identifies sessions where `ABS(perceived_score - ai_score) > 15` (Model was severely wrong).
2. It generates a labeling payload via Label Studio API linking the S3 audio URI and the MediaPipe tensor dump.
3. Human engineers validate the "true" score.
4. Ray / PyTorch DDP cluster spun up on AWS EC2 pulls the validated batch to fine-tune the Multimodal Fusion head layer weights.

---

## 7. Execution Strategy: The Refactor Roadmap

**Phase 1: Subtraction (Day 1)**
*   **DELETE IMMEDIATELY:** The entire `train.py` (Random Forest code) and SQLite implementation.
*   **DELETE IMMEDIATELY:** The heuristic IF/ELSE math in `/api/analyze-audio` and `/api/predict`.
*   **WHY:** Keeping them creates technical debt and prevents streaming adoption. Replace SQLite with PostgreSQL immediately via Docker.

**Phase 2: Plumbing & Transport (Week 1)**
*   Implement the WebSocket ingest in FastAPI (`routes/stream.py`).
*   Implement Redis for buffering chunked frames.
*   Implement the S3 bucket upload mechanism.
*   Update React to stream buffers rather than holding giant Blobs in RAM.

**Phase 3: The Deep Learning Worker Plane (Week 2-3)**
*   Bootstrap the Celery cluster.
*   Wire up `Silero-VAD` and the PyTorch `HuBERT` models inside `ml/pipelines`.
*   Ensure the Celery worker can dequeue a buffered session from Redis, evaluate it via the PyTorch model, and write the score to Postgres.

**Phase 4: Personalization & Analytics (Week 4)**
*   Build the `user_baselines` flow.
*   Launch the Feedback collection UI (thumbs up/down + "What score did you expect?").
