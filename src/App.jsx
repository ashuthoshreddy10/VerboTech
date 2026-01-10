import { Routes, Route } from "react-router-dom";

import Landing from "./screens/Landing";
import Situation from "./screens/Situation";
import Speaking from "./screens/Speaking";
import Feedback from "./screens/Feedback";
import History from "./screens/History";
import Login from "./screens/Login";

import AuthGate from "./utils/AuthGate";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function HomeFlow() {
  const [screen, setScreen] = useState("landing");
  const [result, setResult] = useState(null);
  const [situation, setSituation] = useState(null);
  const navigate = useNavigate();

  if (screen === "landing") {
    return (
      <Landing
        onStart={() => setScreen("situation")}
        onViewHistory={() => navigate("/history")}
      />
    );
  }

  if (screen === "situation") {
    return (
      <Situation
        onCountdownComplete={(selected) => {
          setSituation(selected);
          setScreen("speaking");
        }}
      />
    );
  }

  if (screen === "speaking") {
    return (
      <Speaking
        situation={situation}
        onFinish={(data) => {
          setResult(data);
          setScreen("feedback");
        }}
      />
    );
  }

  if (screen === "feedback") {
    return (
      <Feedback
        result={result}
        onRetry={() => setScreen("situation")}
        onViewHistory={() => navigate("/history")}
      />
    );
  }

  return null;
}

function App() {
  return (
    <Routes>
      {/* 🔐 LOGIN PAGE */}
      <Route path="/login" element={<Login />} />

      {/* 🔒 PROTECTED APP */}
      <Route
        path="/"
        element={
          <AuthGate>
            <HomeFlow />
          </AuthGate>
        }
      />

      <Route
        path="/history"
        element={
          <AuthGate>
            <History />
          </AuthGate>
        }
      />
    </Routes>
  );
}

export default App;
