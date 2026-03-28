import { eq, and, ne, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { orgUnits } from "../../db/schema/core.js";
import { budgetEnvelopes } from "../../db/schema/finance.js";
import { jobSlots, changeRequests } from "../../db/schema/hr.js";
import { NotFoundError } from "../../shared/errors.js";
import type { CreateChangeRequestInput } from "./validators.js";

// ---- My Teams ----

export async function getMyTeams(userId: string) {
  return db
    .select()
    .from(orgUnits)
    .where(eq(orgUnits.headUserId, userId));
}

// ---- Team Capacity ----

export async function getTeamCapacity(orgUnitId: string) {
  const envelopes = await db
    .select()
    .from(budgetEnvelopes)
    .where(
      and(
        eq(budgetEnvelopes.orgUnitId, orgUnitId),
        ne(budgetEnvelopes.status, "closed"),
      ),
    );

  const capacities = [];

  for (const envelope of envelopes) {
    const slots = await db
      .select()
      .from(jobSlots)
      .where(eq(jobSlots.envelopeId, envelope.id));

    const slotsByStatus: Record<string, number> = {};
    let headcountUsed = 0;
    let budgetCommitted = 0;

    for (const slot of slots) {
      slotsByStatus[slot.status] = (slotsByStatus[slot.status] || 0) + 1;
      if (slot.status !== "cancelled") {
        headcountUsed++;
        budgetCommitted += parseFloat(slot.totalCompBase || "0");
      }
    }

    const totalBudget = parseFloat(envelope.totalCompBudget);

    capacities.push({
      envelopeId: envelope.id,
      envelopeType: envelope.envelopeType,
      status: envelope.status,
      slotsByStatus,
      headcountCap: envelope.headcountCap,
      headcountUsed,
      headcountRemaining: envelope.headcountCap - headcountUsed,
      budgetTotal: envelope.totalCompBudget,
      budgetCommitted: budgetCommitted.toFixed(2),
      budgetRemaining: (totalBudget - budgetCommitted).toFixed(2),
    });
  }

  return capacities;
}

// ---- Team Slots ----

export async function getTeamSlots(orgUnitId: string) {
  const envelopes = await db
    .select({ id: budgetEnvelopes.id })
    .from(budgetEnvelopes)
    .where(eq(budgetEnvelopes.orgUnitId, orgUnitId));

  if (envelopes.length === 0) return [];

  const envelopeIds = envelopes.map((e) => e.id);

  const slots = await db
    .select()
    .from(jobSlots)
    .where(sql`${jobSlots.envelopeId} IN ${envelopeIds}`);

  return slots;
}

// ---- Change Requests ----

export async function createChangeRequest(
  input: CreateChangeRequestInput,
  userId: string,
) {
  // Find active envelopes for the org unit
  const envelopes = await db
    .select()
    .from(budgetEnvelopes)
    .where(
      and(
        eq(budgetEnvelopes.orgUnitId, input.orgUnitId),
        ne(budgetEnvelopes.status, "closed"),
      ),
    );

  // Auto-feasibility analysis
  let fitsEnvelope = false;
  let budgetImpact = "0.00";
  let amendmentRequired = false;
  let suggestedOffset: string | null = null;
  let status: "feasible" | "needs_amendment" = "needs_amendment";

  if (
    input.requestType === "new_role" ||
    input.requestType === "add_headcount"
  ) {
    for (const envelope of envelopes) {
      // Get current usage for this envelope
      const slots = await db
        .select()
        .from(jobSlots)
        .where(
          and(
            eq(jobSlots.envelopeId, envelope.id),
            ne(jobSlots.status, "cancelled"),
          ),
        );

      const headcountUsed = slots.length;
      const budgetCommitted = slots.reduce(
        (sum, s) => sum + parseFloat(s.totalCompBase || "0"),
        0,
      );

      const headcountRemaining = envelope.headcountCap - headcountUsed;
      const totalBudget = parseFloat(envelope.totalCompBudget);
      const budgetRemaining = totalBudget - budgetCommitted;
      const compBandLow = parseFloat(envelope.compBandLow || "0");

      if (headcountRemaining > 0 && budgetRemaining >= compBandLow) {
        fitsEnvelope = true;
        budgetImpact = compBandLow.toFixed(2);
        status = "feasible";
        break;
      }
    }

    if (!fitsEnvelope) {
      amendmentRequired = true;
      suggestedOffset =
        "Consider requesting a budget amendment or transferring capacity from a sibling envelope.";
    }
  } else if (input.requestType === "swap_role") {
    if (input.replaceSlotId) {
      const [existingSlot] = await db
        .select()
        .from(jobSlots)
        .where(eq(jobSlots.id, input.replaceSlotId));

      if (existingSlot) {
        const envelope = envelopes.find(
          (e) => e.id === existingSlot.envelopeId,
        );
        if (envelope) {
          const freedComp = parseFloat(existingSlot.totalCompBase || "0");
          const compBandLow = parseFloat(envelope.compBandLow || "0");

          if (freedComp >= compBandLow) {
            fitsEnvelope = true;
            budgetImpact = (compBandLow - freedComp).toFixed(2);
            status = "feasible";
          } else {
            amendmentRequired = true;
            suggestedOffset = `Swapping frees ${freedComp.toFixed(2)} but new role requires at least ${compBandLow.toFixed(2)}.`;
          }
        }
      }
    }
  } else {
    // modify_role, cancel_role, accelerate - generally feasible
    fitsEnvelope = true;
    status = "feasible";
  }

  const [changeRequest] = await db
    .insert(changeRequests)
    .values({
      orgUnitId: input.orgUnitId,
      requestedBy: userId,
      requestType: input.requestType,
      description: input.description,
      targetRoleTitle: input.targetRoleTitle,
      targetLevel: input.targetLevel,
      targetJobFamilyId: input.targetJobFamilyId,
      replaceSlotId: input.replaceSlotId,
      desiredStartDate: input.desiredStartDate,
      fitsEnvelope,
      budgetImpact,
      amendmentRequired,
      suggestedOffset,
      status,
    })
    .returning();

  return changeRequest;
}

export async function getMyChangeRequests(userId: string) {
  return db
    .select()
    .from(changeRequests)
    .where(eq(changeRequests.requestedBy, userId));
}

export async function getChangeRequestFeasibility(id: string) {
  const [cr] = await db
    .select({
      id: changeRequests.id,
      status: changeRequests.status,
      fitsEnvelope: changeRequests.fitsEnvelope,
      budgetImpact: changeRequests.budgetImpact,
      amendmentRequired: changeRequests.amendmentRequired,
      suggestedOffset: changeRequests.suggestedOffset,
    })
    .from(changeRequests)
    .where(eq(changeRequests.id, id));

  if (!cr) throw new NotFoundError("ChangeRequest", id);
  return cr;
}
