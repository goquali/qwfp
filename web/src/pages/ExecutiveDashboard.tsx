import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { get, setCurrentUser } from "../api/client";
import type {
  PlanningCycle,
  BudgetEnvelope,
  EnvelopeUtilization,
  JobSlot,
  DriftAlert,
  OrgUnit,
  CapacitySnapshot,
} from "../api/types";
import ProgressBar from "../components/ProgressBar";
import MoneyDisplay from "../components/MoneyDisplay";
import StatusBadge from "../components/StatusBadge";

const PIPELINE_STATUSES = ["draft", "open", "sourcing", "offer", "filled", "cancelled"] as const;

const PIPELINE_COLORS: Record<string, string> = {
  draft: "#9ca3af",
  open: "#3b82f6",
  sourcing: "#1B8A43",
  offer: "#f59e0b",
  filled: "#22c55e",
  cancelled: "#ef4444",
};

const SEVERITY_COLORS: Record<string, { bg: string; color: string }> = {
  critical: { bg: "#fee2e2", color: "#991b1b" },
  warning: { bg: "#fef3c7", color: "#854d0e" },
  info: { bg: "#dbeafe", color: "#1e40af" },
};

// Top-level division mapping — envelopes without a parent are division-level
function groupByDivision(
  envelopes: BudgetEnvelope[],
  orgUnitMap: Record<string, string>,
): { name: string; envelopes: BudgetEnvelope[] }[] {
  const topLevel = envelopes.filter((e) => !e.parentEnvelopeId);
  return topLevel.map((parent) => {
    const children = envelopes.filter((e) => e.parentEnvelopeId === parent.id);
    return {
      name: orgUnitMap[parent.orgUnitId] || parent.envelopeType,
      envelopes: [parent, ...children],
    };
  });
}

const VIEWS = [
  { key: "executive", label: "Executive", role: "admin", path: "/dashboard" },
  { key: "finance", label: "Finance", role: "finance", path: "/finance" },
  { key: "hr", label: "HR", role: "hr", path: "/hr" },
  { key: "business", label: "Business Owner", role: "business_owner", path: "/team" },
  { key: "recruiting", label: "Recruiting", role: "ta", path: "/ta" },
];

