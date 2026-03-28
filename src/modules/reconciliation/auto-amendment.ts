import { eq, and, ne } from "drizzle-orm";
import { db } from "../../db/client.js";
import { budgetEnvelopes } from "../../db/schema/finance.js";
import { jobSlots } from "../../db/schema/hr.js";
import { NotFoundError } from "../../shared/errors.js";

export interface AmendmentSuggestion {
  suggestedSourceEnvelopeId: string | null;
  suggestedAmount: string;
  description: string;
}

export async function draftAutoAmendment(
  envelopeId: string,
  gap: { headcountGap?: number; budgetGap?: string },
): Promise<AmendmentSuggestion> {
  const [envelope] = await db
    .select()
    .from(budgetEnvelopes)
    .where(eq(budgetEnvelopes.id, envelopeId));

  if (!envelope) throw new NotFoundError("BudgetEnvelope", envelopeId);

  // 1. Get sibling envelopes (same parent, same planning cycle)
  const siblings = await db
    .select()
    .from(budgetEnvelopes)
    .where(
      and(
        eq(budgetEnvelopes.planningCycleId, envelope.planningCycleId),
        eq(
          budgetEnvelopes.parentEnvelopeId,
          envelope.parentEnvelopeId!,
        ),
        ne(budgetEnvelopes.id, envelopeId),
        ne(budgetEnvelopes.status, "closed"),
      ),
    );

  if (siblings.length === 0) {
    return {
      suggestedSourceEnvelopeId: null,
      suggestedAmount: "0.00",
      description:
        "No sibling envelopes available for transfer. Manual budget amendment required.",
    };
  }

  // 2. For each sibling, calculate unused capacity
  const siblingCapacity: {
    id: string;
    headcountRemaining: number;
    budgetRemaining: number;
  }[] = [];

  for (const sibling of siblings) {
    const slots = await db
      .select()
      .from(jobSlots)
      .where(
        and(
          eq(jobSlots.envelopeId, sibling.id),
          ne(jobSlots.status, "cancelled"),
        ),
      );

    const headcountUsed = slots.length;
    const budgetCommitted = slots.reduce(
      (sum, s) => sum + parseFloat(s.totalCompBase || "0"),
      0,
    );

    siblingCapacity.push({
      id: sibling.id,
      headcountRemaining: sibling.headcountCap - headcountUsed,
      budgetRemaining:
        parseFloat(sibling.totalCompBudget) - budgetCommitted,
    });
  }

  // 3. Sort by most slack (budget remaining)
  siblingCapacity.sort((a, b) => b.budgetRemaining - a.budgetRemaining);

  const best = siblingCapacity[0];
  const budgetGapAmount = parseFloat(gap.budgetGap || "0");

  if (best.budgetRemaining <= 0) {
    return {
      suggestedSourceEnvelopeId: null,
      suggestedAmount: "0.00",
      description:
        "No sibling envelopes have unused budget capacity. Manual amendment required.",
    };
  }

  // 4. Suggest transfer
  const transferAmount = Math.min(best.budgetRemaining, budgetGapAmount || best.budgetRemaining);

  return {
    suggestedSourceEnvelopeId: best.id,
    suggestedAmount: transferAmount.toFixed(2),
    description: `Suggest transferring ${transferAmount.toFixed(2)} from sibling envelope ${best.id} which has ${best.budgetRemaining.toFixed(2)} unused budget.`,
  };
}
