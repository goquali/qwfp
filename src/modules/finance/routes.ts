import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors.js";
import {
  createPlanningCycleSchema,
  updatePlanningCycleSchema,
  createEnvelopeSchema,
  updateEnvelopeSchema,
  createAmendmentSchema,
  updateAmendmentSchema,
  createGuardrailSchema,
} from "./validators.js";
import * as service from "./service.js";

const financeRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Apply authentication to all routes
  app.addHook("onRequest", authenticate);

  // ---------- Planning Cycles ----------

  app.post(
    "/planning-cycles",
    { preHandler: [requireRole("finance")] },
    async (request, reply) => {
      const body = createPlanningCycleSchema.parse(request.body);
      const cycle = await service.createPlanningCycle(
        body,
        request.currentUser?.id,
      );
      return reply.code(201).send(cycle);
    },
  );

  app.get("/planning-cycles", async () => {
    return service.getPlanningCycles();
  });

  app.get<{ Params: { id: string } }>(
    "/planning-cycles/:id",
    async (request) => {
      return service.getPlanningCycleById(request.params.id);
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/planning-cycles/:id",
    { preHandler: [requireRole("finance")] },
    async (request) => {
      const body = updatePlanningCycleSchema.parse(request.body);
      return service.updatePlanningCycle(request.params.id, body);
    },
  );

  // ---------- Budget Envelopes ----------

  app.post<{ Params: { id: string } }>(
    "/planning-cycles/:id/envelopes",
    { preHandler: [requireRole("finance")] },
    async (request, reply) => {
      const body = createEnvelopeSchema.parse(request.body);
      const envelope = await service.createEnvelope(request.params.id, body);
      return reply.code(201).send(envelope);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/planning-cycles/:id/envelopes",
    async (request) => {
      return service.getEnvelopes(request.params.id);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/envelopes/:id",
    async (request) => {
      return service.getEnvelopeById(request.params.id);
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/envelopes/:id",
    { preHandler: [requireRole("finance")] },
    async (request) => {
      const body = updateEnvelopeSchema.parse(request.body);
      return service.updateEnvelope(request.params.id, body);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/envelopes/:id/children",
    async (request) => {
      return service.getEnvelopeChildren(request.params.id);
    },
  );

  // ---------- Envelope Utilization ----------

  app.get<{ Params: { id: string } }>(
    "/envelopes/:id/utilization",
    async (request) => {
      return service.getEnvelopeUtilization(request.params.id);
    },
  );

  // ---------- Budget Amendments ----------

  app.post<{ Params: { id: string } }>(
    "/envelopes/:id/amendments",
    { preHandler: [requireRole("finance", "business_owner")] },
    async (request, reply) => {
      const body = createAmendmentSchema.parse(request.body);
      const amendment = await service.createAmendment(
        request.params.id,
        body,
        request.currentUser?.id,
      );
      return reply.code(201).send(amendment);
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/amendments/:id",
    { preHandler: [requireRole("finance")] },
    async (request) => {
      const body = updateAmendmentSchema.parse(request.body);
      const userId = request.currentUser!.id;

      if (body.status === "approved") {
        return service.approveAmendment(request.params.id, userId);
      }
      return service.rejectAmendment(request.params.id, userId);
    },
  );

  // ---------- Guardrail Configs ----------

  app.post<{ Params: { envelopeId: string } }>(
    "/guardrails/:envelopeId",
    { preHandler: [requireRole("finance")] },
    async (request, reply) => {
      const body = createGuardrailSchema.parse(request.body);
      const guardrail = await service.createGuardrail(
        request.params.envelopeId,
        body,
      );
      return reply.code(201).send(guardrail);
    },
  );

  app.get<{ Params: { envelopeId: string } }>(
    "/guardrails/:envelopeId",
    async (request) => {
      return service.getGuardrails(request.params.envelopeId);
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

export default financeRoutes;
