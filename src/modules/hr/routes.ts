import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors.js";
import {
  createJobFamilySchema,
  createJobSlotSchema,
  updateJobSlotSchema,
  transitionSlotStatusSchema,
  createChangeRequestSchema,
} from "./validators.js";
import * as service from "./service.js";

const hrRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Apply authentication to all routes
  app.addHook("onRequest", authenticate);

  // ---------- Job Families ----------

  app.post("/job-families", { preHandler: [requireRole("hr")] }, async (request, reply) => {
    const body = createJobFamilySchema.parse(request.body);
    const family = await service.createJobFamily(body);
    return reply.code(201).send(family);
  });

  app.get("/job-families", async () => {
    return service.getJobFamilies();
  });

  // ---------- Job Slots ----------

  app.post<{ Params: { id: string } }>(
    "/envelopes/:id/slots",
    { preHandler: [requireRole("hr")] },
    async (request, reply) => {
      const body = createJobSlotSchema.parse({
        ...(request.body as object),
        envelopeId: request.params.id,
      });
      const slot = await service.createJobSlot(body);
      return reply.code(201).send(slot);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/envelopes/:id/slots",
    async (request) => {
      return service.getJobSlotsByEnvelope(request.params.id);
    },
  );

  app.get<{ Params: { id: string } }>("/slots/:id", async (request) => {
    return service.getJobSlotById(request.params.id);
  });

  app.patch<{ Params: { id: string } }>(
    "/slots/:id",
    { preHandler: [requireRole("hr")] },
    async (request) => {
      const body = updateJobSlotSchema.parse(request.body);
      return service.updateJobSlot(
        request.params.id,
        body,
        request.currentUser!.id,
      );
    },
  );

  app.post<{ Params: { id: string } }>(
    "/slots/:id/status",
    { preHandler: [requireRole("hr")] },
    async (request) => {
      const body = transitionSlotStatusSchema.parse(request.body);
      return service.transitionSlotStatus(
        request.params.id,
        body.status,
        request.currentUser!.id,
      );
    },
  );

  app.get<{ Params: { id: string } }>(
    "/slots/:id/changes",
    async (request) => {
      return service.getSlotChanges(request.params.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/envelopes/:id/validate-slot",
    async (request) => {
      const body = request.body as { totalComp?: string };
      const comp = body.totalComp ?? "0";
      return service.validateSlotFitsEnvelope(request.params.id, comp);
    },
  );

  // ---------- Change Requests ----------

  app.post(
    "/change-requests",
    { preHandler: [requireRole("hr")] },
    async (request, reply) => {
      const body = createChangeRequestSchema.parse(request.body);
      const cr = await service.createChangeRequest(
        body,
        request.currentUser!.id,
      );
      return reply.code(201).send(cr);
    },
  );

  app.get<{ Querystring: { orgUnitId?: string; status?: string } }>(
    "/change-requests",
    async (request) => {
      return service.getChangeRequests(request.query);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/change-requests/:id",
    async (request) => {
      return service.getChangeRequestById(request.params.id);
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/change-requests/:id",
    { preHandler: [requireRole("hr")] },
    async (request) => {
      const body = request.body as { status: string };
      return service.updateChangeRequestStatus(
        request.params.id,
        body.status,
        request.currentUser!.id,
      );
    },
  );

  app.post<{ Params: { id: string } }>(
    "/change-requests/:id/execute",
    { preHandler: [requireRole("hr")] },
    async (request, reply) => {
      request.log.info(
        { changeRequestId: request.params.id },
        "Change request execution requested (not yet implemented)",
      );
      return reply.code(501).send({
        error: "NOT_IMPLEMENTED",
        message: "Change request execution is not yet implemented",
      });
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

    // Zod validation errors
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

export default hrRoutes;
