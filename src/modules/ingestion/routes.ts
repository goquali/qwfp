import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors.js";
import * as service from "./service.js";

const ingestionRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Apply authentication and role check to all routes
  app.addHook("onRequest", authenticate);
  app.addHook("onRequest", requireRole("hr", "finance"));

  // ---------- Import Jobs ----------

  const createImportJobSchema = z.object({
    sourceType: z.enum(["csv", "xlsx", "json", "hris_api"]),
    sourceName: z.string().min(1).max(255),
    targetEntity: z.enum(["org_units", "envelopes", "job_slots", "employees", "mixed"]),
    filePath: z.string().optional(),
    rawData: z.string().optional(),
  });

  app.post("/jobs", async (request, reply) => {
    const body = createImportJobSchema.parse(request.body);
    const job = await service.createImportJob(body, request.currentUser!.id);
    return reply.code(201).send(job);
  });

  app.get<{ Params: { id: string } }>("/jobs/:id", async (request) => {
    return service.getImportJobById(request.params.id);
  });

  const submitMappingSchema = z.object({
    mapping: z.record(z.string(), z.string()),
  });

  app.post<{ Params: { id: string } }>("/jobs/:id/map", async (request) => {
    const body = submitMappingSchema.parse(request.body);
    return service.submitColumnMapping(request.params.id, body.mapping);
  });

  app.get<{ Params: { id: string } }>("/jobs/:id/validate", async (request) => {
    return service.runValidation(request.params.id);
  });

  app.get<{ Params: { id: string } }>("/jobs/:id/preview", async (request) => {
    return service.getPreview(request.params.id);
  });

  app.post<{ Params: { id: string } }>("/jobs/:id/execute", async (request) => {
    return service.executeImport(request.params.id);
  });

  app.post<{ Params: { id: string } }>("/jobs/:id/rollback", async (request) => {
    return service.rollbackImport(request.params.id);
  });

  // ---------- Field Mappings ----------

  app.get("/field-mappings", async () => {
    return service.getFieldMappings();
  });

  const createFieldMappingSchema = z.object({
    name: z.string().min(1).max(255),
    sourceType: z.enum(["csv", "xlsx", "json", "hris_api"]),
    targetEntity: z.enum(["org_units", "envelopes", "job_slots", "employees", "mixed"]),
    mappings: z.record(z.string(), z.string()),
  });

  app.post("/field-mappings", async (request, reply) => {
    const body = createFieldMappingSchema.parse(request.body);
    const mapping = await service.createFieldMapping(body, request.currentUser!.id);
    return reply.code(201).send(mapping);
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

export default ingestionRoutes;
