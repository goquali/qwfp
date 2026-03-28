interface StatusBadgeProps {
  status: string;
  variant?: "default" | "severity";
}

const colorMap: Record<string, { bg: string; color: string }> = {
  active: { bg: "#dcfce7", color: "#166534" },
  open: { bg: "#dbeafe", color: "#1e40af" },
  approved: { bg: "#dcfce7", color: "#166534" },
  filled: { bg: "#dcfce7", color: "#166534" },
  pending: { bg: "#fef9c3", color: "#854d0e" },
  draft: { bg: "#f3f4f6", color: "#374151" },
  cancelled: { bg: "#fee2e2", color: "#991b1b" },
  closed: { bg: "#f3f4f6", color: "#374151" },
  rejected: { bg: "#fee2e2", color: "#991b1b" },
  critical: { bg: "#fee2e2", color: "#991b1b" },
  warning: { bg: "#fef9c3", color: "#854d0e" },
  info: { bg: "#dbeafe", color: "#1e40af" },
  acknowledged: { bg: "#e0e7ff", color: "#3730a3" },
  resolved: { bg: "#dcfce7", color: "#166534" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const colors = colorMap[status.toLowerCase()] ?? { bg: "#f3f4f6", color: "#374151" };

  return (
    <span
      className="badge"
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "12px",
        fontSize: "13px",
        fontWeight: 500,
        backgroundColor: colors.bg,
        color: colors.color,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}
