import { useEffect, useState } from "react";
import { getSessions } from "../utils/storage";
import { useNavigate } from "react-router-dom";

export default function History() {
  const [sessions, setSessions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const data = getSessions();
    console.log("📦 HISTORY SESSIONS:", data); // ✅ Added log
    setSessions(data);
  }, []);

  const safeAvg = (arr) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  // Group confidence by category
  const grouped = sessions.reduce((acc, s) => {
    if (!s.category) return acc;

    const value = s.avgConfidence ?? s.confidence ?? 0;

    acc[s.category] = acc[s.category] || [];
    acc[s.category].push(value);
    return acc;
  }, {});

  // Example comparison (only if both exist)
  const casualAvg = grouped.casual ? safeAvg(grouped.casual) : null;
  const evalAvg = grouped.self_evaluation
    ? safeAvg(grouped.self_evaluation)
    : null;

  const drop =
    casualAvg !== null && evalAvg !== null ? casualAvg - evalAvg : null;

  return (
    <div className="app-page">
      <div className="app-glass">
        <h1>Practice History & Analytics</h1>

        {sessions.length === 0 ? (
          <p>No practice sessions yet.</p>
        ) : (
          <>
            {sessions
              .slice()
              .reverse()
              .map((s, i) => (
                <div key={i} className="live-confidence">
                  <strong>Session {sessions.length - i}</strong>
                  <ul>
                    <li>
                      Confidence:{" "}
                      {Math.round(s.avgConfidence ?? s.confidence ?? 0)}%
                    </li>
                    <li>Duration: {s.duration}s</li>
                    {s.scenarioTitle && <li>Scenario: {s.scenarioTitle}</li>}
                    <li>Time: {new Date(s.time).toLocaleString()}</li>
                  </ul>
                </div>
              ))}

            <h2>Confidence by Category</h2>
            {Object.entries(grouped).map(([category, values]) => {
              const avgVal = safeAvg(values);
              return (
                <p key={category}>
                  {category}:{" "}
                  {avgVal !== null ? `${Math.round(avgVal)}%` : "N/A"}
                </p>
              );
            })}

            {drop !== null && (
              <p style={{ fontWeight: "bold", marginTop: "1em" }}>
                Confidence drops by {Math.round(drop)}% during self-evaluation
                questions.
              </p>
            )}
          </>
        )}

        {/* Debug / ML export */}
        <button
          onClick={() => {
            navigator.clipboard.writeText(
              JSON.stringify(getSessions(), null, 2)
            );
            alert("Sessions copied to clipboard!");
          }}
        >
          Copy Sessions
        </button>

        <button className="ghost-btn" onClick={() => navigate("/")}>
          Back to Home
        </button>
      </div>
    </div>
  );
}