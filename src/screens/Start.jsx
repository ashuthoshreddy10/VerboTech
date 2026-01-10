import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../utils/firebase";
import { useNavigate } from "react-router-dom";

function Start() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin");
  const [loading, setLoading] = useState(false);

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
      navigate("/");
    } catch {
      alert("Authentication failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-glass">
        <h1 className="brand">VerboTech</h1>

        <p className="tagline">
          Build confidence in <b>English technical communication</b>
        </p>

        <div className="auth-toggle">
          <button
            className={mode === "signin" ? "active" : ""}
            onClick={() => setMode("signin")}
          >
            Sign In
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            onClick={() => setMode("signup")}
          >
            Sign Up
          </button>
        </div>

        {loading ? (
          <div className="skeleton-btn" />
        ) : (
          <button className="google-btn" onClick={handleGoogleAuth}>
            <span>Continue with Google</span>
          </button>
        )}

        <p className="note center">
          Secure sign-in powered by Google.<br />
          No passwords stored.
        </p>
      </div>
    </div>
  );
}

export default Start;
