import { eq, and, ne, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  jobFamilies,
  jobSlots,
  jobSlotChanges,
  changeRequests,
} from "../../db/schema/hr.js";
import { budgetEnvelopes } from "../../db/schema/finance.js";
import { NotFoundError, ValidationError } from "../../shared/errors.js";
import type {
  CreateJobFamilyInput,
  CreateJobSlotInput,
  UpdateJobSlotInput,
  CreateChangeRequestInput,
} from "./validators.js";

// ---- Job Families ----

export async function createJobFamily(input: CreateJobFamilyInput) {
  const [family] = await db.insert(jobFamilies).values(input).returning();
  return family;
}

export async function getJobFamilies() {
  return db.select().from(jobFamilies);
}

// ---- Job Slots ----

function sumComp(input: {
  baseSalary?: string;
  equityValue?: string;
  bonusTarget?: string;
  benefitsCost?: string;
}): string {
  const base = parseFloat(input.baseSalary ?? "0");
  const equity = parseFloat(input.equityValue ?? "0");
  const bonus = parseFloat(input.bonusTarget ?? "0");
  const benefits = parseFloat(input.benefitsCost ?? "0");
  return (base + equity + bonus + benefits).toFixed(2);
}

export async function createJobSlot(input: CreateJobSlotInput) {
  const totalComp = sumComp(input);

  const [slot] = await db
    .insert(jobSlots)
    .values({
      ...input,
      totalComp,
      totalCompBase: totalComp,
      baseSalaryBase: input.baseSalary ?? null,
      equityValueBase: input.equityValue ?? null,
      bonusTargetBase: input.bonusTarget ?? null,
      benefitsCostBase: input.benefitsCost ?? null,
    })
    .returning();
  return slot;
}

export async function getJobSlotsByEnvelope(envelopeId: string) {
  return db
    .select()
    .from(jobSlots)
    .where(eq(jobSlots.envelopeId, envelopeId));
}

export async function getJobSlotById(id: string) {
  const [slot] = await db.select().from(jobSlots).where(eq(jobSlots.id, id));
  if (!slot) throw new NotFoundError("JobSlot", id);
  return slot;
}

export async function updateJobSlot(
  id: string,
  input: UpdateJobSlotInput,
  userId: string,
) {
  const existing = await getJobSlotById(id);

  // Recalculate totalComp if any comp field changed
  const merged = {
    baseSalary: input.baseSalary ?? existing.baseSalary ?? undefined,
    equityValue: input.equityValue ?? existing.equityValue ?? undefined,
    bonusTarget: input.bonusTarget ?? existing.bonusTarget ?? undefined,
    benefitsCost: input.benefitsCost ?? existing.benefitsCost ?? undefined,
  };
  const totalComp = sumComp(merged);

  const updateValues: Record<string, unknown> = {
    ...input,
    totalComp,
    totalCompBase: totalComp,
    baseSalaryBase: merged.baseSalary ?? null,
    equityValueBase: merged.equityValue ?? null,
    bonusTargetBase: merged.bonusTarget ?? null,
    benefitsCostBase: merged.benefitsCost ?? null,
    updatedAt: new Date(),
  };

  // Log each changed field
  const changeLogs: {
    jobSlotId: string;
    fieldChanged: string;
    oldValue: string | null;
    newValue: string | null;
    changedBy: string;
  }[] = [];

  for (const [key, value] of Object.entries(input)) {
    const oldVal = (existing as Record<string, unknown>)[key];
    if (String(oldVal ?? "") !== String(value ?? "")) {
      changeLogs.push({
        jobSlotId: id,
        fieldChanged: key,
        oldValue: oldVal != null ? String(oldVal) : null,
        newValue: value != null ? String(value) : null,
        changedBy: userId,
      });
    }
  }

  if (changeLogs.length > 0) {
    await db.insert(jobSlotChanges).values(changeLogs);
  }

  const [updated] = await db
    .update(jobSlots)
    .set(updateValues)
    .where(eq(jobSlots.id, id))
    .returning();
  return updated;
}

// ---- Status Transitions ----

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["open", "cancelled"],
  open: ["sourcing", "cancelled"],
  sourcing: ["offer", "cancelled"],
  offer: ["filled", "cancelled"],
  filled: ["cancelled"],
  cancelled: [],
};

export async function transitionSlotStatus(
  id: string,
  newStatus: string,
  userId: string,
) {
  const slot = await getJobSlotById(id);
  const currentStatus = slot.status;

  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new ValidationError(
      `Cannot transition from '${currentStatus}' to '${newStatus}'. Valid transitions: ${allowed.join(", ") || "none"}`,
    );
  }

  await db.insert(jobSlotChanges).values({
    jobSlotId: id,
    fieldChanged: "status",
    oldValue: currentStatus,
    newValue: newStatus,
    changedBy: userId,
  });

  const [updated] = await db
    .update(jobSlots)
    .set({ status: newStatus as typeof slot.status, updatedAt: new Date() })
    .where(eq(jobSlots.id, id))
    .returning();
  return updated;
}

// ---- Envelope Validation ----

