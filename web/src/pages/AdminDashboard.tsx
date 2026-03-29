import { useApi } from "../hooks/useApi";
import ProgressBar from "../components/ProgressBar";
import MoneyDisplay from "../components/MoneyDisplay";
import StatusBadge from "../components/StatusBadge";

interface RevenueSummary {
  totalCustomers: number;
  totalMRR: number;
  totalARR: number;
  tierCounts: Record<string, number>;
  totalCreditsUsed: number;
  totalCreditsIncluded: number;
  creditUtilization: string;
  subscriptions: SubscriptionRow[];
}

interface SubscriptionRow {
  id: string;
  organizationId?: string;
  organizationName?: string;
  tier: string;
  status: string;
  creditsUsed: number;
  creditsIncluded: number;
}

interface UsageStats {
  creditsUsed: number;
  creditsRemaining: number;
  creditsIncluded: number;
  tier: string;
  usageByAction: Record<string, number>;
}

const TIER_ORDER: Record<string, number> = {
  enterprise: 0,
  pro: 1,
  essentials: 2,
  free: 3,
};

const TIER_COLORS: Record<string, { bg: string; color: string; bar: string }> = {
  free: { bg: "#f3f4f6", color: "#374151", bar: "#9ca3af" },
  essentials: { bg: "#dbeafe", color: "#1e40af", bar: "#3b82f6" },
  pro: { bg: "#e0e7ff", color: "#3730a3", bar: "#6366f1" },
  enterprise: { bg: "#f3e8ff", color: "#6b21a8", bar: "#8b5cf6" },
};

const ACTION_LABELS: Record<string, string> = {
  feasibility_check: "Feasibility checks",
  copilot_query: "Copilot queries",
  scenario_run: "Scenario runs",
  amendment_draft: "Amendment drafts",
  smart_recommendation: "Smart recommendations",
  predictive_alert: "Predictive alerts",
};

function TierBadge({ tier }: { tier: string }) {
  const colors = TIER_COLORS[tier.toLowerCase()] ?? TIER_COLORS.free;
  return (
    <span
      className="badge"
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 500,
        backgroundColor: colors.bg,
        color: colors.color,
        textTransform: "capitalize",
      }}
    >
      {tier}
    </span>
  );
}

