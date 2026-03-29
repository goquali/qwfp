import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authenticate } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors.js";
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  consumeCreditsSchema,
} from "./validators.js";
import * as service from "./service.js";
import * as stripeService from "./stripe.js";

const billingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --- Stripe webhook (no auth — verified by Stripe signature) ---

  app.post("/webhook", {
    config: { rawBody: true }, // Fastify needs raw body for Stripe signature verification
  }, async (request, reply) => {
    if (!stripeService.isStripeConfigured()) {
      return reply.code(200).send({ received: true, demo: true });
    }

    const signature = request.headers["stripe-signature"] as string;
    if (!signature) {
      return reply.code(400).send({ error: "Missing stripe-signature header" });
    }

    try {
      const event = await stripeService.handleWebhookEvent(
        (request as any).rawBody as string,
        signature,
      );

      // Handle the event
      if (event.type === "checkout_completed" && event.subscriptionId && event.tier) {
        await service.upgradeTier(event.subscriptionId, event.tier);
      }

      if (event.type === "payment_succeeded") {
        // Log payment event
        // In production, match stripeCustomerId to our subscription
      }

      if (event.type === "subscription_cancelled") {
        // Downgrade to free
        // In production, match stripeSubscriptionId to our subscription
      }

      return { received: true, type: event.type };
    } catch (err: any) {
      return reply.code(400).send({ error: `Webhook error: ${err.message}` });
    }
  });

  // --- Authenticated routes ---

  await app.register(async (authenticated: FastifyInstance) => {
    authenticated.addHook("onRequest", authenticate);

    // ---------- Subscription ----------

    authenticated.get<{ Querystring: { orgUnitId?: string } }>(
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

    authenticated.post("/subscription", async (request, reply) => {
      const body = createSubscriptionSchema.parse(request.body);
      const subscription = await service.createSubscription(
        body.orgUnitId,
        body.tier,
      );
      return reply.code(201).send(subscription);
    });

    authenticated.patch<{ Querystring: { subscriptionId?: string; orgUnitId?: string } }>(
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

    authenticated.get<{ Querystring: { subscriptionId?: string; orgUnitId?: string } }>(
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

    authenticated.get<{
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

    authenticated.post<{ Querystring: { subscriptionId?: string; orgUnitId?: string } }>(
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

    // ---------- Stripe Checkout ----------

    // Create Stripe checkout session for upgrading
    authenticated.post("/checkout", async (request, reply) => {
      if (!stripeService.isStripeConfigured()) {
        // Demo mode: simulate upgrade without Stripe
        const body = request.body as { tier: string; orgUnitId?: string };
        const orgUnitId = body.orgUnitId || "default";
        const sub = await service.getOrCreateSubscription(orgUnitId);
        const updated = await service.upgradeTier(sub.id, body.tier);
        return { url: null, demo: true, subscription: updated };
      }

      const body = request.body as { tier: string; orgUnitId?: string; email?: string };
      const orgUnitId = body.orgUnitId || "default";
      const sub = await service.getOrCreateSubscription(orgUnitId);
      const session = await stripeService.createCheckoutSession({
        subscriptionId: sub.id,
        tier: body.tier,
        customerEmail: body.email || request.currentUser?.email,
      });
      return session;
    });

    // Get all subscriptions (admin endpoint for dashboard)
    authenticated.get("/subscriptions", async (request) => {
      return service.getAllSubscriptions();
    });

    // Get revenue summary (admin endpoint)
    authenticated.get("/revenue", async (request) => {
      return service.getRevenueSummary();
    });
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

export default billingRoutes;
