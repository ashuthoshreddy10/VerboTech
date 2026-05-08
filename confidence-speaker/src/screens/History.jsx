import { useEffect, useState } from "react";
import { getSessions } from "../utils/storage";
import { useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { Clock, Activity, TrendingDown, ArrowLeft, Copy, BarChart2, Calendar } from "lucide-react";

export default function History() {
  const [sessions, setSessions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadSessions() {
      const data = await getSessions();
      setSessions(data || []);
    }
    loadSessions();
  }, []);

  const safeAvg = (arr) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const grouped = sessions.reduce((acc, s) => {
    if (!s.category) return acc;
    const value = s.avgConfidence ?? s.confidence ?? 0;
    acc[s.category] = acc[s.category] || [];
    acc[s.category].push(value);
    return acc;
  }, {});

  const casualAvg = grouped.casual ? safeAvg(grouped.casual) : null;
  const evalAvg = grouped.self_evaluation ? safeAvg(grouped.self_evaluation) : null;
  const drop = casualAvg !== null && evalAvg !== null ? casualAvg - evalAvg : null;

  const overallAvg = safeAvg(sessions.map(s => s.avgConfidence ?? s.confidence ?? 0));

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { staggerChildren: 0.1, delayChildren: 0.1 } 
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <div className="app-page" style={{ background: "var(--bg-dark)", minHeight: "100vh", padding: "40px 24px" }}>
      <div className="container" style={{ maxWidth: "1000px", margin: "0 auto" }}>
        
        <Motion.div 
          className="report-header" 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div>
            <h1 style={{ fontSize: "2.5rem", marginBottom: "8px" }}>Analytics & History</h1>
            <p>Review your acoustic performance over time.</p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button className="btn btn-secondary" onClick={() => navigate("/")}>
              <ArrowLeft size={16} /> Dashboard
            </button>
            <button className="btn btn-secondary" onClick={async () => {
              const data = await getSessions();
              navigator.clipboard.writeText(JSON.stringify(data, null, 2));
            }}>
              <Copy size={16} /> Export JSON
            </button>
          </div>
        </Motion.div>

        {sessions.length === 0 ? (
          <Motion.div 
            className="card" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            style={{ textAlign: "center", padding: "64px" }}
          >
            <BarChart2 size={48} color="var(--text-tertiary)" style={{ margin: "0 auto 16px" }} />
            <h2>No Data Available</h2>
            <p style={{ marginTop: "8px" }}>Complete a speaking session to generate analytics.</p>
            <button className="btn btn-primary" style={{ marginTop: "24px" }} onClick={() => navigate("/")}>
              Start Session
            </button>
          </Motion.div>
        ) : (
          <Motion.div variants={containerVariants} initial="hidden" animate="visible">
            
            {/* Top Stats Overview */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "40px" }}>
              <Motion.div variants={itemVariants} className="card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                  <Activity size={18} /> <span>Overall Acoustic Score</span>
                </div>
                <div style={{ fontSize: "3rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                  {overallAvg !== null ? Math.round(overallAvg) : 0}<span style={{ fontSize: "1.5rem", color: "var(--text-tertiary)" }}>/100</span>
                </div>
              </Motion.div>

              <Motion.div variants={itemVariants} className="card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                  <Clock size={18} /> <span>Total Sessions</span>
                </div>
                <div style={{ fontSize: "3rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                  {sessions.length}
                </div>
              </Motion.div>

              {drop !== null && drop > 0 && (
                <Motion.div variants={itemVariants} className="card" style={{ padding: "24px", borderColor: "rgba(255, 107, 107, 0.3)", background: "rgba(255, 107, 107, 0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--danger)", marginBottom: "12px" }}>
                    <TrendingDown size={18} /> <span>Performance Flag</span>
                  </div>
                  <p style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    Pressure drops confidence by <strong style={{ color: "var(--danger)" }}>{Math.round(drop)}%</strong>.
                  </p>
                </Motion.div>
              )}
            </div>

            {/* Session List */}
            <h2 style={{ marginBottom: "20px", fontSize: "1.25rem", color: "var(--text-secondary)" }}>Recent Logs</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {sessions.slice().reverse().map((s, i) => {
                const conf = Math.round(s.avgConfidence ?? s.confidence ?? 0);
                return (
                  <Motion.div 
                    key={i} 
                    variants={itemVariants}
                    className="card" 
                    style={{ padding: "20px 24px", display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "1.1rem" }}>
                          {s.scenarioTitle || `Session ${sessions.length - i}`}
                        </span>
                        <span style={{ fontSize: "0.8rem", padding: "4px 8px", background: "var(--bg-elevated)", borderRadius: "4px", color: "var(--text-tertiary)" }}>
                          {s.category || "General"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "24px", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Calendar size={14} /> {new Date(s.time).toLocaleDateString()}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Clock size={14} /> {s.duration}s</span>
                      </div>
                    </div>
                    
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: conf > 70 ? "var(--success)" : conf > 40 ? "#feca57" : "var(--danger)" }}>
                        {conf}%
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Acoustic Score</div>
                    </div>
                  </Motion.div>
                );
              })}
            </div>

          </Motion.div>
        )}
      </div>
    </div>
  );
}