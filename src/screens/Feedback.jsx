import { useState } from "react";
import { saveSession } from "../utils/storage";

/* ---------------- GROQ CONFIG ---------------- */

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

/* ---------------- CONFIDENCE ANALYSIS ---------------- */

/**
 * Returns an array of confidence signals instead of one label
 */
function analyzeConfidence(result, selfConfidence) {
  const signals = [];

  if (result.neverSpoke) {
    signals.push("freeze");
    return signals;
  }

  if (result.silenceRatio > 0.45) {
    signals.push("high_hesitation");
  }

  if (result.eyeContactRatio < 0.4) {
    signals.push("low_eye_contact");
  }

  if (result.headMovementRatio > 0.35) {
    signals.push("nervous_movement");
  }

  if (result.volumeVariance < 0.0004) {
    signals.push("low_vocal_expressiveness");
  }

  if (
    result.speechBursts >= 12 &&
    result.eyeContactRatio >= 0.6 &&
    selfConfidence >= 4
  ) {
    signals.push("strong_fluency");
  }

  if (signals.length === 0) {
    signals.push("moderate_confidence");
  }

  return signals;
}

/* ---------------- AI FEEDBACK ---------------- */

async function getAIFeedback({ result, signals, selfConfidence }) {
  if (!GROQ_API_KEY) return null;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content:
              "You are a speaking confidence coach. You analyze behavioral and delivery cues, not grammar.",
          },
          {
            role: "user",
            content: `
Speaking behavior summary:

Detected confidence signals:
${signals.map((s) => `- ${s}`).join("\n")}

Metrics:
- Silence ratio: ${result.silenceRatio.toFixed(2)}
- Speech bursts: ${result.speechBursts}
- Volume variance: ${result.volumeVariance.toFixed(4)}
- Eye contact ratio: ${result.eyeContactRatio.toFixed(2)}
- Head movement ratio: ${result.headMovementRatio.toFixed(2)}
- Self-rated confidence: ${selfConfidence}/5

Task:
Explain what these signals say about the user's confidence.
Then give ONE concrete improvement action.

Rules:
- Do NOT ask questions
- Do NOT correct grammar
- Max 3 short sentences
- Be direct and practical
`,
          },
        ],
        temperature: 0.55,
        max_tokens: 140,
      }),
    });

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error("Groq error:", err);
    return null;
  }
}

/* ---------------- COMPONENT ---------------- */

function Feedback({ result, situation, onRetry, onViewHistory, liveConfidenceRef }) {
  const [confidence, setConfidence] = useState(3);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  const signals = analyzeConfidence(result, confidence);

  /* -------- AI Handler -------- */

  const handleGetFeedback = async () => {
    setLoading(true);

    const feedback = await getAIFeedback({
      result,
      signals,
      selfConfidence: confidence,
    });

    setAiFeedback(
      feedback ||
        "Your confidence was affected by hesitation and limited expressiveness. Focus on steady eye contact and completing one idea fully before pausing."
    );

    setLoading(false);
  };

  /* -------- Save Session -------- */

  const saveAndRetry = () => {
    saveSession({
      scenarioTitle: situation?.title || "Unknown scenario",
      confidence: confidence,                 // self-reported
      finalConfidence: result.finalConfidence, // ✅ real score
      silenceCount: result.silenceCount,
      duration: result.duration,
      time: new Date().toISOString(),
    });

    onRetry();
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="feedback-page">
      <div className="feedback-glass">
        <h1>Session Feedback</h1>

        <p className="feedback-message">
          Feedback is based on how you spoke and behaved — not what you said.
        </p>

        {/* Confidence slider */}
        <div className="confidence-block">
          <p>How confident did you feel?</p>
          <input
            type="range"
            min="1"
            max="5"
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
          />
          <span>{confidence}/5</span>
        </div>

        {/* Confidence breakdown */}
        <div className="breakdown-block">
          <h3>Confidence Signals Detected</h3>
          <ul>
            {signals.map((s, i) => (
              <li key={i}>
                {s.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        </div>

        {/* AI feedback */}
        <div className="ai-block">
          <h3>AI Confidence Feedback</h3>

          {aiFeedback ? (
            <p className="ai-text">{aiFeedback}</p>
          ) : (
            <button
              className="primary-cta"
              onClick={handleGetFeedback}
              disabled={loading}
            >
              {loading ? "Analyzing…" : "Get Feedback"}
            </button>
          )}
        </div>

        <div className="feedback-actions">
          <button className="primary-cta" onClick={saveAndRetry}>
            Try Again
          </button>
          <button className="ghost-btn" onClick={onViewHistory}>
            View History
          </button>
        </div>
      </div>
    </div>
  );
}

export default Feedback;