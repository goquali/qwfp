import { useState, useEffect, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { get, patch } from "../api/client";
import type {
  PlanningCycle,
  BudgetEnvelope,
  EnvelopeUtilization,
  DriftAlert,
  OrgUnit,
} from "../api/types";
import StatusBadge from "../components/StatusBadge";
import ProgressBar from "../components/ProgressBar";
import MoneyDisplay from "../components/MoneyDisplay";

export default function FinanceDashboard() {
  // Welcome banner dismissal
  const [showBanner, setShowBanner] = useState(
    () => localStorage.getItem("qwfp-dismiss-finance") !== "true",
  );

  // Tab state
  const [activeTab, setActiveTab] = useState("budgets");

  // Show all levels toggle
  const [showAllLevels, setShowAllLevels] = useState(false);

  // Step 1: Fetch planning cycles and find the active one
  const { data: cycles, loading: cyclesLoading, error: cyclesError } = useApi<PlanningCycle[]>("/finance/planning-cycles");

  const activeCycle = useMemo(
    () => cycles?.find((c) => c.status === "active") ?? cycles?.[0] ?? null,
    [cycles],
  );

  // Step 2: Fetch envelopes for the active cycle
  const {
    data: envelopes,
    loading: envelopesLoading,
    error: envelopesError,
  } = useApi<BudgetEnvelope[]>(
    activeCycle ? `/finance/planning-cycles/${activeCycle.id}/envelopes` : null,
  );

  // Step 3: Batch-fetch utilization for each envelope
  const [utilizationMap, setUtilizationMap] = useState<Record<string, EnvelopeUtilization>>({});
  const [utilLoading, setUtilLoading] = useState(false);

  useEffect(() => {
    if (!envelopes || envelopes.length === 0) return;
    setUtilLoading(true);
    Promise.all(
      envelopes.map((e) =>
        get<EnvelopeUtilization>(`/finance/envelopes/${e.id}/utilization`),
      ),
    )
      .then((results) => {
        const map: Record<string, EnvelopeUtilization> = {};
        envelopes.forEach((e, i) => {
          map[e.id] = results[i];
        });
        setUtilizationMap(map);
      })
      .catch(() => {})
      .finally(() => setUtilLoading(false));
  }, [envelopes]);

  // Step 4: Fetch alerts
  const { data: alerts, loading: alertsLoading, refetch: refetchAlerts } = useApi<DriftAlert[]>("/reconciliation/alerts");

  // Alert dismiss state
  const [dismissingAlert, setDismissingAlert] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleDismissAlert(alertId: string) {
    setDismissingAlert(alertId);
    try {
      await patch(`/reconciliation/alerts/${alertId}`, { status: "acknowledged" });
      setToast({ message: "Alert acknowledged", type: "success" });
      refetchAlerts();
    } catch {
      setToast({ message: "Failed to acknowledge alert", type: "error" });
    } finally {
      setDismissingAlert(null);
    }
  }

  // Step 5: Fetch org units for team names
  const { data: orgUnits } = useApi<OrgUnit[]>("/org-units");

  const orgUnitMap = useMemo(() => {
    const map: Record<string, string> = {};
    orgUnits?.forEach((u) => {
      map[u.id] = u.name;
    });
    return map;
  }, [orgUnits]);

  // Compute aggregate stats
  const stats = useMemo(() => {
    if (!envelopes) return null;

    let totalBudget = 0;
    let totalHeadcountCap = 0;
    let totalCommitted = 0;
    let flexSum = 0;
    let flexCount = 0;

    for (const env of envelopes) {
      totalBudget += parseFloat(env.totalCompBudget) || 0;
      totalHeadcountCap += env.headcountCap;

      const util = utilizationMap[env.id];
      if (util) {
        totalCommitted += parseFloat(String(util.budgetCommitted)) || 0;
        if (util.flexibilityPct != null) {
          flexSum += util.flexibilityPct;
          flexCount++;
        }
      }
    }

    const utilizationPct = totalBudget > 0 ? (totalCommitted / totalBudget) * 100 : 0;

    return {
      totalBudget,
      totalHeadcountCap,
      totalCommitted,
      avgFlexibility: flexCount > 0 ? flexSum / flexCount : 0,
      utilizationPct,
    };
  }, [envelopes, utilizationMap]);

  // Compute "what needs attention" data
  const attentionItems = useMemo(() => {
    const items: { type: "critical" | "warning" | "info"; message: string }[] = [];

    // Count alerts by severity
    const sevCounts: Record<string, number> = { critical: 0, warning: 0, info: 0 };
    alerts?.forEach((a) => {
      const sev = a.severity.toLowerCase();
      if (sevCounts[sev] !== undefined) sevCounts[sev]++;
      else sevCounts.info++;
    });

    if (sevCounts.critical > 0) {
      items.push({ type: "critical", message: `${sevCounts.critical} critical budget alert${sevCounts.critical !== 1 ? "s" : ""} need attention` });
    }
    if (sevCounts.warning > 0) {
      items.push({ type: "warning", message: `${sevCounts.warning} warning${sevCounts.warning !== 1 ? "s" : ""} to review` });
    }

    // Envelopes over 90% utilized
    const over90: string[] = [];
    envelopes?.forEach((env) => {
      const util = utilizationMap[env.id];
      if (util) {
        const budgetTotal = parseFloat(env.totalCompBudget) || 0;
        const budgetUsed = parseFloat(String(util.budgetCommitted)) || 0;
        if (budgetTotal > 0 && (budgetUsed / budgetTotal) * 100 > 90) {
          over90.push(orgUnitMap[env.orgUnitId] || env.envelopeType);
        }
      }
    });

    if (over90.length > 0) {
      items.push({
        type: "critical",
        message: `${over90.length} team budget${over90.length !== 1 ? "s" : ""} over 90% utilized: ${over90.slice(0, 3).join(", ")}${over90.length > 3 ? ` +${over90.length - 3} more` : ""}`,
      });
    }

    return items;
  }, [alerts, envelopes, utilizationMap, orgUnitMap]);

  // Filter envelopes for display
  const displayEnvelopes = useMemo(() => {
    if (!envelopes) return [];
    if (showAllLevels) return envelopes;
    // Show only team-level (leaf envelopes that have a parent, or all if none have parents)
    const hasParents = envelopes.some((e) => e.parentEnvelopeId);
    if (!hasParents) return envelopes;
    return envelopes.filter((e) => e.parentEnvelopeId);
  }, [envelopes, showAllLevels]);

  // Active alerts count
  const activeAlertCount = alerts?.length ?? 0;

  // Loading / error states
  const isLoading = cyclesLoading || envelopesLoading || utilLoading || alertsLoading;
  const error = cyclesError || envelopesError;

  if (isLoading && !envelopes) {
    return <div className="loading" style={{ padding: "48px", textAlign: "center" }}>Loading budget data...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "#ef4444" }}>
        Error: {error}
      </div>
    );
  }

  function dismissBanner() {
    localStorage.setItem("qwfp-dismiss-finance", "true");
    setShowBanner(false);
  }

  return (
    <div style={{ padding: "24px", textAlign: "left" }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 200, padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "#fff", background: toast.type === "success" ? "var(--success)" : "var(--danger)", boxShadow: "var(--shadow-lg)" }}>
          {toast.message}
        </div>
      )}
      {/* Welcome Banner */}
      {showBanner && (
        <div style={bannerStyle}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "4px", color: "var(--text-h)" }}>
              Welcome to Budget Control Center
            </div>
            <div style={{ fontSize: "14px", color: "var(--text)", lineHeight: 1.5 }}>
              You set the budget rules. Teams hire within them. You only get involved when changes exceed your thresholds — the system handles the rest automatically.
            </div>
          </div>
          <button onClick={dismissBanner} style={bannerDismissStyle} aria-label="Dismiss">
            &#10005;
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "32px", margin: "0 0 4px" }}>Budget Control Center</h1>
        <p style={{ color: "var(--text)", fontSize: "15px" }}>
          FY26 Workforce Planning
          {activeCycle && <> &mdash; {activeCycle.name}</>}
        </p>
      </div>

      {/* What Needs Attention */}
      <div style={{ marginBottom: "24px" }}>
        {attentionItems.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {attentionItems.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 500,
                  backgroundColor: item.type === "critical" ? "#fef2f2" : item.type === "warning" ? "#fffbeb" : "#eff6ff",
                  color: item.type === "critical" ? "#991b1b" : item.type === "warning" ? "#854d0e" : "#1e40af",
                  border: `1px solid ${item.type === "critical" ? "#fecaca" : item.type === "warning" ? "#fde68a" : "#bfdbfe"}`,
                }}
              >
                <span>{item.type === "critical" ? "\u26A0" : item.type === "warning" ? "\u25CB" : "\u2139"}</span>
                <span>{item.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 500,
              backgroundColor: "#f0fdf4",
              color: "#166534",
              border: "1px solid #bbf7d0",
            }}
          >
            All budgets on track
          </div>
        )}
      </div>

      {/* Stats Grid */}
      {stats && (
        <div
          className="stats-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div className="stat-card card" style={statCardStyle}>
            <div className="stat-label" style={statLabelStyle}>Total Budget</div>
            <div className="stat-value" style={statValueStyle}>
              <MoneyDisplay amount={stats.totalBudget} compact />
            </div>
            <div className="stat-sub" style={statSubStyle}>
              {envelopes?.length ?? 0} team budgets
            </div>
          </div>

          <div className="stat-card card" style={statCardStyle}>
            <div className="stat-label" style={statLabelStyle}>Total Headcount Cap</div>
            <div className="stat-value" style={statValueStyle}>
              {stats.totalHeadcountCap}
            </div>
            <div className="stat-sub" style={statSubStyle}>maximum positions across all teams</div>
          </div>

          <div className="stat-card card" style={{
            ...statCardStyle,
            borderLeft: `4px solid ${stats.utilizationPct > 90 ? "#ef4444" : stats.utilizationPct > 70 ? "#eab308" : "#22c55e"}`,
          }}>
            <div className="stat-label" style={statLabelStyle}>Budget Committed</div>
            <div className="stat-value" style={{
              ...statValueStyle,
              color: stats.utilizationPct > 90 ? "#ef4444" : stats.utilizationPct > 70 ? "#eab308" : "#22c55e",
            }}>
              <MoneyDisplay amount={stats.totalCommitted} compact />
            </div>
            <div className="stat-sub" style={statSubStyle}>
              {stats.utilizationPct.toFixed(1)}% of total budget spent
            </div>
          </div>

          <div className="stat-card card" style={{
            ...statCardStyle,
            borderLeft: `4px solid ${stats.avgFlexibility < 5 ? "#ef4444" : stats.avgFlexibility < 15 ? "#eab308" : "#22c55e"}`,
          }}>
            <div className="stat-label" style={statLabelStyle}>Budget Headroom</div>
            <div className="stat-value" style={{
              ...statValueStyle,
              color: stats.avgFlexibility < 5 ? "#ef4444" : stats.avgFlexibility < 15 ? "#eab308" : "#22c55e",
            }}>
              {stats.avgFlexibility.toFixed(1)}%
            </div>
            <div className="stat-sub" style={statSubStyle}>average room before hitting limits</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={tabContainerStyle}>
        <button
          style={activeTab === "budgets" ? { ...tabStyle, ...tabActiveStyle } : tabStyle}
          onClick={() => setActiveTab("budgets")}
        >
          Team Budgets
        </button>
        <button
          style={activeTab === "alerts" ? { ...tabStyle, ...tabActiveStyle } : tabStyle}
          onClick={() => setActiveTab("alerts")}
        >
          Budget Alerts
          {activeAlertCount > 0 && (
            <span style={{
              ...tabBadgeStyle,
              backgroundColor: alerts?.some((a) => a.severity.toLowerCase() === "critical") ? "#fee2e2" : "#fef3c7",
              color: alerts?.some((a) => a.severity.toLowerCase() === "critical") ? "#991b1b" : "#854d0e",
            }}>
              {activeAlertCount}
            </span>
          )}
        </button>
      </div>

      {/* Team Budgets Tab */}
      {activeTab === "budgets" && (
        <div className="card" style={cardStyle}>
          <div className="card-header" style={{ ...cardHeaderStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: "18px" }}>Team Budgets</h2>
            <label style={{ fontSize: "13px", color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="checkbox"
                checked={showAllLevels}
                onChange={(e) => setShowAllLevels(e.target.checked)}
              />
              Show all levels
            </label>
          </div>
          <div className="table-wrapper" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Team / Department</th>
                  <th style={thStyle}>Headcount</th>
                  <th style={thStyle}>Budget</th>
                  <th style={{ ...thStyle, width: "100px" }}>Headroom</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayEnvelopes.map((env) => {
                  const util = utilizationMap[env.id];
                  const hcUsed = util?.headcountUsed ?? 0;
                  const hcCap = util?.headcountCap ?? env.headcountCap;
                  const budgetCommitted = parseFloat(String(util?.budgetCommitted ?? "0"));
                  const totalBudget = parseFloat(env.totalCompBudget) || 0;
                  const flexPct = util?.flexibilityPct ?? 0;
                  const teamName = orgUnitMap[env.orgUnitId] || env.orgUnitId;
                  const utilPct = totalBudget > 0 ? (budgetCommitted / totalBudget) * 100 : 0;

                  const rowBg = utilPct > 90
                    ? "rgba(239, 68, 68, 0.06)"
                    : utilPct > 70
                    ? "rgba(234, 179, 8, 0.06)"
                    : "transparent";

                  return (
                    <tr key={env.id} style={{ borderBottom: "1px solid var(--border)", backgroundColor: rowBg }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 500, color: "var(--text-h)" }}>{teamName}</div>
                        <div style={{ fontSize: "12px", color: "var(--text)" }}>{env.envelopeType}</div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ marginBottom: "4px", fontSize: "13px" }}>
                          {hcUsed} / {hcCap}
                        </div>
                        <ProgressBar value={hcUsed} max={hcCap} />
                      </td>
                      <td style={tdStyle}>
                        <div style={{ marginBottom: "4px", fontSize: "13px" }}>
                          <MoneyDisplay amount={budgetCommitted} compact /> / <MoneyDisplay amount={totalBudget} compact />
                        </div>
                        <ProgressBar value={budgetCommitted} max={totalBudget} />
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          color: flexPct < 5 ? "#ef4444" : flexPct < 15 ? "#eab308" : "#22c55e",
                          fontWeight: 600,
                        }}>
                          {flexPct.toFixed(1)}%
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <StatusBadge status={env.status} />
                      </td>
                    </tr>
                  );
                })}
                {displayEnvelopes.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "var(--text)" }}>
                      No team budgets found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Budget Alerts Tab */}
      {activeTab === "alerts" && (
        <div className="card" style={cardStyle}>
          <div className="card-header" style={cardHeaderStyle}>
            <h2 style={{ margin: 0, fontSize: "18px" }}>
              Budget Alerts
              {alerts && <span style={{ fontWeight: 400, color: "var(--text)", fontSize: "14px" }}> ({alerts.length})</span>}
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "16px" }}>
            {alerts?.map((alert) => (
              <div
                key={alert.id}
                className="alert-item"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                }}
              >
                <StatusBadge status={alert.severity} variant="severity" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", color: "var(--text-h)", marginBottom: "4px" }}>
                    {alert.message}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text)" }}>
                    {alert.alertType.replace(/envelope/gi, "team budget").replace(/drift/gi, "budget")} &middot; Enforcement: {alert.enforcement}
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={dismissingAlert === alert.id}
                  onClick={() => handleDismissAlert(alert.id)}
                  style={{ flexShrink: 0, fontSize: 12 }}
                >
                  {dismissingAlert === alert.id ? "..." : "Acknowledge"}
                </button>
              </div>
            ))}
            {(!alerts || alerts.length === 0) && (
              <p style={{ textAlign: "center", color: "var(--text)", fontSize: "14px", padding: "24px 0" }}>
                No active budget alerts
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Banner styles
const bannerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "16px",
  padding: "16px 20px",
  marginBottom: "24px",
  borderRadius: "8px",
  backgroundColor: "#eff6ff",
  borderLeft: "4px solid #3b82f6",
};

const bannerDismissStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: "16px",
  cursor: "pointer",
  color: "#6b7280",
  padding: "0 4px",
  lineHeight: 1,
  flexShrink: 0,
};

