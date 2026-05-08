import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { Navigate } from "react-router-dom";

export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsub;
  }, []);

  if (user === undefined) {
    // 🔄 Show minimal loader instead of blank screen
    return <div className="auth-loading">Loading…</div>;
  }

  if (!user) {
    // ❌ Not logged in → force login route
    return <Navigate to="/login" />;
  }

  // ✅ Logged in → show app
  return children;
}