import { auth } from "./firebase";

/**
 * Always return a valid storage key
 * (fallback allows debugging even if auth lags)
 */
function getStorageKey() {
  const user = auth.currentUser;
  return user
    ? `confidence_sessions_${user.uid}`
    : "confidence_sessions_guest";
}

function safeParse(data) {
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * SAVE SESSION
 * This MUST be called from Feedback.jsx
 */
export function saveSession(session) {
  console.log("🔥 saveSession CALLED", session);

  if (!session) {
    console.warn("❌ saveSession called with empty data");
    return;
  }

  const STORAGE_KEY = getStorageKey();

  const raw = localStorage.getItem(STORAGE_KEY);
  const existing = Array.isArray(safeParse(raw))
    ? safeParse(raw)
    : [];

  existing.push(session);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

  console.log(
    `✅ Session saved under key: ${STORAGE_KEY}`,
    "Total:",
    existing.length
  );
}

/**
 * GET ALL SESSIONS
 * Always returns an array
 */
export function getSessions() {
  const STORAGE_KEY = getStorageKey();
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = safeParse(raw);

  console.log("📦 HISTORY SESSIONS:", parsed);

  return Array.isArray(parsed) ? parsed : [];
}

/**
 * BASELINE CONFIDENCE (Casual questions)
 */
export function getBaselineConfidence() {
  const sessions = getSessions();

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
