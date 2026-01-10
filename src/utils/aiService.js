/**
 * AI Service
 * -----------
 * This module handles all AI interactions.
 * The rest of the app NEVER talks to AI directly.
 *
 * AI role:
 * - Reflective coaching
 * - Structured feedback
 * - Prompt suggestions
 *
 * NOT used for:
 * - Scoring
 * - Grammar correction
 * - Accent evaluation
 */

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

/**
 * Generate AI feedback after a speaking session
 */
export async function generateAIFeedback({
  scenarioTitle,
  duration,
  silenceCount,
  confidence,
  userReflection = "",
}) {
  if (!API_KEY) {
    return {
      summary:
        "AI feedback is unavailable right now. You can still improve by practicing consistently.",
      tips: [
        "Focus on structuring your explanation clearly.",
        "Try reducing pauses between ideas.",
      ],
    };
  }

  const prompt = `
You are a communication coach helping engineering students improve verbal confidence.

Context:
- Scenario: ${scenarioTitle}
- Speaking duration: ${duration} seconds
- Long silence count: ${silenceCount}
- Self-rated confidence (1–5): ${confidence}
- User reflection: "${userReflection}"

Instructions:
- Do NOT evaluate grammar or language correctness
- Do NOT give scores
- Focus on confidence, flow, and structure
- Be supportive and practical

Respond in this exact JSON format:
{
  "summary": "2–3 sentence overall reflection",
  "tips": [
    "Actionable improvement tip 1",
    "Actionable improvement tip 2",
    "Optional tip 3"
  ]
}
`;

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    const data = await res.json();

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Attempt to parse JSON safely
    const parsed = JSON.parse(text);

    return {
      summary: parsed.summary || "Good effort. Keep practicing consistently.",
      tips: Array.isArray(parsed.tips) ? parsed.tips : [],
    };
  } catch (err) {
    console.error("AI error:", err);

    return {
      summary:
        "AI feedback could not be generated. Focus on reducing long pauses and maintaining flow.",
      tips: [
        "Try structuring your explanation as problem → solution → result.",
        "Practice speaking continuously even if imperfect.",
      ],
    };
  }
}

/**
 * Generate a new AI practice prompt (optional future use)
 */
export async function generateNextPrompt({ scenarioTitle }) {
  if (!API_KEY) return null;

  const prompt = `
Generate one short speaking practice prompt
based on this scenario: ${scenarioTitle}

Keep it realistic and pressure-based.
`;

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await res.json();
    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text || null
    );
  } catch {
    return null;
  }
}
