import { useState, useEffect, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { get } from "../api/client";
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

export default function TeamDashboard() {
  const { data: teams, loading: teamsLoading, error: teamsError } = useApi<OrgUnit[]>("/team/my-teams");

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<TeamCapacity[]>([]);
  const [slots, setSlots] = useState<JobSlot[]>([]);
  const [capacityLoading, setCapacityLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const { data: changeRequests, loading: crLoading } = useApi<ChangeRequest[]>("/team/my-change-requests");

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
      {/* Page Header with Team Selector */}
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1>Team Capacity</h1>
          <p>Your teams' hiring plan and open positions</p>
        </div>
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
                    <td>{slot.level || "—"}</td>
                    <td><StatusBadge status={slot.status} /></td>
                    <td>{slot.targetStartDate ? new Date(slot.targetStartDate).toLocaleDateString() : "—"}</td>
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
