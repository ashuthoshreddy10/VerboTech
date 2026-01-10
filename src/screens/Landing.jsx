import { signOut } from "firebase/auth";
import { auth } from "../utils/firebase";

function Landing({ onStart, onViewHistory }) {
  return (
    <div className="landing-page">
      {/* HEADER */}
      <div className="landing-header">
        <div className="brand">VerboTech</div>

        <div className="header-right">
          <button
            className="icon-btn"
            onClick={() => signOut(auth)}
          >
            Logout
          </button>
        </div>
      </div>

      {/* HERO */}
      <div className="landing-hero">
        <h1>
          Speak with <span>Confidence</span>
        </h1>

        <p>
          Practice interviews, presentations, and real-life
          speaking with AI-powered feedback.
        </p>

        <div className="cta-group">
          <button className="primary-cta" onClick={onStart}>
            Start Practice
          </button>

          <button className="ghost-btn" onClick={onViewHistory}>
            View History
          </button>
        </div>
      </div>
    </div>
  );
}

export default Landing;
