import { useState, useEffect, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { get } from "../api/client";
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
  sourcing: "#6366f1",
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

export default function ExecutiveDashboard() {
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

    let budgetCommitted = 0;
    for (const env of topLevel) {
      const util = utilizationMap[env.id];
      if (util) {
        budgetCommitted += parseFloat(String(util.budgetCommitted)) || 0;
      }
    }

    const fillRate = totalPlan > 0 ? (filled / totalPlan) * 100 : 0;

    return { totalPlan, filled, inPipeline, totalBudget, budgetCommitted, fillRate };
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

  // Loading / error states
  const isLoading = cyclesLoading || envelopesLoading || utilLoading || slotsLoading || alertsLoading || taLoading;
  const error = cyclesError || envelopesError;

  if (isLoading && !envelopes) {
    return <div className="loading" style={{ padding: "48px", textAlign: "center" }}>Loading executive overview...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "#ef4444" }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", textAlign: "left" }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "32px", margin: "0 0 4px" }}>Executive Overview</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "15px" }}>
          FY26 Workforce Plan
          {activeCycle && <> &mdash; {activeCycle.name}</>}
        </p>
      </div>

      {/* Stats Row */}
      {stats && (
        <div
          className="stats-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div className="stat-card card" style={statCardStyle}>
            <div className="stat-label" style={statLabelStyle}>Total Headcount Plan</div>
            <div className="stat-value" style={statValueStyle}>{stats.totalPlan}</div>
            <div className="stat-sub" style={statSubStyle}>positions planned</div>
          </div>

          <div className="stat-card card" style={statCardStyle}>
            <div className="stat-label" style={statLabelStyle}>Positions Filled</div>
            <div className="stat-value" style={statValueStyle}>{stats.filled}</div>
            <div className="stat-sub" style={statSubStyle}>hires completed</div>
          </div>

          <div className="stat-card card" style={statCardStyle}>
            <div className="stat-label" style={statLabelStyle}>In Pipeline</div>
            <div className="stat-value" style={statValueStyle}>{stats.inPipeline}</div>
            <div className="stat-sub" style={statSubStyle}>open + sourcing + offer</div>
          </div>

          <div className="stat-card card" style={statCardStyle}>
            <div className="stat-label" style={statLabelStyle}>Total Budget</div>
            <div className="stat-value" style={statValueStyle}>
              <MoneyDisplay amount={stats.totalBudget} compact />
            </div>
            <div className="stat-sub" style={statSubStyle}>comp budget</div>
          </div>

          <div className="stat-card card" style={statCardStyle}>
            <div className="stat-label" style={statLabelStyle}>Budget Committed</div>
            <div className="stat-value" style={statValueStyle}>
              <MoneyDisplay amount={stats.budgetCommitted} compact />
            </div>
            <div className="stat-sub" style={statSubStyle}>
              {stats.totalBudget > 0
                ? `${((stats.budgetCommitted / stats.totalBudget) * 100).toFixed(1)}% of total`
                : "0%"}
            </div>
          </div>

          <div className="stat-card card" style={statCardStyle}>
            <div className="stat-label" style={statLabelStyle}>Fill Rate</div>
            <div
              className="stat-value"
              style={{
                ...statValueStyle,
                color:
                  stats.fillRate >= 75
                    ? "var(--success)"
                    : stats.fillRate >= 40
                    ? "var(--warning)"
                    : "var(--danger)",
              }}
            >
              {stats.fillRate.toFixed(1)}%
            </div>
            <div className="stat-sub" style={statSubStyle}>filled / planned</div>
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
              Active Alerts
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
            <h2 style={{ margin: 0, fontSize: "18px" }}>TA Capacity</h2>
          </div>
          <div style={{ padding: "16px" }}>
            {taLoading && !taCapacity && (
              <div className="loading" style={{ padding: "24px" }}>Loading TA data...</div>
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
                    ? `Overloaded — need ${taCapacity.capacityGap} more recruiter${taCapacity.capacityGap !== 1 ? "s" : ""}`
                    : "Capacity sufficient"}
                </div>
              </div>
            )}
            {!taLoading && !taCapacity && (
              <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "14px", padding: "16px 0" }}>
                TA capacity data unavailable
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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
