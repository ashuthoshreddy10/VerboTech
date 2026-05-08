import { useEffect, useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { QUESTIONS } from "../data/questions";
import { Mic, Clock, ChevronRight } from "lucide-react";

function Situation({ onCountdownComplete }) {
  const [selected, setSelected] = useState(QUESTIONS[0]);
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
  };

  return (
    <div className="situation-page">
      <Motion.div 
        className="situation-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1>Select Scenario</h1>
        <p>Choose your training environment. The acoustic engine will calibrate prior to starting.</p>
      </Motion.div>

      <Motion.div 
        className="scenario-grid"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {QUESTIONS.map((q) => (
          <Motion.div
            key={q.id}
            variants={itemVariants}
            className={`scenario-card ${selected.id === q.id ? "active" : ""}`}
            onClick={() => setSelected(q)}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="scenario-icon">
              <Mic size={20} />
            </div>
            
            <h3>{q.title}</h3>
            <p>{q.text}</p>
            
            <div className="scenario-meta">
              <span><Clock size={14} /> {q.duration}s capture</span>
              {selected.id === q.id && <ChevronRight size={16} color="var(--text-primary)" />}
            </div>
          </Motion.div>
        ))}
      </Motion.div>

      <Motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{ marginTop: "48px", textAlign: "center" }}
      >
        {countdown === null ? (
          <button
            className="btn btn-primary"
            onClick={() => setCountdown(3)}
            style={{ padding: "16px 48px", fontSize: "1.1rem" }}
          >
            Initialize Environment
          </button>
        ) : (
          <div style={{ height: "56px" /* prevent layout shift */ }} /> 
        )}
      </Motion.div>

      <AnimatePresence>
        {countdown !== null && (
          <Motion.div 
            className="countdown-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Motion.div 
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="countdown-number"
            >
              {countdown > 0 ? countdown : "Go"}
            </Motion.div>
            {countdown > 0 && (
              <Motion.div 
                className="countdown-text"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Calibrating microphone array...
              </Motion.div>
            )}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Situation;