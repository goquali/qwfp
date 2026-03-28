# QWFP — Workforce Planning System Design

## Problem Statement

Fast-growing companies face persistent friction between Finance, HR, and Business Leaders around hiring plans:

- **Finance** uses position management — every headcount is a numbered slot with a precise budget, cost center, and approval chain. Rigid, but gives forecast accuracy.
- **HR** uses job management — they think in roles, levels, and team capacity. They need flexibility to swap, split, or consolidate headcount within guardrails.
- **Business Leaders** just want to hire fast. They pivot constantly ("swap 2 backend engineers for 1 ML engineer").
- **HR is the squeezed middle** — stuck between business owners who move fast and finance who holds tight. They do manual shuttle diplomacy via spreadsheets and email.

No existing tool is built for all three stakeholders. Position management tools serve finance. ATS tools serve recruiting. Nobody bridges the gap.

## Solution: The Envelope Model

Instead of forcing one stakeholder's model on the others, QWFP introduces a **three-layer architecture** where each stakeholder works in their native language while a reconciliation engine keeps everything in sync.

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: BUDGET ENVELOPES (Finance)                    │
│  Hierarchical budget allocations by org/team/cost-center│
│  Finance controls the "what" and "how much"             │
└───────────────────────┬─────────────────────────────────┘
                        │ constrains
┌───────────────────────▼─────────────────────────────────┐
│  Layer 2: JOB SLOTS + CHANGE REQUESTS (HR + Business)   │
│  Requisitions and structured change intake               │
│  HR orchestrates, Business requests, within guardrails  │
└───────────────────────┬─────────────────────────────────┘
                        │ tracked by
┌───────────────────────▼─────────────────────────────────┐
│  Layer 3: RECONCILIATION ENGINE                         │
│  Real-time sync, drift alerts, scenario modeling,       │
│  flexibility metrics, auto-amendment drafting           │
└─────────────────────────────────────────────────────────┘
```

## Stakeholder Views

### Finance
- **Controls**: Budget envelopes (total comp budget, headcount caps, comp bands per team/department)
- **Sees**: Forecast vs actual spend, budget utilization, amendment trends, variance analysis
- **Doesn't need to**: Manage individual requisitions. They set the envelope; HR works within it.

### HR (Empowered Broker)
- **Controls**: Job slots within envelopes — create, modify, cancel reqs as long as they fit
- **Sees**: Flexibility zone (what they can do without asking anyone), change request queue from business owners, auto-drafted amendments when changes exceed bounds
- **Key capability**: Smart swap engine — "cancel this junior role, open a senior role, here's the budget impact, here's whether it fits." One action, no spreadsheet.

### Business Owners
- **Controls**: Structured change requests (not emails) with instant feasibility feedback
- **Sees**: Team capacity canvas showing current team, planned hires, open slots — in business language (roles, not budgets)
- **Gets**: "This change fits your team's budget — HR can approve immediately" vs "This needs $30k more — amendment will take ~3 days"

### Talent Acquisition (Recruiting)
- **Controls**: Recruiter assignments, workload management
- **Sees**: Pipeline capacity, req load per recruiter, time-to-fill velocity, demand forecasts
- **Key capability**: "Given the hiring plan changes, do we have enough recruiters?"

## Core Concepts

### Budget Envelope
The primary finance allocation unit. Scoped to an org unit + cost center + planning cycle.

**Properties:**
- Headcount cap (max positions)
- Total comp budget (salary + equity + bonus + benefits)
- Comp bands (per-head min/max)
- Hire window (start/end dates)
- Auto-approve threshold (% change that doesn't need finance approval)

**Hierarchy:** Envelopes can be nested (department → team). Child envelopes must sum to ≤ parent.

### Job Slot
HR's working unit — a single requisition within an envelope.

**Properties:**
- Role title, job family, level
- Comp breakdown: base salary, equity, bonus, benefits (local + base currency)
- Worker type: FTE, contractor, contingent
- Status: draft → open → sourcing → offer → filled | cancelled
- Source type: new hire, backfill, transfer, promotion

### Change Request
Business owner's structured way to request hiring changes. Replaces email/Slack chaos.

**Auto-feasibility analysis on submission:**
1. Find the team's active envelopes
2. Check if the request fits within current capacity
3. Calculate budget impact
4. Determine if amendment is needed
5. Suggest offsets if budget is exceeded

### Guardrails
Configurable per envelope. Each guardrail has a type, enforcement level, and thresholds.

| Guardrail | Soft (Warning) | Hard (Block) |
|---|---|---|
| Headcount | 80% of cap used | Would exceed cap |
| Total comp | 90% of budget | Would exceed budget |
| Comp band | Within 10% of band edge | Outside band |
| Timeline | Hire date outside window | — (configurable) |
| Vacancy rate | Below target fill rate | — (configurable) |

Finance configures which are soft vs hard per envelope. Soft = HR gets a warning but can proceed. Hard = blocked, must request an amendment.

### Amendments
Formal changes to budget envelopes. Two paths:

1. **Auto-approved**: Change is within the envelope's auto-approve threshold (e.g., <10% budget shift). HR or system can execute immediately.
2. **Formal approval**: Change exceeds threshold. System auto-drafts the amendment with business context, budget impact, and suggested offsets. Finance reviews and approves/rejects.

## Data Model (Entity Relationships)

```
PlanningCycle 1──────N BudgetEnvelope 1──────N JobSlot
                      │                        │
                      │ parent/child           │ changes
                      │ (hierarchy)            │
                      ├──────N GuardrailConfig  N JobSlotChange
                      ├──────N BudgetAmendment
                      ├──────N EnvelopeSnapshot
                      └──────N DriftAlert

