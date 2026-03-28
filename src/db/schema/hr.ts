import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users, orgUnits } from "./core.js";
import { budgetEnvelopes } from "./finance.js";

// --- Enums ---

export const workerTypeEnum = pgEnum("worker_type", [
  "fte",
  "contractor",
  "contingent",
]);

export const slotStatusEnum = pgEnum("slot_status", [
  "draft",
  "open",
  "sourcing",
  "offer",
  "filled",
  "cancelled",
]);

export const sourceTypeEnum = pgEnum("source_type", [
  "new_hire",
  "backfill",
  "transfer",
  "promotion",
]);

export const changeRequestTypeEnum = pgEnum("change_request_type", [
  "new_role",
  "swap_role",
  "modify_role",
  "cancel_role",
  "accelerate",
  "add_headcount",
]);

export const changeRequestStatusEnum = pgEnum("change_request_status", [
  "submitted",
  "feasible",
  "needs_amendment",
  "approved",
  "in_progress",
  "completed",
  "rejected",
]);

// --- Tables ---

export const jobFamilies = pgTable("job_families", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jobSlots = pgTable(
  "job_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    envelopeId: uuid("envelope_id").notNull(),
    roleTitle: varchar("role_title", { length: 255 }).notNull(),
    jobFamilyId: uuid("job_family_id"),
    level: varchar("level", { length: 50 }),
    workerType: workerTypeEnum("worker_type").notNull().default("fte"),
    hiringManagerId: uuid("hiring_manager_id"),
    recruiterId: uuid("recruiter_id"),
    targetStartDate: varchar("target_start_date", { length: 10 }),
    justification: text("justification"),

    // Comp breakdown (local currency)
    baseSalary: decimal("base_salary", { precision: 15, scale: 2 }),
    equityValue: decimal("equity_value", { precision: 15, scale: 2 }),
    bonusTarget: decimal("bonus_target", { precision: 15, scale: 2 }),
    benefitsCost: decimal("benefits_cost", { precision: 15, scale: 2 }),
    totalComp: decimal("total_comp", { precision: 15, scale: 2 }),

    // Comp breakdown (base currency)
    baseSalaryBase: decimal("base_salary_base", { precision: 15, scale: 2 }),
    equityValueBase: decimal("equity_value_base", { precision: 15, scale: 2 }),
    bonusTargetBase: decimal("bonus_target_base", { precision: 15, scale: 2 }),
    benefitsCostBase: decimal("benefits_cost_base", { precision: 15, scale: 2 }),
    totalCompBase: decimal("total_comp_base", { precision: 15, scale: 2 }),

    currencyCode: varchar("currency_code", { length: 3 }).notNull().default("USD"),
    status: slotStatusEnum("status").notNull().default("draft"),
    sourceType: sourceTypeEnum("source_type").notNull().default("new_hire"),
    sourceSlotId: uuid("source_slot_id"),
    changeRequestId: uuid("change_request_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("job_slots_envelope_status_idx").on(table.envelopeId, table.status),
    index("job_slots_hiring_manager_idx").on(table.hiringManagerId),
  ],
);

export const jobSlotChanges = pgTable("job_slot_changes", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobSlotId: uuid("job_slot_id").notNull(),
  fieldChanged: varchar("field_changed", { length: 100 }).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changeReason: text("change_reason"),
  validated: boolean("validated").notNull().default(true),
  changedBy: uuid("changed_by"),
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
});

export const changeRequests = pgTable("change_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgUnitId: uuid("org_unit_id").notNull(),
  requestedBy: uuid("requested_by").notNull(),
  requestType: changeRequestTypeEnum("request_type").notNull(),
  description: text("description").notNull(),

  // Structured fields
  targetRoleTitle: varchar("target_role_title", { length: 255 }),
  targetLevel: varchar("target_level", { length: 50 }),
  targetJobFamilyId: uuid("target_job_family_id"),
  replaceSlotId: uuid("replace_slot_id"),
  desiredStartDate: varchar("desired_start_date", { length: 10 }),

  // Auto-analysis (computed on creation)
  fitsEnvelope: boolean("fits_envelope"),
  budgetImpact: decimal("budget_impact", { precision: 15, scale: 2 }),
  amendmentRequired: boolean("amendment_required"),
  suggestedOffset: text("suggested_offset"),

  status: changeRequestStatusEnum("status").notNull().default("submitted"),
  handledBy: uuid("handled_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

// --- Relations ---

export const jobSlotsRelations = relations(jobSlots, ({ one, many }) => ({
  envelope: one(budgetEnvelopes, {
    fields: [jobSlots.envelopeId],
    references: [budgetEnvelopes.id],
  }),
  jobFamily: one(jobFamilies, {
    fields: [jobSlots.jobFamilyId],
    references: [jobFamilies.id],
  }),
  hiringManager: one(users, {
    fields: [jobSlots.hiringManagerId],
    references: [users.id],
    relationName: "slotHiringManager",
  }),
  recruiter: one(users, {
    fields: [jobSlots.recruiterId],
    references: [users.id],
    relationName: "slotRecruiter",
  }),
  sourceSlot: one(jobSlots, {
    fields: [jobSlots.sourceSlotId],
    references: [jobSlots.id],
    relationName: "sourceSlot",
  }),
  changeRequest: one(changeRequests, {
    fields: [jobSlots.changeRequestId],
    references: [changeRequests.id],
  }),
  changes: many(jobSlotChanges),
}));

export const jobSlotChangesRelations = relations(
  jobSlotChanges,
  ({ one }) => ({
    jobSlot: one(jobSlots, {
      fields: [jobSlotChanges.jobSlotId],
      references: [jobSlots.id],
    }),
    changedByUser: one(users, {
      fields: [jobSlotChanges.changedBy],
      references: [users.id],
    }),
  }),
);

export const changeRequestsRelations = relations(
  changeRequests,
  ({ one }) => ({
    orgUnit: one(orgUnits, {
      fields: [changeRequests.orgUnitId],
      references: [orgUnits.id],
    }),
    requestor: one(users, {
      fields: [changeRequests.requestedBy],
      references: [users.id],
      relationName: "changeRequestor",
    }),
    handler: one(users, {
      fields: [changeRequests.handledBy],
      references: [users.id],
      relationName: "changeHandler",
    }),
    targetJobFamily: one(jobFamilies, {
      fields: [changeRequests.targetJobFamilyId],
      references: [jobFamilies.id],
    }),
    replaceSlot: one(jobSlots, {
      fields: [changeRequests.replaceSlotId],
      references: [jobSlots.id],
    }),
  }),
);
