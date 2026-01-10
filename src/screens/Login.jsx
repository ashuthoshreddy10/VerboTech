import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../utils/firebase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/"); // 🔥 redirect into app
    } catch (e) {
      alert("Login failed");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-glass">
        <h1 className="brand">VerboTech</h1>

        <p className="tagline">
          Train your speaking confidence with AI.
          <br />
          Built for interviews, presentations, and real life.
        </p>

        <button className="google-btn" onClick={handleLogin}>
          Continue with Google
        </button>

        <p className="note" style={{ marginTop: 18 }}>
          Secure login · No passwords · Free to start
        </p>
      </div>
    </div>
  );
}
