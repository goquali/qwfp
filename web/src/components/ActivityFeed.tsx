import { useState, useEffect } from "react";

const MESSAGES = [
  { text: "Reconciliation engine scanned 13 envelopes — all within budget", color: "#22A652" },
  { text: "Auto-feasibility checked 1 change request — fits budget", color: "#22A652" },
  { text: "Budget alert: Infrastructure at 100% headcount capacity", color: "#A6A022" },
  { text: "Pipeline update: 2 positions moved to sourcing this week", color: "#22A652" },
  { text: "TA capacity: 67% recruiter utilization, no gap detected", color: "#22A652" },
  { text: "Envelope snapshot captured for FY26 Q2 planning cycle", color: "#22A652" },
  { text: "New job slot created: Security Engineer (Infrastructure)", color: "#22A652" },
  { text: "Change request from VP Engineering queued for HR review", color: "#A6A022" },
];

function timeAgo(index: number) {
  const seconds = [2, 14, 31, 48, 67, 85, 112, 140];
  const s = seconds[index % seconds.length];
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
}

export default function ActivityFeed() {
  const [visibleMessages, setVisibleMessages] = useState(MESSAGES.slice(0, 4));
  const [counter, setCounter] = useState(4);

  useEffect(() => {
    const interval = setInterval(() => {
      setCounter((prev) => {
        const next = prev + 1;
        const newMsg = MESSAGES[next % MESSAGES.length];
        setVisibleMessages((msgs) => [newMsg, ...msgs.slice(0, 3)]);
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="activity-feed">
      <div className="activity-feed-header">
        <span className="live-dot" />
        System Activity
      </div>
      {visibleMessages.map((msg, i) => (
        <div key={`${counter}-${i}`} className="activity-feed-item">
          <span className="activity-feed-dot" style={{ background: msg.color }} />
          <span style={{ flex: 1 }}>{msg.text}</span>
          <span className="activity-feed-time">{timeAgo(i)}</span>
        </div>
      ))}
    </div>
  );
}
