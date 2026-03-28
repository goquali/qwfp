import { eq, ne, sql, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import { recruiters, recruiterAssignments } from "../../db/schema/ta.js";
import { jobSlots } from "../../db/schema/hr.js";

export interface CapacitySnapshot {
  totalRecruiters: number;
  availableRecruiters: number;
  availableCapacity: number;
  activeReqs: number;
  utilizationPct: number;
  capacityGap: number;
}

export async function getCurrentCapacity(): Promise<CapacitySnapshot> {
  // 1. Count all recruiters not on leave
  const availableRecruitersResult = await db
    .select()
    .from(recruiters)
    .where(ne(recruiters.availability, "on_leave"));

  const totalRecruitersResult = await db.select().from(recruiters);

  const totalRecruiters = totalRecruitersResult.length;
  const availableRecruiters = availableRecruitersResult.length;

  // 2. Sum available capacity = sum(maxActiveReqs * availabilityPct / 100)
  let availableCapacity = 0;
  for (const recruiter of availableRecruitersResult) {
    const maxReqs = recruiter.maxActiveReqs;
    const pct = parseFloat(recruiter.availabilityPct);
    availableCapacity += (maxReqs * pct) / 100;
  }

  // 3. Count active reqs (jobSlots with status in open, sourcing, offer)
  const activeSlots = await db
    .select()
    .from(jobSlots)
    .where(inArray(jobSlots.status, ["open", "sourcing", "offer"]));

  const activeReqs = activeSlots.length;

  // 4. Utilization and gap
  const utilizationPct =
    availableCapacity > 0 ? (activeReqs / availableCapacity) * 100 : 0;
  const capacityGap = activeReqs - availableCapacity;

  return {
    totalRecruiters,
    availableRecruiters,
    availableCapacity: parseFloat(availableCapacity.toFixed(2)),
    activeReqs,
    utilizationPct: parseFloat(utilizationPct.toFixed(2)),
    capacityGap: parseFloat(capacityGap.toFixed(2)),
  };
}
