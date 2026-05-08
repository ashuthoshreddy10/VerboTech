import { motion as Motion } from "framer-motion";
import { ArrowRight, Activity, ShieldCheck, Zap, LogOut } from "lucide-react";
import { auth } from "../utils/firebase";
import { signOut } from "firebase/auth";

function Landing({ onStart, onViewHistory }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { staggerChildren: 0.1, delayChildren: 0.2 } 
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="landing-page">
      {/* GLOW EFFECT */}
      <div className="hero-glow" />

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="brand">
          <Activity size={24} color="var(--text-primary)" />
          VerboTech
        </div>
        <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <a href="#" onClick={onViewHistory}>History</a>
          <button 
            className="btn btn-secondary" 
            onClick={handleSignOut} 
            style={{ padding: "8px 16px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px", border: "1px solid var(--border-light)", background: "var(--bg-dark)" }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <main className="hero-section">
        <Motion.div 
          className="hero-content"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <Motion.div variants={itemVariants} className="hero-badge">
            <Zap size={14} color="var(--success)" />
            Acoustic AI Engine 2.0 now live
          </Motion.div>
          
          <Motion.h1 variants={itemVariants}>
            Master Communication with <br />
            <span style={{ color: "var(--text-secondary)" }}>Clinical Precision.</span>
          </Motion.h1>
          
          <Motion.p variants={itemVariants}>
            Train your speaking skills against real-world scenarios. Our acoustic ML models dissect your pitch variance, speaking rate, and visual expressiveness to provide absolute ground-truth feedback.
          </Motion.p>
          
          <Motion.div variants={itemVariants} className="hero-ctas">
            <button className="btn btn-primary" onClick={onStart}>
              Start Session <ArrowRight size={18} />
            </button>
            <button className="btn btn-secondary" onClick={onViewHistory}>
              View Metrics
            </button>
          </Motion.div>
        </Motion.div>
      </main>
    </div>
  );
}

export default Landing;
