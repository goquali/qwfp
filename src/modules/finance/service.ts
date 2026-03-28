import { eq, and, sql, ne } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  planningCycles,
  budgetEnvelopes,
  budgetAmendments,
  guardrailConfigs,
} from "../../db/schema/finance.js";
import { jobSlots } from "../../db/schema/hr.js";
import { NotFoundError, ValidationError } from "../../shared/errors.js";
import type {
  CreatePlanningCycleInput,
  UpdatePlanningCycleInput,
  CreateEnvelopeInput,
  UpdateEnvelopeInput,
  CreateAmendmentInput,
  CreateGuardrailInput,
} from "./validators.js";

// ---- Planning Cycles ----

export async function createPlanningCycle(
  input: CreatePlanningCycleInput,
  createdBy?: string,
) {
  const [cycle] = await db
    .insert(planningCycles)
    .values({ ...input, createdBy })
    .returning();
  return cycle;
}

export async function getPlanningCycles() {
  return db.select().from(planningCycles);
}

export async function getPlanningCycleById(id: string) {
  const [cycle] = await db
    .select()
    .from(planningCycles)
    .where(eq(planningCycles.id, id));
  if (!cycle) throw new NotFoundError("PlanningCycle", id);
  return cycle;
}

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["under_review"],
  under_review: ["approved", "draft"],
  approved: ["active"],
  active: ["closed"],
  closed: [],
};

export async function updatePlanningCycle(
  id: string,
  input: UpdatePlanningCycleInput,
) {
  const existing = await getPlanningCycleById(id);

  if (input.status && input.status !== existing.status) {
    const allowed = VALID_STATUS_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(input.status)) {
      throw new ValidationError(
        `Cannot transition planning cycle from '${existing.status}' to '${input.status}'`,
      );
    }
  }

  const [updated] = await db
    .update(planningCycles)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(planningCycles.id, id))
    .returning();
  return updated;
}

// ---- Budget Envelopes ----

export async function createEnvelope(
  planningCycleId: string,
  input: CreateEnvelopeInput,
) {
  // Ensure planning cycle exists
  await getPlanningCycleById(planningCycleId);

  const [envelope] = await db
    .insert(budgetEnvelopes)
    .values({ ...input, planningCycleId })
    .returning();
  return envelope;
}

export async function getEnvelopes(planningCycleId: string) {
  return db
    .select()
    .from(budgetEnvelopes)
    .where(eq(budgetEnvelopes.planningCycleId, planningCycleId));
}

export async function getEnvelopeById(id: string) {
  const [envelope] = await db
    .select()
    .from(budgetEnvelopes)
    .where(eq(budgetEnvelopes.id, id));
  if (!envelope) throw new NotFoundError("BudgetEnvelope", id);
  return envelope;
}

export async function updateEnvelope(id: string, input: UpdateEnvelopeInput) {
  await getEnvelopeById(id);

  const [updated] = await db
    .update(budgetEnvelopes)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(budgetEnvelopes.id, id))
    .returning();
  return updated;
}

export async function getEnvelopeChildren(id: string) {
  return db
    .select()
    .from(budgetEnvelopes)
    .where(eq(budgetEnvelopes.parentEnvelopeId, id));
}

// ---- Envelope Utilization ----

export async function getEnvelopeUtilization(envelopeId: string) {
  const envelope = await getEnvelopeById(envelopeId);

  // Count non-cancelled slots for headcount used
  const [headcountResult] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(jobSlots)
    .where(
      and(
        eq(jobSlots.envelopeId, envelopeId),
        ne(jobSlots.status, "cancelled"),
      ),
    );

  // Sum total_comp_base for committed budget (all non-cancelled slots)
  const [committedResult] = await db
    .select({
      total: sql<string>`coalesce(sum(${jobSlots.totalCompBase}), 0)`,
    })
    .from(jobSlots)
    .where(
      and(
        eq(jobSlots.envelopeId, envelopeId),
        ne(jobSlots.status, "cancelled"),
      ),
    );

  // Sum total_comp_base for consumed budget (filled slots only)
  const [consumedResult] = await db
    .select({
      total: sql<string>`coalesce(sum(${jobSlots.totalCompBase}), 0)`,
    })
    .from(jobSlots)
    .where(
      and(
        eq(jobSlots.envelopeId, envelopeId),
        eq(jobSlots.status, "filled"),
      ),
    );

  const headcountUsed = headcountResult?.count ?? 0;
  const budgetCommitted = parseFloat(committedResult?.total ?? "0");
  const budgetConsumed = parseFloat(consumedResult?.total ?? "0");
  const totalBudget = parseFloat(envelope.totalCompBudget);
  const budgetRemaining = totalBudget - budgetCommitted;

  const headcountFlexibilityPct =
    envelope.headcountCap > 0
      ? ((envelope.headcountCap - headcountUsed) / envelope.headcountCap) * 100
      : 100;

  const budgetFlexibilityPct =
    totalBudget > 0
      ? ((totalBudget - budgetCommitted) / totalBudget) * 100
      : 100;

  return {
    envelopeId,
    headcountCap: envelope.headcountCap,
    headcountUsed,
    headcountRemaining: envelope.headcountCap - headcountUsed,
    totalBudget,
    budgetCommitted,
    budgetConsumed,
    budgetRemaining,
    headcountFlexibilityPct: Math.round(headcountFlexibilityPct * 100) / 100,
    budgetFlexibilityPct: Math.round(budgetFlexibilityPct * 100) / 100,
  };
}

