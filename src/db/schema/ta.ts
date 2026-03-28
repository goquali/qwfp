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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users, orgUnits } from "./core.js";
import { jobSlots, jobFamilies } from "./hr.js";

// --- Enums ---

export const recruiterAvailabilityEnum = pgEnum("recruiter_availability", [
  "full_time",
  "part_time",
  "on_leave",
]);

export const recruiterAssignmentStatusEnum = pgEnum(
  "recruiter_assignment_status",
  ["active", "completed", "reassigned"],
);

// --- Tables ---

export const recruiters = pgTable("recruiters", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique(),
  maxActiveReqs: integer("max_active_reqs").notNull().default(20),
  specializations: jsonb("specializations"), // [{ jobFamilyId, levels }]
  availability: recruiterAvailabilityEnum("availability")
    .notNull()
    .default("full_time"),
  availabilityPct: decimal("availability_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("100.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const recruiterAssignments = pgTable("recruiter_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  recruiterId: uuid("recruiter_id").notNull(),
  jobSlotId: uuid("job_slot_id").notNull(),
  status: recruiterAssignmentStatusEnum("status").notNull().default("active"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const pipelineVelocity = pgTable("pipeline_velocity", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobFamilyId: uuid("job_family_id"),
  level: varchar("level", { length: 50 }),
  orgUnitId: uuid("org_unit_id"),
  avgDaysToFill: decimal("avg_days_to_fill", { precision: 8, scale: 2 }),
  medianDaysToFill: decimal("median_days_to_fill", { precision: 8, scale: 2 }),
  p75DaysToFill: decimal("p75_days_to_fill", { precision: 8, scale: 2 }),
  avgCandidatesPerHire: decimal("avg_candidates_per_hire", {
    precision: 8,
    scale: 2,
  }),
  sampleSize: integer("sample_size").notNull().default(0),
  calculatedAt: timestamp("calculated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const taCapacitySnapshots = pgTable("ta_capacity_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  snapshotDate: varchar("snapshot_date", { length: 10 }).notNull(),
  totalRecruiters: integer("total_recruiters").notNull().default(0),
  availableCapacity: decimal("available_capacity", { precision: 8, scale: 2 })
    .notNull()
    .default("0"),
  activeReqs: integer("active_reqs").notNull().default(0),
  utilizationPct: decimal("utilization_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  projectedReqs30d: integer("projected_reqs_30d"),
  projectedReqs60d: integer("projected_reqs_60d"),
  projectedReqs90d: integer("projected_reqs_90d"),
  capacityGap: decimal("capacity_gap", { precision: 8, scale: 2 }),
  recruiterMonthsNeeded: decimal("recruiter_months_needed", {
    precision: 8,
    scale: 2,
  }),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- Relations ---

export const recruitersRelations = relations(recruiters, ({ one, many }) => ({
  user: one(users, {
    fields: [recruiters.userId],
    references: [users.id],
  }),
  assignments: many(recruiterAssignments),
}));

export const recruiterAssignmentsRelations = relations(
  recruiterAssignments,
  ({ one }) => ({
    recruiter: one(recruiters, {
      fields: [recruiterAssignments.recruiterId],
      references: [recruiters.id],
    }),
    jobSlot: one(jobSlots, {
      fields: [recruiterAssignments.jobSlotId],
      references: [jobSlots.id],
    }),
  }),
);

export const pipelineVelocityRelations = relations(
  pipelineVelocity,
  ({ one }) => ({
    jobFamily: one(jobFamilies, {
      fields: [pipelineVelocity.jobFamilyId],
      references: [jobFamilies.id],
    }),
    orgUnit: one(orgUnits, {
      fields: [pipelineVelocity.orgUnitId],
      references: [orgUnits.id],
    }),
  }),
);
