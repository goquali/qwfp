import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { eq, and, ne, desc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { authenticate } from "../../middleware/auth.js";
import { AppError, NotFoundError } from "../../shared/errors.js";
import { budgetEnvelopes } from "../../db/schema/finance.js";
import { jobSlots } from "../../db/schema/hr.js";
import { driftAlerts, scenarios } from "../../db/schema/reconciliation.js";
import { getFlexibilityMetrics } from "./flexibility.js";
import { forecastEnvelope } from "./forecasting.js";
import {
  createScenario,
  addScenarioAction,
  analyzeScenario,
} from "./scenarios.js";

const reconciliationRoutes: FastifyPluginAsync = async (
  app: FastifyInstance,
) => {
  // Apply authentication to all routes
  app.addHook("onRequest", authenticate);

  // ---------- Alerts ----------

  app.get<{ Querystring: { envelopeId?: string } }>(
    "/alerts",
    async (request) => {
      const { envelopeId } = request.query;
      if (envelopeId) {
        return db
          .select()
          .from(driftAlerts)
          .where(
            and(
              eq(driftAlerts.envelopeId, envelopeId),
              eq(driftAlerts.status, "active"),
            ),
          )
          .orderBy(desc(driftAlerts.createdAt));
      }
      return db
        .select()
        .from(driftAlerts)
        .where(eq(driftAlerts.status, "active"))
        .orderBy(desc(driftAlerts.createdAt));
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { status: "acknowledged" | "resolved" | "overridden" };
  }>("/alerts/:id", async (request) => {
    const { id } = request.params;
    const { status } = request.body as {
      status: "acknowledged" | "resolved" | "overridden";
    };

    const [alert] = await db
      .select()
      .from(driftAlerts)
      .where(eq(driftAlerts.id, id));

    if (!alert) throw new NotFoundError("DriftAlert", id);

    const updateData: Record<string, unknown> = { status };
    if (status === "acknowledged") {
      updateData.acknowledgedBy = request.currentUser!.id;
    }
    if (status === "resolved" || status === "overridden") {
      updateData.resolvedAt = new Date();
    }

    const [updated] = await db
      .update(driftAlerts)
      .set(updateData)
      .where(eq(driftAlerts.id, id))
      .returning();

    return updated;
  });

  // ---------- Dashboards ----------

  app.get("/dashboard/finance", async () => {
    // Aggregate utilization across all active envelopes
    const envelopes = await db
      .select()
      .from(budgetEnvelopes)
      .where(eq(budgetEnvelopes.status, "active"));

    let totalHeadcountCap = 0;
    let totalHeadcountUsed = 0;
    let totalBudget = 0;
    let totalBudgetCommitted = 0;

    for (const envelope of envelopes) {
      const slots = await db
        .select()
        .from(jobSlots)
        .where(
          and(
            eq(jobSlots.envelopeId, envelope.id),
            ne(jobSlots.status, "cancelled"),
          ),
        );

      totalHeadcountCap += envelope.headcountCap;
      totalHeadcountUsed += slots.length;
      totalBudget += parseFloat(envelope.totalCompBudget);
      totalBudgetCommitted += slots.reduce(
        (sum, s) => sum + parseFloat(s.totalCompBase || "0"),
        0,
      );
    }

    const activeAlerts = await db
      .select()
      .from(driftAlerts)
      .where(eq(driftAlerts.status, "active"));

    return {
      envelopeCount: envelopes.length,
      headcountCap: totalHeadcountCap,
      headcountUsed: totalHeadcountUsed,
      headcountRemaining: totalHeadcountCap - totalHeadcountUsed,
      budgetTotal: totalBudget.toFixed(2),
      budgetCommitted: totalBudgetCommitted.toFixed(2),
      budgetRemaining: (totalBudget - totalBudgetCommitted).toFixed(2),
      utilizationPct:
        totalBudget > 0
          ? parseFloat(
              ((totalBudgetCommitted / totalBudget) * 100).toFixed(2),
            )
          : 0,
      activeAlertCount: activeAlerts.length,
      alertsBySeverity: {
        critical: activeAlerts.filter((a) => a.severity === "critical").length,
        warning: activeAlerts.filter((a) => a.severity === "warning").length,
        info: activeAlerts.filter((a) => a.severity === "info").length,
      },
    };
  });

  app.get("/dashboard/hr", async () => {
    // HR-focused view with flexibility metrics
    const envelopes = await db
      .select()
      .from(budgetEnvelopes)
      .where(eq(budgetEnvelopes.status, "active"));

    const envelopeMetrics = [];
    for (const envelope of envelopes) {
      const flexibility = await getFlexibilityMetrics(envelope.id);
      const forecast = await forecastEnvelope(envelope.id);
      envelopeMetrics.push({
        envelopeId: envelope.id,
        orgUnitId: envelope.orgUnitId,
        flexibility,
        forecast,
      });
    }

    return { envelopes: envelopeMetrics };
  });

  app.get<{ Params: { orgUnitId: string } }>(
    "/dashboard/team/:orgUnitId",
    async (request) => {
      const { orgUnitId } = request.params;

      const envelopes = await db
        .select()
        .from(budgetEnvelopes)
        .where(
          and(
            eq(budgetEnvelopes.orgUnitId, orgUnitId),
            ne(budgetEnvelopes.status, "closed"),
          ),
        );

      const results = [];
      for (const envelope of envelopes) {
        const flexibility = await getFlexibilityMetrics(envelope.id);
        const forecast = await forecastEnvelope(envelope.id);

        const alerts = await db
          .select()
          .from(driftAlerts)
          .where(
            and(
              eq(driftAlerts.envelopeId, envelope.id),
              eq(driftAlerts.status, "active"),
            ),
          );

        results.push({
          envelopeId: envelope.id,
          envelopeType: envelope.envelopeType,
          status: envelope.status,
          flexibility,
          forecast,
          activeAlerts: alerts,
        });
      }

      return { orgUnitId, envelopes: results };
    },
  );

  // ---------- Scenarios ----------

  app.post("/scenarios", async (request, reply) => {
    const body = request.body as {
      name: string;
      description?: string;
      baseEnvelopeId: string;
    };
    const scenario = await createScenario(body, request.currentUser!.id);
    return reply.code(201).send(scenario);
  });

  app.post<{ Params: { id: string } }>(
    "/scenarios/:id/actions",
    async (request, reply) => {
      const body = request.body as {
        actionType:
          | "add_slot"
          | "remove_slot"
          | "modify_slot"
          | "transfer_budget";
        parameters: Record<string, unknown>;
      };
      const action = await addScenarioAction(request.params.id, body);
      return reply.code(201).send(action);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/scenarios/:id/analyze",
    async (request) => {
      return analyzeScenario(request.params.id);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/scenarios/:id",
    async (request) => {
      const [scenario] = await db
        .select()
        .from(scenarios)
        .where(eq(scenarios.id, request.params.id));

      if (!scenario) throw new NotFoundError("Scenario", request.params.id);
      return scenario;
    },
  );

  // ---------- Error handler ----------

  app.setErrorHandler((error: Error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: error.code,
        message: error.message,
      });
    }

    if (error.name === "ZodError") {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        message: "Invalid request body",
        details: (error as any).issues,
      });
    }

    request.log.error(error);
    return reply.code(500).send({
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    });
  });
};

export default reconciliationRoutes;
