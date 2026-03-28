import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors.js";
import { createChangeRequestSchema } from "./validators.js";
import * as service from "./service.js";

const teamRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Apply authentication to all routes
  app.addHook("onRequest", authenticate);

  // ---------- My Teams ----------

  app.get("/my-teams", async (request) => {
    return service.getMyTeams(request.currentUser!.id);
  });

  app.get<{ Params: { id: string } }>(
    "/my-teams/:id/capacity",
    async (request) => {
      return service.getTeamCapacity(request.params.id);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/my-teams/:id/slots",
    async (request) => {
      return service.getTeamSlots(request.params.id);
    },
  );

  // ---------- Change Requests ----------

  app.post<{ Params: { id: string } }>(
    "/my-teams/:id/change-requests",
    { preHandler: requireRole("business_owner") },
    async (request, reply) => {
      const body = createChangeRequestSchema.parse(request.body);
      const changeRequest = await service.createChangeRequest(
        { ...body, orgUnitId: request.params.id },
        request.currentUser!.id,
      );
      return reply.code(201).send(changeRequest);
    },
  );

  app.get("/my-change-requests", async (request) => {
    return service.getMyChangeRequests(request.currentUser!.id);
  });

  app.get<{ Params: { id: string } }>(
    "/change-requests/:id/feasibility",
    async (request) => {
      return service.getChangeRequestFeasibility(request.params.id);
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

export default teamRoutes;
