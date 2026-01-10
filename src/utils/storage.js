import { auth } from "./firebase";

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

export function saveSession(session) {
  const STORAGE_KEY = getStorageKey();

  const existingRaw = localStorage.getItem(STORAGE_KEY);
  const existing = Array.isArray(safeParse(existingRaw))
    ? safeParse(existingRaw)
    : [];

  const sanitizedSession = {
    confidence: Number(session.confidence) || 0,
    silenceCount: Number(session.silenceCount) || 0,
    neverSpoke: Boolean(session.neverSpoke),
    scenarioId: session.scenarioId || "",
    scenarioTitle: session.scenarioTitle || "",
    duration: Number(session.duration) || 0,
    time: new Date().toISOString(),
  };

  existing.push(sanitizedSession);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function getSessions() {
  const STORAGE_KEY = getStorageKey();
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = safeParse(raw);
  return Array.isArray(parsed) ? parsed : [];
}
