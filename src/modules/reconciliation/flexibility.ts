import { eq, and, ne } from "drizzle-orm";
import { db } from "../../db/client.js";
import { budgetEnvelopes } from "../../db/schema/finance.js";
import { jobSlots } from "../../db/schema/hr.js";
import { NotFoundError } from "../../shared/errors.js";

export interface FlexibilityMetrics {
  headcountRemaining: number;
  budgetRemaining: number;
  flexibilityPct: number;
  canAddAtBandLow: number;
}

export async function getFlexibilityMetrics(
  envelopeId: string,
): Promise<FlexibilityMetrics> {
  const [envelope] = await db
    .select()
    .from(budgetEnvelopes)
    .where(eq(budgetEnvelopes.id, envelopeId));

  if (!envelope) throw new NotFoundError("BudgetEnvelope", envelopeId);

  const slots = await db
    .select()
    .from(jobSlots)
    .where(
      and(
        eq(jobSlots.envelopeId, envelopeId),
        ne(jobSlots.status, "cancelled"),
      ),
    );

  const headcountUsed = slots.length;
  const budgetCommitted = slots.reduce(
    (sum, s) => sum + parseFloat(s.totalCompBase || "0"),
    0,
  );

  const totalBudget = parseFloat(envelope.totalCompBudget);
  const headcountRemaining = envelope.headcountCap - headcountUsed;
  const budgetRemaining = totalBudget - budgetCommitted;

  const flexibilityPct =
    totalBudget > 0 ? (budgetRemaining / totalBudget) * 100 : 100;

  const compBandLow = parseFloat(envelope.compBandLow || "0");
  const canAddAtBandLow =
    compBandLow > 0
      ? Math.min(
          Math.floor(budgetRemaining / compBandLow),
          headcountRemaining,
        )
      : headcountRemaining;

  return {
    headcountRemaining,
    budgetRemaining: parseFloat(budgetRemaining.toFixed(2)),
    flexibilityPct: parseFloat(flexibilityPct.toFixed(2)),
    canAddAtBandLow: Math.max(0, canAddAtBandLow),
  };
}
