from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session
import datetime
import uvicorn
import json
import asyncio

app = FastAPI(title="VerboTech ML Streaming Backend")

# 1. Setup CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Database Setup (SQLite for Phase 1)
SQLALCHEMY_DATABASE_URL = "sqlite:///./confidence.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class SessionData(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True) 
    question_id = Column(String)
    scenario_title = Column(String)
    category = Column(String)
    difficulty = Column(String)
    
    duration = Column(Integer)
    silence_count = Column(Integer)
    silence_ratio = Column(Float)
    eye_contact_score = Column(Float)       
    expressiveness_score = Column(Float)    
    confidence_score = Column(Float)
    delta_score = Column(Float, default=0.0) # difference from baseline
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class UserBaseline(Base):
    __tablename__ = "user_baselines"
    user_id = Column(String, primary_key=True, index=True)
    baseline_score = Column(Float)
    acoustic_centroid = Column(String) # JSON list of floats
    vision_centroid = Column(String) # JSON list of floats
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)

class SessionFeedback(Base):
    __tablename__ = "session_feedbacks"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer)
    user_id = Column(String)
    perceived_score = Column(Float)
    ai_score = Column(Float)
    user_correction = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class SessionCreate(BaseModel):
    user_id: str
    question_id: str
    scenario_title: str = "Unknown Scenario"
    category: str = "Unknown Category"
    difficulty: str = "Unknown Difficulty"
    duration: int
    silence_count: int
    silence_ratio: float
    eye_contact: str = "Unknown"
    expressiveness: str = "Unknown"
    confidence_score: float
    delta_score: float = 0.0

class FeedbackCreate(BaseModel):
    session_id: int
    user_id: str
    perceived_score: float
    ai_score: float
    user_correction: str = ""

@app.get("/")
def read_root():
    return {"message": "VerboTech Phase 1 Streaming API is live"}

@app.post("/api/sessions")
def create_session(session_data: SessionCreate, db: Session = Depends(get_db)):
    """ Keep REST endpoint for saving the final session metadata to DB """
    eye_map = {"Good": 1.0, "Fair": 0.5, "Poor": 0.0}
    exp_map = {"Expressive": 1.0, "Neutral": 0.5, "Flat": 0.0}
    
    db_session = SessionData(
        user_id=session_data.user_id,
        question_id=session_data.question_id,
        scenario_title=session_data.scenario_title,
        category=session_data.category,
        difficulty=session_data.difficulty,
        duration=session_data.duration,
        silence_count=session_data.silence_count,
        silence_ratio=session_data.silence_ratio,
        eye_contact_score=eye_map.get(session_data.eye_contact, 0.5),
        expressiveness_score=exp_map.get(session_data.expressiveness, 0.5),
        confidence_score=session_data.confidence_score,
        delta_score=session_data.delta_score
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return {"status": "success", "session_id": db_session.id}

@app.post("/api/feedback")
def submit_feedback(feedback_data: FeedbackCreate, db: Session = Depends(get_db)):
    """ Endpoint for Data Flywheel: Capturing ground truth from user perception """
    fb = SessionFeedback(
        session_id=feedback_data.session_id,
        user_id=feedback_data.user_id,
        perceived_score=feedback_data.perceived_score,
        ai_score=feedback_data.ai_score,
        user_correction=feedback_data.user_correction
    )
    db.add(fb)
    db.commit()
    return {"status": "Feedback absorbed into Flywheel successfully"}

@app.get("/api/sessions/{user_id}")
def get_user_sessions(user_id: str, db: Session = Depends(get_db)):
    """ History endpoint """
    sessions = db.query(SessionData).filter(SessionData.user_id == user_id).order_by(SessionData.timestamp.asc()).all()
    result = []
    for s in sessions:
        result.append({
            "id": s.id,
            "questionId": s.question_id,
            "scenarioTitle": s.scenario_title,
            "category": s.category,
            "difficulty": s.difficulty,
            "avgConfidence": s.confidence_score,
            "duration": s.duration,
            "time": s.timestamp.isoformat()
        })
    return result

# --- PHASE 1 STREAMING ENDPOINT ---
# Replaces the polling /api/predict and heavy /api/analyze-audio

@app.websocket("/ws/stream/{session_id}")
async def stream_telemetry(websocket: WebSocket, session_id: str):
    await websocket.accept()
    audio_buffer = bytearray()
    vision_tensors = []
    
    print(f"WebSocket connected for inference stream: {session_id}")
    try:
        while True:
            message = await websocket.receive()
            
            if "bytes" in message:
                audio_buffer.extend(message["bytes"])
                
            elif "text" in message:
                text_data = message["text"]
                try:
                    payload = json.loads(text_data)
                    
                    if payload.get("type") == "tensor":
                        vision_tensors.append(payload.get("data", []))
                        
                    elif payload.get("action") == "finish":
                        user_id_obj = payload.get("user_id", "anonymous")
                        is_onboarding = payload.get("is_onboarding", False)
                        
                        score = 0.0
                        delta = 0.0
                        
                        try:
                            print(f"Session {session_id} finished. Attempting Celery Cluster...")
                            from workers.tasks import process_multimodal_session
                            task = process_multimodal_session.delay(
                                audio_hex=bytes(audio_buffer).hex(),
                                tensors_json=json.dumps(vision_tensors),
                                user_id=user_id_obj,
                                is_onboarding=is_onboarding
                            )
                            result = task.get(timeout=25) # 25s timeout
                            score = result.get("confidence_score", 50.0)
                            delta = result.get("delta_score", 0.0)
                        except Exception as worker_err:
                            print(f"Worker Cluster UNAVAILABLE or Timeout: {worker_err}. Falling back to local thread...")
                            # FALLBACK: Run the task logic locally in a thread to prevent app hang
                            from workers.tasks import process_multimodal_session
                            # We call it directly (effectively bypassing celery delay)
                            result = await asyncio.to_thread(
                                process_multimodal_session, 
                                audio_hex=bytes(audio_buffer).hex(),
                                tensors_json=json.dumps(vision_tensors),
                                user_id=user_id_obj,
                                is_onboarding=is_onboarding
                            )
                            score = result.get("confidence_score", 50.0)
                            delta = result.get("delta_score", 0.0)

                        print(f"Final Score for {session_id}: {score:.1f} (Delta: {delta:.1f})")
                        await websocket.send_json({"confidence_score": score, "delta_score": delta})
                        await websocket.close()
                        break
                        
                except json.JSONDecodeError:
                    pass
                
    except WebSocketDisconnect:
        print(f"WebSocket disconnected: {session_id}")
    except Exception as e:
        print(f"WebSocket Error: {e}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
