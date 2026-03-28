import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authenticate } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors.js";
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  consumeCreditsSchema,
} from "./validators.js";
import * as service from "./service.js";

const billingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Apply authentication to all routes
  app.addHook("onRequest", authenticate);

  // ---------- Subscription ----------

  app.get<{ Querystring: { orgUnitId?: string } }>(
    "/subscription",
    async (request) => {
      const orgUnitId =
        request.query.orgUnitId || request.currentUser?.id || "default";
      const subscription = await service.getSubscription(orgUnitId);
      if (!subscription) {
        return { subscription: null };
      }
      return subscription;
    },
  );

  app.post("/subscription", async (request, reply) => {
    const body = createSubscriptionSchema.parse(request.body);
    const subscription = await service.createSubscription(
      body.orgUnitId,
      body.tier,
    );
    return reply.code(201).send(subscription);
  });

  app.patch<{ Querystring: { subscriptionId?: string; orgUnitId?: string } }>(
    "/subscription",
    async (request) => {
      const body = updateSubscriptionSchema.parse(request.body);

      let subscriptionId = request.query.subscriptionId;

      if (!subscriptionId && request.query.orgUnitId) {
        const sub = await service.getOrCreateSubscription(
          request.query.orgUnitId,
        );
        subscriptionId = sub.id;
      }

      if (!subscriptionId) {
        throw new AppError(400, "subscriptionId or orgUnitId is required");
      }

      return service.upgradeTier(subscriptionId, body.tier);
    },
  );

  // ---------- Usage ----------

  app.get<{ Querystring: { subscriptionId?: string; orgUnitId?: string } }>(
    "/usage",
    async (request) => {
      let subscriptionId = request.query.subscriptionId;

      if (!subscriptionId && request.query.orgUnitId) {
        const sub = await service.getOrCreateSubscription(
          request.query.orgUnitId,
        );
        subscriptionId = sub.id;
      }

      if (!subscriptionId) {
        throw new AppError(400, "subscriptionId or orgUnitId is required");
      }

      return service.getUsageStats(subscriptionId);
    },
  );

  app.get<{
    Querystring: { subscriptionId?: string; orgUnitId?: string; limit?: string };
  }>("/usage/log", async (request) => {
    let subscriptionId = request.query.subscriptionId;

    if (!subscriptionId && request.query.orgUnitId) {
      const sub = await service.getOrCreateSubscription(
        request.query.orgUnitId,
      );
      subscriptionId = sub.id;
    }

    if (!subscriptionId) {
      throw new AppError(400, "subscriptionId or orgUnitId is required");
    }

    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
    return service.getUsageLog(subscriptionId, limit);
  });

  app.post<{ Querystring: { subscriptionId?: string; orgUnitId?: string } }>(
    "/usage/consume",
    async (request) => {
      const body = consumeCreditsSchema.parse(request.body);

      let subscriptionId = request.query.subscriptionId;

      if (!subscriptionId && request.query.orgUnitId) {
        const sub = await service.getOrCreateSubscription(
          request.query.orgUnitId,
        );
        subscriptionId = sub.id;
      }

      if (!subscriptionId) {
        throw new AppError(400, "subscriptionId or orgUnitId is required");
      }

      const userId = request.currentUser?.id || "unknown";
      return service.consumeCredits(subscriptionId, userId, body.action);
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

export default billingRoutes;
