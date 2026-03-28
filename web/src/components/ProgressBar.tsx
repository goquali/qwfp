interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
}

function getColor(pct: number): string {
  if (pct > 90) return "#ef4444";
  if (pct > 70) return "#eab308";
  return "#22c55e";
}

export default function ProgressBar({ value, max, label }: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = getColor(pct);

  return (
    <div className="progress-bar" style={{ width: "100%" }}>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
          <span>{label}</span>
          <span>{pct.toFixed(0)}%</span>
        </div>
      )}
      <div
        style={{
          height: "8px",
          borderRadius: "4px",
          backgroundColor: "var(--border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: "4px",
            backgroundColor: color,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}
