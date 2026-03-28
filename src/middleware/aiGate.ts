import { FastifyRequest, FastifyReply } from "fastify";
import * as billingService from "../modules/billing/service.js";

export function requireAI(action: string) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    // Get the org unit for the current user (simplification: use a default org)
    // In production, this would look up the user's organization
    const orgUnitId =
      (request.query as any)?.orgUnitId ||
      (request.body as any)?.orgUnitId ||
      "default";

    const access = await billingService.checkAIAccess(orgUnitId, action);

    if (!access.allowed) {
      reply.code(402).send({
        error: "AI_CREDITS_EXHAUSTED",
        message: `AI credits exhausted. ${access.creditsRemaining} credits remaining. Upgrade to continue using AI features.`,
        tier: access.tier,
        creditsRemaining: access.creditsRemaining,
        upgradeUrl: "/pricing",
      });
      return;
    }

    // Consume credits after the request succeeds (store action context for post-handler)
    (request as any).__aiAction = action;
    (request as any).__aiOrgUnitId = orgUnitId;
  };
}
