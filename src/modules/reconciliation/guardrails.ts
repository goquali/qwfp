import { eq, and } from "drizzle-orm";
import { db } from "../../db/client.js";
import { budgetEnvelopes, guardrailConfigs } from "../../db/schema/finance.js";
import { jobSlots } from "../../db/schema/hr.js";
import { driftAlerts } from "../../db/schema/reconciliation.js";
import type { UtilizationMetrics } from "./engine.js";

interface GuardrailResult {
  alerts: (typeof driftAlerts.$inferSelect)[];
  hardBlock: boolean;
}

export async function evaluateGuardrails(
  envelopeId: string,
  utilization: UtilizationMetrics,
): Promise<GuardrailResult> {
  // 1. Get guardrail configs for this envelope
  const configs = await db
    .select()
    .from(guardrailConfigs)
    .where(eq(guardrailConfigs.envelopeId, envelopeId));

  const createdAlerts: (typeof driftAlerts.$inferSelect)[] = [];
  let hardBlock = false;

  for (const config of configs) {
    const warningPct = parseFloat(config.warningThresholdPct);
    const breachPct = parseFloat(config.breachThresholdPct);

    if (config.guardrailType === "headcount") {
      const usagePct =
        utilization.headcountCap > 0
          ? (utilization.headcountUsed / utilization.headcountCap) * 100
          : 0;

      if (usagePct >= breachPct) {
        const alert = await createAlertIfNotExists(envelopeId, {
          alertType: "headcount_breach",
          severity: "critical",
          enforcement: config.enforcement,
          message: `Headcount usage at ${usagePct.toFixed(1)}% (breach threshold: ${breachPct}%)`,
          currentValue: utilization.headcountUsed.toFixed(2),
          thresholdValue: utilization.headcountCap.toFixed(2),
        });
        if (alert) createdAlerts.push(alert);
        if (config.enforcement === "hard") hardBlock = true;
      } else if (usagePct >= warningPct) {
        const alert = await createAlertIfNotExists(envelopeId, {
          alertType: "headcount_warning",
          severity: "warning",
          enforcement: config.enforcement,
          message: `Headcount usage at ${usagePct.toFixed(1)}% (warning threshold: ${warningPct}%)`,
          currentValue: utilization.headcountUsed.toFixed(2),
          thresholdValue: utilization.headcountCap.toFixed(2),
        });
        if (alert) createdAlerts.push(alert);
      } else {
        // Resolve any active headcount alerts
        await resolveAlerts(envelopeId, [
          "headcount_warning",
          "headcount_breach",
        ]);
      }
    }

    if (config.guardrailType === "total_comp") {
      const usagePct =
        utilization.totalCompBudget > 0
          ? (utilization.budgetCommitted / utilization.totalCompBudget) * 100
          : 0;

      if (usagePct >= breachPct) {
        const alert = await createAlertIfNotExists(envelopeId, {
          alertType: "budget_breach",
          severity: "critical",
          enforcement: config.enforcement,
          message: `Budget usage at ${usagePct.toFixed(1)}% (breach threshold: ${breachPct}%)`,
          currentValue: utilization.budgetCommitted.toFixed(2),
          thresholdValue: utilization.totalCompBudget.toFixed(2),
        });
        if (alert) createdAlerts.push(alert);
        if (config.enforcement === "hard") hardBlock = true;
      } else if (usagePct >= warningPct) {
        const alert = await createAlertIfNotExists(envelopeId, {
          alertType: "budget_warning",
          severity: "warning",
          enforcement: config.enforcement,
          message: `Budget usage at ${usagePct.toFixed(1)}% (warning threshold: ${warningPct}%)`,
          currentValue: utilization.budgetCommitted.toFixed(2),
          thresholdValue: utilization.totalCompBudget.toFixed(2),
        });
        if (alert) createdAlerts.push(alert);
      } else {
        await resolveAlerts(envelopeId, ["budget_warning", "budget_breach"]);
      }
    }

    if (config.guardrailType === "comp_band") {
      // Check each non-cancelled slot's totalCompBase against comp bands
      const slots = await db
        .select()
        .from(jobSlots)
        .where(
          and(
            eq(jobSlots.envelopeId, envelopeId),
          ),
        );

      let hasException = false;

      const [envelope] = await db
        .select()
        .from(budgetEnvelopes)
        .where(eq(budgetEnvelopes.id, envelopeId));

      const compBandLow = parseFloat(envelope?.compBandLow || "0");
      const compBandHigh = parseFloat(envelope?.compBandHigh || "999999999");

      for (const slot of slots) {
        if (slot.status === "cancelled") continue;
        const comp = parseFloat(slot.totalCompBase || "0");

        if (comp > 0 && (comp < compBandLow || comp > compBandHigh)) {
          hasException = true;
          const alert = await createAlertIfNotExists(
            envelopeId,
            {
              alertType: "comp_band_exception",
              severity: "warning",
              enforcement: config.enforcement,
              message: `Slot ${slot.id} comp ${comp.toFixed(2)} outside band [${compBandLow.toFixed(2)}, ${compBandHigh.toFixed(2)}]`,
              currentValue: comp.toFixed(2),
              thresholdValue: compBandHigh.toFixed(2),
            },
            slot.id,
          );
          if (alert) createdAlerts.push(alert);
          if (config.enforcement === "hard") hardBlock = true;
        }
      }

      if (!hasException) {
        await resolveAlerts(envelopeId, ["comp_band_exception"]);
      }
    }
  }

  return { alerts: createdAlerts, hardBlock };
}

async function createAlertIfNotExists(
  envelopeId: string,
  alert: {
    alertType: (typeof driftAlerts.$inferSelect)["alertType"];
    severity: (typeof driftAlerts.$inferSelect)["severity"];
    enforcement: string;
    message: string;
    currentValue: string;
    thresholdValue: string;
  },
  jobSlotId?: string,
): Promise<(typeof driftAlerts.$inferSelect) | null> {
  // Check if an active alert of the same type already exists
  const existing = await db
    .select()
    .from(driftAlerts)
    .where(
      and(
        eq(driftAlerts.envelopeId, envelopeId),
        eq(driftAlerts.alertType, alert.alertType),
        eq(driftAlerts.status, "active"),
      ),
    );

  if (existing.length > 0) return null;

  const [created] = await db
    .insert(driftAlerts)
    .values({
      envelopeId,
      jobSlotId: jobSlotId ?? null,
      alertType: alert.alertType,
      severity: alert.severity,
      enforcement: alert.enforcement,
      message: alert.message,
      currentValue: alert.currentValue,
      thresholdValue: alert.thresholdValue,
    })
    .returning();

  return created;
}

async function resolveAlerts(
  envelopeId: string,
  alertTypes: (typeof driftAlerts.$inferSelect)["alertType"][],
): Promise<void> {
  for (const alertType of alertTypes) {
    const active = await db
      .select()
      .from(driftAlerts)
      .where(
        and(
          eq(driftAlerts.envelopeId, envelopeId),
          eq(driftAlerts.alertType, alertType),
          eq(driftAlerts.status, "active"),
        ),
      );

    for (const alert of active) {
      await db
        .update(driftAlerts)
        .set({ status: "resolved", resolvedAt: new Date() })
        .where(eq(driftAlerts.id, alert.id));
    }
  }
}
