import { useEffect, useState } from "react";

const SITUATIONS = [
  {
    id: "project",
    title: "Project Explanation",
    text: "Explain your project to a senior who is listening silently and taking notes.",
    duration: 90,
  },
  {
    id: "intro",
    title: "Interview Introduction",
    text: "Introduce yourself to an interviewer who is not smiling or reacting.",
    duration: 60,
  },
  {
    id: "concept",
    title: "Technical Concept Explanation",
    text: "Explain a technical concept you know well to someone evaluating your clarity.",
    duration: 120,
  },
];

function Situation({ onCountdownComplete }) {
  const [selected, setSelected] = useState(SITUATIONS[0]);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      onCountdownComplete(selected);
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
        <h1>Select a Speaking Scenario</h1>

        <p className="subtitle">
          Choose a real-life situation and speak continuously without interruption.
        </p>

        <div className="scenario-list">
          {SITUATIONS.map((s) => (
            <div
              key={s.id}
              className={`scenario-card ${
                selected.id === s.id ? "active" : ""
              }`}
              onClick={() => setSelected(s)}
            >
              <div className="scenario-header">
                <h3>{s.title}</h3>
                <span className="duration">{s.duration}s</span>
              </div>

              <p>{s.text}</p>
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
