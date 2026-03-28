import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { AppError } from "./shared/errors.js";
import coreRoutes from "./modules/core/routes.js";
import financeRoutes from "./modules/finance/routes.js";
import hrRoutes from "./modules/hr/routes.js";
import teamRoutes from "./modules/team/routes.js";
import reconciliationRoutes from "./modules/reconciliation/routes.js";
import ingestionRoutes from "./modules/ingestion/routes.js";
import taRoutes from "./modules/ta/routes.js";
import billingRoutes from "./modules/billing/routes.js";

const app = Fastify({
  logger: {
    level: config.nodeEnv === "production" ? "info" : "debug",
  },
});

await app.register(cors);

// Global error handler
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

// Health check
app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

// Register route modules
await app.register(coreRoutes, { prefix: "/api/v1" });
await app.register(financeRoutes, { prefix: "/api/v1/finance" });
await app.register(hrRoutes, { prefix: "/api/v1/hr" });
await app.register(teamRoutes, { prefix: "/api/v1/team" });
await app.register(reconciliationRoutes, { prefix: "/api/v1/reconciliation" });
await app.register(ingestionRoutes, { prefix: "/api/v1/import" });
await app.register(taRoutes, { prefix: "/api/v1/ta" });
await app.register(billingRoutes, { prefix: "/api/v1/billing" });

// Start server
try {
  await app.listen({ port: config.port, host: config.host });
  console.log(`QWFP server running on http://${config.host}:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

export default app;
