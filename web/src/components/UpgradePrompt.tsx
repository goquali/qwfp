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
      background: "#DEE7DE",
      border: "1px solid #E4E7E4",
      borderRadius: 6,
      padding: "20px 24px",
      textAlign: "center",
      maxWidth: 400,
      margin: "16px auto",
    }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>✨</div>
      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{feature}</div>
      <div style={{ fontSize: 13, color: "#5e6278", marginBottom: 12, lineHeight: 1.5 }}>{description}</div>
      {creditsRemaining !== undefined && (
        <div style={{ fontSize: 12, color: "#22A652", marginBottom: 12 }}>
          {creditsRemaining} credits remaining
        </div>
      )}
      <button
        onClick={() => navigate("/pricing")}
        style={{
          padding: "8px 20px", borderRadius: 4, border: "none",
          background: "#232A23",
          color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer",
        }}
      >
        Upgrade to Pro
      </button>
    </div>
  );
}
