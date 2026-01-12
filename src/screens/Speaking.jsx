import { useEffect, useState, useRef } from "react";
import { useAudioAnalyzer } from "../utils/useAudioAnalyzer";
import { useFaceAnalyzer } from "../utils/useFaceAnalyzer";
import { getBaselineConfidence } from "../utils/storage"; // ✅ baseline import

function Speaking({ situation, onFinish }) {
  // ✅ Step 1: derive duration from situation
  const duration = situation?.duration ?? 90;

  const [timeLeft, setTimeLeft] = useState(duration);
  const [confidence, setConfidence] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  const audioMetrics = useAudioAnalyzer();
  const { eyeContact, expressiveness, videoRef } =
    useFaceAnalyzer(cameraEnabled);

  const confidenceRef = useRef(35);
  const lastSpeechTimeRef = useRef(Date.now());

  // --- Phase-2 additions ---
  const confidenceSamplesRef = useRef([]);
  const minConfidenceRef = useRef(100);
  const varianceRef = useRef(0);

  /* ---------- TIMER ---------- */
  useEffect(() => {
    if (timeLeft <= 0) {
      // compute variance at end of session
      const samples = confidenceSamplesRef.current;
      let variance = 0;

      if (samples.length > 0) {
        const mean =
          samples.reduce((a, b) => a + b, 0) / samples.length;
        variance =
          samples.reduce((a, b) => a + (b - mean) ** 2, 0) /
          samples.length;
      }

      varianceRef.current = variance;

      const finalConfidence = Math.max(
        20,
        Math.round(confidenceRef.current)
      );

      const baseline = getBaselineConfidence();
      let deltaConfidence = null;
      if (baseline !== null) {
        deltaConfidence = confidence - baseline;
      }

      const sessionData = {
        // --- Question context ---
        questionId: situation?.id,
        scenarioTitle: situation?.title,
        category: situation?.category,
        difficulty: situation?.difficulty,
        stakes: situation?.stakes,

        // --- Behavioral confidence ---
        avgConfidence: confidence,
        minConfidence: minConfidenceRef.current,
        confidenceVariance: varianceRef.current,

        // --- Speech dynamics ---
        silenceCount: audioMetrics.silenceCount || 0,
        silenceRatio: audioMetrics.silenceRatio || 0,

        // ✅ Step 3: correct duration saved
        duration,

        neverSpoke: !audioMetrics.everSpoke,

        // --- Delta features ---
        deltaConfidenceVsCasual: deltaConfidence,

        // --- Timestamp ---
        time: new Date().toISOString(),
      };

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
        targetScore = Math.max(
          0,
          confidenceRef.current - 0.4
        );
      }
    }

    const smoothed =
      confidenceRef.current +
      (targetScore - confidenceRef.current) * 0.08;

    confidenceRef.current = smoothed;
    const rounded = Math.round(smoothed);

    setConfidence(prev =>
      prev !== rounded ? rounded : prev
    );

    confidenceSamplesRef.current.push(rounded);
    minConfidenceRef.current = Math.min(
      minConfidenceRef.current,
      rounded
    );
  }, [
    audioMetrics.isSpeaking,
    audioMetrics.longPauses,
    eyeContact,
    expressiveness,
    cameraEnabled,
  ]);

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
