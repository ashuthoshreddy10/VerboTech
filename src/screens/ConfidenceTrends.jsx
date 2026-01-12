import { Line } from "react-chartjs-2";
import { getSessions } from "../utils/storage";

function ConfidenceTrends() {
  const sessions = getSessions();

  const data = {
    labels: sessions.map((s) =>
      new Date(s.time).toLocaleDateString()
    ),
    datasets: [
      {
        label: "Self Confidence",
        data: sessions.map((s) => s.confidence),
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