import { useState, useEffect, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { get } from "../api/client";
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
  const { data: alerts, loading: alertsLoading } = useApi<DriftAlert[]>("/reconciliation/alerts");

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

    return {
      totalBudget,
      totalHeadcountCap,
      totalCommitted,
      avgFlexibility: flexCount > 0 ? flexSum / flexCount : 0,
    };
  }, [envelopes, utilizationMap]);

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

  return (
    <div style={{ padding: "24px", textAlign: "left" }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "32px", margin: "0 0 4px" }}>Budget Overview</h1>
        <p style={{ color: "var(--text)", fontSize: "15px" }}>
          FY26 Workforce Planning
          {activeCycle && <> &mdash; {activeCycle.name}</>}
        </p>
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
              {envelopes?.length ?? 0} envelopes
            </div>
          </div>

          <div className="stat-card card" style={statCardStyle}>
            <div className="stat-label" style={statLabelStyle}>Total Headcount Cap</div>
            <div className="stat-value" style={statValueStyle}>
              {stats.totalHeadcountCap}
            </div>
            <div className="stat-sub" style={statSubStyle}>across all teams</div>
          </div>

          <div className="stat-card card" style={statCardStyle}>
            <div className="stat-label" style={statLabelStyle}>Budget Committed</div>
            <div className="stat-value" style={statValueStyle}>
              <MoneyDisplay amount={stats.totalCommitted} compact />
            </div>
            <div className="stat-sub" style={statSubStyle}>
              {stats.totalBudget > 0
                ? `${((stats.totalCommitted / stats.totalBudget) * 100).toFixed(1)}% utilized`
                : "0% utilized"}
            </div>
          </div>

          <div className="stat-card card" style={statCardStyle}>
            <div className="stat-label" style={statLabelStyle}>Avg Flexibility</div>
            <div className="stat-value" style={statValueStyle}>
              {stats.avgFlexibility.toFixed(1)}%
            </div>
            <div className="stat-sub" style={statSubStyle}>budget headroom</div>
          </div>
        </div>
      )}

      {/* Envelope Table */}
      <div className="card" style={cardStyle}>
        <div className="card-header" style={cardHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: "18px" }}>Budget Envelopes</h2>
        </div>
        <div className="table-wrapper" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr>
                <th style={thStyle}>Team / Department</th>
                <th style={thStyle}>Headcount</th>
                <th style={thStyle}>Budget</th>
                <th style={{ ...thStyle, width: "100px" }}>Flexibility</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {envelopes?.map((env) => {
                const util = utilizationMap[env.id];
                const hcUsed = util?.headcountUsed ?? 0;
                const hcCap = util?.headcountCap ?? env.headcountCap;
                const budgetCommitted = parseFloat(String(util?.budgetCommitted ?? "0"));
                const totalBudget = parseFloat(env.totalCompBudget) || 0;
                const flexPct = util?.flexibilityPct ?? 0;
                const teamName = orgUnitMap[env.orgUnitId] || env.orgUnitId;

                return (
                  <tr key={env.id} style={{ borderBottom: "1px solid var(--border)" }}>
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
                      {flexPct.toFixed(1)}%
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={env.status} />
                    </td>
                  </tr>
                );
              })}
              {(!envelopes || envelopes.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "var(--text)" }}>
                    No envelopes found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Alerts */}
      <div className="card" style={{ ...cardStyle, marginTop: "24px" }}>
        <div className="card-header" style={cardHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: "18px" }}>
            Active Alerts
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
                  {alert.alertType} &middot; Enforcement: {alert.enforcement}
                </div>
              </div>
            </div>
          ))}
          {(!alerts || alerts.length === 0) && (
            <p style={{ textAlign: "center", color: "var(--text)", fontSize: "14px", padding: "24px 0" }}>
              No active alerts
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

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
