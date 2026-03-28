import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors.js";
import * as service from "./service.js";

const taRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Apply authentication and role check to all routes
  app.addHook("onRequest", authenticate);
  app.addHook("onRequest", requireRole("hr", "ta"));

  // ---------- Recruiters ----------

  const createRecruiterSchema = z.object({
    userId: z.string().uuid(),
    maxActiveReqs: z.number().int().positive().optional(),
    specializations: z.any().optional(),
    availability: z.enum(["full_time", "part_time", "on_leave"]).optional(),
    availabilityPct: z.string().optional(),
  });

  app.post("/recruiters", async (request, reply) => {
    const body = createRecruiterSchema.parse(request.body);
    const recruiter = await service.createRecruiter(body);
    return reply.code(201).send(recruiter);
  });

  app.get("/recruiters", async () => {
    return service.getRecruiters();
  });

  app.get<{ Params: { id: string } }>("/recruiters/:id", async (request) => {
    return service.getRecruiterById(request.params.id);
  });

  const updateRecruiterSchema = z.object({
    maxActiveReqs: z.number().int().positive().optional(),
    specializations: z.any().optional(),
    availability: z.enum(["full_time", "part_time", "on_leave"]).optional(),
    availabilityPct: z.string().optional(),
  });

  app.patch<{ Params: { id: string } }>(
    "/recruiters/:id",
    async (request) => {
      const body = updateRecruiterSchema.parse(request.body);
      return service.updateRecruiter(request.params.id, body);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/recruiters/:id/workload",
    async (request) => {
      return service.getRecruiterWorkload(request.params.id);
    },
  );

  // ---------- Assignments ----------

  const createAssignmentSchema = z.object({
    recruiterId: z.string().uuid(),
    jobSlotId: z.string().uuid(),
  });

  app.post("/assignments", async (request, reply) => {
    const body = createAssignmentSchema.parse(request.body);
    const assignment = await service.createAssignment(
      body.recruiterId,
      body.jobSlotId,
    );
    return reply.code(201).send(assignment);
  });

  const updateAssignmentSchema = z.object({
    status: z.enum(["active", "completed", "reassigned"]),
  });

  app.patch<{ Params: { id: string } }>(
    "/assignments/:id",
    async (request) => {
      const body = updateAssignmentSchema.parse(request.body);
      return service.updateAssignment(request.params.id, body.status);
    },
  );

  // ---------- Capacity & Analytics ----------

  app.get("/capacity", async () => {
    return service.getCurrentCapacity();
  });

  app.get("/capacity/forecast", async () => {
    return service.getCapacityForecast();
  });

  app.get<{ Querystring: { jobFamilyId?: string } }>(
    "/velocity",
    async (request) => {
      return service.calculateVelocity(request.query.jobFamilyId);
    },
  );

  app.get("/workload-distribution", async () => {
    return service.getWorkloadDistribution();
  });

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

export default taRoutes;
