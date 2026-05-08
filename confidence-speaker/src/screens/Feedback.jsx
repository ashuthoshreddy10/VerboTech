import { useState, useEffect } from "react";
import { motion as Motion } from "framer-motion";
import { saveSession } from "../utils/storage";
import { RotateCcw, BookOpen, Activity, AlertCircle, Mic, ThumbsUp, ThumbsDown, Send, CheckCircle2, Loader2 } from "lucide-react";
import { auth } from "../utils/firebase";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

async function getAIFeedback({ finalConfidence, transcript, questionPrompt }) {
  if (!GROQ_API_KEY) return null;

  const actualSpokenContent = transcript?.trim()
    ? transcript
    : "(No audible speech detected)";

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0.6,
        max_tokens: 250,
        messages: [
          {
            role: "system",
            content: "You are an elite executive communications coach. Analyze the given transcript based on clarity, filler words, and narrative structure. If the transcript is empty but telemetry was flagged, suggest the user check their microphone levels. If the transcript is present, be actionable and precise. Maximum 2 sentences.",
          },
          {
            role: "user",
            content: `Prompt: "${questionPrompt}"\nAcoustic Score: ${finalConfidence}/100\nTranscript: "${actualSpokenContent}"\nProvide actionable critique.`,
          },
        ],
      }),
    });

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

