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
      border: "1px solid #e0e7ff",
      borderRadius: 12,
      padding: 20,
      textAlign: "center",
      maxWidth: 400,
      margin: "16px auto",
    }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>✨</div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{feature}</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
        {description}
      </div>
      {creditsRemaining !== undefined && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          {creditsRemaining} credits remaining this month
        </div>
      )}
      <button
        className="btn btn-primary"
        onClick={() => navigate("/pricing")}
        style={{ fontSize: 13, padding: "8px 20px" }}
      >
        Upgrade to Pro
      </button>
      <div style={{ marginTop: 8 }}>
        <a
          onClick={() => navigate("/pricing")}
          style={{ fontSize: 12, color: "var(--primary)", cursor: "pointer", textDecoration: "none" }}
        >
          View all plans →
        </a>
      </div>
    </div>
  );
}
