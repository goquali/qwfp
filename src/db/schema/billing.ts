import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users, orgUnits } from "./core.js";

// --- Enums ---

export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "free",
  "essentials",
  "pro",
  "enterprise",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "cancelled",
  "past_due",
  "trialing",
]);

export const aiActionEnum = pgEnum("ai_action", [
  "feasibility_check",
  "copilot_query",
  "scenario_run",
  "amendment_draft",
  "smart_recommendation",
  "predictive_alert",
]);

export const billingEventTypeEnum = pgEnum("billing_event_type", [
  "subscription_created",
  "tier_upgraded",
  "tier_downgraded",
  "credits_purchased",
  "credits_reset",
  "payment_received",
]);

// --- Tables ---

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgUnitId: uuid("org_unit_id").notNull(),
  tier: subscriptionTierEnum("tier").notNull().default("free"),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  creditsIncluded: integer("credits_included").notNull().default(50),
  creditsUsed: integer("credits_used").notNull().default(0),
  creditsRemaining: integer("credits_remaining").notNull().default(50),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).defaultNow().notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const aiUsageLog = pgTable("ai_usage_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  subscriptionId: uuid("subscription_id").notNull(),
  userId: uuid("user_id").notNull(),
  action: aiActionEnum("action").notNull(),
  creditsCost: integer("credits_cost").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const billingEvents = pgTable("billing_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  subscriptionId: uuid("subscription_id").notNull(),
  eventType: billingEventTypeEnum("event_type").notNull(),
  previousTier: subscriptionTierEnum("previous_tier"),
  newTier: subscriptionTierEnum("new_tier"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- Relations ---

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  orgUnit: one(orgUnits, {
    fields: [subscriptions.orgUnitId],
    references: [orgUnits.id],
  }),
  usageLog: many(aiUsageLog),
  billingEvents: many(billingEvents),
}));

export const aiUsageLogRelations = relations(aiUsageLog, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [aiUsageLog.subscriptionId],
    references: [subscriptions.id],
  }),
  user: one(users, {
    fields: [aiUsageLog.userId],
    references: [users.id],
  }),
}));

export const billingEventsRelations = relations(billingEvents, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [billingEvents.subscriptionId],
    references: [subscriptions.id],
  }),
}));
