import { useNavigate } from "react-router-dom";

interface UpgradePromptProps {
  feature: string;
  description: string;
  creditsRemaining?: number;
}

export default function UpgradePrompt({ feature, description, creditsRemaining }: UpgradePromptProps) {
  const navigate = useNavigate();
  return (
    <div style={{
      background: "linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)",
      border: "1px solid #c7d2fe",
      borderRadius: 12,
      padding: "20px 24px",
      textAlign: "center",
      maxWidth: 400,
      margin: "16px auto",
    }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>✨</div>
      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{feature}</div>
      <div style={{ fontSize: 13, color: "#5e6278", marginBottom: 12, lineHeight: 1.5 }}>{description}</div>
      {creditsRemaining !== undefined && (
        <div style={{ fontSize: 12, color: "#6366f1", marginBottom: 12 }}>
          {creditsRemaining} credits remaining
        </div>
      )}
      <button
        onClick={() => navigate("/pricing")}
        style={{
          padding: "8px 20px", borderRadius: 8, border: "none",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer",
        }}
      >
        Upgrade to Pro
      </button>
    </div>
  );
}
