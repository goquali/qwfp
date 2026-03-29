import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { get } from "../api/client";
import MoneyDisplay from "../components/MoneyDisplay";
import ProgressBar from "../components/ProgressBar";
import type {
  PlanningCycle,
  BudgetEnvelope,
  EnvelopeUtilization,
  JobSlot,
  DriftAlert,
  OrgUnit,
  CapacitySnapshot,
} from "../api/types";

interface DemoData {
  divisions: { name: string; budget: number; headcount: number; filled: number }[];
  pipeline: Record<string, number>;
  totalBudget: number;
  totalHeadcount: number;
  totalFilled: number;
  alertCount: number;
  taUtilization: number;
  budgetCommittedPct: number;
}

const TOTAL_STEPS = 7; // 0=hero, 1-5=steps, 6=CTA

const PIPELINE_COLORS: Record<string, string> = {
  draft: "#929C92",
  open: "#22A652",
  sourcing: "#1B8A43",
  offer: "#A6A022",
  filled: "#22A652",
};

const PIPELINE_LABELS: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  sourcing: "Sourcing",
  offer: "Offer",
  filled: "Filled",
};

const PIPELINE_ORDER = ["draft", "open", "sourcing", "offer", "filled"];

const BUDGET_BAR_COLORS = [
  "#22A652",
  "#1B8A43",
  "#A6A022",
  "#A62222",
  "#232A23",
];

