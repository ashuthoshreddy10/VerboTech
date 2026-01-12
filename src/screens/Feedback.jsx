import { useState, useMemo } from "react";
import { saveSession } from "../utils/storage";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

/* ---------------- SIGNAL DERIVATION ---------------- */

function deriveSignals({ finalConfidence, silenceCount, neverSpoke }) {
  if (neverSpoke) return ["freeze"];

  const signals = [];

  if (finalConfidence < 35) signals.push("low_composure");
  else if (finalConfidence < 65) signals.push("moderate_stability");
  else signals.push("strong_presence");

  if (silenceCount >= 4) signals.push("frequent_pauses");

  return signals.length ? signals : ["neutral_delivery"];
}

/* ---------------- AI FEEDBACK ---------------- */

async function getAIFeedback({ signals, finalConfidence, selfConfidence }) {
  if (!GROQ_API_KEY) return null;

  try {
    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          temperature: 0.5,
          max_tokens: 120,
          messages: [
            {
              role: "system",
              content:
                "You are a speaking confidence coach. Focus on composure and delivery, not grammar.",
            },
            {
              role: "user",
              content: `
Signals:
${signals.map((s) => `- ${s}`).join("\n")}

Metrics:
- Confidence: ${finalConfidence}/100
- Self rating: ${selfConfidence}/5

Give ONE improvement action.
Max 3 sentences.
`,
            },
          ],
        }),
      }
    );

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

/* ---------------- COMPONENT ---------------- */

function Feedback({ result, situation, onRetry, onViewHistory }) {
  const [selfConfidence, setSelfConfidence] = useState(3);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!result) {
    return (
      <div className="feedback-page">
        <div className="feedback-glass">
          <p>Session data missing.</p>
          <button className="primary-cta" onClick={onRetry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const signals = useMemo(
    () =>
      deriveSignals({
        finalConfidence: result.finalConfidence,
        silenceCount: result.silenceCount,
        neverSpoke: result.neverSpoke,
      }),
    [result]
  );

  /* -------- AI -------- */

  const handleGetFeedback = async () => {
    setLoading(true);

    const feedback = await getAIFeedback({
      signals,
      finalConfidence: result.finalConfidence,
      selfConfidence,
    });

    setAiFeedback(feedback);
    setLoading(false);
  };

  /* -------- SAVE -------- */

  const handleSaveAndRetry = () => {
    saveSession({
      ...result,
      selfConfidence,
    });

    onRetry();
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="feedback-page">
      <div className="feedback-glass">
        <h1>Session Feedback</h1>

        <div className="confidence-block">
          <p>How confident did you feel?</p>
          <input
            type="range"
            min="1"
            max="5"
            value={selfConfidence}
            onChange={(e) => setSelfConfidence(Number(e.target.value))}
          />
          <span>{selfConfidence}/5</span>
        </div>

        <div className="breakdown-block">
          <h3>Confidence Signals</h3>
          <ul>
            {signals.map((s) => (
              <li key={s}>{s.replaceAll("_", " ")}</li>
            ))}
          </ul>
        </div>

        <div className="ai-block">
          <h3>AI Feedback</h3>

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
          <button className="primary-cta" onClick={handleSaveAndRetry}>
            Try Again
          </button>
          <button
            className="ghost-btn"
            onClick={() => {
              saveSession({
                ...result,
                selfConfidence,
              });
              onViewHistory();
            }}
          >
            View History
          </button>
        </div>
      </div>
    </div>
  );
}

export default Feedback;