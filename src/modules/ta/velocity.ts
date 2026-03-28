import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { jobSlots } from "../../db/schema/hr.js";
import { pipelineVelocity } from "../../db/schema/ta.js";

export interface VelocityMetrics {
  avgDaysToFill: number;
  medianDaysToFill: number;
  p75DaysToFill: number;
  avgCandidatesPerHire: number;
  sampleSize: number;
  jobFamilyId: string | null;
}

export async function calculateVelocity(
  jobFamilyId?: string,
): Promise<VelocityMetrics> {
  // 1. Get filled job slots
  let filledSlots;
  if (jobFamilyId) {
    filledSlots = await db
      .select()
      .from(jobSlots)
      .where(
        sql`${jobSlots.status} = 'filled' AND ${jobSlots.jobFamilyId} = ${jobFamilyId}`,
      );
  } else {
    filledSlots = await db
      .select()
      .from(jobSlots)
      .where(eq(jobSlots.status, "filled"));
  }

  if (filledSlots.length === 0) {
    return {
      avgDaysToFill: 0,
      medianDaysToFill: 0,
      p75DaysToFill: 0,
      avgCandidatesPerHire: 0,
      sampleSize: 0,
      jobFamilyId: jobFamilyId ?? null,
    };
  }

  // 2. Calculate fill times using createdAt and updatedAt as proxy
  const fillDays: number[] = [];
  for (const slot of filledSlots) {
    const created = new Date(slot.createdAt).getTime();
    const updated = new Date(slot.updatedAt).getTime();
    const diffDays = (updated - created) / (1000 * 60 * 60 * 24);
    if (diffDays >= 0) {
      fillDays.push(diffDays);
    }
  }

  if (fillDays.length === 0) {
    return {
      avgDaysToFill: 0,
      medianDaysToFill: 0,
      p75DaysToFill: 0,
      avgCandidatesPerHire: 0,
      sampleSize: 0,
      jobFamilyId: jobFamilyId ?? null,
    };
  }

  fillDays.sort((a, b) => a - b);

  // 3. Calculate stats
  const avg = fillDays.reduce((sum, d) => sum + d, 0) / fillDays.length;
  const median = getPercentile(fillDays, 50);
  const p75 = getPercentile(fillDays, 75);

  // Placeholder: avgCandidatesPerHire based on sample size
  const avgCandidatesPerHire = Math.max(5, Math.round(fillDays.length * 0.8));

  return {
    avgDaysToFill: parseFloat(avg.toFixed(2)),
    medianDaysToFill: parseFloat(median.toFixed(2)),
    p75DaysToFill: parseFloat(p75.toFixed(2)),
    avgCandidatesPerHire,
    sampleSize: fillDays.length,
    jobFamilyId: jobFamilyId ?? null,
  };
}

function getPercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const fraction = index - lower;
  return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}
