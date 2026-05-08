import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { getSessions } from "../utils/storage";

function ConfidenceTrends() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    async function loadSessions() {
      const data = await getSessions();
      setSessions(data);
    }
    loadSessions();
  }, []);

  if (sessions.length === 0) {
    return <div className="container"><h2>Confidence Trends</h2><p>Loading or no data...</p></div>;
  }

  const data = {
    // In ML backend, the timestamp is passed as `time`
    labels: sessions.map((s) =>
      new Date(s.time).toLocaleDateString()
    ),
    datasets: [
      {
        label: "AI Predicted Confidence",
        data: sessions.map((s) => s.avgConfidence ?? s.confidence ?? 0),
        borderColor: "#4A90E2",
        backgroundColor: "rgba(74, 144, 226, 0.2)",
      },
    ],
  };

  return (
    <div className="container">
      <h2>Confidence Trends</h2>
      <Line data={data} />
    </div>
  );
}

export default ConfidenceTrends;