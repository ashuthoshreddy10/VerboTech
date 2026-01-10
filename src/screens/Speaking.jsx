import { useEffect, useState, useRef } from "react";
import { useAudioAnalyzer } from "../utils/useAudioAnalyzer";
import { useFaceAnalyzer } from "../utils/useFaceAnalyzer";
import { saveSession } from "../utils/storage";

function Speaking({ situation, duration = 90, onFinish }) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [confidence, setConfidence] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  const audioMetrics = useAudioAnalyzer();
  const { eyeContact, expressiveness, videoRef } =
    useFaceAnalyzer(cameraEnabled);

  const confidenceRef = useRef(35);
  const lastSpeechTimeRef = useRef(Date.now());

  /* ---------- TIMER ---------- */
  useEffect(() => {
    if (timeLeft <= 0) {
      const sessionData = {
        confidence,
        silenceCount: audioMetrics.silenceCount || 0,
        duration,
        scenarioId: situation?.id || "",
        scenarioTitle: situation?.title || situation?.text || "",
        neverSpoke: !audioMetrics.everSpoke,
      };

      saveSession(sessionData);
      onFinish(sessionData);
      return;
    }

    const t = setTimeout(() => setTimeLeft(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  /* ---------- CONFIDENCE ENGINE ---------- */
  useEffect(() => {
    let targetScore = confidenceRef.current;
    const now = Date.now();

    if (audioMetrics.isSpeaking) {
      lastSpeechTimeRef.current = now;

      let score = 30;
      if (audioMetrics.longPauses === 0) score += 15;

      if (cameraEnabled) {
        if (eyeContact === "Good") score += 15;
        if (expressiveness === "Expressive") score += 15;
      }

      targetScore = Math.min(100, score);
    } else {
      const silenceDuration = now - lastSpeechTimeRef.current;
      if (silenceDuration > 1500) {
        targetScore = Math.max(0, confidenceRef.current - 0.4);
      }
    }

    const smoothed =
      confidenceRef.current +
      (targetScore - confidenceRef.current) * 0.08;

    confidenceRef.current = smoothed;
    setConfidence(Math.round(smoothed));
  }, [audioMetrics, eyeContact, expressiveness, cameraEnabled]);

  return (
    <div className="speaking-wrapper">
      <div className="speaking-stage">
        <h1>Speaking</h1>

        <p className="scenario-text">
          {situation?.text || "Speak confidently without stopping."}
        </p>

        <div className="timer">⏱ {timeLeft}s remaining</div>

        <label className="camera-toggle">
          <input
            type="checkbox"
            checked={cameraEnabled}
            onChange={() => setCameraEnabled(v => !v)}
          />
          Enable Camera Analysis
        </label>

        {cameraEnabled && (
          <div className="camera-box">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="camera-feed"
            />
          </div>
        )}

        {/* LIVE SIGNALS */}
        <div className="signals-card">
          <h3>Live Confidence Signals</h3>
          <div className="signal-chips">
            <span className="chip">
              🗣 Flow: {audioMetrics.isSpeaking ? "Active" : "Silent"}
            </span>
            <span className="chip">
              👀 Eye Contact: {cameraEnabled ? eyeContact || "…" : "Off"}
            </span>
            <span className="chip">
              🙂 Expression: {cameraEnabled ? expressiveness || "…" : "Off"}
            </span>
          </div>
        </div>

        {/* CONFIDENCE BAR */}
        <div className="confidence-meter">
          <div className="confidence-label">
            Confidence Level: {confidence}%
          </div>
          <div className="confidence-bar">
            <div
              className="confidence-fill"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Speaking;