// ---- Budget Amendments ----

export async function createAmendment(
  envelopeId: string,
  input: CreateAmendmentInput,
  requestedBy?: string,
) {
  const envelope = await getEnvelopeById(envelopeId);

  // Auto-approve logic: if the change is within auto_approve_threshold_pct
  const oldVal = parseFloat(input.oldValue);
  const newVal = parseFloat(input.newValue);
  const thresholdPct = parseFloat(envelope.autoApproveThresholdPct);

  let autoApproved = false;
  let status: "pending" | "auto_approved" = "pending";

  if (oldVal !== 0) {
    const changePct = (Math.abs(newVal - oldVal) / Math.abs(oldVal)) * 100;
    if (changePct <= thresholdPct) {
      autoApproved = true;
      status = "auto_approved";
    }
  }

  const [amendment] = await db
    .insert(budgetAmendments)
    .values({
      envelopeId,
      ...input,
      requestedBy,
      status,
      autoApproved,
      resolvedAt: autoApproved ? new Date() : null,
    })
    .returning();

  // If auto-approved, apply the change to the envelope
  if (autoApproved) {
    await applyAmendmentToEnvelope(envelope, input);
  }

  return amendment;
}

export async function approveAmendment(id: string, approvedBy: string) {
  const amendment = await getAmendmentById(id);

  if (amendment.status !== "pending") {
    throw new ValidationError(
      `Amendment is already '${amendment.status}', cannot approve`,
    );
  }

  const envelope = await getEnvelopeById(amendment.envelopeId);

  const [updated] = await db
    .update(budgetAmendments)
    .set({
      status: "approved",
      approvedBy,
      resolvedAt: new Date(),
    })
    .where(eq(budgetAmendments.id, id))
    .returning();

  // Apply the change to the envelope
  await applyAmendmentToEnvelope(envelope, {
    fieldChanged: amendment.fieldChanged,
    oldValue: amendment.oldValue,
    newValue: amendment.newValue,
  });

  return updated;
}

export async function rejectAmendment(id: string, approvedBy: string) {
  const amendment = await getAmendmentById(id);

  if (amendment.status !== "pending") {
    throw new ValidationError(
      `Amendment is already '${amendment.status}', cannot reject`,
    );
  }

  const [updated] = await db
    .update(budgetAmendments)
    .set({
      status: "rejected",
      approvedBy,
      resolvedAt: new Date(),
    })
    .where(eq(budgetAmendments.id, id))
    .returning();

  return updated;
}

async function getAmendmentById(id: string) {
  const [amendment] = await db
    .select()
    .from(budgetAmendments)
    .where(eq(budgetAmendments.id, id));
  if (!amendment) throw new NotFoundError("BudgetAmendment", id);
  return amendment;
}

async function applyAmendmentToEnvelope(
  envelope: typeof budgetEnvelopes.$inferSelect,
  change: { fieldChanged: string; oldValue: string; newValue: string },
) {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  switch (change.fieldChanged) {
    case "headcount_cap":
      updateData.headcountCap = parseInt(change.newValue, 10);
      break;
    case "total_comp_budget":
      updateData.totalCompBudget = change.newValue;
      break;
    case "comp_band_low":
      updateData.compBandLow = change.newValue;
      break;
    case "comp_band_high":
      updateData.compBandHigh = change.newValue;
      break;
    default:
      // Unknown field, skip application
      return;
  }

  await db
    .update(budgetEnvelopes)
    .set(updateData)
    .where(eq(budgetEnvelopes.id, envelope.id));
}

// ---- Guardrail Configs ----

export async function createGuardrail(
  envelopeId: string,
  input: CreateGuardrailInput,
) {
  await getEnvelopeById(envelopeId);

  const [guardrail] = await db
    .insert(guardrailConfigs)
    .values({ ...input, envelopeId })
    .returning();
  return guardrail;
}

export async function getGuardrails(envelopeId: string) {
  return db
    .select()
    .from(guardrailConfigs)
    .where(eq(guardrailConfigs.envelopeId, envelopeId));
}
