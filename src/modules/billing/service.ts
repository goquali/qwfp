import { eq, desc, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  subscriptions,
  aiUsageLog,
  billingEvents,
} from "../../db/schema/billing.js";
import { NotFoundError } from "../../shared/errors.js";

// --- Constants ---

const TIER_CREDITS: Record<string, number> = {
  free: 50,
  essentials: 500,
  pro: 5000,
  enterprise: 999999,
};

const CREDIT_COSTS: Record<string, number> = {
  feasibility_check: 2,
  copilot_query: 1,
  scenario_run: 3,
  amendment_draft: 2,
  smart_recommendation: 1,
  predictive_alert: 0,
};

// --- Subscriptions ---

export async function getSubscription(orgUnitId: string) {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgUnitId, orgUnitId));
  return subscription ?? null;
}

export async function getOrCreateSubscription(orgUnitId: string) {
  const existing = await getSubscription(orgUnitId);
  if (existing) return existing;
  return createSubscription(orgUnitId, "free");
}

export async function createSubscription(
  orgUnitId: string,
  tier: string = "free",
) {
  const credits = TIER_CREDITS[tier] ?? TIER_CREDITS.free;

  const [subscription] = await db
    .insert(subscriptions)
    .values({
      orgUnitId,
      tier: tier as any,
      status: "active",
      creditsIncluded: credits,
      creditsUsed: 0,
      creditsRemaining: credits,
    })
    .returning();

  await db.insert(billingEvents).values({
    subscriptionId: subscription.id,
    eventType: "subscription_created",
    newTier: tier as any,
    metadata: { creditsIncluded: credits },
  });

  return subscription;
}

export async function upgradeTier(subscriptionId: string, newTier: string) {
  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId));

  if (!existing) throw new NotFoundError("Subscription", subscriptionId);

  const previousTier = existing.tier;
  const newCredits = TIER_CREDITS[newTier] ?? TIER_CREDITS.free;

  // Calculate additional credits: new allocation minus what was already included,
  // plus whatever remains unused
  const additionalCredits = newCredits - existing.creditsIncluded;
  const newRemaining = existing.creditsRemaining + additionalCredits;

  const [updated] = await db
    .update(subscriptions)
    .set({
      tier: newTier as any,
      creditsIncluded: newCredits,
      creditsRemaining: newRemaining > 0 ? newRemaining : 0,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  const tiers = ["free", "essentials", "pro", "enterprise"];
  const isUpgrade = tiers.indexOf(newTier) > tiers.indexOf(previousTier);

  await db.insert(billingEvents).values({
    subscriptionId,
    eventType: isUpgrade ? "tier_upgraded" : "tier_downgraded",
    previousTier: previousTier as any,
    newTier: newTier as any,
    metadata: {
      previousCredits: existing.creditsIncluded,
      newCredits,
      creditsRemaining: updated.creditsRemaining,
    },
  });

  return updated;
}

export async function consumeCredits(
  subscriptionId: string,
  userId: string,
  action: string,
  amount?: number,
) {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId));

  if (!subscription) throw new NotFoundError("Subscription", subscriptionId);

  const cost = amount ?? CREDIT_COSTS[action] ?? 1;

  // Enterprise tier always allows
  if (subscription.tier === "enterprise") {
    await db.insert(aiUsageLog).values({
      subscriptionId,
      userId,
      action: action as any,
      creditsCost: cost,
    });

    await db
      .update(subscriptions)
      .set({
        creditsUsed: subscription.creditsUsed + cost,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscriptionId));

    return {
      allowed: true,
      creditsRemaining: subscription.creditsRemaining,
    };
  }

  // Check if credits are available
  if (subscription.creditsRemaining < cost) {
    return {
      allowed: false,
      creditsRemaining: subscription.creditsRemaining,
      reason: "Credits exhausted",
    };
  }

  // Deduct credits
  const newRemaining = subscription.creditsRemaining - cost;
  const newUsed = subscription.creditsUsed + cost;

  await db
    .update(subscriptions)
    .set({
      creditsUsed: newUsed,
      creditsRemaining: newRemaining,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId));

  await db.insert(aiUsageLog).values({
    subscriptionId,
    userId,
    action: action as any,
    creditsCost: cost,
  });

  return {
    allowed: true,
    creditsRemaining: newRemaining,
  };
}

export async function checkAIAccess(orgUnitId: string, action: string) {
  const subscription = await getOrCreateSubscription(orgUnitId);

  const cost = CREDIT_COSTS[action] ?? 1;

  // Enterprise tier always has access
  if (subscription.tier === "enterprise") {
    return {
      allowed: true,
      creditsRemaining: subscription.creditsRemaining,
      tier: subscription.tier,
    };
  }

  if (subscription.creditsRemaining < cost) {
    return {
      allowed: false,
      creditsRemaining: subscription.creditsRemaining,
      tier: subscription.tier,
      reason: "Credits exhausted",
    };
  }

  return {
    allowed: true,
    creditsRemaining: subscription.creditsRemaining,
    tier: subscription.tier,
  };
}

export async function getUsageStats(subscriptionId: string) {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId));

  if (!subscription) throw new NotFoundError("Subscription", subscriptionId);

  // Aggregate usage by action
  const usageRows = await db
    .select({
      action: aiUsageLog.action,
      total: sql<number>`cast(sum(${aiUsageLog.creditsCost}) as integer)`,
    })
    .from(aiUsageLog)
    .where(eq(aiUsageLog.subscriptionId, subscriptionId))
    .groupBy(aiUsageLog.action);

  const usageByAction: Record<string, number> = {};
  for (const row of usageRows) {
    usageByAction[row.action] = row.total;
  }

  return {
    creditsUsed: subscription.creditsUsed,
    creditsRemaining: subscription.creditsRemaining,
    creditsIncluded: subscription.creditsIncluded,
    usageByAction,
    tier: subscription.tier,
  };
}

export async function getUsageLog(subscriptionId: string, limit: number = 50) {
  return db
    .select()
    .from(aiUsageLog)
    .where(eq(aiUsageLog.subscriptionId, subscriptionId))
    .orderBy(desc(aiUsageLog.createdAt))
    .limit(limit);
}

// --- Admin functions ---

export async function getAllSubscriptions() {
  return db.select().from(subscriptions);
}

export async function getRevenueSummary() {
  const allSubs = await db.select().from(subscriptions);

  const MONTHLY_PRICES: Record<string, number> = {
    free: 0,
    essentials: 99,
    pro: 499,
    enterprise: 1999,
  };

  let totalMRR = 0;
  const tierCounts: Record<string, number> = { free: 0, essentials: 0, pro: 0, enterprise: 0 };
  let totalCreditsUsed = 0;
  let totalCreditsIncluded = 0;

  for (const sub of allSubs) {
    tierCounts[sub.tier] = (tierCounts[sub.tier] || 0) + 1;
    totalMRR += MONTHLY_PRICES[sub.tier] || 0;
    totalCreditsUsed += sub.creditsUsed;
    totalCreditsIncluded += sub.creditsIncluded;
  }

  return {
    totalCustomers: allSubs.length,
    totalMRR,
    totalARR: totalMRR * 12,
    tierCounts,
    totalCreditsUsed,
    totalCreditsIncluded,
    creditUtilization: totalCreditsIncluded > 0 ? ((totalCreditsUsed / totalCreditsIncluded) * 100).toFixed(1) : "0",
    subscriptions: allSubs,
  };
}