function Feedback({ result, situation, onRetry, onViewHistory }) {
  const [aiFeedback, setAiFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [rating, setRating] = useState(null); // 'good' or 'bad'
  const [userCorrection, setUserCorrection] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const ML_BACKEND_URL = "http://localhost:8000";

  useEffect(() => {
    if (!result) return;

    let isMounted = true;
    (async () => {
      const feedback = await getAIFeedback({
        finalConfidence: result.avgConfidence,
        transcript: result.transcript,
        questionPrompt: situation?.text || "General Speaking",
      });
      if (isMounted) {
        setAiFeedback(feedback || "Unable to acquire AI critique at this time.");
        setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [result, situation]);

  const handleSaveAndRetry = () => {
    saveSession({ ...result, selfConfidence: rating === 'good' ? 8 : 4 });
    onRetry();
  };

  const handleSaveAndExit = () => {
    saveSession({ ...result, selfConfidence: rating === 'good' ? 8 : 4 });
    onViewHistory();
  };

  const handleSubmitDataFlywheel = async () => {
    if (!rating) return;
    setIsSubmittingFeedback(true);
    try {
      await fetch(`${ML_BACKEND_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: result.id || 0,
          user_id: auth.currentUser?.uid || "guest",
          perceived_score: rating === 'good' ? result.avgConfidence : (result.avgConfidence < 50 ? 80 : 20),
          ai_score: result.avgConfidence,
          user_correction: userCorrection
        })
      });
      setFeedbackSubmitted(true);
    } catch (err) {
      console.error("Flywheel ingestion failed:", err);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
  };

  if (!result) {
    return (
      <div className="feedback-page">
        <div className="card" style={{ textAlign: "center", padding: "48px" }}>
          <AlertCircle size={48} color="var(--danger)" style={{ margin: "0 auto 16px" }} />
          <h2>Telemetry Yielded No Data</h2>
          <p style={{ marginTop: "12px", marginBottom: "24px" }}>The acoustic engine failed to compile a session report.</p>
          <button className="btn btn-primary" onClick={onRetry}>Initialize New Session</button>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-page">
      <Motion.div
        className="report-container"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <Motion.div variants={itemVariants} className="report-header">
          <div className="score-hero">
            <span className="label">Composite Acoustic Score</span>
            <div className="value">
              {Math.round(result.avgConfidence)}<span>/100</span>
            </div>
          </div>

          <div className="actions-row">
            <button className="btn btn-secondary" onClick={handleSaveAndRetry}>
              <RotateCcw size={16} /> Re-calibrate
            </button>
            <button className="btn btn-primary" onClick={handleSaveAndExit}>
              <BookOpen size={16} /> Save & Exit
            </button>
          </div>
        </Motion.div>

        <Motion.div variants={itemVariants} className="analysis-grid">

          {/* Transcript Panel */}
          <div className="panel">
            <div className="panel-header">
              <Mic size={18} color="var(--text-secondary)" />
              <h3>Whisper-X Transcription</h3>
            </div>

            <div className="transcript-content">
              {result.transcript ? (
                `"${result.transcript}"`
              ) : (
                <span style={{ fontStyle: "italic", color: "var(--text-tertiary)" }}>
                  No actionable spoken data was captured by the microphone array.
                </span>
              )}
            </div>
          </div>

          {/* AI Critique Panel */}
          <div className="panel">
            <div className="panel-header">
              <Activity size={18} color="var(--success)" />
              <h3>Executive AI Critique</h3>
            </div>

            {loading ? (
              <div>
                <div className="skeleton-line" />
                <div className="skeleton-line" />
                <div className="skeleton-line" />
              </div>
            ) : (
              <p className="ai-feedback-raw">{aiFeedback}</p>
            )}

            <div style={{ marginTop: "32px", borderTop: "1px solid var(--border-light)", paddingTop: "16px" }}>
              <span className="label" style={{ fontSize: "0.85rem", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Telemetry Flags</span>
              <ul style={{ listStyle: "none", marginTop: "12px", fontSize: "0.95rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "8px" }}>
                <li style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Silence Intercalation</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{result.silenceCount} instances</span>
                </li>
                <li style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Variance Volatility</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{result.confidenceVariance?.toFixed(1) || 0}</span>
                </li>
                {result.deltaConfidenceVsCasual !== null && (
                  <li style={{ display: "flex", justifyContent: "space-between", color: result.deltaConfidenceVsCasual >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    <span>Personal Delta</span>
                    <span style={{ fontWeight: 600 }}>{result.deltaConfidenceVsCasual > 0 ? '+' : ''}{result.deltaConfidenceVsCasual.toFixed(1)}%</span>
                  </li>
                )}
              </ul>
            </div>
          </div>

        </Motion.div>

        {/* DATA FLYWHEEL PANEL */}
        <Motion.div variants={itemVariants} className="panel flywheel-panel" style={{ marginTop: "24px", border: "1px solid var(--border-light)", background: "var(--bg-dark)" }}>
          <div className="panel-header">
            <Send size={18} color="var(--text-primary)" />
            <h3>Data Flywheel: Help the AI Improve</h3>
          </div>

          {feedbackSubmitted ? (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <CheckCircle2 size={32} color="var(--success)" style={{ margin: "0 auto 12px" }} />
              <p style={{ color: "var(--text-secondary)" }}>Thank you. Your behavioral session has been queued for re-training.</p>
            </div>
          ) : (
            <div style={{ padding: "10px 0" }}>
              <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
                How accurate was this acoustic analysis for your current state of mind?
              </p>

              <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
                <button
                  className={`btn ${rating === 'good' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setRating('good')}
                  style={{ flex: 1, padding: "12px", gap: "8px" }}
                >
                  <ThumbsUp size={18} /> Accurate
                </button>
                <button
                  className={`btn ${rating === 'bad' ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => setRating('bad')}
                  style={{ flex: 1, padding: "12px", gap: "8px" }}
                >
                  <ThumbsDown size={18} /> Inaccurate
                </button>
              </div>

              {rating === 'bad' && (
                <Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                  <textarea
                    placeholder="Tell the AI what it missed (e.g., 'I was speaking fast on purpose', 'Background noise')"
                    value={userCorrection}
                    onChange={(e) => setUserCorrection(e.target.value)}
                    style={{ width: "100%", background: "var(--bg-black)", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "12px", color: "white", minHeight: "80px", marginBottom: "16px" }}
                  />
                </Motion.div>
              )}

              <button
                className="btn btn-primary"
                onClick={handleSubmitDataFlywheel}
                disabled={!rating || isSubmittingFeedback}
                style={{ width: "100%", opacity: !rating ? 0.5 : 1 }}
              >
                {isSubmittingFeedback ? <Loader2 className="lucide-spin" size={18} /> : "Submit To Training Pipeline"}
              </button>
            </div>
          )}
        </Motion.div>
      </Motion.div>
    </div>
  );
}

export default Feedback;