export default function AdminDashboard() {
  const { data: revenue, loading: revLoading, error: revError } = useApi<RevenueSummary>("/billing/revenue");
  const { data: usage, loading: usageLoading } = useApi<UsageStats>("/billing/usage");

  const loading = revLoading || usageLoading;

  if (loading) {
    return <div className="loading">Loading admin dashboard...</div>;
  }

  if (revError) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
        <p style={{ fontSize: 16, marginBottom: 8 }}>Could not load billing data.</p>
        <p style={{ fontSize: 14 }}>{revError}</p>
      </div>
    );
  }

  const mrr = revenue?.totalMRR ?? 0;
  const arr = revenue?.totalARR ?? (mrr * 12);
  const totalCustomers = revenue?.totalCustomers ?? 0;
  const utilPct = revenue?.creditUtilization
    ? parseFloat(revenue.creditUtilization)
    : revenue?.totalCreditsIncluded
      ? (revenue.totalCreditsUsed / revenue.totalCreditsIncluded) * 100
      : 0;

  const tierCounts = revenue?.tierCounts ?? {};
  const maxTierCount = Math.max(...Object.values(tierCounts), 1);

  const subscriptions = [...(revenue?.subscriptions ?? [])].sort(
    (a, b) => (TIER_ORDER[a.tier.toLowerCase()] ?? 99) - (TIER_ORDER[b.tier.toLowerCase()] ?? 99)
  );

  const usageByAction = usage?.usageByAction ?? {};
  const maxActionUsage = Math.max(...Object.values(usageByAction), 1);

  const hasCustomers = totalCustomers > 0;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 style={{
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          Admin Dashboard
        </h1>
        <p>Revenue, customers, and AI usage</p>
      </div>

      {/* Stats Row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Monthly Recurring Revenue</div>
          <div className="stat-value">
            <MoneyDisplay amount={mrr} />
          </div>
          <div className="stat-sub">per month</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Annual Recurring Revenue</div>
          <div className="stat-value">
            <MoneyDisplay amount={arr} />
          </div>
          <div className="stat-sub">projected yearly</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Customers</div>
          <div className="stat-value">{totalCustomers}</div>
          <div className="stat-sub">active subscriptions</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Credit Utilization</div>
          <div className="stat-value">{utilPct.toFixed(0)}%</div>
          <div style={{ marginTop: 8 }}>
            <ProgressBar value={utilPct} max={100} />
          </div>
        </div>
      </div>

      {!hasCustomers && (
        <div className="card" style={{ textAlign: "center", padding: 48, marginBottom: 24 }}>
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No customers yet</p>
          <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
            Once organizations subscribe, their data will appear here.
          </p>
          <a href="/pricing" className="btn btn-primary">View Pricing Plans</a>
        </div>
      )}

      {/* Tier Distribution */}
      {hasCustomers && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">Tier Distribution</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {["free", "essentials", "pro", "enterprise"].map((tier) => {
              const count = tierCounts[tier] ?? 0;
              const widthPct = maxTierCount > 0 ? (count / maxTierCount) * 100 : 0;
              const colors = TIER_COLORS[tier] ?? TIER_COLORS.free;
              return (
                <div key={tier} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{
                    width: 90,
                    fontSize: 14,
                    fontWeight: 500,
                    textTransform: "capitalize",
                    color: colors.color,
                    flexShrink: 0,
                  }}>
                    {tier}
                  </span>
                  <div style={{ flex: 1, height: 24, background: "#f3f4f6", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.max(widthPct, count > 0 ? 4 : 0)}%`,
                      background: colors.bar,
                      borderRadius: 6,
                      transition: "width 0.3s ease",
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 8,
                    }}>
                      {widthPct > 15 && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{count}</span>
                      )}
                    </div>
                  </div>
                  {widthPct <= 15 && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", width: 28 }}>
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Customer Table */}
      {hasCustomers && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">Customers</div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Tier</th>
                  <th>Credits Used</th>
                  <th>Credits Included</th>
                  <th style={{ width: 160 }}>Utilization</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => {
                  const utilization = sub.creditsIncluded > 0
                    ? (sub.creditsUsed / sub.creditsIncluded) * 100
                    : 0;
                  return (
                    <tr key={sub.id}>
                      <td style={{ fontWeight: 500 }}>
                        {sub.organizationName || sub.organizationId || sub.id}
                      </td>
                      <td><TierBadge tier={sub.tier} /></td>
                      <td className="money">{sub.creditsUsed.toLocaleString()}</td>
                      <td className="money">{sub.creditsIncluded.toLocaleString()}</td>
                      <td>
                        <ProgressBar value={sub.creditsUsed} max={sub.creditsIncluded} />
                      </td>
                      <td><StatusBadge status={sub.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Usage Breakdown */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">AI Credit Usage by Feature</div>
        {Object.keys(usageByAction).length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No usage data available yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Object.entries(ACTION_LABELS).map(([key, label]) => {
              const count = usageByAction[key] ?? 0;
              const widthPct = maxActionUsage > 0 ? (count / maxActionUsage) * 100 : 0;
              const isFree = key === "predictive_alert";
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{
                    width: 180,
                    fontSize: 14,
                    color: "var(--text)",
                    flexShrink: 0,
                  }}>
                    {label}
                  </span>
                  <div style={{ flex: 1, height: 20, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.max(widthPct, count > 0 ? 3 : 0)}%`,
                      background: isFree
                        ? "linear-gradient(90deg, #22c55e, #16a34a)"
                        : "linear-gradient(90deg, #6366f1, #8b5cf6)",
                      borderRadius: 4,
                      transition: "width 0.3s ease",
                    }} />
                  </div>
                  <span style={{
                    width: 80,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textAlign: "right",
                    flexShrink: 0,
                  }}>
                    {count.toLocaleString()} {isFree ? "(free)" : "credits"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
