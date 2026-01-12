import { useEffect, useState } from "react";
import { QUESTIONS } from "../data/questions";

function Situation({ onCountdownComplete }) {
  const [selected, setSelected] = useState(QUESTIONS[0]);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      onCountdownComplete(selected); // ✅ now passing full question object
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((c) => c - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, selected, onCountdownComplete]);

  return (
    <div className="scenario-page">
      <div className="scenario-glass">
        <h1>Select a Question</h1>

        <p className="subtitle">
          Choose a real-life question and speak continuously without interruption.
        </p>

        <div className="scenario-list">
          {QUESTIONS.map((q) => (
            <div
              key={q.id}
              className={`scenario-card ${selected.id === q.id ? "active" : ""}`}
              onClick={() => setSelected(q)}
            >
              <div className="scenario-header">
                <h3>{q.title}</h3>
                <span className="duration">{q.duration}s</span>
              </div>

              <p>{q.text}</p>
            </div>
          ))}
        </div>

        {countdown === null ? (
          <button
            className="primary-cta"
            onClick={() => setCountdown(5)}
          >
            I’m Ready
          </button>
        ) : (
          <div className="countdown-big">{countdown}</div>
        )}

        <p className="note center">
          Speaking will begin automatically after the countdown.
        </p>
      </div>
    </div>
  );
}

export default Situation;