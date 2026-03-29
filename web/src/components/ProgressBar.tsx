interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  size?: "default" | "thick";
}

function getColor(pct: number): string {
  if (pct > 90) return "linear-gradient(90deg, #E53E3E, #F87171)";
  if (pct > 70) return "linear-gradient(90deg, #F5A623, #FBBF24)";
  return "linear-gradient(90deg, #1DB954, #4ADE80)";
}

export default function ProgressBar({ value, max, label, size = "default" }: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const background = getColor(pct);
  const height = size === "thick" ? 14 : 10;

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
          height: `${height}px`,
          borderRadius: "5px",
          backgroundColor: "var(--border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: "5px",
            background,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}
