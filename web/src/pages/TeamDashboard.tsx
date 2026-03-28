import { useState, useEffect, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { get, post } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import ProgressBar from "../components/ProgressBar";
import MoneyDisplay from "../components/MoneyDisplay";
import type {
  OrgUnit,
  JobSlot,
  ChangeRequest,
} from "../api/types";

interface TeamCapacity {
  envelopeId: string;
  envelopeType: string;
  status: string;
  slotsByStatus: Record<string, number>;
  headcountCap: number;
  headcountUsed: number;
  headcountRemaining: number;
  budgetTotal: string;
  budgetCommitted: string;
  budgetRemaining: string;
}

const REQUEST_TYPES = [
  { value: "new_role", label: "New Role" },
  { value: "swap_role", label: "Swap Role" },
  { value: "modify_role", label: "Modify Role" },
  { value: "cancel_role", label: "Cancel Role" },
  { value: "accelerate", label: "Accelerate" },
  { value: "add_headcount", label: "Add Headcount" },
];

const LEVELS = ["L1", "L2", "L3", "L4", "L5", "L6"];

// Modal overlay style
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: "white",
  borderRadius: "12px",
  padding: "24px",
  width: "100%",
  maxWidth: "520px",
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  fontSize: 14,
  background: "var(--bg-card)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-muted)",
  marginBottom: 4,
};

interface Toast {
  message: string;
  type: "success" | "error" | "warning";
}

interface FeasibilityResult {
  fitsEnvelope: boolean | null;
  amendmentRequired: boolean | null;
  budgetImpact: string | null;
  suggestedOffset: string | null;
}

