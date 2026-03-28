import { eq, and, ne } from "drizzle-orm";
import { db } from "../../db/client.js";
import { budgetEnvelopes, guardrailConfigs } from "../../db/schema/finance.js";
import { jobSlots } from "../../db/schema/hr.js";
import {
  scenarios,
  scenarioActions,
} from "../../db/schema/reconciliation.js";
import { NotFoundError } from "../../shared/errors.js";

export interface CreateScenarioInput {
  name: string;
  description?: string;
  baseEnvelopeId: string;
}

export interface AddScenarioActionInput {
  actionType: "add_slot" | "remove_slot" | "modify_slot" | "transfer_budget";
  parameters: Record<string, unknown>;
}

export interface ScenarioResult {
  scenarioId: string;
  baseState: {
    headcountUsed: number;
    headcountCap: number;
    budgetCommitted: number;
    totalCompBudget: number;
  };
  projectedState: {
    headcountUsed: number;
    headcountCap: number;
    budgetCommitted: number;
    totalCompBudget: number;
  };
  guardrailAlerts: {
    type: string;
    severity: string;
    message: string;
  }[];
}

export async function createScenario(
  input: CreateScenarioInput,
  userId: string,
) {
  const [scenario] = await db
    .insert(scenarios)
    .values({
      name: input.name,
      description: input.description,
      baseEnvelopeId: input.baseEnvelopeId,
      createdBy: userId,
    })
    .returning();

  return scenario;
}

export async function addScenarioAction(
  scenarioId: string,
  action: AddScenarioActionInput,
) {
  // Verify scenario exists
  const [scenario] = await db
    .select()
    .from(scenarios)
    .where(eq(scenarios.id, scenarioId));

  if (!scenario) throw new NotFoundError("Scenario", scenarioId);

  const [created] = await db
    .insert(scenarioActions)
    .values({
      scenarioId,
      actionType: action.actionType,
      parameters: action.parameters,
    })
    .returning();

  return created;
}

export async function analyzeScenario(
  scenarioId: string,
): Promise<ScenarioResult> {
  // 1. Get scenario and its actions
  const [scenario] = await db
    .select()
    .from(scenarios)
    .where(eq(scenarios.id, scenarioId));

  if (!scenario) throw new NotFoundError("Scenario", scenarioId);

  const actions = await db
    .select()
    .from(scenarioActions)
    .where(eq(scenarioActions.scenarioId, scenarioId));

  // 2. Get base envelope and current utilization
  const [envelope] = await db
    .select()
    .from(budgetEnvelopes)
    .where(eq(budgetEnvelopes.id, scenario.baseEnvelopeId));

  if (!envelope) throw new NotFoundError("BudgetEnvelope", scenario.baseEnvelopeId);

  const slots = await db
    .select()
    .from(jobSlots)
    .where(
      and(
        eq(jobSlots.envelopeId, envelope.id),
        ne(jobSlots.status, "cancelled"),
      ),
    );

  const headcountUsed = slots.length;
  const budgetCommitted = slots.reduce(
    (sum, s) => sum + parseFloat(s.totalCompBase || "0"),
    0,
  );
  const totalCompBudget = parseFloat(envelope.totalCompBudget);

  const baseState = {
    headcountUsed,
    headcountCap: envelope.headcountCap,
    budgetCommitted,
    totalCompBudget,
  };

  // 3. Simulate effects of each action
  let projectedHeadcount = headcountUsed;
  let projectedBudget = budgetCommitted;
  let projectedTotalBudget = totalCompBudget;
  let projectedHeadcountCap = envelope.headcountCap;

  for (const action of actions) {
    const params = action.parameters as Record<string, unknown>;

    switch (action.actionType) {
      case "add_slot": {
        projectedHeadcount += 1;
        const comp = parseFloat((params.totalCompBase as string) || "0");
        projectedBudget += comp;
        break;
      }
      case "remove_slot": {
        projectedHeadcount = Math.max(0, projectedHeadcount - 1);
        const comp = parseFloat((params.totalCompBase as string) || "0");
        projectedBudget = Math.max(0, projectedBudget - comp);
        break;
      }
      case "modify_slot": {
        const oldComp = parseFloat((params.oldTotalCompBase as string) || "0");
        const newComp = parseFloat((params.newTotalCompBase as string) || "0");
        projectedBudget = projectedBudget - oldComp + newComp;
        break;
      }
      case "transfer_budget": {
        const amount = parseFloat((params.amount as string) || "0");
        const direction = params.direction as string;
        if (direction === "in") {
          projectedTotalBudget += amount;
        } else {
          projectedTotalBudget -= amount;
        }
        break;
      }
    }
  }

  const projectedState = {
    headcountUsed: projectedHeadcount,
    headcountCap: projectedHeadcountCap,
    budgetCommitted: parseFloat(projectedBudget.toFixed(2)),
    totalCompBudget: parseFloat(projectedTotalBudget.toFixed(2)),
  };

  // 4. Check if projected state would trigger guardrails
  const configs = await db
    .select()
    .from(guardrailConfigs)
    .where(eq(guardrailConfigs.envelopeId, envelope.id));

  const guardrailAlerts: { type: string; severity: string; message: string }[] =
    [];

  for (const config of configs) {
    const warningPct = parseFloat(config.warningThresholdPct);
    const breachPct = parseFloat(config.breachThresholdPct);

    if (config.guardrailType === "headcount") {
      const usagePct =
        projectedHeadcountCap > 0
          ? (projectedHeadcount / projectedHeadcountCap) * 100
          : 0;
      if (usagePct >= breachPct) {
        guardrailAlerts.push({
          type: "headcount_breach",
          severity: "critical",
          message: `Projected headcount ${projectedHeadcount}/${projectedHeadcountCap} (${usagePct.toFixed(1)}%) exceeds breach threshold ${breachPct}%`,
        });
      } else if (usagePct >= warningPct) {
        guardrailAlerts.push({
          type: "headcount_warning",
          severity: "warning",
          message: `Projected headcount ${projectedHeadcount}/${projectedHeadcountCap} (${usagePct.toFixed(1)}%) exceeds warning threshold ${warningPct}%`,
        });
      }
    }

    if (config.guardrailType === "total_comp") {
      const usagePct =
        projectedTotalBudget > 0
          ? (projectedBudget / projectedTotalBudget) * 100
          : 0;
      if (usagePct >= breachPct) {
        guardrailAlerts.push({
          type: "budget_breach",
          severity: "critical",
          message: `Projected budget ${projectedBudget.toFixed(2)}/${projectedTotalBudget.toFixed(2)} (${usagePct.toFixed(1)}%) exceeds breach threshold ${breachPct}%`,
        });
      } else if (usagePct >= warningPct) {
        guardrailAlerts.push({
          type: "budget_warning",
          severity: "warning",
          message: `Projected budget ${projectedBudget.toFixed(2)}/${projectedTotalBudget.toFixed(2)} (${usagePct.toFixed(1)}%) exceeds warning threshold ${warningPct}%`,
        });
      }
    }
  }

  // 5. Update scenario with results
  const resultSummary = { baseState, projectedState, guardrailAlerts };

  await db
    .update(scenarios)
    .set({
      status: "completed",
      resultSummary,
      updatedAt: new Date(),
    })
    .where(eq(scenarios.id, scenarioId));

  return {
    scenarioId,
    ...resultSummary,
  };
}