// Tab styles
const tabContainerStyle: React.CSSProperties = {
  display: "flex",
  borderBottom: "2px solid var(--border)",
  gap: 0,
  marginBottom: "24px",
};

const tabStyle: React.CSSProperties = {
  padding: "12px 20px",
  fontSize: "14px",
  fontWeight: 500,
  border: "none",
  background: "none",
  cursor: "pointer",
  borderBottom: "2px solid transparent",
  marginBottom: "-2px",
  color: "var(--text-muted)",
};

const tabActiveStyle: React.CSSProperties = {
  color: "var(--primary)",
  borderBottomColor: "var(--primary)",
};

const tabBadgeStyle: React.CSSProperties = {
  marginLeft: "6px",
  padding: "1px 7px",
  borderRadius: "10px",
  fontSize: "12px",
};

// Inline style constants for layout
const cardStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "12px",
  overflow: "hidden",
};

const cardHeaderStyle: React.CSSProperties = {
  padding: "16px",
  borderBottom: "1px solid var(--border)",
};

const statCardStyle: React.CSSProperties = {
  padding: "20px",
  border: "1px solid var(--border)",
  borderRadius: "12px",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text)",
  marginBottom: "4px",
};

const statValueStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 600,
  color: "var(--text-h)",
  lineHeight: 1.2,
};

const statSubStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text)",
  marginTop: "4px",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--text)",
  borderBottom: "1px solid var(--border)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  verticalAlign: "middle",
};
