import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const PROFILE_KEY = "verbo_profile";

function Profile() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("confidence");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(PROFILE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setName(data.name || "");
        setGoal(data.goal || "confidence");
      } catch {}
    }
  }, []);

  const saveProfile = () => {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({
        name,
        goal,
      })
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="container">
      <h2>Your Profile</h2>

      <p className="subtitle">
        This information stays on your device and helps personalize feedback.
      </p>

      <div style={{ marginTop: "20px", maxWidth: "320px" }}>
        <label>
          <b>Name (optional)</b>
        </label>
        <input
          type="text"
          value={name}
          placeholder="Enter your name"
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", marginTop: "6px", padding: "8px" }}
        />
      </div>

      <div style={{ marginTop: "20px", maxWidth: "320px" }}>
        <label>
          <b>Primary Goal</b>
        </label>
        <select
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          style={{ width: "100%", marginTop: "6px", padding: "8px" }}
        >
          <option value="confidence">Build speaking confidence</option>
          <option value="interviews">Prepare for interviews</option>
          <option value="projects">Explain projects better</option>
          <option value="communication">Improve overall communication</option>
        </select>
      </div>

      <button
        className="primary-btn"
        style={{ marginTop: "24px" }}
        onClick={saveProfile}
      >
        Save Profile
      </button>

      {saved && (
        <p style={{ marginTop: "12px", color: "#5cb85c" }}>
          Profile saved successfully
        </p>
      )}

      <button
        className="secondary-btn"
        style={{ marginTop: "24px" }}
        onClick={() => navigate("/")}
      >
        Back to Home
      </button>
    </div>
  );
}

export default Profile;