export async function validateSlotFitsEnvelope(
  envelopeId: string,
  comp: string,
) {
  const [envelope] = await db
    .select()
    .from(budgetEnvelopes)
    .where(eq(budgetEnvelopes.id, envelopeId));
  if (!envelope) throw new NotFoundError("BudgetEnvelope", envelopeId);

  // Count current non-cancelled slots in this envelope
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobSlots)
    .where(
      and(
        eq(jobSlots.envelopeId, envelopeId),
        ne(jobSlots.status, "cancelled"),
      ),
    );
  const currentHeadcount = countResult?.count ?? 0;

  // Sum current total comp for non-cancelled slots
  const [sumResult] = await db
    .select({
      totalUsed: sql<string>`coalesce(sum(${jobSlots.totalComp}), '0')`,
    })
    .from(jobSlots)
    .where(
      and(
        eq(jobSlots.envelopeId, envelopeId),
        ne(jobSlots.status, "cancelled"),
      ),
    );
  const currentCompUsed = parseFloat(sumResult?.totalUsed ?? "0");

  const headcountCap = envelope.headcountCap;
  const totalCompBudget = parseFloat(envelope.totalCompBudget);
  const compValue = parseFloat(comp);

  const headcountRemaining = headcountCap - currentHeadcount;
  const budgetRemaining = totalCompBudget - currentCompUsed;

  const warnings: string[] = [];
  let fits = true;

  if (headcountRemaining <= 0) {
    fits = false;
    warnings.push(
      `Headcount cap reached: ${currentHeadcount}/${headcountCap}`,
    );
  }

  if (compValue > budgetRemaining) {
    fits = false;
    warnings.push(
      `Comp ${comp} exceeds remaining budget ${budgetRemaining.toFixed(2)}`,
    );
  }

  // Soft warning at 80% threshold
  if (fits && budgetRemaining - compValue < totalCompBudget * 0.2) {
    warnings.push("Adding this slot would use more than 80% of the envelope budget");
  }

  return {
    fits,
    headcountRemaining,
    budgetRemaining: budgetRemaining.toFixed(2),
    warnings,
  };
}

// ---- Slot Change Audit ----

export async function getSlotChanges(jobSlotId: string) {
  return db
    .select()
    .from(jobSlotChanges)
    .where(eq(jobSlotChanges.jobSlotId, jobSlotId));
}

// ---- Change Requests ----

export async function createChangeRequest(
  input: CreateChangeRequestInput,
  userId: string,
) {
  // Find the envelope for the orgUnit to run auto-feasibility
  const [envelope] = await db
    .select()
    .from(budgetEnvelopes)
    .where(eq(budgetEnvelopes.orgUnitId, input.orgUnitId));

  let fitsEnvelope: boolean | null = null;
  let budgetImpact: string | null = null;
  let amendmentRequired: boolean | null = null;

  if (envelope) {
    // Estimate budget impact as zero if we have no comp info on the request
    // A real implementation would look up comp bands; for now use a placeholder
    const validation = await validateSlotFitsEnvelope(envelope.id, "0");
    fitsEnvelope = validation.fits;
    budgetImpact = "0.00";
    amendmentRequired = !validation.fits;
  }

  const status = fitsEnvelope === false ? "needs_amendment" : "feasible";

  const [cr] = await db
    .insert(changeRequests)
    .values({
      ...input,
      requestedBy: userId,
      fitsEnvelope,
      budgetImpact,
      amendmentRequired,
      status: status as "submitted" | "feasible" | "needs_amendment",
    })
    .returning();
  return cr;
}

export async function getChangeRequests(filters?: { orgUnitId?: string; status?: string }) {
  if (filters?.orgUnitId && filters?.status) {
    return db
      .select()
      .from(changeRequests)
      .where(
        and(
          eq(changeRequests.orgUnitId, filters.orgUnitId),
          eq(changeRequests.status, filters.status as typeof changeRequests.status.enumValues[number]),
        ),
      );
  }
  if (filters?.orgUnitId) {
    return db
      .select()
      .from(changeRequests)
      .where(eq(changeRequests.orgUnitId, filters.orgUnitId));
  }
  if (filters?.status) {
    return db
      .select()
      .from(changeRequests)
      .where(eq(changeRequests.status, filters.status as typeof changeRequests.status.enumValues[number]));
  }
  return db.select().from(changeRequests);
}

export async function getChangeRequestById(id: string) {
  const [cr] = await db
    .select()
    .from(changeRequests)
    .where(eq(changeRequests.id, id));
  if (!cr) throw new NotFoundError("ChangeRequest", id);
  return cr;
}

export async function updateChangeRequestStatus(
  id: string,
  status: string,
  handledBy: string,
) {
  const cr = await getChangeRequestById(id);

  const updateData: Record<string, unknown> = {
    status: status as typeof cr.status,
    handledBy,
  };

  // Set resolvedAt for terminal statuses
  if (["completed", "rejected"].includes(status)) {
    updateData.resolvedAt = new Date();
  }

  const [updated] = await db
    .update(changeRequests)
    .set(updateData)
    .where(eq(changeRequests.id, id))
    .returning();
  return updated;
}
