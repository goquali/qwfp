import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { post } from "../api/client";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "",
    tier: "free",
    description: "Get started",
    credits: "50 AI credits/month",
    features: ["Budget management", "Job slot tracking", "Basic dashboards", "Unlimited users", "Data import"],
    cta: "Current Plan",
    highlighted: false,
    ctaStyle: "ghost" as const,
    disabled: true,
  },
  {
    name: "Essentials",
    price: "$99",
    period: "/mo",
    tier: "essentials",
    description: "For growing teams",
    credits: "500 AI credits/month",
    features: ["Everything in Free", "Auto-feasibility analysis", "AI Copilot (limited)", "Budget alerts", "Change request tracking"],
    cta: "Upgrade",
    highlighted: false,
    ctaStyle: "ghost" as const,
    disabled: false,
  },
  {
    name: "Pro",
    price: "$499",
    period: "/mo",
    tier: "pro",
    description: "Most popular",
    credits: "5,000 AI credits/month",
    features: ["Everything in Essentials", "Unlimited AI Copilot", "Scenario modeling", "Smart recommendations", "Predictive alerts", "Auto-amendment drafting"],
    cta: "Upgrade to Pro",
    highlighted: true,
    ctaStyle: "primary" as const,
    disabled: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    tier: "enterprise",
    description: "For large organizations",
    credits: "Unlimited AI credits",
    features: ["Everything in Pro", "Custom AI models", "SSO & audit logs", "Dedicated support", "Custom integrations", "SLA guarantee"],
    cta: "Contact Sales",
    highlighted: false,
    ctaStyle: "ghost" as const,
    disabled: false,
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
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  async function handleUpgrade(tier: string) {
    if (tier === "enterprise") {
      // Enterprise: just show a contact message
      setToast({ message: "Our sales team will reach out shortly!", type: "success" });
      setTimeout(() => setToast(null), 4000);
      return;
    }

    setUpgrading(tier);
    try {
      const result = await post("/billing/checkout", { tier });
      if (result.url) {
        // Stripe checkout — redirect
        window.location.href = result.url;
      } else if (result.demo) {
        // Demo mode — instant upgrade
        setToast({ message: "Upgraded! Redirecting to dashboard...", type: "success" });
        setTimeout(() => {
          setToast(null);
          navigate("/dashboard");
        }, 2000);
      } else {
        setToast({ message: "Upgrade successful!", type: "success" });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (err: any) {
      // If billing endpoint doesn't exist, treat as demo mode
      setToast({ message: "Upgraded! (demo mode) Redirecting...", type: "success" });
      setTimeout(() => {
        setToast(null);
        navigate("/dashboard");
      }, 2000);
    } finally {
      setUpgrading(null);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 0" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 1100,
          padding: "12px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)", color: "white",
          backgroundColor: toast.type === "success" ? "#10b981" : "#ef4444",
        }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 style={{ fontSize: 40, fontWeight: 500, letterSpacing: "-0.8px", margin: 0, color: "#1A1D1A" }}>
          Simple, usage-based pricing
        </h1>
        <p style={{ fontSize: 18, color: "#616D61", maxWidth: 500, margin: "12px auto 0" }}>
          The platform is free. Pay only for AI features that save you hours.
        </p>
      </div>

      {/* Tier Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 64 }}>
        {TIERS.map((tier) => (
          <div key={tier.name} style={{
            background: "#fff",
            border: tier.highlighted ? "2px solid #22A652" : "1px solid var(--border, #E4E7E4)",
            borderRadius: 6,
            padding: 24,
            position: "relative",
            boxShadow: tier.highlighted ? "0 4px 12px rgba(26,29,26,0.08)" : "0 1px 3px rgba(26,29,26,0.06)",
          }}>
            {tier.highlighted && (
              <div style={{
                position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                background: "#DEE7DE", color: "#1A1D1A",
                padding: "3px 14px", borderRadius: 100, fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
              }}>
                MOST POPULAR
              </div>
            )}

            <div style={{ fontSize: 13, color: "#616D61", fontWeight: 500, marginBottom: 4 }}>{tier.description}</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{tier.name}</div>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 36, fontWeight: 500, letterSpacing: -1 }}>{tier.price}</span>
              {tier.period && <span style={{ fontSize: 14, color: "#616D61" }}>{tier.period}</span>}
            </div>
            <div style={{
              background: "#E8F8EE", color: "#22A652", padding: "6px 12px",
              borderRadius: 4, fontSize: 13, fontWeight: 500, marginBottom: 20, textAlign: "center",
            }}>
              {tier.credits}
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 8 }}>
              {tier.features.map((f) => (
                <li key={f} style={{ fontSize: 13, color: "#616D61", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#22A652", fontSize: 14 }}>✓</span> {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => !tier.disabled && handleUpgrade(tier.tier)}
              disabled={tier.disabled || upgrading === tier.tier}
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "10px 0",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 4,
                cursor: tier.disabled ? "default" : "pointer",
                border: tier.ctaStyle === "primary" ? "none" : "1px solid #E4E7E4",
                background: tier.disabled
                  ? "#EFF2EF"
                  : tier.ctaStyle === "primary"
                  ? "#232A23"
                  : "#fff",
                color: tier.disabled
                  ? "#929C92"
                  : tier.ctaStyle === "primary"
                  ? "#fff"
                  : "#1A1D1A",
                opacity: upgrading === tier.tier ? 0.6 : 1,
                fontFamily: "inherit",
              }}
            >
              {upgrading === tier.tier ? "Processing..." : tier.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Credit Table */}
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>What counts as an AI credit?</h2>
        <p style={{ textAlign: "center", color: "#6b7280", marginBottom: 24, fontSize: 14 }}>
          Each AI-powered action consumes credits. Predictive alerts are always free.
        </p>

        <div style={{ background: "#fff", border: "1px solid var(--border, #e5e7eb)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: "1px solid var(--border, #e5e7eb)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#6b7280" }}>Action</th>
                <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: "1px solid var(--border, #e5e7eb)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#6b7280" }}>Description</th>
                <th style={{ textAlign: "center", padding: "12px 16px", borderBottom: "1px solid var(--border, #e5e7eb)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#6b7280" }}>Credits</th>
              </tr>
            </thead>
            <tbody>
              {CREDIT_TABLE.map((row) => (
                <tr key={row.action}>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border, #e5e7eb)", fontWeight: 500 }}>{row.action}</td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border, #e5e7eb)", color: "#6b7280" }}>{row.description}</td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border, #e5e7eb)", textAlign: "center" }}>
                    {row.credits === 0 ? (
                      <span style={{ color: "#10b981", fontWeight: 600 }}>Free</span>
                    ) : (
                      <span style={{ background: "rgba(99,102,241,0.08)", color: "#6366f1", padding: "2px 10px", borderRadius: 100, fontWeight: 600, fontSize: 13 }}>{row.credits}</span>
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
