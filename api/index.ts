import type { VercelRequest, VercelResponse } from "@vercel/node";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { AppError } from "../src/shared/errors.js";
import coreRoutes from "../src/modules/core/routes.js";
import financeRoutes from "../src/modules/finance/routes.js";
import hrRoutes from "../src/modules/hr/routes.js";
import teamRoutes from "../src/modules/team/routes.js";
import reconciliationRoutes from "../src/modules/reconciliation/routes.js";
import ingestionRoutes from "../src/modules/ingestion/routes.js";
import taRoutes from "../src/modules/ta/routes.js";

const app = Fastify({ logger: false });

let initialized = false;

async function init() {
  if (initialized) return;
  await app.register(cors);

  app.setErrorHandler((error: Error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: error.code, message: error.message });
    }
    if (error.name === "ZodError") {
      return reply.code(400).send({ error: "VALIDATION_ERROR", message: "Invalid request body", details: (error as any).issues });
    }
    return reply.code(500).send({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
  });

  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  await app.register(coreRoutes, { prefix: "/api/v1" });
  await app.register(financeRoutes, { prefix: "/api/v1/finance" });
  await app.register(hrRoutes, { prefix: "/api/v1/hr" });
  await app.register(teamRoutes, { prefix: "/api/v1/team" });
  await app.register(reconciliationRoutes, { prefix: "/api/v1/reconciliation" });
  await app.register(ingestionRoutes, { prefix: "/api/v1/import" });
  await app.register(taRoutes, { prefix: "/api/v1/ta" });

  await app.ready();
  initialized = true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await init();

  const response = await app.inject({
    method: req.method as any,
    url: req.url || "/",
    headers: req.headers as Record<string, string>,
    payload: req.body ? JSON.stringify(req.body) : undefined,
  });

  res.status(response.statusCode);
  for (const [key, value] of Object.entries(response.headers)) {
    if (value) res.setHeader(key, value as string);
  }
  res.send(response.body);
}