export default function GuidedDemo() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      try {
        // 1. Get planning cycles -> active cycle
        const cycles = await get<PlanningCycle[]>("/finance/planning-cycles");
        const activeCycle = cycles.find((c) => c.status === "active") ?? cycles[0];
        if (!activeCycle) throw new Error("No planning cycle found");

        // 2. Get envelopes
        const envelopes = await get<BudgetEnvelope[]>(
          `/finance/planning-cycles/${activeCycle.id}/envelopes`
        );

        // 3. Get org units for names
        const orgUnits = await get<OrgUnit[]>("/org-units");
        const orgMap: Record<string, string> = {};
        orgUnits.forEach((u) => { orgMap[u.id] = u.name; });

        // 4. Batch utilization
        const utilResults = await Promise.all(
          envelopes.map((e) =>
            get<EnvelopeUtilization>(`/finance/envelopes/${e.id}/utilization`).catch(() => null)
          )
        );
        const utilMap: Record<string, EnvelopeUtilization> = {};
        envelopes.forEach((e, i) => {
          if (utilResults[i]) utilMap[e.id] = utilResults[i]!;
        });

        // 5. Batch slots
        const slotResults = await Promise.all(
          envelopes.map((e) =>
            get<JobSlot[]>(`/hr/envelopes/${e.id}/slots`).catch(() => [] as JobSlot[])
          )
        );
        const allSlots: JobSlot[] = [];
        slotResults.forEach((r) => allSlots.push(...r));

        // 6. Alerts
        const alerts = await get<DriftAlert[]>("/reconciliation/alerts").catch(() => [] as DriftAlert[]);

        // 7. TA capacity
        const taCapacity = await get<CapacitySnapshot>("/ta/capacity").catch(() => null);

        // Build DemoData
        const topLevel = envelopes.filter((e) => !e.parentEnvelopeId);

        const divisions = topLevel.map((env, idx) => {
          const util = utilMap[env.id];
          const childEnvIds = [env.id, ...envelopes.filter((e) => e.parentEnvelopeId === env.id).map((e) => e.id)];
          const filled = allSlots.filter(
            (s) => s.status === "filled" && childEnvIds.includes(s.envelopeId)
          ).length;
          return {
            name: orgMap[env.orgUnitId] || env.envelopeType,
            budget: parseFloat(env.totalCompBudget) || 0,
            headcount: env.headcountCap,
            filled,
          };
        });

        const totalBudget = topLevel.reduce((s, e) => s + (parseFloat(e.totalCompBudget) || 0), 0);
        const totalHeadcount = topLevel.reduce((s, e) => s + e.headcountCap, 0);
        const totalFilled = allSlots.filter((s) => s.status === "filled").length;

        let budgetCommitted = 0;
        for (const env of topLevel) {
          const util = utilMap[env.id];
          if (util) budgetCommitted += parseFloat(String(util.budgetCommitted)) || 0;
        }
        const budgetCommittedPct = totalBudget > 0 ? (budgetCommitted / totalBudget) * 100 : 0;

        const pipeline: Record<string, number> = {};
        for (const status of PIPELINE_ORDER) pipeline[status] = 0;
        for (const slot of allSlots) {
          if (pipeline[slot.status] !== undefined) pipeline[slot.status]++;
        }

        const alertCount = Array.isArray(alerts) ? alerts.filter((a) => a.status === "open" || a.status === "active").length : 0;
        const taUtilization = taCapacity?.utilizationPct ?? 0;

        setData({
          divisions,
          pipeline,
          totalBudget,
          totalHeadcount,
          totalFilled,
          alertCount: Array.isArray(alerts) ? alerts.length : 0,
          taUtilization,
          budgetCommittedPct,
        });
      } catch (err: any) {
        setError(err.message || "Failed to load demo data");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const maxBudget = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.divisions.map((d) => d.budget));
  }, [data]);

  const maxPipeline = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...Object.values(data.pipeline));
  }, [data]);

  const totalPipelineCount = useMemo(() => {
    if (!data) return 0;
    return Object.values(data.pipeline).reduce((s, v) => s + v, 0);
  }, [data]);

  function goNext() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  // Loading state
  if (loading) {
    return (
      <div style={pageWrapperStyle}>
        <div style={{ textAlign: "center", padding: "120px 24px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "18px", marginBottom: "8px" }}>Loading demo data...</div>
          <div style={{ fontSize: "14px" }}>Connecting to the QWFP platform</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={pageWrapperStyle}>
        <div style={{ textAlign: "center", padding: "120px 24px" }}>
          <div style={{ fontSize: "18px", color: "#ef4444", marginBottom: "8px" }}>
            Something went wrong
          </div>
          <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrapperStyle}>
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* Step content with animation */}
        <div key={step} className="step-enter">
          {step === 0 && renderHero()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
          {step === 6 && renderCTA()}
        </div>

        {/* Navigation */}
        <div style={navBarStyle}>
          <div>
            {step > 0 && (
              <button onClick={goBack} style={navBtnStyle}>
                &larr; Back
              </button>
            )}
          </div>

          {/* Progress dots */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                style={{
                  width: i === step ? "24px" : "10px",
                  height: "10px",
                  borderRadius: "5px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: i === step ? "var(--primary)" : "var(--border)",
                  transition: "all 0.3s ease",
                }}
                aria-label={`Go to step ${i}`}
              />
            ))}
          </div>

          <div>
            {step < TOTAL_STEPS - 1 && step > 0 && (
              <button onClick={goNext} className="btn btn-primary" style={{ fontSize: "14px" }}>
                Next &rarr;
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inline animation keyframes */}
      <style>{`
        .step-enter {
          animation: fadeInUp 0.4s ease-out;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );

  // ─── HERO (step 0) ───────────────────────────────────────────────
  function renderHero() {
    return (
      <div style={{ textAlign: "center", padding: "60px 0 40px" }}>
        <div className="page-header">
          <h1
            style={{
              fontSize: "40px",
              fontWeight: 500,
              letterSpacing: "-0.8px",
              color: "var(--text)",
              marginBottom: "16px",
            }}
          >
            Meet TechCorp
          </h1>
        </div>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "18px",
            lineHeight: 1.7,
            maxWidth: "520px",
            margin: "0 auto 32px",
          }}
        >
          Series C startup. 200 employees.
          <br />
          Scaling to 300 this year.
        </p>

        {/* Stats badges */}
        <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "40px", flexWrap: "wrap" }}>
          <span style={heroBadgeStyle}>
            <MoneyDisplay amount={data!.totalBudget} compact /> budget
          </span>
          <span style={heroBadgeStyle}>
            {data!.totalHeadcount} positions
          </span>
          <span style={heroBadgeStyle}>
            {data!.divisions.length} divisions
          </span>
        </div>

        <button
          onClick={goNext}
          className="btn btn-primary"
          style={{
            fontSize: "14px",
            padding: "14px 32px",
            borderRadius: "4px",
            fontWeight: 500,
            background: "#232A23",
            color: "white",
          }}
        >
          Start the Tour &rarr;
        </button>
      </div>
    );
  }

  // ─── STEP 1: Finance Sets the Guardrails ─────────────────────────
  function renderStep1() {
    return (
      <div style={stepCardStyle}>
        {renderStepHeader(1, "Finance Sets the Guardrails", "Division budgets define what's possible")}

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
          {data!.divisions.map((div, idx) => {
            const widthPct = Math.max(8, (div.budget / maxBudget) * 100);
            return (
              <div key={div.name}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--text)" }}>{div.name}</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>
                    <MoneyDisplay amount={div.budget} compact />
                  </span>
                </div>
                <div
                  style={{
                    height: "40px",
                    width: `${widthPct}%`,
                    borderRadius: "8px",
                    background: BUDGET_BAR_COLORS[idx % BUDGET_BAR_COLORS.length],
                    transition: "width 0.5s ease",
                  }}
                />
                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                  {div.filled} of {div.headcount} positions
                </div>
              </div>
            );
          })}
        </div>

        {renderCallout(
          "Finance defines team budgets with headcount caps and salary ranges. They don't manage individual roles \u2014 they set the guardrails and let HR operate within them."
        )}
      </div>
    );
  }

  // ─── STEP 2: HR Orchestrates the Hiring ──────────────────────────
  function renderStep2() {
    return (
      <div style={stepCardStyle}>
        {renderStepHeader(2, "HR Orchestrates the Hiring", "Positions flow through a structured pipeline")}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
          {PIPELINE_ORDER.map((status, idx) => {
            const count = data!.pipeline[status] || 0;
            const widthPct = Math.max(10, (count / maxPipeline) * 100);
            const isLast = idx === PIPELINE_ORDER.length - 1;
            return (
              <div key={status}>
                <div
                  style={{
                    height: "48px",
                    width: `${widthPct}%`,
                    borderRadius: "10px",
                    backgroundColor: PIPELINE_COLORS[status],
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 16px",
                    color: "white",
                    fontWeight: 600,
                    fontSize: "14px",
                    transition: "width 0.5s ease",
                    minWidth: "120px",
                  }}
                >
                  <span>{PIPELINE_LABELS[status]}</span>
                  <span>{count}</span>
                </div>
                {!isLast && (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "16px", padding: "2px 0", marginLeft: "20px" }}>
                    &#8595;
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: "15px", color: "var(--text)", marginBottom: "20px" }}>
          <strong>{totalPipelineCount}</strong> positions in pipeline, <strong>{data!.totalFilled}</strong> filled
        </div>

        {renderCallout(
          "HR creates specific positions within budgets. As long as total headcount and comp stay within the team budget, HR has full autonomy \u2014 no approvals needed."
        )}
      </div>
    );
  }

  // ─── STEP 3: A Business Owner Needs to Pivot ─────────────────────
  function renderStep3() {
    return (
      <div style={stepCardStyle}>
        {renderStepHeader(3, "A Business Owner Needs to Pivot", "Structured requests with instant feasibility")}

        {/* Scenario card */}
        <div style={scenarioCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <span style={{ fontSize: "20px" }}>&#128260;</span>
            <span style={{ fontWeight: 700, fontSize: "16px", color: "var(--text)" }}>Change Request</span>
          </div>

          <div style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "4px" }}>
            <strong style={{ color: "var(--text)" }}>From:</strong> Priya Patel, VP Engineering
          </div>
          <div style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "16px" }}>
            <strong style={{ color: "var(--text)" }}>Type:</strong> Swap Role
          </div>

          <div
            style={{
              fontSize: "15px",
              color: "var(--text)",
              lineHeight: 1.6,
              fontStyle: "italic",
              marginBottom: "20px",
              padding: "0 8px",
            }}
          >
            "I need to swap our open Backend Engineer position for a Senior ML Engineer. The team is pivoting to build our ML pipeline."
          </div>

          {/* Feasibility box */}
          <div
            style={{
              background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
              border: "1px solid #bbf7d0",
              borderRadius: "10px",
              padding: "16px",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#166534", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
              Auto-Feasibility
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px", color: "#15803d" }}>
              <div>&#9989; Fits within team budget</div>
              <div>Budget impact: +$12,000/year</div>
              <div>Headroom remaining: $85,000</div>
              <div style={{ fontWeight: 600, marginTop: "4px" }}>&rarr; HR can execute immediately</div>
            </div>
          </div>
        </div>

        {renderCallout(
          "Business owners submit structured requests. The system instantly calculates the budget impact and tells everyone if it fits \u2014 no spreadsheets, no waiting."
        )}
      </div>
    );
  }

  // ─── STEP 4: HR Reviews With Full Context ────────────────────────
  function renderStep4() {
    return (
      <div style={stepCardStyle}>
        {renderStepHeader(4, "HR Reviews With Full Context", "Pre-analyzed requests, instant decisions")}

        {/* Review card */}
        <div style={scenarioCardStyle}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", marginBottom: "16px" }}>
            Incoming Request
          </div>

          <div style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "4px" }}>
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: "4px",
                backgroundColor: "var(--primary-light)",
                color: "var(--primary)",
                fontWeight: 500,
                fontSize: "13px",
                marginRight: "8px",
              }}
            >
              swap_role
            </span>
            from Priya Patel
          </div>
          <div style={{ fontSize: "15px", color: "var(--text)", marginBottom: "20px" }}>
            "Swap Backend Engineer &rarr; Senior ML Engineer"
          </div>

          {/* Budget analysis box */}
          <div
            style={{
              border: "1px solid #bbf7d0",
              borderRadius: "10px",
              overflow: "hidden",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 16px",
                background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
                borderBottom: "1px solid #bbf7d0",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: "14px", color: "#166534" }}>Budget Analysis</span>
              <span style={{ fontWeight: 700, fontSize: "13px", color: "#16a34a" }}>&#9989; Within Budget</span>
            </div>
            <div style={{ padding: "14px 16px", fontSize: "14px", color: "var(--text)", lineHeight: 1.7 }}>
              Budget impact: <strong>+$12,000</strong>
              <br />
              HR can execute immediately &mdash; no Finance approval needed.
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, padding: "10px 16px", fontSize: "14px", borderRadius: "8px" }}
              onClick={(e) => e.preventDefault()}
            >
              Approve
            </button>
            <button
              className="btn"
              style={{
                flex: 1,
                padding: "10px 16px",
                fontSize: "14px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                backgroundColor: "white",
                color: "var(--text)",
                cursor: "pointer",
              }}
              onClick={(e) => e.preventDefault()}
            >
              Reject
            </button>
          </div>
        </div>

        {renderCallout(
          "HR sees every request pre-analyzed with the dollar impact. Green means execute immediately. Yellow means the system has already drafted the budget request for Finance."
        )}
      </div>
    );
  }

  // ─── STEP 5: Everyone Sees Progress ──────────────────────────────
  function renderStep5() {
    const fillRate = data!.totalHeadcount > 0
      ? (data!.totalFilled / data!.totalHeadcount) * 100
      : 0;

    function statusColor(val: number, greenBelow: number, yellowBelow: number) {
      if (val <= greenBelow) return "#22c55e";
      if (val <= yellowBelow) return "#eab308";
      return "#ef4444";
    }

    function fillColor(val: number) {
      if (val >= 60) return "#22c55e";
      if (val >= 30) return "#eab308";
      return "#ef4444";
    }

    function alertColor(count: number) {
      if (count === 0) return "#22c55e";
      if (count <= 3) return "#eab308";
      return "#ef4444";
    }

    return (
      <div style={stepCardStyle}>
        {renderStepHeader(5, "Everyone Sees Progress", "Real-time visibility across the organization")}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          {/* Fill Rate */}
          <div style={metricCardStyle}>
            <div style={metricLabelStyle}>Fill Rate</div>
            <div style={{ ...metricValueStyle, color: fillColor(fillRate) }}>
              {fillRate.toFixed(0)}%
            </div>
            <div style={{ marginTop: "8px" }}>
              <ProgressBar value={data!.totalFilled} max={data!.totalHeadcount} label="" />
            </div>
            <div style={metricSubStyle}>
              {data!.totalFilled} of {data!.totalHeadcount} positions filled
            </div>
          </div>

          {/* Budget Committed */}
          <div style={metricCardStyle}>
            <div style={metricLabelStyle}>Budget Committed</div>
            <div style={{ ...metricValueStyle, color: statusColor(data!.budgetCommittedPct, 70, 90) }}>
              {data!.budgetCommittedPct.toFixed(0)}%
            </div>
            <div style={{ marginTop: "8px" }}>
              <ProgressBar value={data!.budgetCommittedPct} max={100} label="" />
            </div>
            <div style={metricSubStyle}>of total hiring budget</div>
          </div>

          {/* Active Alerts */}
          <div style={metricCardStyle}>
            <div style={metricLabelStyle}>Active Alerts</div>
            <div style={{ ...metricValueStyle, color: alertColor(data!.alertCount) }}>
              {data!.alertCount}
            </div>
            <div style={{ ...metricSubStyle, marginTop: "8px" }}>
              {data!.alertCount === 0 ? "All clear" : `${data!.alertCount} alert${data!.alertCount !== 1 ? "s" : ""} need attention`}
            </div>
          </div>

          {/* Recruiter Utilization */}
          <div style={metricCardStyle}>
            <div style={metricLabelStyle}>Recruiter Utilization</div>
            <div style={{ ...metricValueStyle, color: statusColor(data!.taUtilization, 70, 90) }}>
              {data!.taUtilization.toFixed(0)}%
            </div>
            <div style={{ marginTop: "8px" }}>
              <ProgressBar value={data!.taUtilization} max={100} label="" />
            </div>
            <div style={metricSubStyle}>of recruiting capacity</div>
          </div>
        </div>

        {renderCallout(
          "Real-time visibility for all stakeholders. Budget alerts surface problems before they become crises. No one is surprised at quarter end."
        )}
      </div>
    );
  }

  // ─── CTA (step 6) ────────────────────────────────────────────────
  function renderCTA() {
    return (
      <div style={{ textAlign: "center", padding: "60px 0 40px" }}>
        <h1
          style={{
            fontSize: "40px",
            fontWeight: 500,
            letterSpacing: "-0.8px",
            color: "var(--text)",
            marginBottom: "24px",
          }}
        >
          That's QWFP.
        </h1>

        <div
          style={{
            fontSize: "17px",
            lineHeight: 2,
            color: "var(--text-muted)",
            marginBottom: "40px",
          }}
        >
          Finance sets guardrails.
          <br />
          HR orchestrates within them.
          <br />
          Business owners get instant answers.
          <br />
          Everyone sees progress.
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
          <button
            className="btn btn-primary"
            style={{
              fontSize: "14px",
              padding: "14px 28px",
              borderRadius: "4px",
              fontWeight: 500,
              background: "#232A23",
              color: "white",
            }}
            onClick={() => navigate("/dashboard")}
          >
            Explore the Dashboard
          </button>
          <button
            className="btn"
            style={{
              fontSize: "14px",
              padding: "14px 28px",
              borderRadius: "4px",
              fontWeight: 500,
              border: "1px solid #E4E7E4",
              backgroundColor: "transparent",
              color: "var(--text)",
              cursor: "pointer",
            }}
            onClick={() => navigate("/how-it-works")}
          >
            How It Works
          </button>
        </div>
      </div>
    );
  }

  // ─── Shared renderers ────────────────────────────────────────────
  function renderStepHeader(num: number, title: string, subtitle: string) {
    return (
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: "#232A23",
              color: "white",
              fontSize: "14px",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {num}
          </span>
          <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 500 }}>
            Step {num} of 5
          </span>
        </div>
        <h2
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--text)",
            marginBottom: "4px",
          }}
        >
          {title}
        </h2>
        <p style={{ fontSize: "15px", color: "var(--text-muted)" }}>{subtitle}</p>
      </div>
    );
  }

  function renderCallout(text: string) {
    return (
      <div
        style={{
          background: "#F6F8F6",
          borderLeft: "3px solid #22A652",
          borderRadius: "6px",
          padding: "16px 20px",
          fontSize: "14px",
          lineHeight: 1.7,
          color: "var(--text)",
          marginTop: "8px",
        }}
      >
        {text}
      </div>
    );
  }
}

// ─── Style constants ────────────────────────────────────────────────

const pageWrapperStyle: React.CSSProperties = {
  minHeight: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const stepCardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  padding: "32px",
  boxShadow: "0 4px 6px rgba(0,0,0,0.07)",
};

const scenarioCardStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: "12px",
  padding: "24px",
  marginBottom: "24px",
  background: "#fafafa",
};

const navBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "32px",
  padding: "0 4px",
};

const navBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: "14px",
  color: "var(--text-muted)",
  cursor: "pointer",
  fontWeight: 500,
  padding: "8px 12px",
};

const heroBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  padding: "8px 18px",
  borderRadius: "20px",
  fontSize: "15px",
  fontWeight: 600,
  backgroundColor: "var(--primary-light)",
  color: "var(--primary)",
};

const metricCardStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  padding: "20px",
  textAlign: "center",
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: "4px",
};

const metricValueStyle: React.CSSProperties = {
  fontSize: "32px",
  fontWeight: 700,
  lineHeight: 1.2,
};

const metricSubStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-muted)",
  marginTop: "4px",
};
