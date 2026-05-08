import { auth } from "./firebase";

const ML_BACKEND_URL = "http://localhost:8000";

function getUserId() {
  const user = auth.currentUser;
  return user ? user.uid : "anonymous_user";
}

/**
 * SAVE SESSION
 * Saves the rich payload (including transcript/feedback) to localStorage for the React UI,
 * while ALSO pinging the Python ML backend for headless training data.
 */
export async function saveSession(session) {
  console.log("🔥 saveSession CALLED", session);
  if (!session) return;

  // 1. Save completely to LocalStorage for the History Screen UI
  try {
    const existing = JSON.parse(localStorage.getItem("confidence_sessions")) || [];
    existing.push(session);
    localStorage.setItem("confidence_sessions", JSON.stringify(existing));
    console.log("✅ Session saved to LocalStorage");
  } catch (err) {
    console.error("❌ Failed to save session to LocalStorage:", err);
  }

  // 2. Ping ML Backend with stripped down training data
  const payload = {
    user_id: getUserId(),
    question_id: session.questionId || "unknown",
    scenario_title: session.scenarioTitle || "Unknown",
    category: session.category || "Unknown",
    difficulty: session.difficulty || "Unknown",
    duration: session.duration || 0,
    silence_count: session.silenceCount || 0,
    silence_ratio: session.silenceRatio || 0,
    confidence_score: session.avgConfidence || 0
  };

  try {
    fetch(`${ML_BACKEND_URL}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(e => console.warn("Failed ML ping (non-fatal)", e));
  } catch (err) {
    console.error("❌ Failed to save session to ML backend:", err);
  }
}

/**
 * GET ALL SESSIONS
 * Fetches the rich UI history straight from the browser's local storage.
 */
export async function getSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem("confidence_sessions")) || [];
    console.log("📦 HISTORY SESSIONS (From LocalStorage):", parsed);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("❌ Failed to parse LocalStorage history:", err);
    return [];
  }
}

/**
 * BASELINE CONFIDENCE (Casual questions)
 */
export async function getBaselineConfidence() {
  const sessions = await getSessions();

  const casual = sessions.filter(
    (s) =>
      s.category === "casual" &&
      typeof s.avgConfidence === "number"
  );

  if (casual.length === 0) return null;

  const sum = casual.reduce(
    (acc, s) => acc + s.avgConfidence,
    0
  );

  return sum / casual.length;
}
