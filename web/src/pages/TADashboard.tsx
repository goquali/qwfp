import { useState, useEffect, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { get } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import ProgressBar from "../components/ProgressBar";
import MoneyDisplay from "../components/MoneyDisplay";
import type { User, Recruiter, RecruiterWorkload, CapacitySnapshot } from "../api/types";

interface ForecastResult {
  current: CapacitySnapshot;
  projectedReqs30d: number;
  projectedReqs60d: number;
  projectedReqs90d: number;
  recruiterMonthsNeeded30d: number;
  recruiterMonthsNeeded60d: number;
  recruiterMonthsNeeded90d: number;
  avgCapacityPerRecruiter: number;
}

interface VelocityMetrics {
  avgDaysToFill: number;
  medianDaysToFill: number;
  p75DaysToFill: number;
  avgCandidatesPerHire: number;
  sampleSize: number;
  jobFamilyId: string | null;
}

export default function TADashboard() {
  const [showBanner, setShowBanner] = useState(() => localStorage.getItem("qwfp-dismiss-ta") !== "true");
  const { data: capacity, loading: capLoading, error: capError } = useApi<CapacitySnapshot>("/ta/capacity");
  const { data: distribution, loading: distLoading } = useApi<RecruiterWorkload[]>("/ta/workload-distribution");
  const { data: forecast, loading: forecastLoading } = useApi<ForecastResult>("/ta/capacity/forecast");
  const { data: velocity, loading: velocityLoading } = useApi<VelocityMetrics>("/ta/velocity");
  const { data: recruitersList, loading: recruitersLoading } = useApi<Recruiter[]>("/ta/recruiters");
  const { data: users } = useApi<User[]>("/users");

  // Recruiter workloads (fetched individually)
  const [recruiterWorkloads, setRecruiterWorkloads] = useState<Record<string, RecruiterWorkload>>({});
  const [workloadsLoading, setWorkloadsLoading] = useState(false);

  // Build userId -> name map
  const userNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (users) {
      for (const u of users) {
        map[u.id] = u.name;
      }
    }
    return map;
  }, [users]);

  // Build recruiterId -> userId map
  const recruiterUserMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (recruitersList) {
      for (const r of recruitersList) {
        map[r.id] = r.userId;
      }
    }
    return map;
  }, [recruitersList]);

  // Helper: get recruiter display name from recruiterId
  function getRecruiterName(recruiterId: string): string {
    const userId = recruiterUserMap[recruiterId];
    if (userId && userNameMap[userId]) return userNameMap[userId];
    return recruiterId.slice(0, 8) + "...";
  }

  // Fetch individual recruiter workloads
  useEffect(() => {
    if (!recruitersList || recruitersList.length === 0) return;
    setWorkloadsLoading(true);

    const promises = recruitersList.map((r) =>
      get<RecruiterWorkload>(`/ta/recruiters/${r.id}/workload`)
        .then((wl) => ({ id: r.id, wl }))
        .catch(() => null),
    );

    Promise.all(promises).then((results) => {
      const map: Record<string, RecruiterWorkload> = {};
      for (const result of results) {
        if (result) map[result.id] = result.wl;
      }
      setRecruiterWorkloads(map);
      setWorkloadsLoading(false);
    });
  }, [recruitersList]);

  const isLoading = capLoading && distLoading && forecastLoading;

  if (isLoading) {
    return (
      <div>
        <div className="page-header">
          <h1>Recruiting Dashboard</h1>
          <p>Recruiter workload and hiring pipeline</p>
        </div>
        <div className="loading">Loading TA data...</div>
      </div>
    );
  }

  if (capError) {
    return (
      <div>
        <div className="page-header">
          <h1>Recruiting Dashboard</h1>
          <p>Recruiter workload and hiring pipeline</p>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <p style={{ color: "var(--danger)" }}>Failed to load capacity data: {capError}</p>
        </div>
      </div>
    );
  }

  const utilizationPct = capacity?.utilizationPct ?? 0;
  const utilizationColor =
    utilizationPct > 90 ? "var(--danger)" : utilizationPct > 70 ? "var(--warning)" : "var(--success)";

  const capacityGap = capacity?.capacityGap ?? 0;
  const gapIsOverloaded = capacityGap > 0;

  return (
    <div>
      <div className="page-header">
        <h1>Recruiting Dashboard</h1>
        <p>Recruiter workload and hiring pipeline</p>
      </div>

      {showBanner && (
        <div style={{ background: "#fef2f2", borderLeft: "4px solid var(--danger)", borderRadius: 8, padding: "12px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: 14, lineHeight: 1.6, color: "#991b1b" }}>
          <span>Your recruiting capacity dashboard. See who's overloaded, track how fast positions get filled, and forecast whether you need more recruiters to hit the hiring plan.</span>
          <button onClick={() => { setShowBanner(false); localStorage.setItem("qwfp-dismiss-ta", "true"); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#991b1b", marginLeft: 12, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Recruiters</div>
          <div className="stat-value">{capacity?.totalRecruiters ?? "—"}</div>
          <div className="stat-sub">registered recruiters</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Reqs</div>
          <div className="stat-value">{capacity?.activeReqs ?? "—"}</div>
          <div className="stat-sub">open / sourcing / offer</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Team Utilization</div>
          <div className="stat-value" style={{ color: utilizationColor }}>
            {utilizationPct.toFixed(1)}%
          </div>
          <div className="stat-sub">
            {utilizationPct <= 70 ? "healthy" : utilizationPct <= 90 ? "moderate" : "high load"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Capacity Gap</div>
          <div className="stat-value" style={{ color: gapIsOverloaded ? "var(--danger)" : "var(--success)" }}>
            {gapIsOverloaded ? "+" : ""}{capacityGap.toFixed(1)}
          </div>
          <div className="stat-sub">
            {gapIsOverloaded ? "overloaded" : "surplus capacity"}
          </div>
        </div>
      </div>

      {/* Workload Distribution */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">Workload Distribution</div>
        {distLoading ? (
          <div className="loading">Loading workload...</div>
        ) : !distribution || distribution.length === 0 ? (
          <p style={{ color: "var(--text-muted)", padding: 16 }}>No recruiters configured.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Recruiter</th>
                  <th>Active Reqs</th>
                  <th>Max Capacity</th>
                  <th>Utilization</th>
                  <th style={{ minWidth: 140 }}>Progress</th>
                  <th>Availability</th>
                </tr>
              </thead>
              <tbody>
                {distribution.map((wl) => (
                  <tr key={wl.recruiterId}>
                    <td style={{ fontWeight: 500 }}>{getRecruiterName(wl.recruiterId)}</td>
                    <td>{wl.activeAssignments}</td>
                    <td>{wl.maxActiveReqs}</td>
                    <td>{wl.utilizationPct.toFixed(1)}%</td>
                    <td>
                      <ProgressBar value={wl.activeAssignments} max={wl.maxActiveReqs} />
                    </td>
                    <td><StatusBadge status={wl.availability} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Capacity Forecast */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">Capacity Forecast</div>
        {forecastLoading ? (
          <div className="loading">Loading forecast...</div>
        ) : !forecast ? (
          <p style={{ color: "var(--text-muted)", padding: 16 }}>No forecast data available.</p>
        ) : (
          <div>
            <div className="stats-grid" style={{ marginBottom: 16 }}>
              <ForecastCard
                label="30 Days"
                projectedReqs={forecast.projectedReqs30d}
                recruiterMonths={forecast.recruiterMonthsNeeded30d}
                currentCapacity={forecast.current.availableCapacity}
              />
              <ForecastCard
                label="60 Days"
                projectedReqs={forecast.projectedReqs60d}
                recruiterMonths={forecast.recruiterMonthsNeeded60d}
                currentCapacity={forecast.current.availableCapacity}
              />
              <ForecastCard
                label="90 Days"
                projectedReqs={forecast.projectedReqs90d}
                recruiterMonths={forecast.recruiterMonthsNeeded90d}
                currentCapacity={forecast.current.availableCapacity}
              />
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "0 4px" }}>
              Avg capacity per recruiter: {forecast.avgCapacityPerRecruiter.toFixed(1)} reqs
            </p>
          </div>
        )}
      </div>

      {/* Pipeline Velocity */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">Pipeline Velocity</div>
        {velocityLoading ? (
          <div className="loading">Loading velocity...</div>
        ) : !velocity || velocity.sampleSize === 0 ? (
          <p style={{ color: "var(--text-muted)", padding: 16 }}>
            No filled positions yet — velocity metrics will appear once slots are filled.
          </p>
        ) : (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Avg Days to Fill</div>
              <div className="stat-value">{velocity.avgDaysToFill.toFixed(1)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Median Days to Fill</div>
              <div className="stat-value">{velocity.medianDaysToFill.toFixed(1)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">P75 Days to Fill</div>
              <div className="stat-value">{velocity.p75DaysToFill.toFixed(1)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Sample Size</div>
              <div className="stat-value">{velocity.sampleSize}</div>
              <div className="stat-sub">filled positions</div>
            </div>
          </div>
        )}
      </div>

      {/* Recruiter Details */}
      <div className="card">
        <div className="card-header">Recruiter Details</div>
        {recruitersLoading || workloadsLoading ? (
          <div className="loading">Loading recruiter details...</div>
        ) : !recruitersList || recruitersList.length === 0 ? (
          <p style={{ color: "var(--text-muted)", padding: 16 }}>No recruiters configured.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Recruiter</th>
                  <th>Availability</th>
                  <th>Availability %</th>
                  <th>Active Assignments</th>
                  <th>Max Capacity</th>
                  <th>Capacity Remaining</th>
                </tr>
              </thead>
              <tbody>
                {recruitersList.map((r) => {
                  const wl = recruiterWorkloads[r.id];
                  const active = wl?.activeAssignments ?? 0;
                  const remaining = r.maxActiveReqs - active;
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500 }}>
                        {userNameMap[r.userId] || r.userId.slice(0, 8) + "..."}
                      </td>
                      <td><StatusBadge status={r.availability} /></td>
                      <td>{parseFloat(r.availabilityPct).toFixed(0)}%</td>
                      <td>{active}</td>
                      <td>{r.maxActiveReqs}</td>
                      <td>
                        <span style={{ color: remaining <= 0 ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>
                          {remaining}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** Sub-component for forecast period cards */
function ForecastCard({
  label,
  projectedReqs,
  recruiterMonths,
  currentCapacity,
}: {
  label: string;
  projectedReqs: number;
  recruiterMonths: number;
  currentCapacity: number;
}) {
  const overCapacity = projectedReqs > currentCapacity;
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: overCapacity ? "var(--danger)" : "var(--success)" }}>
        {projectedReqs}
      </div>
      <div className="stat-sub">projected reqs</div>
      <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-muted)" }}>
        {recruiterMonths.toFixed(1)} recruiter-months needed
      </div>
    </div>
  );
}