export default function TeamDashboard() {
  const { data: teams, loading: teamsLoading, error: teamsError } = useApi<OrgUnit[]>("/team/my-teams");

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<TeamCapacity[]>([]);
  const [slots, setSlots] = useState<JobSlot[]>([]);
  const [capacityLoading, setCapacityLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const { data: changeRequests, loading: crLoading, refetch: refetchCRs } = useApi<ChangeRequest[]>("/team/my-change-requests");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    requestType: "new_role",
    description: "",
    targetRoleTitle: "",
    targetLevel: "",
    desiredStartDate: "",
    replaceSlotId: "",
  });

  // Toast state
  const [toast, setToast] = useState<Toast | null>(null);

  // Feasibility result after submission
  const [feasibility, setFeasibility] = useState<FeasibilityResult | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Auto-select first team when teams load
  useEffect(() => {
    if (teams && teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  // Fetch capacity and slots when selected team changes
  useEffect(() => {
    if (!selectedTeamId) return;

    setCapacityLoading(true);
    setSlotsLoading(true);

    get<TeamCapacity[]>(`/team/my-teams/${selectedTeamId}/capacity`)
      .then(setCapacity)
      .catch(() => setCapacity([]))
      .finally(() => setCapacityLoading(false));

    get<JobSlot[]>(`/team/my-teams/${selectedTeamId}/slots`)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedTeamId]);

  // Derived stats
  const activeSlots = useMemo(
    () => slots.filter((s) => s.status !== "cancelled"),
    [slots],
  );

  const openPositions = useMemo(
    () => slots.filter((s) => !["draft", "filled", "cancelled"].includes(s.status)).length,
    [slots],
  );

  const filledPositions = useMemo(
    () => slots.filter((s) => s.status === "filled").length,
    [slots],
  );

  const budgetRemaining = useMemo(() => {
    return capacity.reduce((sum, c) => sum + parseFloat(c.budgetRemaining || "0"), 0);
  }, [capacity]);

  const crCount = changeRequests?.length ?? 0;

  const noTeams = !teamsLoading && (!teams || teams.length === 0);

  // Form handlers
  function openModal() {
    setFormData({
      requestType: "new_role",
      description: "",
      targetRoleTitle: "",
      targetLevel: "",
      desiredStartDate: "",
      replaceSlotId: "",
    });
    setFeasibility(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setFeasibility(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeamId || !formData.description.trim()) return;

    setSubmitting(true);
    try {
      const body: Record<string, any> = {
        orgUnitId: selectedTeamId,
        requestType: formData.requestType,
        description: formData.description,
      };
      if (formData.targetRoleTitle) body.targetRoleTitle = formData.targetRoleTitle;
      if (formData.targetLevel) body.targetLevel = formData.targetLevel;
      if (formData.desiredStartDate) body.desiredStartDate = formData.desiredStartDate;
      if (formData.replaceSlotId) body.replaceSlotId = formData.replaceSlotId;

      const result = await post<ChangeRequest>(
        `/team/my-teams/${selectedTeamId}/change-requests`,
        body,
      );

      // Show feasibility result
      setFeasibility({
        fitsEnvelope: result.fitsEnvelope,
        amendmentRequired: result.amendmentRequired,
        budgetImpact: result.budgetImpact,
        suggestedOffset: result.suggestedOffset,
      });

      if (result.fitsEnvelope) {
        setToast({ message: "Change request submitted successfully!", type: "success" });
      } else if (result.amendmentRequired) {
        setToast({ message: "Change request submitted — amendment required.", type: "warning" });
      } else {
        setToast({ message: "Change request submitted.", type: "success" });
      }

      // Refresh change requests list
      refetchCRs();

      // Close modal after a delay so user can see feasibility
      setTimeout(() => closeModal(), 3000);
    } catch (err: any) {
      setToast({
        message: err.message || "Failed to submit change request.",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (teamsLoading) {
    return (
      <div>
        <div className="page-header">
          <h1>Team Capacity</h1>
          <p>Your teams' hiring plan and open positions</p>
        </div>
        <div className="loading">Loading teams...</div>
      </div>
    );
  }

  if (teamsError) {
    return (
      <div>
        <div className="page-header">
          <h1>Team Capacity</h1>
          <p>Your teams' hiring plan and open positions</p>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <p style={{ color: "var(--danger)" }}>Failed to load teams: {teamsError}</p>
        </div>
      </div>
    );
  }

  if (noTeams) {
    return (
      <div>
        <div className="page-header">
          <h1>Team Capacity</h1>
          <p>Your teams' hiring plan and open positions</p>
        </div>
        <div className="card" style={{ marginTop: 16, textAlign: "center", padding: 48 }}>
          <p style={{ color: "var(--text-muted)", fontSize: 16 }}>
            No teams found. Switch to a business owner persona to see team data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Toast notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 1100,
            padding: "12px 20px",
            borderRadius: "var(--radius)",
            fontSize: 14,
            fontWeight: 500,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            color: "white",
            backgroundColor:
              toast.type === "success"
                ? "var(--success)"
                : toast.type === "warning"
                ? "var(--warning)"
                : "var(--danger)",
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Change Request Modal */}
      {showModal && (
        <div style={overlayStyle} onClick={() => !submitting && closeModal()}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Request Change</h2>
              <button
                onClick={closeModal}
                disabled={submitting}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: "4px 8px",
                }}
              >
                &#10005;
              </button>
            </div>

            {/* Feasibility result */}
            {feasibility && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "var(--radius)",
                  marginBottom: 16,
                  backgroundColor: feasibility.fitsEnvelope ? "var(--success-light)" : "var(--warning-light)",
                  color: feasibility.fitsEnvelope ? "var(--success)" : "var(--warning)",
                  fontSize: 14,
                }}
              >
                {feasibility.fitsEnvelope && (
                  <div style={{ fontWeight: 600 }}>Feasible! No amendment needed.</div>
                )}
                {feasibility.amendmentRequired && (
                  <>
                    <div style={{ fontWeight: 600 }}>Amendment required.</div>
                    {feasibility.budgetImpact && (
                      <div style={{ marginTop: 4 }}>
                        Budget impact: <MoneyDisplay amount={feasibility.budgetImpact} compact />
                      </div>
                    )}
                    {feasibility.suggestedOffset && (
                      <div style={{ marginTop: 2 }}>Suggested: {feasibility.suggestedOffset}</div>
                    )}
                  </>
                )}
                {feasibility.fitsEnvelope === false && !feasibility.amendmentRequired && (
                  <div style={{ fontWeight: 600, color: "var(--danger)" }}>Does not fit current envelope.</div>
                )}
              </div>
            )}

            {!feasibility && (
              <form onSubmit={handleSubmit}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Request Type</label>
                    <select
                      style={inputStyle}
                      value={formData.requestType}
                      onChange={(e) => setFormData({ ...formData, requestType: e.target.value })}
                    >
                      {REQUEST_TYPES.map((rt) => (
                        <option key={rt.value} value={rt.value}>{rt.label}</option>
                      ))}
                    </select>
                  </div>

                  {formData.requestType === "swap_role" && (
                    <div>
                      <label style={labelStyle}>Slot to Replace *</label>
                      <select
                        style={inputStyle}
                        required
                        value={formData.replaceSlotId}
                        onChange={(e) => setFormData({ ...formData, replaceSlotId: e.target.value })}
                      >
                        <option value="">Select the position to swap out</option>
                        {activeSlots
                          .filter((s) => s.status !== "filled")
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.roleTitle} ({s.level || "—"}) — {s.totalComp ? `$${Math.round(parseFloat(s.totalComp) / 1000)}k` : "no comp"} — {s.status}
                            </option>
                          ))}
                      </select>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                        Select the existing position you want to swap. The system will calculate the net budget impact.
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={labelStyle}>Description *</label>
                    <textarea
                      style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                      required
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe what you need and why..."
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Target Role Title</label>
                    <input
                      type="text"
                      style={inputStyle}
                      value={formData.targetRoleTitle}
                      onChange={(e) => setFormData({ ...formData, targetRoleTitle: e.target.value })}
                      placeholder="e.g. Senior Software Engineer"
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Target Level</label>
                      <select
                        style={inputStyle}
                        value={formData.targetLevel}
                        onChange={(e) => setFormData({ ...formData, targetLevel: e.target.value })}
                      >
                        <option value="">Select level</option>
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Desired Start Date</label>
                      <input
                        type="date"
                        style={inputStyle}
                        value={formData.desiredStartDate}
                        onChange={(e) => setFormData({ ...formData, desiredStartDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={submitting}
                      className="btn"
                      style={{
                        background: "var(--bg)",
                        color: "var(--text)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !formData.description.trim()}
                      className="btn btn-primary"
                      style={{ opacity: submitting ? 0.6 : 1 }}
                    >
                      {submitting ? "Submitting..." : "Submit Request"}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Page Header with Team Selector */}
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1>Team Capacity</h1>
          <p>Your teams' hiring plan and open positions</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {teams && teams.length > 1 && (
            <select
              value={selectedTeamId || ""}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                fontSize: 14,
                background: "var(--bg-card)",
              }}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn btn-primary" onClick={openModal}>
            Request Change
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Open Positions</div>
          <div className="stat-value">{openPositions}</div>
          <div className="stat-sub">active requisitions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Positions Filled</div>
          <div className="stat-value">{filledPositions}</div>
          <div className="stat-sub">of {activeSlots.length} total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Budget Remaining</div>
          <div className="stat-value">
            <MoneyDisplay amount={budgetRemaining} compact />
          </div>
          <div className="stat-sub">across all envelopes</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">My Change Requests</div>
          <div className="stat-value">{crCount}</div>
          <div className="stat-sub">submitted</div>
        </div>
      </div>

      {/* Team Capacity Table */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">Team Capacity</div>
        {capacityLoading ? (
          <div className="loading">Loading capacity...</div>
        ) : capacity.length === 0 ? (
          <p style={{ color: "var(--text-muted)", padding: 16 }}>No capacity data available.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Envelope</th>
                  <th>Status</th>
                  <th>Headcount</th>
                  <th style={{ minWidth: 140 }}>HC Progress</th>
                  <th>Budget Used</th>
                  <th style={{ minWidth: 140 }}>Budget Progress</th>
                </tr>
              </thead>
              <tbody>
                {capacity.map((cap) => {
                  const budgetTotal = parseFloat(cap.budgetTotal || "0");
                  const budgetUsed = parseFloat(cap.budgetCommitted || "0");
                  return (
                    <tr key={cap.envelopeId}>
                      <td>{cap.envelopeType}</td>
                      <td><StatusBadge status={cap.status} /></td>
                      <td>
                        {cap.headcountUsed} / {cap.headcountCap}
                      </td>
                      <td>
                        <ProgressBar value={cap.headcountUsed} max={cap.headcountCap} />
                      </td>
                      <td>
                        <MoneyDisplay amount={budgetUsed} compact /> / <MoneyDisplay amount={budgetTotal} compact />
                      </td>
                      <td>
                        <ProgressBar value={budgetUsed} max={budgetTotal} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Current Openings */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">Current Openings</div>
        {slotsLoading ? (
          <div className="loading">Loading slots...</div>
        ) : activeSlots.length === 0 ? (
          <p style={{ color: "var(--text-muted)", padding: 16 }}>No open positions.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th>Target Start</th>
                  <th>Comp</th>
                </tr>
              </thead>
              <tbody>
                {activeSlots.map((slot) => (
                  <tr key={slot.id}>
                    <td>{slot.roleTitle}</td>
                    <td>{slot.level || "\u2014"}</td>
                    <td><StatusBadge status={slot.status} /></td>
                    <td>{slot.targetStartDate ? new Date(slot.targetStartDate).toLocaleDateString() : "\u2014"}</td>
                    <td><MoneyDisplay amount={slot.totalComp} compact /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* My Change Requests */}
      <div className="card">
        <div className="card-header">My Change Requests</div>
        {crLoading ? (
          <div className="loading">Loading change requests...</div>
        ) : !changeRequests || changeRequests.length === 0 ? (
          <p style={{ color: "var(--text-muted)", padding: 16 }}>No change requests submitted.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Feasibility</th>
                  <th>Budget Impact</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {changeRequests.map((cr) => (
                  <tr key={cr.id}>
                    <td>{new Date(cr.createdAt).toLocaleDateString()}</td>
                    <td><StatusBadge status={cr.requestType} /></td>
                    <td>{cr.description}</td>
                    <td>
                      {cr.fitsEnvelope === true && (
                        <span style={{ color: "var(--success)", fontWeight: 600 }}>&#10003; Fits</span>
                      )}
                      {cr.amendmentRequired && (
                        <span style={{ color: "var(--warning)", fontWeight: 600 }}>&#9888; Amendment</span>
                      )}
                      {cr.fitsEnvelope === false && !cr.amendmentRequired && (
                        <span style={{ color: "var(--danger)", fontWeight: 600 }}>&#10007; No fit</span>
                      )}
                      {cr.fitsEnvelope === null && (
                        <span style={{ color: "var(--text-muted)" }}>Pending</span>
                      )}
                    </td>
                    <td><MoneyDisplay amount={cr.budgetImpact} compact /></td>
                    <td><StatusBadge status={cr.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
