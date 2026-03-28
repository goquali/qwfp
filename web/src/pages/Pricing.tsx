import { useNavigate } from "react-router-dom";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "",
    description: "Get started",
    credits: "50 AI credits/month",
    features: ["Budget management", "Job slot tracking", "Basic dashboards", "Unlimited users", "Data import"],
    cta: "Current Plan",
    highlighted: false,
    ctaStyle: "ghost" as const,
  },
  {
    name: "Essentials",
    price: "$99",
    period: "/mo",
    description: "For growing teams",
    credits: "500 AI credits/month",
    features: ["Everything in Free", "Auto-feasibility analysis", "AI Copilot (limited)", "Budget alerts", "Change request tracking"],
    cta: "Upgrade",
    highlighted: false,
    ctaStyle: "ghost" as const,
  },
  {
    name: "Pro",
    price: "$499",
    period: "/mo",
    description: "Most popular",
    credits: "5,000 AI credits/month",
    features: ["Everything in Essentials", "Unlimited AI Copilot", "Scenario modeling", "Smart recommendations", "Predictive alerts", "Auto-amendment drafting"],
    cta: "Upgrade to Pro",
    highlighted: true,
    ctaStyle: "primary" as const,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations",
    credits: "Unlimited AI credits",
    features: ["Everything in Pro", "Custom AI models", "SSO & audit logs", "Dedicated support", "Custom integrations", "SLA guarantee"],
    cta: "Contact Sales",
    highlighted: false,
    ctaStyle: "ghost" as const,
  },
];

const CREDIT_TABLE = [
  { action: "Feasibility check", description: "Auto-analyzes if a hiring change fits the budget", credits: 2 },
  { action: "Copilot query", description: "Ask AI questions about your hiring data", credits: 1 },
  { action: "Scenario analysis", description: "Model 'what-if' hiring scenarios", credits: 3 },
  { action: "Amendment drafting", description: "Auto-draft budget change requests", credits: 2 },
  { action: "Smart recommendation", description: "AI suggests budget offsets and optimizations", credits: 1 },
  { action: "Predictive alerts", description: "Early warning before budget limits are hit", credits: 0 },
];

export default function Pricing() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 0" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 className="page-header" style={{ fontSize: 36, fontWeight: 700, marginBottom: 8 }}>
          <span style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Simple, usage-based pricing
          </span>
        </h1>
        <p style={{ fontSize: 18, color: "var(--text-muted)", maxWidth: 500, margin: "0 auto" }}>
          The platform is free. Pay only for AI features that save you hours.
        </p>
      </div>

      {/* Tier Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 64 }}>
        {TIERS.map((tier) => (
          <div key={tier.name} style={{
            background: "#fff",
            border: tier.highlighted ? "2px solid var(--primary)" : "1px solid var(--border)",
            borderRadius: 16,
            padding: 24,
            position: "relative",
            boxShadow: tier.highlighted ? "0 8px 24px rgba(99,102,241,0.15)" : "var(--shadow)",
          }}>
            {tier.highlighted && (
              <div style={{
                position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff",
                padding: "3px 14px", borderRadius: 100, fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
              }}>
                RECOMMENDED
              </div>
            )}

            <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>{tier.description}</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{tier.name}</div>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1 }}>{tier.price}</span>
              {tier.period && <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{tier.period}</span>}
            </div>
            <div style={{
              background: "var(--primary-light)", color: "var(--primary)", padding: "6px 12px",
              borderRadius: 8, fontSize: 13, fontWeight: 500, marginBottom: 20, textAlign: "center",
            }}>
              {tier.credits}
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 8 }}>
              {tier.features.map((f) => (
                <li key={f} style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--success)", fontSize: 14 }}>✓</span> {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => tier.name !== "Enterprise" ? navigate("/onboarding") : undefined}
              className={`btn ${tier.ctaStyle === "primary" ? "btn-primary" : "btn-ghost"}`}
              style={{ width: "100%", justifyContent: "center", padding: "10px 0", fontSize: 14 }}
            >
              {tier.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Credit Table */}
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>What counts as an AI credit?</h2>
        <p style={{ textAlign: "center", color: "var(--text-muted)", marginBottom: 24, fontSize: 14 }}>
          Each AI-powered action consumes credits. Predictive alerts are always free.
        </p>

        <div className="card" style={{ borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)" }}>Action</th>
                <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)" }}>Description</th>
                <th style={{ textAlign: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)" }}>Credits</th>
              </tr>
            </thead>
            <tbody>
              {CREDIT_TABLE.map((row) => (
                <tr key={row.action}>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 500 }}>{row.action}</td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>{row.description}</td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", textAlign: "center" }}>
                    {row.credits === 0 ? (
                      <span style={{ color: "var(--success)", fontWeight: 600 }}>Free</span>
                    ) : (
                      <span style={{ background: "var(--primary-light)", color: "var(--primary)", padding: "2px 10px", borderRadius: 100, fontWeight: 600, fontSize: 13 }}>{row.credits}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
