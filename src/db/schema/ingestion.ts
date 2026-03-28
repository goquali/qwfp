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
import { users } from "./core.js";

// --- Enums ---

export const importStatusEnum = pgEnum("import_status", [
  "uploaded",
  "mapping",
  "validating",
  "preview",
  "importing",
  "completed",
  "failed",
  "rolled_back",
]);

export const importSourceTypeEnum = pgEnum("import_source_type", [
  "csv",
  "xlsx",
  "json",
  "hris_api",
]);

export const importTargetEntityEnum = pgEnum("import_target_entity", [
  "org_units",
  "envelopes",
  "job_slots",
  "employees",
  "mixed",
]);

export const importRecordStatusEnum = pgEnum("import_record_status", [
  "pending",
  "validated",
  "imported",
  "skipped",
  "error",
]);

// --- Tables ---

export const importJobs = pgTable("import_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdBy: uuid("created_by").notNull(),
  sourceType: importSourceTypeEnum("source_type").notNull(),
  sourceName: varchar("source_name", { length: 255 }).notNull(),
  targetEntity: importTargetEntityEnum("target_entity").notNull(),
  status: importStatusEnum("status").notNull().default("uploaded"),
  filePath: text("file_path"),
  columnMapping: jsonb("column_mapping"), // { sourceCol: qwfpField }
  validationErrors: jsonb("validation_errors"), // [{ row, field, error }]
  previewSummary: jsonb("preview_summary"), // { entities_to_create: N, ... }
  importStats: jsonb("import_stats"), // { created: N, updated: N, skipped: N, errors: N }
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const importRecords = pgTable("import_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  importJobId: uuid("import_job_id").notNull(),
  rowNumber: integer("row_number").notNull(),
  sourceData: jsonb("source_data").notNull(), // raw row
  mappedData: jsonb("mapped_data"), // after column mapping
  targetEntityType: varchar("target_entity_type", { length: 50 }),
  targetEntityId: uuid("target_entity_id"),
  status: importRecordStatusEnum("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const fieldMappings = pgTable("field_mappings", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  sourceType: importSourceTypeEnum("source_type").notNull(),
  targetEntity: importTargetEntityEnum("target_entity").notNull(),
  mappings: jsonb("mappings").notNull(), // saved column → field mappings
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- Relations ---

export const importJobsRelations = relations(importJobs, ({ one, many }) => ({
  creator: one(users, {
    fields: [importJobs.createdBy],
    references: [users.id],
  }),
  records: many(importRecords),
}));

export const importRecordsRelations = relations(importRecords, ({ one }) => ({
  importJob: one(importJobs, {
    fields: [importRecords.importJobId],
    references: [importJobs.id],
  }),
}));

export const fieldMappingsRelations = relations(fieldMappings, ({ one }) => ({
  creator: one(users, {
    fields: [fieldMappings.createdBy],
    references: [users.id],
  }),
}));
