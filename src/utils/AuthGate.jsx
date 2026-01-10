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

  if (user === undefined) return null; // loading

  // ❌ Not logged in → force login route
  if (!user) return <Navigate to="/login" />;

  // ✅ Logged in → show app
  return children;
}
