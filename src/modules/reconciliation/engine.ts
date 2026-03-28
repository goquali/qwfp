import { eq, and, ne } from "drizzle-orm";
import { db } from "../../db/client.js";
import { budgetEnvelopes } from "../../db/schema/finance.js";
import { jobSlots } from "../../db/schema/hr.js";
import { envelopeSnapshots } from "../../db/schema/reconciliation.js";
import { NotFoundError } from "../../shared/errors.js";
import { evaluateGuardrails } from "./guardrails.js";

export interface UtilizationMetrics {
  slotsTotal: number;
  slotsOpen: number;
  slotsFilled: number;
  slotsCancelled: number;
  headcountUsed: number;
  headcountRemaining: number;
  headcountCap: number;
  budgetCommitted: number;
  budgetConsumed: number;
  budgetRemaining: number;
  totalCompBudget: number;
  flexibilityPct: number;
}

export async function recalculateEnvelope(
  envelopeId: string,
  triggerType: string = "event_triggered",
): Promise<void> {
  // 1. Get envelope
  const [envelope] = await db
    .select()
    .from(budgetEnvelopes)
    .where(eq(budgetEnvelopes.id, envelopeId));

  if (!envelope) throw new NotFoundError("BudgetEnvelope", envelopeId);

  // 2. Get all non-cancelled job slots
  const slots = await db
    .select()
    .from(jobSlots)
    .where(
      and(
        eq(jobSlots.envelopeId, envelopeId),
        ne(jobSlots.status, "cancelled"),
      ),
    );

  const cancelledSlots = await db
    .select()
    .from(jobSlots)
    .where(
      and(
        eq(jobSlots.envelopeId, envelopeId),
        eq(jobSlots.status, "cancelled"),
      ),
    );

  // 3. Calculate metrics
  const slotsTotal = slots.length + cancelledSlots.length;
  const slotsOpen = slots.filter((s) =>
    ["draft", "open", "sourcing", "offer"].includes(s.status),
  ).length;
  const slotsFilled = slots.filter((s) => s.status === "filled").length;
  const slotsCancelled = cancelledSlots.length;
  const headcountUsed = slots.length; // non-cancelled count
  const headcountRemaining = envelope.headcountCap - headcountUsed;

  const budgetCommitted = slots.reduce(
    (sum, s) => sum + parseFloat(s.totalCompBase || "0"),
    0,
  );
  const budgetConsumed = slots
    .filter((s) => s.status === "filled")
    .reduce((sum, s) => sum + parseFloat(s.totalCompBase || "0"), 0);

  const totalCompBudget = parseFloat(envelope.totalCompBudget);
  const budgetRemaining = totalCompBudget - budgetCommitted;

  const flexibilityPct =
    totalCompBudget > 0
      ? ((budgetRemaining / totalCompBudget) * 100)
      : 100;

  const utilization: UtilizationMetrics = {
    slotsTotal,
    slotsOpen,
    slotsFilled,
    slotsCancelled,
    headcountUsed,
    headcountRemaining,
    headcountCap: envelope.headcountCap,
    budgetCommitted,
    budgetConsumed,
    budgetRemaining,
    totalCompBudget,
    flexibilityPct,
  };

  // 4. Insert snapshot
  await db.insert(envelopeSnapshots).values({
    envelopeId,
    snapshotType: triggerType as "event_triggered" | "scheduled_daily" | "scheduled_weekly",
    slotsTotal,
    slotsOpen,
    slotsFilled,
    slotsCancelled,
    headcountUsed,
    headcountRemaining,
    budgetCommitted: budgetCommitted.toFixed(2),
    budgetConsumed: budgetConsumed.toFixed(2),
    budgetRemaining: budgetRemaining.toFixed(2),
    flexibilityPct: flexibilityPct.toFixed(2),
  });

  // 5. Evaluate guardrails
  await evaluateGuardrails(envelopeId, utilization);

  // 6. Recursively recalculate parent
  if (envelope.parentEnvelopeId) {
    await recalculateEnvelope(envelope.parentEnvelopeId, triggerType);
  }
}