OrgUnit (hierarchy) ←──── BudgetEnvelope
                    ←──── ChangeRequest ──→ JobSlot (replace)
                    ←──── CostCenter

User ──→ roles: admin, finance, hr, ta, business_owner

Recruiter ──→ RecruiterAssignment ──→ JobSlot
           └── PipelineVelocity (by job family, level, org)
           └── TACapacitySnapshot (team-wide)

ImportJob ──→ ImportRecord ──→ created entity
FieldMapping (reusable templates)
```

## Reconciliation Engine

**Event-driven** with scheduled supplements.

### Real-time (on every state change)
1. Recalculate envelope utilization (headcount, budget committed/consumed)
2. Walk up hierarchy — update parent envelope rollups
3. Evaluate guardrails → generate/resolve drift alerts
4. If hard guardrail breached → reject the action
5. If soft guardrail triggered → create warning alert, allow action
6. Capture envelope snapshot
7. Update flexibility metrics

### Scheduled (daily)
1. Snapshot all active envelopes
2. Run forecast model (avg time-to-fill × open slots → projected completion)
3. Detect utilization_low alerts (envelopes not being used)
4. Recalculate FX-converted amounts using latest exchange rates

### Auto-Amendment Drafting
When a change exceeds envelope bounds:
1. Calculate the gap (how much over budget/headcount)
2. Scan sibling envelopes for slack (unused budget/headcount)
3. Generate suggested offset: "Transfer $30k from Team-B envelope (85% unused)"
4. Pre-populate amendment with business context from change request

## Data Ingestion

Clients bring messy data. The import pipeline handles:

```
Upload (CSV/XLSX/JSON) → Column Mapping → Validation → Preview → Import → (Rollback)
```

- **Auto-detection**: Fuzzy match source headers to QWFP fields
- **Saved templates**: Reuse mappings for repeat imports from same source
- **Atomic imports**: All-or-nothing transactions
- **Rollback**: Undo any completed import

## TA Capacity Planning

Recruiters need to model their bandwidth against the hiring plan:

- **Workload tracking**: Active reqs per recruiter vs max capacity
- **Pipeline velocity**: Historical time-to-fill by role type, level, team
- **Demand forecasting**: "If business adds 10 reqs next quarter, we need X recruiter-months"
- **Capacity gaps**: Real-time view of whether the TA team can handle the plan

## Tech Stack

| Component | Choice |
|---|---|
| Runtime | Node.js 22 LTS |
| Language | TypeScript 5.x (strict) |
| Framework | Fastify 5 |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Validation | Zod |
| Testing | Vitest |

## API Design

All endpoints under `/api/v1/`. Authentication via `X-User-Id` + `X-User-Role` headers (MVP). Role-based access control (RBAC) enforced per endpoint.

### Domains
- `/api/v1/` — Core entities (users, org units, cost centers, currencies)
- `/api/v1/finance/` — Planning cycles, envelopes, amendments, guardrails
- `/api/v1/hr/` — Job families, job slots, change request handling
- `/api/v1/team/` — Business owner: team capacity, change request submission
- `/api/v1/reconciliation/` — Alerts, dashboards, scenarios
- `/api/v1/import/` — Data ingestion pipeline
- `/api/v1/ta/` — Recruiter management, capacity planning

## Authorization (RBAC)

| Action | admin | finance | hr | ta | business_owner |
|---|---|---|---|---|---|
| Manage planning cycles & envelopes | Y | Y | - | - | - |
| Configure guardrails | Y | Y | - | - | - |
| Approve amendments | Y | Y | - | - | - |
| Manage job slots | Y | - | Y | - | - |
| Handle change requests | Y | - | Y | - | - |
| Submit change requests | Y | - | - | - | Y (own teams) |
| View team capacity | Y | Y | Y | Y | Y (own teams) |
| Import data | Y | Y | Y | - | - |
| Manage TA capacity | Y | - | Y | Y | - |
