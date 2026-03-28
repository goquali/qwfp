import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  decimal,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./core.js";
import { budgetEnvelopes } from "./finance.js";
import { jobSlots } from "./hr.js";

// --- Enums ---

export const snapshotTypeEnum = pgEnum("snapshot_type", [
  "event_triggered",
  "scheduled_daily",
  "scheduled_weekly",
]);

export const alertTypeEnum = pgEnum("alert_type", [
  "headcount_warning",
  "headcount_breach",
  "budget_warning",
  "budget_breach",
  "comp_band_exception",
  "timeline_drift",
  "utilization_low",
]);

export const alertSeverityEnum = pgEnum("alert_severity", [
  "info",
  "warning",
  "critical",
]);

export const alertStatusEnum = pgEnum("alert_status", [
  "active",
  "acknowledged",
  "resolved",
  "overridden",
]);

export const scenarioStatusEnum = pgEnum("scenario_status", [
  "draft",
  "analyzing",
  "completed",
]);

export const scenarioActionTypeEnum = pgEnum("scenario_action_type", [
  "add_slot",
  "remove_slot",
  "modify_slot",
  "transfer_budget",
]);

export const mobilityEventTypeEnum = pgEnum("mobility_event_type", [
  "transfer",
  "promotion",
]);

// --- Tables ---

export const envelopeSnapshots = pgTable(
  "envelope_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    envelopeId: uuid("envelope_id").notNull(),
    snapshotType: snapshotTypeEnum("snapshot_type").notNull(),
    slotsTotal: integer("slots_total").notNull().default(0),
    slotsOpen: integer("slots_open").notNull().default(0),
    slotsFilled: integer("slots_filled").notNull().default(0),
    slotsCancelled: integer("slots_cancelled").notNull().default(0),
    headcountUsed: integer("headcount_used").notNull().default(0),
    headcountRemaining: integer("headcount_remaining").notNull().default(0),
    budgetCommitted: decimal("budget_committed", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    budgetConsumed: decimal("budget_consumed", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    budgetRemaining: decimal("budget_remaining", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    flexibilityPct: decimal("flexibility_pct", { precision: 5, scale: 2 })
      .notNull()
      .default("100"),
    forecastCompletionDate: varchar("forecast_completion_date", { length: 10 }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("envelope_snapshots_envelope_date_idx").on(
      table.envelopeId,
      table.capturedAt,
    ),
  ],
);

export const driftAlerts = pgTable("drift_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  envelopeId: uuid("envelope_id").notNull(),
  jobSlotId: uuid("job_slot_id"),
  alertType: alertTypeEnum("alert_type").notNull(),
  severity: alertSeverityEnum("severity").notNull(),
  enforcement: varchar("enforcement", { length: 10 }).notNull(), // "soft" or "hard"
  message: text("message").notNull(),
  details: jsonb("details"),
  currentValue: decimal("current_value", { precision: 15, scale: 2 }),
  thresholdValue: decimal("threshold_value", { precision: 15, scale: 2 }),
  status: alertStatusEnum("status").notNull().default("active"),
  acknowledgedBy: uuid("acknowledged_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const scenarios = pgTable("scenarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  baseEnvelopeId: uuid("base_envelope_id").notNull(),
  createdBy: uuid("created_by").notNull(),
  status: scenarioStatusEnum("status").notNull().default("draft"),
  resultSummary: jsonb("result_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scenarioActions = pgTable("scenario_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  scenarioId: uuid("scenario_id").notNull(),
  actionType: scenarioActionTypeEnum("action_type").notNull(),
  parameters: jsonb("parameters").notNull(),
  projectedImpact: jsonb("projected_impact"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const mobilityEvents = pgTable("mobility_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceSlotId: uuid("source_slot_id").notNull(),
  destinationSlotId: uuid("destination_slot_id").notNull(),
  eventType: mobilityEventTypeEnum("event_type").notNull(),
  effectiveDate: varchar("effective_date", { length: 10 }).notNull(),
  compChange: decimal("comp_change", { precision: 15, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- Relations ---

export const envelopeSnapshotsRelations = relations(
  envelopeSnapshots,
  ({ one }) => ({
    envelope: one(budgetEnvelopes, {
      fields: [envelopeSnapshots.envelopeId],
      references: [budgetEnvelopes.id],
    }),
  }),
);

export const driftAlertsRelations = relations(driftAlerts, ({ one }) => ({
  envelope: one(budgetEnvelopes, {
    fields: [driftAlerts.envelopeId],
    references: [budgetEnvelopes.id],
  }),
  jobSlot: one(jobSlots, {
    fields: [driftAlerts.jobSlotId],
    references: [jobSlots.id],
  }),
  acknowledgedByUser: one(users, {
    fields: [driftAlerts.acknowledgedBy],
    references: [users.id],
  }),
}));

export const scenariosRelations = relations(scenarios, ({ one, many }) => ({
  baseEnvelope: one(budgetEnvelopes, {
    fields: [scenarios.baseEnvelopeId],
    references: [budgetEnvelopes.id],
  }),
  creator: one(users, {
    fields: [scenarios.createdBy],
    references: [users.id],
  }),
  actions: many(scenarioActions),
}));

export const scenarioActionsRelations = relations(
  scenarioActions,
  ({ one }) => ({
    scenario: one(scenarios, {
      fields: [scenarioActions.scenarioId],
      references: [scenarios.id],
    }),
  }),
);

export const mobilityEventsRelations = relations(
  mobilityEvents,
  ({ one }) => ({
    sourceSlot: one(jobSlots, {
      fields: [mobilityEvents.sourceSlotId],
      references: [jobSlots.id],
      relationName: "mobilitySource",
    }),
    destinationSlot: one(jobSlots, {
      fields: [mobilityEvents.destinationSlotId],
      references: [jobSlots.id],
      relationName: "mobilityDestination",
    }),
  }),
);
