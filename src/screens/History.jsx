import { useEffect, useState } from "react";
import { getSessions } from "../utils/storage";
import { useNavigate } from "react-router-dom";

export default function History() {
  const [sessions, setSessions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    setSessions(getSessions());
  }, []);

  return (
    <div className="app-page">
      <div className="app-glass">
        <h1>Practice History & Analytics</h1>

        {sessions.length === 0 ? (
          <p>No practice sessions yet.</p>
        ) : (
          sessions
            .slice()
            .reverse()
            .map((s, i) => (
              <div key={i} className="live-confidence">
                <strong>Session {sessions.length - i}</strong>
                <ul>
                  <li>Confidence: {s.confidence}%</li>
                  <li>Duration: {s.duration}s</li>
                  {s.scenarioTitle && (
                    <li>Scenario: {s.scenarioTitle}</li>
                  )}
                  <li>
                    Time: {new Date(s.time).toLocaleString()}
                  </li>
                </ul>
              </div>
            ))
        )}

        <button className="ghost-btn" onClick={() => navigate("/")}>
          Back to Home
        </button>
      </div>
    </div>
  );
}
