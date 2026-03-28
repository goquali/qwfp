import { z } from "zod";

export const createSubscriptionSchema = z.object({
  orgUnitId: z.string().uuid(),
  tier: z
    .enum(["free", "essentials", "pro", "enterprise"])
    .default("free"),
});

export const updateSubscriptionSchema = z.object({
  tier: z.enum(["free", "essentials", "pro", "enterprise"]),
});

export const consumeCreditsSchema = z.object({
  action: z.enum([
    "feasibility_check",
    "copilot_query",
    "scenario_run",
    "amendment_draft",
    "smart_recommendation",
    "predictive_alert",
  ]),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type ConsumeCreditsInput = z.infer<typeof consumeCreditsSchema>;
