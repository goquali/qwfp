import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authenticate } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors.js";
import {
  createUserSchema,
  createOrgUnitSchema,
  createCostCenterSchema,
  createCurrencySchema,
  createExchangeRateSchema,
} from "./validators.js";
import * as service from "./service.js";

const coreRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Apply authentication to all routes
  app.addHook("onRequest", authenticate);

  // ---------- Users ----------

  app.post("/users", async (request, reply) => {
    const body = createUserSchema.parse(request.body);
    const user = await service.createUser(body);
    return reply.code(201).send(user);
  });

  app.get("/users", async () => {
    return service.getUsers();
  });

  app.get<{ Params: { id: string } }>("/users/:id", async (request) => {
    return service.getUserById(request.params.id);
  });

  // ---------- Org Units ----------

  app.post("/org-units", async (request, reply) => {
    const body = createOrgUnitSchema.parse(request.body);
    const orgUnit = await service.createOrgUnit(body);
    return reply.code(201).send(orgUnit);
  });

  app.get("/org-units", async () => {
    return service.getOrgUnits();
  });

  app.get<{ Params: { id: string } }>("/org-units/:id", async (request) => {
    return service.getOrgUnitById(request.params.id);
  });

  app.get<{ Params: { id: string } }>(
    "/org-units/:id/children",
    async (request) => {
      return service.getOrgUnitChildren(request.params.id);
    },
  );

  app.get<{ Querystring: { rootId?: string } }>(
    "/org-units/tree",
    async (request) => {
      return service.getOrgUnitTree(request.query.rootId);
    },
  );

  // ---------- Cost Centers ----------

  app.post("/cost-centers", async (request, reply) => {
    const body = createCostCenterSchema.parse(request.body);
    const cc = await service.createCostCenter(body);
    return reply.code(201).send(cc);
  });

  app.get("/cost-centers", async () => {
    return service.getCostCenters();
  });

  // ---------- Currencies ----------

  app.post("/currencies", async (request, reply) => {
    const body = createCurrencySchema.parse(request.body);
    const currency = await service.createCurrency(body);
    return reply.code(201).send(currency);
  });

  app.get("/currencies", async () => {
    return service.getCurrencies();
  });

  // ---------- Exchange Rates ----------

  app.post("/exchange-rates", async (request, reply) => {
    const body = createExchangeRateSchema.parse(request.body);
    const rate = await service.createExchangeRate(body);
    return reply.code(201).send(rate);
  });

  app.get("/exchange-rates", async () => {
    return service.getExchangeRates();
  });

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

export default coreRoutes;
