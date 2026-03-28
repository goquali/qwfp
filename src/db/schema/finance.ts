import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  decimal,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users, orgUnits, costCenters } from "./core.js";

// --- Enums ---

export const planningCycleStatusEnum = pgEnum("planning_cycle_status", [
  "draft",
  "under_review",
  "approved",
  "active",
  "closed",
]);

export const envelopeStatusEnum = pgEnum("envelope_status", [
  "draft",
  "approved",
  "active",
  "frozen",
  "closed",
]);

export const envelopeTypeEnum = pgEnum("envelope_type", [
  "new_headcount",
  "backfill",
  "conversion",
  "contractor_to_fte",
]);

export const guardrailTypeEnum = pgEnum("guardrail_type", [
  "headcount",
  "total_comp",
  "comp_band",
  "timeline",
  "vacancy_rate",
]);

export const enforcementEnum = pgEnum("enforcement", ["soft", "hard"]);

export const amendmentTypeEnum = pgEnum("amendment_type", [
  "increase",
  "decrease",
  "transfer",
  "reallocation",
]);

export const amendmentStatusEnum = pgEnum("amendment_status", [
  "pending",
  "auto_approved",
  "approved",
  "rejected",
]);

// --- Tables ---

export const planningCycles = pgTable("planning_cycles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  startDate: varchar("start_date", { length: 10 }).notNull(),
  endDate: varchar("end_date", { length: 10 }).notNull(),
  baseCurrency: varchar("base_currency", { length: 3 }).notNull().default("USD"),
  status: planningCycleStatusEnum("status").notNull().default("draft"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const budgetEnvelopes = pgTable("budget_envelopes", {
  id: uuid("id").defaultRandom().primaryKey(),
  planningCycleId: uuid("planning_cycle_id").notNull(),
  orgUnitId: uuid("org_unit_id").notNull(),
  costCenterId: uuid("cost_center_id"),
  parentEnvelopeId: uuid("parent_envelope_id"),
  envelopeType: envelopeTypeEnum("envelope_type").notNull().default("new_headcount"),
  headcountCap: integer("headcount_cap").notNull(),
  totalCompBudget: decimal("total_comp_budget", { precision: 15, scale: 2 }).notNull(),
  compBandLow: decimal("comp_band_low", { precision: 15, scale: 2 }),
  compBandHigh: decimal("comp_band_high", { precision: 15, scale: 2 }),
  startWindow: varchar("start_window", { length: 10 }),
  endWindow: varchar("end_window", { length: 10 }),
  currencyCode: varchar("currency_code", { length: 3 }).notNull().default("USD"),
  status: envelopeStatusEnum("status").notNull().default("draft"),
  autoApproveThresholdPct: decimal("auto_approve_threshold_pct", {
    precision: 5,
    scale: 2,
  })
    .notNull()
    .default("10.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const guardrailConfigs = pgTable(
  "guardrail_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    envelopeId: uuid("envelope_id").notNull(),
    guardrailType: guardrailTypeEnum("guardrail_type").notNull(),
    enforcement: enforcementEnum("enforcement").notNull().default("soft"),
    warningThresholdPct: decimal("warning_threshold_pct", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("80.00"),
    breachThresholdPct: decimal("breach_threshold_pct", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("100.00"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("guardrail_envelope_type_idx").on(
      table.envelopeId,
      table.guardrailType,
    ),
  ],
);

export const budgetAmendments = pgTable("budget_amendments", {
  id: uuid("id").defaultRandom().primaryKey(),
  envelopeId: uuid("envelope_id").notNull(),
  amendmentType: amendmentTypeEnum("amendment_type").notNull(),
  fieldChanged: varchar("field_changed", { length: 100 }).notNull(),
  oldValue: decimal("old_value", { precision: 15, scale: 2 }).notNull(),
  newValue: decimal("new_value", { precision: 15, scale: 2 }).notNull(),
  transferToEnvelopeId: uuid("transfer_to_envelope_id"),
  justification: text("justification").notNull(),
  businessContext: text("business_context"),
  status: amendmentStatusEnum("status").notNull().default("pending"),
  autoApproved: boolean("auto_approved").notNull().default(false),
  requestedBy: uuid("requested_by"),
  approvedBy: uuid("approved_by"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

// --- Relations ---

export const planningCyclesRelations = relations(
  planningCycles,
  ({ one, many }) => ({
    creator: one(users, {
      fields: [planningCycles.createdBy],
      references: [users.id],
    }),
    envelopes: many(budgetEnvelopes),
  }),
);

export const budgetEnvelopesRelations = relations(
  budgetEnvelopes,
  ({ one, many }) => ({
    planningCycle: one(planningCycles, {
      fields: [budgetEnvelopes.planningCycleId],
      references: [planningCycles.id],
    }),
    orgUnit: one(orgUnits, {
      fields: [budgetEnvelopes.orgUnitId],
      references: [orgUnits.id],
    }),
    costCenter: one(costCenters, {
      fields: [budgetEnvelopes.costCenterId],
      references: [costCenters.id],
    }),
    parent: one(budgetEnvelopes, {
      fields: [budgetEnvelopes.parentEnvelopeId],
      references: [budgetEnvelopes.id],
      relationName: "envelopeParent",
    }),
    children: many(budgetEnvelopes, { relationName: "envelopeParent" }),
    guardrails: many(guardrailConfigs),
    amendments: many(budgetAmendments),
  }),
);

export const guardrailConfigsRelations = relations(
  guardrailConfigs,
  ({ one }) => ({
    envelope: one(budgetEnvelopes, {
      fields: [guardrailConfigs.envelopeId],
      references: [budgetEnvelopes.id],
    }),
  }),
);

export const budgetAmendmentsRelations = relations(
  budgetAmendments,
  ({ one }) => ({
    envelope: one(budgetEnvelopes, {
      fields: [budgetAmendments.envelopeId],
      references: [budgetEnvelopes.id],
    }),
    transferToEnvelope: one(budgetEnvelopes, {
      fields: [budgetAmendments.transferToEnvelopeId],
      references: [budgetEnvelopes.id],
      relationName: "transferTarget",
    }),
    requestor: one(users, {
      fields: [budgetAmendments.requestedBy],
      references: [users.id],
      relationName: "amendmentRequestor",
    }),
    approver: one(users, {
      fields: [budgetAmendments.approvedBy],
      references: [users.id],
      relationName: "amendmentApprover",
    }),
  }),
);
