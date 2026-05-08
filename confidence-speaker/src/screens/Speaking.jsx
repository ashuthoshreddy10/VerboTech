import { useEffect, useState, useRef } from "react";
import { motion as Motion } from "framer-motion";
import { useAudioAnalyzer } from "../utils/useAudioAnalyzer";
import { useFaceAnalyzer } from "../utils/useFaceAnalyzer";
import { useSpeechRecognition } from "../utils/useSpeechRecognition"; 
import { getBaselineConfidence } from "../utils/storage"; 
import { auth } from "../utils/firebase";
import { Eye, EyeOff, Mic, MicOff, Activity, Loader2, StopCircle, Video, TrendingUp, Clock } from "lucide-react";

function Speaking({ situation, onFinish }) {
  const duration = situation?.duration ?? 90;

  const [timeLeft, setTimeLeft] = useState(duration);
  const [confidence, setConfidence] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [hasStarted, setHasStarted] = useState(false); 
  const [isTranscribing, setIsTranscribing] = useState(false); 

  const audioMetrics = useAudioAnalyzer();
  const [sessionToken, setSessionToken] = useState("sess-pending");
  const { finishSession, sendVisionTensors } = useSpeechRecognition(hasStarted, sessionToken); 
  const { eyeContact, expressiveness, videoRef } = useFaceAnalyzer(cameraEnabled && hasStarted, sendVisionTensors);

  const confidenceRef = useRef(35);
  const lastSpeechTimeRef = useRef(0);
  const confidenceSamplesRef = useRef([]);
  const minConfidenceRef = useRef(100);
  const varianceRef = useRef(0);

  const ML_BACKEND_URL = "http://localhost:8000";

  /* ---------- TIMER & COMPLETION ---------- */
  useEffect(() => {
    if (timeLeft <= 0) {
      async function finalizeSession() {
        console.log("🔥 finalizeSession triggered. Time is 0.");
        const samples = confidenceSamplesRef.current;
        let variance = 0;

        if (samples.length > 0) {
          const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
          variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
        }

        varianceRef.current = variance;
        
        let baseline = null;
        try {
          baseline = await Promise.race([
            getBaselineConfidence(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
          ]);
        } catch (e) {
          console.warn(e);
        }

        let deltaConfidence = null;
        if (baseline !== null) {
          deltaConfidence = confidence - baseline;
        }

// Transcript engine placeholder (Captured telemetry indicator)
        let finalTranscript = "[Acoustic telemetry captured and analyzed by Deep Learning Fusion Engine. Full semantic transcription disabled in this phase.]"; 
        let finalMlConfidence = confidence; 

        setIsTranscribing(true); // Trigger UI Loader
        try {
            console.log("Transmission Complete. Hooking into backend PyTorch stream...");
            const currentUserId = auth.currentUser?.uid || "guest";
            const isFirstSession = situation?.isOnboarding || false;

            const pytorchResult = await finishSession({
              user_id: currentUserId,
              is_onboarding: isFirstSession
            });
            
            console.log("Deep Learning Output:", pytorchResult);
            
            // Re-normalize score back into UI range safely
            finalMlConfidence = Math.max(0, Math.min(100, Math.round(pytorchResult.confidence_score)));
            deltaConfidence = pytorchResult.delta_score;
        } catch (err) {
            console.error("PyTorch Interface Error:", err);
        }

        const sessionData = {
          questionId: situation?.id,
          scenarioTitle: situation?.text,
          category: situation?.category,
          difficulty: situation?.difficulty,
          stakes: situation?.stakes, 
          avgConfidence: finalMlConfidence,
          minConfidence: minConfidenceRef.current,
          confidenceVariance: varianceRef.current,
          silenceCount: audioMetrics.silenceCount || 0,
          silenceRatio: audioMetrics.silenceRatio || 0,
          duration,
          neverSpoke: !audioMetrics.everSpoke,
          deltaConfidenceVsCasual: deltaConfidence,
          transcript: audioMetrics.everSpoke ? finalTranscript : "", 
          time: new Date().toISOString(),
        };

        fetch(`${ML_BACKEND_URL}/api/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: auth.currentUser?.uid || "guest", 
            question_id: situation?.id || "unknown",
            scenario_title: situation?.title || "Unknown",
            category: situation?.category || "Unknown",
            difficulty: situation?.difficulty || "Unknown",
            duration: duration,
            silence_count: audioMetrics.silenceCount || 0,
            silence_ratio: audioMetrics.silenceRatio || 0,
            eye_contact: cameraEnabled ? (eyeContact || "Unknown") : "Unknown",
            expressiveness: cameraEnabled ? (expressiveness || "Unknown") : "Unknown",
            confidence_score: finalMlConfidence,
            delta_score: deltaConfidence || 0
          })
        }).catch(() => {});

        onFinish(sessionData);
      }

      finalizeSession();
      return;
    }

    if (hasStarted) {
      const t = setTimeout(() => setTimeLeft(v => v - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [timeLeft, hasStarted]);

  const targetConfidenceRef = useRef(35);

  /* ---------- CONFIDENCE ENGINE ---------- */
  useEffect(() => {
    if (!hasStarted) return; 
    if (!lastSpeechTimeRef.current) {
      lastSpeechTimeRef.current = Date.now();
    }

    // Phase 1 Optimization: Disabling legacy 3-second REST polling 
    // to prevent server thread blocking. The UI heuristic will sustain 
    // the visual element while the WebSocket buffers the deep payload.

    const now = Date.now();

    if (audioMetrics.isSpeaking) {
      lastSpeechTimeRef.current = now;
      let score = 50;
      if (audioMetrics.longPauses === 0) score += 20;
      else if (audioMetrics.longPauses < 2) score += 10;

      if (cameraEnabled) {
        if (eyeContact === "Good") score += 15;
        else if (eyeContact === "Fair") score += 5;
        if (expressiveness === "Expressive") score += 15;
        else if (expressiveness === "Neutral") score += 5;
      } else {
        score += 30; 
      }
      targetConfidenceRef.current = Math.max(targetConfidenceRef.current, Math.min(100, score));
    } else {
      const silenceDuration = now - lastSpeechTimeRef.current;
      if (silenceDuration > 1500) {
        targetConfidenceRef.current = Math.max(0, targetConfidenceRef.current - 0.8);
      }
    }

    const smoothed = confidenceRef.current + (targetConfidenceRef.current - confidenceRef.current) * 0.08;
    confidenceRef.current = smoothed;
    const rounded = Math.round(smoothed);

    setConfidence(prev => (prev !== rounded ? rounded : prev));
    confidenceSamplesRef.current.push(rounded);
    minConfidenceRef.current = Math.min(minConfidenceRef.current, rounded);
  }, [
    audioMetrics.isSpeaking,
    audioMetrics.longPauses,
    eyeContact,
    expressiveness,
    cameraEnabled,
    timeLeft,
    hasStarted, 
  ]);

  if (!hasStarted) {
    return (
      <div className="speaking-page">
        <Motion.div 
          className="card"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ maxWidth: "500px", textAlign: "center" }}
        >
          <Activity size={48} color="var(--text-primary)" style={{ margin: "0 auto 24px" }} />
          <h1 style={{ marginBottom: "16px", fontSize: "2rem" }}>Ready?</h1>
          <p style={{ marginBottom: "32px", fontSize: "1.1rem" }}>
            "{situation?.text || "Prepare to speak confidently."}"
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setSessionToken(`sess-${Date.now()}`);
              setHasStarted(true);
            }}
            style={{ width: "100%", padding: "16px" }}
          >
            Commence Recording <Mic size={18} style={{ marginLeft: "8px" }} />
          </button>
        </Motion.div>
      </div>
    );
  }

  if (isTranscribing) {
    return (
      <div className="speaking-page">
        <Motion.div 
          className="card"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ maxWidth: "500px", textAlign: "center" }}
        >
          <Motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            style={{ display: "inline-block", marginBottom: "24px" }}
          >
            <Loader2 size={48} color="var(--success)" />
          </Motion.div>
          <h1 style={{ marginBottom: "16px" }}>Analyzing Acoustics</h1>
          <p>Processing pitch variance, speech pacing, and visual expressions...</p>
        </Motion.div>
      </div>
    );
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="speaking-page">
      <Motion.div 
        className="dashboard-layout"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="dashboard-main">
          
          <div className="prompt-card">
            <h2>Current Scenario</h2>
            <p>"{situation?.text || "Speak confidently without stopping."}"</p>
          </div>

          <div className="camera-container">
            {cameraEnabled ? (
              <video ref={videoRef} autoPlay muted playsInline className="camera-feed" />
            ) : (
              <div className="camera-off-state">
                <Video size={48} strokeWidth={1} />
                <p>Telemetry disabled</p>
              </div>
            )}
            
            <Motion.div 
              style={{ position: 'absolute', top: 16, right: 16 }}
              animate={{ opacity: audioMetrics.isSpeaking ? 1 : 0.5 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '99px', backdropFilter: 'blur(4px)' }}>
                 {audioMetrics.isSpeaking ? <Mic size={14} color="var(--success)" /> : <MicOff size={14} color="var(--danger)" />}
                 <span style={{ fontSize: '12px', fontWeight: 600 }}>{audioMetrics.isSpeaking ? "LIVE" : "SILENT"}</span>
              </div>
            </Motion.div>
          </div>

        </div>

        <div className="dashboard-side">
          
          <div className="metrics-panel">
            <div className="metric-header">
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Session Timer</span>
              <div className="timer-pill">
                <Clock size={16} />
                {formatTime(timeLeft)}
              </div>
            </div>

            <div className="confidence-widget">
              <div className="confidence-header">
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Acoustic Confidence</span>
                <span className="confidence-score">{confidence}%</span>
              </div>
              <div className="progress-track">
                <Motion.div 
                  className="progress-fill" 
                  initial={{ width: 0 }}
                  animate={{ width: `${confidence}%` }}
                />
              </div>
            </div>
            
            <div className="signal-list">
               <div className="signal-item">
                 <div className="signal-label"><Activity size={16} /> Audio Flow</div>
                 <div className={`signal-value ${audioMetrics.isSpeaking ? 'positive' : 'negative'}`}>
                   {audioMetrics.isSpeaking ? 'Optimal' : 'Interrupted'}
                 </div>
               </div>

               <div className="signal-item">
                 <div className="signal-label"><Eye size={16} /> Visual Contact</div>
                 <div className={`signal-value ${!cameraEnabled ? 'neutral' : eyeContact === 'Good' ? 'positive' : 'negative'}`}>
                   {!cameraEnabled ? 'Disabled' : eyeContact}
                 </div>
               </div>

               <div className="signal-item">
                 <div className="signal-label"><TrendingUp size={16} /> Expressiveness</div>
                 <div className={`signal-value ${!cameraEnabled ? 'neutral' : expressiveness === 'Expressive' ? 'positive' : 'negative'}`}>
                   {!cameraEnabled ? 'Disabled' : expressiveness || 'Calibrating'}
                 </div>
               </div>
            </div>

            <div className="controls-panel">
               <button 
                 className={`btn ${cameraEnabled ? 'btn-secondary' : 'btn-primary'}`}
                 onClick={() => setCameraEnabled(!cameraEnabled)}
                 title="Toggle Video Telemetry"
               >
                 {cameraEnabled ? <EyeOff size={18} /> : <Eye size={18} />}
                 {cameraEnabled ? "Disable" : "Enable"}
               </button>
               <button 
                 className="btn btn-danger"
                 onClick={() => setTimeLeft(0)}
               >
                 <StopCircle size={18} />
                 End 
               </button>
            </div>
          </div>

        </div>
      </Motion.div>
    </div>
  );
}

export default Speaking;
