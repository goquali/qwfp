import { eq, and, ne } from "drizzle-orm";
import { db } from "../../db/client.js";
import { budgetEnvelopes } from "../../db/schema/finance.js";
import { jobSlots } from "../../db/schema/hr.js";
import { NotFoundError } from "../../shared/errors.js";

export interface ForecastResult {
  avgDaysToFill: number;
  projectedCompletionDate: string | null;
  monthlyBurnRate: number;
  openSlots: number;
  filledSlots: number;
}

export async function forecastEnvelope(
  envelopeId: string,
): Promise<ForecastResult> {
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

  const filledSlots = slots.filter((s) => s.status === "filled");
  const openSlots = slots.filter((s) =>
    ["draft", "open", "sourcing", "offer"].includes(s.status),
  );

  // Estimate avg days from open to filled by looking at filled slots
  // Use createdAt vs updatedAt as a proxy for time-to-fill
  let avgDaysToFill = 45; // default assumption
  if (filledSlots.length > 0) {
    const totalDays = filledSlots.reduce((sum, s) => {
      const created = new Date(s.createdAt).getTime();
      const updated = new Date(s.updatedAt).getTime();
      const days = Math.max(1, (updated - created) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    avgDaysToFill = Math.round(totalDays / filledSlots.length);
  }

  // Project completion date
  let projectedCompletionDate: string | null = null;
  if (openSlots.length > 0) {
    const now = new Date();
    const completionMs = now.getTime() + avgDaysToFill * 24 * 60 * 60 * 1000;
    const completionDate = new Date(completionMs);
    projectedCompletionDate = completionDate.toISOString().split("T")[0];
  }

  // Monthly burn rate based on filled slots
  const totalFilledComp = filledSlots.reduce(
    (sum, s) => sum + parseFloat(s.totalCompBase || "0"),
    0,
  );
  // Annualized comp / 12 = monthly burn
  const monthlyBurnRate = parseFloat((totalFilledComp / 12).toFixed(2));

  return {
    avgDaysToFill,
    projectedCompletionDate,
    monthlyBurnRate,
    openSlots: openSlots.length,
    filledSlots: filledSlots.length,
  };
}
