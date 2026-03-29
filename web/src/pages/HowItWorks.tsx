export default function HowItWorks() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 0" }}>
      <div className="page-header" style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>How QWFP Works</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
          A simple guide to how hiring decisions flow between stakeholders
        </p>
      </div>

      {/* The Big Idea */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>The Big Idea</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text)" }}>
          Finance sets <strong>team budgets</strong> with headcount caps and salary ranges.
          HR hires <strong>within those budgets</strong> without asking permission for every role.
          Business owners submit <strong>change requests</strong> that get instant feasibility checks.
          If a change fits the budget, it happens immediately. If it doesn't, the system
          auto-drafts the budget request — no spreadsheets, no email chains.
        </p>
      </div>

      {/* The Flow */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>The Workflow</h2>

        {/* Step 1 */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <div style={stepNumberStyle}>1</div>
          <div>
            <div style={stepTitleStyle}>Finance sets team budgets</div>
            <p style={stepDescStyle}>
              Finance allocates budget per team: "Engineering gets 12 heads at $2.2M total."
              They set salary ranges and budget rules (warnings at 80%, hard stops at 100%).
              That's it — Finance doesn't manage individual roles.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <div style={stepNumberStyle}>2</div>
          <div>
            <div style={stepTitleStyle}>HR creates positions within those budgets</div>
            <p style={stepDescStyle}>
              HR decides the specific roles: "2 Senior Engineers, 1 DevOps, 3 Mid-level."
              As long as total headcount and comp stay within the team budget, HR has full
              autonomy — no approvals needed.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <div style={stepNumberStyle}>3</div>
          <div>
            <div style={stepTitleStyle}>Business owners request changes</div>
            <p style={stepDescStyle}>
              When a VP needs to pivot — "swap a backend engineer for an ML engineer" — they
              submit a structured request. The system instantly calculates the budget impact
              and tells them if it fits or needs approval.
            </p>
          </div>
        </div>

        {/* Step 4 */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <div style={stepNumberStyle}>4</div>
          <div>
            <div style={stepTitleStyle}>HR reviews with full context</div>
            <p style={stepDescStyle}>
              HR sees every change request with the budget impact pre-calculated.
              Green means "execute immediately." Yellow means "needs Finance to approve
              a budget change" — and the system has already drafted that request.
            </p>
          </div>
        </div>

        {/* Step 5 */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <div style={stepNumberStyle}>5</div>
          <div>
            <div style={stepTitleStyle}>Finance only gets involved when needed</div>
            <p style={stepDescStyle}>
              Finance reviews budget change requests that exceed thresholds — and each one
              arrives pre-analyzed with the business justification, dollar impact, and
              suggested offsets. No back-and-forth.
            </p>
          </div>
        </div>

        {/* Step 6 */}
        <div style={{ display: "flex", gap: 16 }}>
          <div style={stepNumberStyle}>6</div>
          <div>
            <div style={stepTitleStyle}>Everyone sees progress in real time</div>
            <p style={stepDescStyle}>
              The Executive dashboard shows company-wide hiring progress. Budget alerts
              surface problems before they become crises. Recruiting tracks whether they
              have enough capacity to meet the plan.
            </p>
          </div>
        </div>
      </div>

      {/* Who Does What */}
      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Who Does What</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <RoleCard
            emoji="💰"
            title="Finance"
            color="#22A652"
            items={[
              "Sets team budgets (headcount + dollars)",
              "Defines salary ranges per team",
              "Configures budget rules (warn vs block)",
              "Reviews changes that exceed thresholds",
            ]}
          />
          <RoleCard
            emoji="🎯"
            title="HR"
            color="#059669"
            items={[
              "Creates specific positions within budgets",
              "Moves roles through the hiring pipeline",
              "Reviews change requests from business",
              "Executes changes that fit the budget",
            ]}
          />
          <RoleCard
            emoji="👤"
            title="Business Owners"
            color="#d97706"
            items={[
              "Submits change requests (new role, swap, etc.)",
              "Sees instant feasibility feedback",
              "Views team capacity and open positions",
              "Never touches budgets or spreadsheets",
            ]}
          />
          <RoleCard
            emoji="📊"
            title="Recruiting / TA"
            color="#dc2626"
            items={[
              "Tracks recruiter workload and capacity",
              "Monitors time-to-fill metrics",
              "Forecasts if more recruiters are needed",
              "Balances req load across the team",
            ]}
          />
        </div>
      </div>

      {/* Key Concepts */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Key Concepts</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ConceptRow
            term="Team Budget"
            definition="The total hiring budget for a team — includes headcount cap, total compensation budget, and salary ranges. Finance sets these; HR works within them."
          />
          <ConceptRow
            term="Budget Rules"
            definition="Configurable thresholds that protect the budget. Soft rules warn HR but let them proceed. Hard rules block the action until Finance approves a change."
          />
          <ConceptRow
            term="Budget Headroom"
            definition="How much room is left in a team's budget for more hires. Shows both remaining headcount and remaining dollars."
          />
          <ConceptRow
            term="Change Request"
            definition="A structured request from a business owner to modify the hiring plan — add a role, swap one role for another, or adjust timing. Gets instant feasibility analysis."
          />
          <ConceptRow
            term="Auto-Feasibility"
            definition="When a change request is submitted, the system instantly calculates whether it fits within the current budget or needs Finance approval. No manual spreadsheet checks."
          />
          <ConceptRow
            term="Budget Alert"
            definition="An automatic notification when a team's hiring activity approaches or exceeds a budget rule threshold. Helps catch issues early."
          />
        </div>
      </div>
    </div>
  );
}

function RoleCard({ emoji, title, color, items }: { emoji: string; title: string; color: string; items: string[] }) {
  return (
    <div style={{
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: 16,
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>
        {emoji} {title}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8, color: "var(--text-muted)" }}>
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}

function ConceptRow({ term, definition }: { term: string; definition: string }) {
  return (
    <div style={{ paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{term}</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{definition}</div>
    </div>
  );
}

const stepNumberStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "var(--primary)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  fontSize: 14,
  flexShrink: 0,
};

const stepTitleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 15,
  marginBottom: 4,
};

const stepDescStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: "var(--text-muted)",
  margin: 0,
};
