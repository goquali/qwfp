import { useState, useEffect, useMemo, useCallback } from "react";
import { useApi } from "../hooks/useApi";
import { get, post, patch } from "../api/client";
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

interface JobFamily {
  id: string;
  name: string;
  code: string;
}

type ToastState = { message: string; type: "success" | "error" } | null;

const LEVELS = ["L1", "L2", "L3", "L4", "L5", "L6"];
const WORKER_TYPES = ["fte", "contractor", "contingent"];

const SLOT_TRANSITIONS: Record<string, { label: string; next: string } | null> = {
  draft: { label: "Open", next: "open" },
  open: { label: "Start Sourcing", next: "sourcing" },
  sourcing: { label: "Make Offer", next: "offer" },
  offer: { label: "Mark Filled", next: "filled" },
  filled: null,
  cancelled: null,
};

export default function HRDashboard() {
  // Refresh key — increment after any mutation to re-fetch data
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Toast
  const [toast, setToast] = useState<ToastState>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  // Modal state
  const [showModal, setShowModal] = useState(false);

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

  // Step 3b: Fetch job families
  const { data: jobFamilies } = useApi<JobFamily[]>("/hr/job-families");

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

  // Team-level envelopes for the create form (leaf envelopes)
  const teamEnvelopes = useMemo(() => {
    if (!envelopes) return [];
    // Leaf envelopes = those whose id is NOT a parentEnvelopeId of any other envelope
    return envelopes.filter((e) => !envelopes.some((child) => child.parentEnvelopeId === e.id));
  }, [envelopes]);

  // Step 4: Batch-fetch slots for leaf envelopes (team-level)
  const [allSlots, setAllSlots] = useState<JobSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const fetchSlots = useCallback(() => {
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

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots, refreshKey]);

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
  }, [envelopes, refreshKey]);

  // Step 6: Fetch change requests
  const { data: changeRequests, refetch: refetchCRs } = useApi<ChangeRequest[]>("/hr/change-requests");

  // Step 7: Fetch alerts
  const { data: alerts, refetch: refetchAlerts } = useApi<DriftAlert[]>("/reconciliation/alerts");

  // Re-fetch CRs and alerts on refreshKey change
  useEffect(() => {
    if (refreshKey > 0) {
      refetchCRs();
      refetchAlerts();
    }
  }, [refreshKey, refetchCRs, refetchAlerts]);

  // Compute stats
  const stats = useMemo(() => {
    const openSlots = allSlots.filter(
      (s) => !["draft", "filled", "cancelled"].includes(s.status),
    ).length;

    const pendingCRs = changeRequests?.filter((cr) => !["completed", "rejected"].includes(cr.status)).length ?? 0;
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

  // --- Slot status transition ---
  const [transitioningSlot, setTransitioningSlot] = useState<string | null>(null);

  const handleSlotTransition = async (slotId: string, nextStatus: string) => {
    setTransitioningSlot(slotId);
    try {
      await post(`/hr/slots/${slotId}/status`, { status: nextStatus });
      showToast(`Slot transitioned to ${nextStatus}`, "success");
      refresh();
    } catch (err: any) {
      showToast(err.message || "Failed to transition slot", "error");
    } finally {
      setTransitioningSlot(null);
    }
  };

  const handleCancelSlot = async (slotId: string) => {
    setTransitioningSlot(slotId);
    try {
      await post(`/hr/slots/${slotId}/status`, { status: "cancelled" });
      showToast("Slot cancelled", "success");
      refresh();
    } catch (err: any) {
      showToast(err.message || "Failed to cancel slot", "error");
    } finally {
      setTransitioningSlot(null);
    }
  };

  // --- Change request approve/reject ---
  const [actingOnCR, setActingOnCR] = useState<string | null>(null);

  const handleCRAction = async (crId: string, status: "approved" | "rejected") => {
    setActingOnCR(crId);
    try {
      await patch(`/hr/change-requests/${crId}`, { status });
      showToast(`Change request ${status}`, "success");
      refresh();
    } catch (err: any) {
      showToast(err.message || `Failed to ${status} change request`, "error");
    } finally {
      setActingOnCR(null);
    }
  };

  // --- Alert dismiss ---
  const [dismissingAlert, setDismissingAlert] = useState<string | null>(null);

  const handleDismissAlert = async (alertId: string) => {
    setDismissingAlert(alertId);
    try {
      await patch(`/reconciliation/alerts/${alertId}`, { status: "acknowledged" });
      showToast("Alert dismissed", "success");
      refresh();
    } catch (err: any) {
      showToast(err.message || "Failed to dismiss alert", "error");
    } finally {
      setDismissingAlert(null);
    }
  };

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
    <div style={{ padding: "24px", textAlign: "left", position: "relative" }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
            padding: "10px 24px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            color: "#fff",
            backgroundColor: toast.type === "success" ? "var(--success)" : "var(--danger)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: "32px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "32px", margin: "0 0 4px" }}>HR Orchestration</h1>
          <p style={{ color: "var(--text)", fontSize: "15px" }}>
            Manage hiring within budget guardrails
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
        >
          + New Slot
        </button>
      </div>

      {/* Create Slot Modal */}
      {showModal && (
        <CreateSlotModal
          envelopes={teamEnvelopes}
          envelopeTeamMap={envelopeTeamMap}
          jobFamilies={jobFamilies ?? []}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            showToast("Job slot created", "success");
            refresh();
          }}
          onError={(msg) => showToast(msg, "error")}
        />
      )}

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
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {allSlots.map((slot) => {
                  const transition = SLOT_TRANSITIONS[slot.status] ?? null;
                  const isTransitioning = transitioningSlot === slot.id;
                  const canCancel = !["filled", "cancelled"].includes(slot.status);

                  return (
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
                      <td style={tdStyle}>
                        {transition ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                            <button
                              className="btn btn-sm btn-primary"
                              disabled={isTransitioning}
                              onClick={() => handleSlotTransition(slot.id, transition.next)}
                              style={{ opacity: isTransitioning ? 0.6 : 1 }}
                            >
                              {isTransitioning ? "..." : transition.label}
                            </button>
                            {canCancel && (
                              <button
                                disabled={isTransitioning}
                                onClick={() => handleCancelSlot(slot.id)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "var(--danger)",
                                  fontSize: "12px",
                                  cursor: isTransitioning ? "default" : "pointer",
                                  padding: "2px 4px",
                                  opacity: isTransitioning ? 0.5 : 1,
                                }}
                              >
                                Cancel
                              </button>
                            )}
                          </span>
                        ) : canCancel ? (
                          <button
                            disabled={isTransitioning}
                            onClick={() => handleCancelSlot(slot.id)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--danger)",
                              fontSize: "12px",
                              cursor: isTransitioning ? "default" : "pointer",
                              padding: "2px 4px",
                              opacity: isTransitioning ? 0.5 : 1,
                            }}
                          >
                            Cancel
                          </button>
                        ) : (
                          <span style={{ color: "var(--text)", fontSize: "13px" }}>&mdash;</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {allSlots.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "var(--text)" }}>
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
                    {" "}({changeRequests.filter((cr) => !["completed", "rejected"].includes(cr.status)).length} open)
                  </span>
                )}
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "16px" }}>
              {changeRequests
                ?.filter((cr) => !["completed", "rejected"].includes(cr.status))
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
                      <div style={{ fontSize: "12px", color: "var(--text)", marginBottom: "4px" }}>
                        {cr.targetRoleTitle && <>{cr.targetRoleTitle} {cr.targetLevel ? `(${cr.targetLevel})` : ""} &middot; </>}
                        {new Date(cr.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                      {/* Budget Impact Analysis */}
                      <div style={{
                        background: cr.fitsEnvelope ? "#f0fdf4" : "#fefce8",
                        border: `1px solid ${cr.fitsEnvelope ? "#bbf7d0" : "#fef08a"}`,
                        borderRadius: "6px",
                        padding: "8px 10px",
                        marginBottom: "8px",
                        fontSize: "12px",
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: "4px", color: cr.fitsEnvelope ? "#166534" : "#854d0e" }}>
                          {cr.fitsEnvelope ? "Within Budget" : "Exceeds Budget — Amendment Required"}
                        </div>
                        {cr.budgetImpact && (
                          <div>Budget impact: <strong><MoneyDisplay amount={cr.budgetImpact} compact /></strong></div>
                        )}
                        {cr.suggestedOffset && (
                          <div style={{ marginTop: "2px" }}>Suggested offset: {cr.suggestedOffset}</div>
                        )}
                        {cr.amendmentRequired && !cr.suggestedOffset && (
                          <div style={{ marginTop: "2px", fontStyle: "italic" }}>Finance approval will be needed before HR can execute this change.</div>
                        )}
                        {cr.fitsEnvelope && (
                          <div style={{ marginTop: "2px" }}>HR can execute immediately — no finance approval needed.</div>
                        )}
                      </div>
                      {/* Approve / Reject buttons */}
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        <button
                          className="btn btn-sm"
                          disabled={actingOnCR === cr.id}
                          onClick={() => handleCRAction(cr.id, "approved")}
                          style={{
                            backgroundColor: "var(--success)",
                            color: "#fff",
                            opacity: actingOnCR === cr.id ? 0.6 : 1,
                          }}
                        >
                          {actingOnCR === cr.id ? "..." : "Approve"}
                        </button>
                        <button
                          disabled={actingOnCR === cr.id}
                          onClick={() => handleCRAction(cr.id, "rejected")}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--danger)",
                            fontSize: "13px",
                            fontWeight: 500,
                            cursor: actingOnCR === cr.id ? "default" : "pointer",
                            padding: "4px 10px",
                            opacity: actingOnCR === cr.id ? 0.5 : 1,
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              {(!changeRequests || changeRequests.filter((cr) => !["completed", "rejected"].includes(cr.status)).length === 0) && (
                <p style={{ textAlign: "center", color: "var(--text)", fontSize: "14px", padding: "16px 0" }}>
                  No open change requests
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
                  <button
                    className="btn btn-sm"
                    disabled={dismissingAlert === alert.id}
                    onClick={() => handleDismissAlert(alert.id)}
                    style={{
                      background: "none",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      fontSize: "12px",
                      cursor: dismissingAlert === alert.id ? "default" : "pointer",
                      opacity: dismissingAlert === alert.id ? 0.5 : 1,
                      flexShrink: 0,
                    }}
                  >
                    {dismissingAlert === alert.id ? "..." : "Dismiss"}
                  </button>
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

// ============================================================
// Create Slot Modal
// ============================================================

interface CreateSlotModalProps {
  envelopes: BudgetEnvelope[];
  envelopeTeamMap: Record<string, string>;
  jobFamilies: JobFamily[];
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

function CreateSlotModal({ envelopes, envelopeTeamMap, jobFamilies, onClose, onSuccess, onError }: CreateSlotModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [envelopeId, setEnvelopeId] = useState(envelopes[0]?.id ?? "");
  const [roleTitle, setRoleTitle] = useState("");
  const [level, setLevel] = useState("L3");
  const [jobFamilyId, setJobFamilyId] = useState(jobFamilies[0]?.id ?? "");
  const [baseSalary, setBaseSalary] = useState("");
  const [equityValue, setEquityValue] = useState("");
  const [bonusTarget, setBonusTarget] = useState("");
  const [benefitsCost, setBenefitsCost] = useState("");
  const [workerType, setWorkerType] = useState("fte");
  const [targetStartDate, setTargetStartDate] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTitle.trim()) {
      setFormError("Role title is required");
      return;
    }
    if (!envelopeId) {
      setFormError("Please select an envelope");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const toMoney = (val: string) => {
      const n = parseFloat(val);
      return isNaN(n) ? undefined : `${n.toFixed(2)}`;
    };

    const body: Record<string, any> = {
      roleTitle: roleTitle.trim(),
      level,
      workerType,
    };

    if (jobFamilyId) body.jobFamilyId = jobFamilyId;
    if (baseSalary) body.baseSalary = toMoney(baseSalary);
    if (equityValue) body.equityValue = toMoney(equityValue);
    if (bonusTarget) body.bonusTarget = toMoney(bonusTarget);
    if (benefitsCost) body.benefitsCost = toMoney(benefitsCost);
    if (targetStartDate) body.targetStartDate = targetStartDate;

    try {
      await post(`/hr/envelopes/${envelopeId}/slots`, body);
      onSuccess();
    } catch (err: any) {
      const msg = err.message || err.error || "Failed to create slot";
      setFormError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "500px",
          width: "90%",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "20px" }}>New Job Slot</h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text)", padding: "4px" }}
          >
            &times;
          </button>
        </div>

        {formError && (
          <div style={{ padding: "8px 12px", borderRadius: "var(--radius)", backgroundColor: "var(--danger-light)", color: "var(--danger)", fontSize: "13px", marginBottom: "16px" }}>
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Envelope */}
          <div style={{ marginBottom: "16px" }}>
            <label style={formLabelStyle}>Envelope</label>
            <select
              value={envelopeId}
              onChange={(e) => setEnvelopeId(e.target.value)}
              style={formInputStyle}
            >
              {envelopes.map((env) => (
                <option key={env.id} value={env.id}>
                  {envelopeTeamMap[env.id] || env.id}
                </option>
              ))}
            </select>
          </div>

          {/* Role Title */}
          <div style={{ marginBottom: "16px" }}>
            <label style={formLabelStyle}>Role Title</label>
            <input
              type="text"
              required
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              style={formInputStyle}
            />
          </div>

          {/* Level + Job Family row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div>
              <label style={formLabelStyle}>Level</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)} style={formInputStyle}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={formLabelStyle}>Job Family</label>
              <select value={jobFamilyId} onChange={(e) => setJobFamilyId(e.target.value)} style={formInputStyle}>
                <option value="">-- Select --</option>
                {jobFamilies.map((jf) => (
                  <option key={jf.id} value={jf.id}>{jf.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Salary + Equity row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div>
              <label style={formLabelStyle}>Base Salary</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
                placeholder="150000"
                style={formInputStyle}
              />
            </div>
            <div>
              <label style={formLabelStyle}>Equity Value</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={equityValue}
                onChange={(e) => setEquityValue(e.target.value)}
                placeholder="50000"
                style={formInputStyle}
              />
            </div>
          </div>

          {/* Bonus + Benefits row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div>
              <label style={formLabelStyle}>Bonus Target</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={bonusTarget}
                onChange={(e) => setBonusTarget(e.target.value)}
                placeholder="20000"
                style={formInputStyle}
              />
            </div>
            <div>
              <label style={formLabelStyle}>Benefits Cost</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={benefitsCost}
                onChange={(e) => setBenefitsCost(e.target.value)}
                placeholder="15000"
                style={formInputStyle}
              />
            </div>
          </div>

          {/* Worker Type + Start Date row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
            <div>
              <label style={formLabelStyle}>Worker Type</label>
              <select value={workerType} onChange={(e) => setWorkerType(e.target.value)} style={formInputStyle}>
                {WORKER_TYPES.map((wt) => (
                  <option key={wt} value={wt}>{wt}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={formLabelStyle}>Target Start Date</label>
              <input
                type="date"
                value={targetStartDate}
                onChange={(e) => setTargetStartDate(e.target.value)}
                style={formInputStyle}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                background: "white",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? "Creating..." : "Create Slot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Inline style constants
// ============================================================

const formLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 500,
  marginBottom: "4px",
  color: "var(--text-h)",
};

const formInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: "14px",
  boxSizing: "border-box",
};

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
