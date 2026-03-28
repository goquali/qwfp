import { useState, useEffect, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { get } from "../api/client";
import type {
  PlanningCycle,
  BudgetEnvelope,
  EnvelopeUtilization,
  JobSlot,
  ChangeRequest,
  DriftAlert,
  OrgUnit,
} from "../api/types";
import StatusBadge from "../components/StatusBadge";
import ProgressBar from "../components/ProgressBar";
import MoneyDisplay from "../components/MoneyDisplay";

export default function HRDashboard() {
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

  // Step 3: Fetch org units for team names
  const { data: orgUnits } = useApi<OrgUnit[]>("/org-units");

  const orgUnitMap = useMemo(() => {
    const map: Record<string, string> = {};
    orgUnits?.forEach((u) => {
      map[u.id] = u.name;
    });
    return map;
  }, [orgUnits]);

  const envelopeTeamMap = useMemo(() => {
    const map: Record<string, string> = {};
    envelopes?.forEach((e) => {
      map[e.id] = orgUnitMap[e.orgUnitId] || e.orgUnitId;
    });
    return map;
  }, [envelopes, orgUnitMap]);

  // Step 4: Batch-fetch slots for leaf envelopes (team-level)
  const [allSlots, setAllSlots] = useState<JobSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    if (!envelopes || envelopes.length === 0) return;
    // Fetch slots for all envelopes (leaf envelopes = those without children, but we fetch all)
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

  // Step 5: Batch-fetch utilization
  const [utilizationMap, setUtilizationMap] = useState<Record<string, EnvelopeUtilization>>({});

  useEffect(() => {
    if (!envelopes || envelopes.length === 0) return;
    Promise.all(
      envelopes.map((e) =>
        get<EnvelopeUtilization>(`/finance/envelopes/${e.id}/utilization`).catch(() => null),
      ),
    ).then((results) => {
      const map: Record<string, EnvelopeUtilization> = {};
      envelopes.forEach((e, i) => {
        if (results[i]) map[e.id] = results[i]!;
      });
      setUtilizationMap(map);
    });
  }, [envelopes]);

  // Step 6: Fetch change requests
  const { data: changeRequests, loading: crLoading } = useApi<ChangeRequest[]>("/hr/change-requests");

  // Step 7: Fetch alerts
  const { data: alerts, loading: alertsLoading } = useApi<DriftAlert[]>("/reconciliation/alerts");

  // Compute stats
  const stats = useMemo(() => {
    const openSlots = allSlots.filter(
      (s) => !["draft", "filled", "cancelled"].includes(s.status),
    ).length;

    const pendingCRs = changeRequests?.filter((cr) => cr.status === "pending").length ?? 0;
    const activeAlerts = alerts?.length ?? 0;

    let flexSum = 0;
    let flexCount = 0;
    Object.values(utilizationMap).forEach((u) => {
      if (u.flexibilityPct != null) {
        flexSum += u.flexibilityPct;
        flexCount++;
      }
    });
    const avgFlex = flexCount > 0 ? flexSum / flexCount : 0;

    return { openSlots, pendingCRs, activeAlerts, avgFlex };
  }, [allSlots, changeRequests, alerts, utilizationMap]);

  // Loading / error
  const isLoading = cyclesLoading || envelopesLoading || slotsLoading;
  const error = cyclesError || envelopesError;

  if (isLoading && !envelopes) {
    return <div className="loading" style={{ padding: "48px", textAlign: "center" }}>Loading HR data...</div>;
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
        <h1 style={{ fontSize: "32px", margin: "0 0 4px" }}>HR Orchestration</h1>
        <p style={{ color: "var(--text)", fontSize: "15px" }}>
          Manage hiring within budget guardrails
        </p>
      </div>

      {/* Stats Grid */}
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
          <div className="stat-label" style={statLabelStyle}>Open Slots</div>
          <div className="stat-value" style={statValueStyle}>{stats.openSlots}</div>
          <div className="stat-sub" style={statSubStyle}>{allSlots.length} total slots</div>
        </div>

        <div className="stat-card card" style={statCardStyle}>
          <div className="stat-label" style={statLabelStyle}>Pending Change Requests</div>
          <div className="stat-value" style={statValueStyle}>{stats.pendingCRs}</div>
          <div className="stat-sub" style={statSubStyle}>
            {changeRequests?.length ?? 0} total
          </div>
        </div>

        <div className="stat-card card" style={statCardStyle}>
          <div className="stat-label" style={statLabelStyle}>Active Alerts</div>
          <div className="stat-value" style={statValueStyle}>{stats.activeAlerts}</div>
          <div className="stat-sub" style={statSubStyle}>drift warnings</div>
        </div>

        <div className="stat-card card" style={statCardStyle}>
          <div className="stat-label" style={statLabelStyle}>Avg Flexibility</div>
          <div className="stat-value" style={statValueStyle}>{stats.avgFlex.toFixed(1)}%</div>
          <div className="stat-sub" style={statSubStyle}>budget headroom</div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "24px", alignItems: "start" }}>
        {/* Left column: Job Slots Table */}
        <div className="card" style={cardStyle}>
          <div className="card-header" style={cardHeaderStyle}>
            <h2 style={{ margin: 0, fontSize: "18px" }}>
              Job Slots
              <span style={{ fontWeight: 400, color: "var(--text)", fontSize: "14px" }}> ({allSlots.length})</span>
            </h2>
          </div>
          <div className="table-wrapper" style={{ overflowX: "auto", maxHeight: "600px", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Level</th>
                  <th style={thStyle}>Team</th>
                  <th style={thStyle}>Comp</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Start Date</th>
                </tr>
              </thead>
              <tbody>
                {allSlots.map((slot) => (
                  <tr key={slot.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 500, color: "var(--text-h)" }}>{slot.roleTitle}</span>
                    </td>
                    <td style={tdStyle}>{slot.level || "--"}</td>
                    <td style={tdStyle}>{envelopeTeamMap[slot.envelopeId] || "--"}</td>
                    <td style={tdStyle}>
                      {slot.totalComp ? <MoneyDisplay amount={slot.totalComp} compact /> : "--"}
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={slot.status} />
                    </td>
                    <td style={tdStyle}>
                      {slot.targetStartDate
                        ? new Date(slot.targetStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "--"}
                    </td>
                  </tr>
                ))}
                {allSlots.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "var(--text)" }}>
                      No job slots found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Flexibility Metrics */}
          <div className="card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: "18px" }}>Flexibility Metrics</h2>
            </div>
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {envelopes?.map((env) => {
                const util = utilizationMap[env.id];
                if (!util) return null;
                const teamName = orgUnitMap[env.orgUnitId] || env.orgUnitId;
                const hcCap = util.headcountCap ?? env.headcountCap;
                const hcUsed = util.headcountUsed ?? 0;
                const totalBudget = parseFloat(String(util.totalCompBudget ?? util.totalBudget ?? env.totalCompBudget)) || 0;
                const budgetCommitted = parseFloat(String(util.budgetCommitted ?? "0"));

                return (
                  <div key={env.id} style={{ paddingBottom: "12px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 500, color: "var(--text-h)", marginBottom: "8px", fontSize: "14px" }}>
                      {teamName}
                    </div>
                    <div style={{ display: "flex", gap: "16px", fontSize: "13px", marginBottom: "8px" }}>
                      <span>HC remaining: {hcCap - hcUsed}</span>
                      <span>Budget remaining: <MoneyDisplay amount={totalBudget - budgetCommitted} compact /></span>
                    </div>
                    <ProgressBar
                      value={budgetCommitted}
                      max={totalBudget}
                      label={`Flexibility: ${(util.flexibilityPct ?? 0).toFixed(1)}%`}
                    />
                  </div>
                );
              })}
              {(!envelopes || envelopes.length === 0) && (
                <p style={{ textAlign: "center", color: "var(--text)", fontSize: "14px" }}>
                  No envelope data
                </p>
              )}
            </div>
          </div>

          {/* Change Requests */}
          <div className="card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: "18px" }}>
                Change Requests
                {changeRequests && (
                  <span style={{ fontWeight: 400, color: "var(--text)", fontSize: "14px" }}>
                    {" "}({changeRequests.filter((cr) => cr.status === "pending").length} pending)
                  </span>
                )}
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "16px" }}>
              {changeRequests
                ?.filter((cr) => cr.status === "pending")
                .map((cr) => (
                  <div
                    key={cr.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 500, color: "var(--text-h)", fontSize: "14px" }}>
                          {cr.requestType}
                        </span>
                        {cr.fitsEnvelope === true && (
                          <span
                            className="badge"
                            style={{
                              display: "inline-block",
                              padding: "1px 8px",
                              borderRadius: "10px",
                              fontSize: "12px",
                              fontWeight: 500,
                              backgroundColor: "#dcfce7",
                              color: "#166534",
                            }}
                          >
                            Fits budget
                          </span>
                        )}
                        {cr.fitsEnvelope === false && (
                          <span
                            className="badge"
                            style={{
                              display: "inline-block",
                              padding: "1px 8px",
                              borderRadius: "10px",
                              fontSize: "12px",
                              fontWeight: 500,
                              backgroundColor: "#fef9c3",
                              color: "#854d0e",
                            }}
                          >
                            Needs amendment
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text)", marginBottom: "4px" }}>
                        {cr.description}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text)" }}>
                        {cr.targetRoleTitle && <>{cr.targetRoleTitle} {cr.targetLevel ? `(${cr.targetLevel})` : ""} &middot; </>}
                        {new Date(cr.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                  </div>
                ))}
              {(!changeRequests || changeRequests.filter((cr) => cr.status === "pending").length === 0) && (
                <p style={{ textAlign: "center", color: "var(--text)", fontSize: "14px", padding: "16px 0" }}>
                  No pending change requests
                </p>
              )}
            </div>
          </div>

          {/* Alerts Feed */}
          <div className="card" style={cardStyle}>
            <div className="card-header" style={cardHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: "18px" }}>
                Alerts
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
                    <div style={{ fontSize: "14px", color: "var(--text-h)", marginBottom: "2px" }}>
                      {alert.message}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text)" }}>
                      {alert.alertType}
                    </div>
                  </div>
                </div>
              ))}
              {(!alerts || alerts.length === 0) && (
                <p style={{ textAlign: "center", color: "var(--text)", fontSize: "14px", padding: "16px 0" }}>
                  No active alerts
                </p>
              )}
            </div>
          </div>
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
  position: "sticky",
  top: 0,
  backgroundColor: "var(--bg)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  verticalAlign: "middle",
};