export default function ExecutiveDashboard() {
  const navigate = useNavigate();
  const { data: users } = useApi<import("../api/types").User[]>("/users");

  function switchView(view: typeof VIEWS[number]) {
    if (view.key === "executive") return; // already here
    const user = users?.find(u => u.role === view.role);
    if (user) {
      setCurrentUser({ id: user.id, role: user.role, name: user.name });
      navigate(view.path);
    }
  }

  // Welcome banner dismissal
  const [showBanner, setShowBanner] = useState(
    () => localStorage.getItem("qwfp-dismiss-executive") !== "true",
  );

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
        get<EnvelopeUtilization>(`/finance/envelopes/${e.id}/utilization`).catch(() => null),
      ),
    )
      .then((results) => {
        const map: Record<string, EnvelopeUtilization> = {};
        envelopes.forEach((e, i) => {
          if (results[i]) map[e.id] = results[i]!;
        });
        setUtilizationMap(map);
      })
      .finally(() => setUtilLoading(false));
  }, [envelopes]);

  // Step 4: Batch-fetch slots for all envelopes
  const [allSlots, setAllSlots] = useState<JobSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    if (!envelopes || envelopes.length === 0) return;
    setSlotsLoading(true);
    Promise.all(
      envelopes.map((e) =>
        get<JobSlot[]>(`/hr/envelopes/${e.id}/slots`).catch(() => [] as JobSlot[]),
      ),
    )
      .then((results) => {
        const slots: JobSlot[] = [];
        results.forEach((r) => slots.push(...r));
        setAllSlots(slots);
      })
      .finally(() => setSlotsLoading(false));
  }, [envelopes]);

  // Step 5: Fetch alerts
  const { data: alerts, loading: alertsLoading } = useApi<DriftAlert[]>("/reconciliation/alerts");

  // Step 6: Fetch TA capacity
  const { data: taCapacity, loading: taLoading } = useApi<CapacitySnapshot>("/ta/capacity");

  // Step 7: Fetch org units for team names
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

    // Use top-level envelopes for totals (avoid double-counting children)
    const topLevel = envelopes.filter((e) => !e.parentEnvelopeId);

    const totalPlan = topLevel.reduce((sum, e) => sum + e.headcountCap, 0);
    const totalBudget = topLevel.reduce((sum, e) => sum + (parseFloat(e.totalCompBudget) || 0), 0);

    const filled = allSlots.filter((s) => s.status === "filled").length;
    const inPipeline = allSlots.filter((s) =>
      ["open", "sourcing", "offer"].includes(s.status),
    ).length;
    const sourcingCount = allSlots.filter((s) => s.status === "sourcing").length;
    const offerCount = allSlots.filter((s) => s.status === "offer").length;

    let budgetCommitted = 0;
    for (const env of topLevel) {
      const util = utilizationMap[env.id];
      if (util) {
        budgetCommitted += parseFloat(String(util.budgetCommitted)) || 0;
      }
    }

    const burnPct = totalBudget > 0 ? (budgetCommitted / totalBudget) * 100 : 0;

    return { totalPlan, filled, inPipeline, sourcingCount, offerCount, totalBudget, budgetCommitted, burnPct };
  }, [envelopes, allSlots, utilizationMap]);

  // Division groupings
  const divisions = useMemo(() => {
    if (!envelopes) return [];
    return groupByDivision(envelopes, orgUnitMap);
  }, [envelopes, orgUnitMap]);

  // Pipeline funnel counts
  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const status of PIPELINE_STATUSES) {
      counts[status] = 0;
    }
    for (const slot of allSlots) {
      if (counts[slot.status] !== undefined) {
        counts[slot.status]++;
      }
    }
    return counts;
  }, [allSlots]);

  const maxPipelineCount = useMemo(
    () => Math.max(1, ...Object.values(pipelineCounts)),
    [pipelineCounts],
  );

  // Alert groupings
  const alertsBySeverity = useMemo(() => {
    const groups: Record<string, DriftAlert[]> = { critical: [], warning: [], info: [] };
    alerts?.forEach((a) => {
      const sev = a.severity.toLowerCase();
      if (groups[sev]) groups[sev].push(a);
      else groups.info.push(a);
    });
    return groups;
  }, [alerts]);

  const recentAlerts = useMemo(() => {
    if (!alerts) return [];
    return [...alerts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [alerts]);

  const criticalAlertCount = alertsBySeverity.critical?.length ?? 0;

  // Loading / error states
  const isLoading = cyclesLoading || envelopesLoading || utilLoading || slotsLoading || alertsLoading || taLoading;
  const error = cyclesError || envelopesError;

  if (isLoading && !envelopes) {
    return <div className="loading" style={{ padding: "48px", textAlign: "center" }}>Loading hiring overview...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "#ef4444" }}>
        Error: {error}
      </div>
    );
  }

  function dismissBanner() {
    localStorage.setItem("qwfp-dismiss-executive", "true");
    setShowBanner(false);
  }

  return (
    <div style={{ padding: "24px", textAlign: "left" }}>
      {/* Welcome Banner */}
      {showBanner && (
        <div style={bannerStyle}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "4px", color: "var(--text-h)" }}>
              Welcome to the Hiring Command Center
            </div>
            <div style={{ fontSize: "14px", color: "var(--text)", lineHeight: 1.5 }}>
              Company-wide hiring progress at a glance. Green means on track, yellow means watch closely, red means action needed.
            </div>
          </div>
          <button onClick={dismissBanner} style={bannerDismissStyle} aria-label="Dismiss">
            &#10005;
          </button>
        </div>
      )}

      {/* View-as Toggle */}
      <div className="view-toggle">
        {VIEWS.map(v => (
          <button key={v.key} className={v.key === "executive" ? "active" : ""} onClick={() => switchView(v)}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", margin: "0 0 4px" }}>Hiring Command Center</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
          FY26 Workforce Plan
          {activeCycle && <> — {activeCycle.name}</>}
        </p>
      </div>

      {/* Stats Row — simplified to 4 cards */}
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
          {/* Positions Filled */}
          <div className="stat-card card" style={{
            ...statCardStyle,
            borderLeft: `4px solid ${stats.totalPlan > 0 && (stats.filled / stats.totalPlan) >= 0.75 ? "#22c55e" : stats.totalPlan > 0 && (stats.filled / stats.totalPlan) >= 0.4 ? "#eab308" : "#ef4444"}`,
          }}>
            <div className="stat-label" style={statLabelStyle}>Positions Filled</div>
            <div className="stat-value" style={statValueStyle}>
              {stats.filled} of {stats.totalPlan}
            </div>
            <div style={{ marginTop: "8px" }}>
              <ProgressBar value={stats.filled} max={stats.totalPlan} />
            </div>
            <div className="stat-sub" style={statSubStyle}>hires completed vs. plan</div>
          </div>

          {/* Budget Burn */}
          <div className="stat-card card" style={{
            ...statCardStyle,
            borderLeft: `4px solid ${stats.burnPct > 90 ? "#ef4444" : stats.burnPct > 70 ? "#eab308" : "#22c55e"}`,
          }}>
            <div className="stat-label" style={statLabelStyle}>Budget Burn</div>
            <div className="stat-value" style={{
              ...statValueStyle,
              color: stats.burnPct > 90 ? "#ef4444" : stats.burnPct > 70 ? "#eab308" : "#22c55e",
            }}>
              {stats.burnPct.toFixed(0)}% committed
            </div>
            <div className="stat-sub" style={statSubStyle}>
              <MoneyDisplay amount={stats.budgetCommitted} compact /> of <MoneyDisplay amount={stats.totalBudget} compact />
            </div>
          </div>

          {/* Pipeline */}
          <div className="stat-card card" style={{
            ...statCardStyle,
            borderLeft: "4px solid #22A652",
          }}>
            <div className="stat-label" style={statLabelStyle}>Pipeline</div>
            <div className="stat-value" style={statValueStyle}>
              {stats.inPipeline} in pipeline
            </div>
            <div className="stat-sub" style={statSubStyle}>
              {stats.sourcingCount} sourcing, {stats.offerCount} in offer
            </div>
          </div>

          {/* Alerts */}
          <div className="stat-card card" style={{
            ...statCardStyle,
            borderLeft: `4px solid ${criticalAlertCount > 0 ? "#ef4444" : (alerts?.length ?? 0) > 0 ? "#eab308" : "#22c55e"}`,
          }}>
            <div className="stat-label" style={statLabelStyle}>Alerts</div>
            <div className="stat-value" style={{
              ...statValueStyle,
              color: criticalAlertCount > 0 ? "#ef4444" : (alerts?.length ?? 0) > 0 ? "#eab308" : "#22c55e",
            }}>
              {alerts?.length ?? 0} active
            </div>
            <div className="stat-sub" style={statSubStyle}>
              {criticalAlertCount > 0
                ? `${criticalAlertCount} critical`
                : "no critical issues"}
            </div>
          </div>
        </div>
      )}

      {/* Division Progress */}
      <div className="card" style={{ ...cardStyle, marginBottom: "24px" }}>
        <div className="card-header" style={cardHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: "18px" }}>Hiring by Division</h2>
        </div>
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {divisions.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "14px", padding: "16px 0" }}>
              No division data available
            </p>
          )}
          {divisions.map((div) => {
            const parentEnv = div.envelopes[0];
            const parentUtil = utilizationMap[parentEnv.id];
            const hcCap = parentUtil?.headcountCap ?? parentEnv.headcountCap;
            const hcFilled = allSlots.filter(
              (s) => s.status === "filled" && div.envelopes.some((e) => e.id === s.envelopeId),
            ).length;
            const budgetTotal = parseFloat(parentEnv.totalCompBudget) || 0;
            const budgetCommitted = parentUtil
              ? parseFloat(String(parentUtil.budgetCommitted)) || 0
              : 0;

            return (
              <div key={parentEnv.id} style={{ paddingBottom: "16px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--text)" }}>{div.name}</span>
                  <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    {hcFilled} / {hcCap} headcount
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
                      Headcount: {hcFilled} / {hcCap}
                    </div>
                    <ProgressBar value={hcFilled} max={hcCap} />
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
                      Budget: <MoneyDisplay amount={budgetCommitted} compact /> / <MoneyDisplay amount={budgetTotal} compact />
                    </div>
                    <ProgressBar value={budgetCommitted} max={budgetTotal} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline Funnel */}
      <div className="card" style={{ ...cardStyle, marginBottom: "24px" }}>
        <div className="card-header" style={cardHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: "18px" }}>Pipeline Funnel</h2>
        </div>
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {PIPELINE_STATUSES.map((status) => {
            const count = pipelineCounts[status] || 0;
            const widthPct = (count / maxPipelineCount) * 100;
            return (
              <div key={status} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span
                  style={{
                    width: "80px",
                    fontSize: "13px",
                    fontWeight: 500,
                    textTransform: "capitalize",
                    color: "var(--text)",
                    flexShrink: 0,
                  }}
                >
                  {status}
                </span>
                <span
                  style={{
                    width: "36px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--text)",
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {count}
                </span>
                <div style={{ flex: 1, height: "24px", borderRadius: "4px", backgroundColor: "#f3f4f6", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${widthPct}%`,
                      backgroundColor: PIPELINE_COLORS[status],
                      borderRadius: "4px",
                      transition: "width 0.3s ease",
                      minWidth: count > 0 ? "4px" : "0",
                    }}
                  />
                </div>
              </div>
            );
          })}

          {/* Conversion rates */}
          <div
            style={{
              marginTop: "12px",
              paddingTop: "12px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              gap: "24px",
              flexWrap: "wrap",
              fontSize: "13px",
              color: "var(--text-muted)",
            }}
          >
            {pipelineCounts.sourcing > 0 && (
              <span>
                Sourcing → Offer:{" "}
                <strong style={{ color: "var(--text)" }}>
                  {((pipelineCounts.offer / pipelineCounts.sourcing) * 100).toFixed(0)}%
                </strong>
              </span>
            )}
            {pipelineCounts.offer > 0 && (
              <span>
                Offer → Filled:{" "}
                <strong style={{ color: "var(--text)" }}>
                  {((pipelineCounts.filled / pipelineCounts.offer) * 100).toFixed(0)}%
                </strong>
              </span>
            )}
            {pipelineCounts.open > 0 && (
              <span>
                Open → Sourcing:{" "}
                <strong style={{ color: "var(--text)" }}>
                  {((pipelineCounts.sourcing / pipelineCounts.open) * 100).toFixed(0)}%
                </strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Two-column bottom section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        {/* Left: Active Alerts Summary */}
        <div className="card" style={cardStyle}>
          <div className="card-header" style={cardHeaderStyle}>
            <h2 style={{ margin: 0, fontSize: "18px" }}>
              Budget Alerts
              {alerts && <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "14px" }}> ({alerts.length})</span>}
            </h2>
          </div>
          <div style={{ padding: "16px" }}>
            {/* Severity counts */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
              {(["critical", "warning", "info"] as const).map((sev) => {
                const count = alertsBySeverity[sev]?.length ?? 0;
                const colors = SEVERITY_COLORS[sev];
                return (
                  <span
                    key={sev}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "4px 12px",
                      borderRadius: "12px",
                      fontSize: "13px",
                      fontWeight: 500,
                      backgroundColor: colors.bg,
                      color: colors.color,
                    }}
                  >
                    <span style={{ textTransform: "capitalize" }}>{sev}</span>
                    <strong>{count}</strong>
                  </span>
                );
              })}
            </div>

            {/* Recent alerts list */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                  }}
                >
                  <StatusBadge status={alert.severity} variant="severity" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "var(--text)", marginBottom: "2px" }}>{alert.message}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {new Date(alert.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))}
              {recentAlerts.length === 0 && (
                <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "14px", padding: "16px 0" }}>
                  No active alerts
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: TA Capacity Summary */}
        <div className="card" style={cardStyle}>
          <div className="card-header" style={cardHeaderStyle}>
            <h2 style={{ margin: 0, fontSize: "18px" }}>Recruiting Capacity</h2>
          </div>
          <div style={{ padding: "16px" }}>
            {taLoading && !taCapacity && (
              <div className="loading" style={{ padding: "24px" }}>Loading recruiting data...</div>
            )}
            {taCapacity && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "2px" }}>Total Recruiters</div>
                    <div style={{ fontSize: "24px", fontWeight: 600, color: "var(--text)" }}>{taCapacity.totalRecruiters}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "2px" }}>Active Reqs</div>
                    <div style={{ fontSize: "24px", fontWeight: 600, color: "var(--text)" }}>{taCapacity.activeReqs}</div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>
                    Utilization: {taCapacity.utilizationPct.toFixed(1)}%
                  </div>
                  <ProgressBar value={taCapacity.utilizationPct} max={100} />
                </div>

                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    backgroundColor: taCapacity.capacityGap > 0 ? "#fee2e2" : "#dcfce7",
                    color: taCapacity.capacityGap > 0 ? "#991b1b" : "#166534",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  {taCapacity.capacityGap > 0
                    ? `Overloaded by ${taCapacity.capacityGap} — need more recruiter${taCapacity.capacityGap !== 1 ? "s" : ""}`
                    : taCapacity.capacityGap < 0
                    ? `${Math.abs(taCapacity.capacityGap)} capacity surplus`
                    : "Capacity balanced"}
                </div>
              </div>
            )}
            {!taLoading && !taCapacity && (
              <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "14px", padding: "16px 0" }}>
                Recruiting capacity data unavailable
              </p>
            )}
          </div>
        </div>
      </div>
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

// Inline style constants
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
  color: "var(--text-muted)",
  marginBottom: "4px",
};

const statValueStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 600,
  color: "var(--text)",
  lineHeight: 1.2,
};

const statSubStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-muted)",
  marginTop: "4px",
};
