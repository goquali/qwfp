import { eq, sql, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  recruiters,
  recruiterAssignments,
} from "../../db/schema/ta.js";
import { jobSlots } from "../../db/schema/hr.js";
import { NotFoundError } from "../../shared/errors.js";
import { getCurrentCapacity } from "./capacity.js";
import { calculateVelocity } from "./velocity.js";
import { getCapacityForecast } from "./forecasting.js";

// ---- Recruiters ----

interface CreateRecruiterInput {
  userId: string;
  maxActiveReqs?: number;
  specializations?: any;
  availability?: "full_time" | "part_time" | "on_leave";
  availabilityPct?: string;
}

export async function createRecruiter(input: CreateRecruiterInput) {
  const [recruiter] = await db
    .insert(recruiters)
    .values({
      userId: input.userId,
      maxActiveReqs: input.maxActiveReqs ?? 20,
      specializations: input.specializations ?? null,
      availability: input.availability ?? "full_time",
      availabilityPct: input.availabilityPct ?? "100.00",
    })
    .returning();
  return recruiter;
}

export async function getRecruiters() {
  return db.select().from(recruiters);
}

export async function getRecruiterById(id: string) {
  const [recruiter] = await db
    .select()
    .from(recruiters)
    .where(eq(recruiters.id, id));
  if (!recruiter) throw new NotFoundError("Recruiter", id);
  return recruiter;
}

interface UpdateRecruiterInput {
  maxActiveReqs?: number;
  specializations?: any;
  availability?: "full_time" | "part_time" | "on_leave";
  availabilityPct?: string;
}

export async function updateRecruiter(id: string, input: UpdateRecruiterInput) {
  await getRecruiterById(id); // ensure exists

  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (input.maxActiveReqs !== undefined) updateData.maxActiveReqs = input.maxActiveReqs;
  if (input.specializations !== undefined) updateData.specializations = input.specializations;
  if (input.availability !== undefined) updateData.availability = input.availability;
  if (input.availabilityPct !== undefined) updateData.availabilityPct = input.availabilityPct;

  const [updated] = await db
    .update(recruiters)
    .set(updateData)
    .where(eq(recruiters.id, id))
    .returning();

  return updated;
}

// ---- Assignments ----

export async function createAssignment(recruiterId: string, jobSlotId: string) {
  await getRecruiterById(recruiterId); // ensure recruiter exists

  const [assignment] = await db
    .insert(recruiterAssignments)
    .values({
      recruiterId,
      jobSlotId,
      status: "active",
    })
    .returning();
  return assignment;
}

export async function updateAssignment(
  id: string,
  status: "active" | "completed" | "reassigned",
) {
  const [existing] = await db
    .select()
    .from(recruiterAssignments)
    .where(eq(recruiterAssignments.id, id));
  if (!existing) throw new NotFoundError("RecruiterAssignment", id);

  const updateData: Record<string, any> = { status };
  if (status === "completed") {
    updateData.completedAt = new Date();
  }

  const [updated] = await db
    .update(recruiterAssignments)
    .set(updateData)
    .where(eq(recruiterAssignments.id, id))
    .returning();

  return updated;
}

// ---- Workload ----

export interface RecruiterWorkload {
  recruiterId: string;
  activeAssignments: number;
  maxActiveReqs: number;
  utilizationPct: number;
  availability: string;
}

export async function getRecruiterWorkload(
  recruiterId: string,
): Promise<RecruiterWorkload> {
  const recruiter = await getRecruiterById(recruiterId);

  const activeAssignments = await db
    .select()
    .from(recruiterAssignments)
    .where(
      sql`${recruiterAssignments.recruiterId} = ${recruiterId} AND ${recruiterAssignments.status} = 'active'`,
    );

  const activeCount = activeAssignments.length;
  const maxReqs = recruiter.maxActiveReqs;
  const pct = parseFloat(recruiter.availabilityPct);
  const effectiveCapacity = (maxReqs * pct) / 100;
  const utilizationPct =
    effectiveCapacity > 0 ? (activeCount / effectiveCapacity) * 100 : 0;

  return {
    recruiterId: recruiter.id,
    activeAssignments: activeCount,
    maxActiveReqs: maxReqs,
    utilizationPct: parseFloat(utilizationPct.toFixed(2)),
    availability: recruiter.availability,
  };
}

// ---- Workload Distribution ----

export async function getWorkloadDistribution() {
  const allRecruiters = await db.select().from(recruiters);
  const distribution = [];

  for (const recruiter of allRecruiters) {
    const workload = await getRecruiterWorkload(recruiter.id);
    distribution.push(workload);
  }

  return distribution;
}

// Re-export capacity/velocity/forecast functions
export { getCurrentCapacity } from "./capacity.js";
export { calculateVelocity } from "./velocity.js";
export { getCapacityForecast } from "./forecasting.js";
