import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { jobSlots } from "../../db/schema/hr.js";
import { budgetEnvelopes } from "../../db/schema/finance.js";
import { getCurrentCapacity } from "./capacity.js";
import type { CapacitySnapshot } from "./capacity.js";

export interface ForecastResult {
  current: CapacitySnapshot;
  projectedReqs30d: number;
  projectedReqs60d: number;
  projectedReqs90d: number;
  recruiterMonthsNeeded30d: number;
  recruiterMonthsNeeded60d: number;
  recruiterMonthsNeeded90d: number;
  avgCapacityPerRecruiter: number;
}

export async function getCapacityForecast(): Promise<ForecastResult> {
  // 1. Get current capacity
  const current = await getCurrentCapacity();

  // 2. Count planned but not-yet-open slots (draft status)
  const draftSlots = await db
    .select()
    .from(jobSlots)
    .where(eq(jobSlots.status, "draft"));

  // 3. Project req counts based on target start dates within 30/60/90 day windows
  const now = new Date();
  const day30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const day60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const day90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  let reqs30 = current.activeReqs;
  let reqs60 = current.activeReqs;
  let reqs90 = current.activeReqs;

  for (const slot of draftSlots) {
    if (!slot.targetStartDate) {
      // No target date - assume evenly distributed across 90 days
      reqs90++;
      continue;
    }

    const startDate = new Date(slot.targetStartDate);
    if (startDate <= day30) {
      reqs30++;
      reqs60++;
      reqs90++;
    } else if (startDate <= day60) {
      reqs60++;
      reqs90++;
    } else if (startDate <= day90) {
      reqs90++;
    }
  }

  // 4. Calculate recruiter months needed
  // avgCapacityPerRecruiter = availableCapacity / availableRecruiters
  const avgCapacity =
    current.availableRecruiters > 0
      ? current.availableCapacity / current.availableRecruiters
      : 15; // default assumption

  const recruiterMonths30 =
    avgCapacity > 0 ? reqs30 / avgCapacity : 0;
  const recruiterMonths60 =
    avgCapacity > 0 ? reqs60 / avgCapacity : 0;
  const recruiterMonths90 =
    avgCapacity > 0 ? reqs90 / avgCapacity : 0;

  return {
    current,
    projectedReqs30d: reqs30,
    projectedReqs60d: reqs60,
    projectedReqs90d: reqs90,
    recruiterMonthsNeeded30d: parseFloat(recruiterMonths30.toFixed(2)),
    recruiterMonthsNeeded60d: parseFloat(recruiterMonths60.toFixed(2)),
    recruiterMonthsNeeded90d: parseFloat(recruiterMonths90.toFixed(2)),
    avgCapacityPerRecruiter: parseFloat(avgCapacity.toFixed(2)),
  };
}
