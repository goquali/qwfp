import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// --- Enums ---

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "finance",
  "hr",
  "ta",
  "business_owner",
]);

export const orgUnitLevelEnum = pgEnum("org_unit_level", [
  "company",
  "division",
  "department",
  "team",
]);

// --- Tables ---

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orgUnits = pgTable("org_units", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentId: uuid("parent_id"),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  level: orgUnitLevelEnum("level").notNull(),
  headUserId: uuid("head_user_id"),
  materializedPath: text("materialized_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const costCenters = pgTable("cost_centers", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  orgUnitId: uuid("org_unit_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const currencies = pgTable("currencies", {
  code: varchar("code", { length: 3 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
});

export const exchangeRates = pgTable("exchange_rates", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromCurrency: varchar("from_currency", { length: 3 }).notNull(),
  toCurrency: varchar("to_currency", { length: 3 }).notNull(),
  rate: varchar("rate", { length: 30 }).notNull(), // stored as string for precision
  effectiveDate: varchar("effective_date", { length: 10 }).notNull(), // YYYY-MM-DD
  source: varchar("source", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- Relations ---

export const orgUnitsRelations = relations(orgUnits, ({ one, many }) => ({
  parent: one(orgUnits, {
    fields: [orgUnits.parentId],
    references: [orgUnits.id],
    relationName: "orgUnitParent",
  }),
  children: many(orgUnits, { relationName: "orgUnitParent" }),
  head: one(users, {
    fields: [orgUnits.headUserId],
    references: [users.id],
  }),
  costCenters: many(costCenters),
}));

export const costCentersRelations = relations(costCenters, ({ one }) => ({
  orgUnit: one(orgUnits, {
    fields: [costCenters.orgUnitId],
    references: [orgUnits.id],
  }),
}));

export const exchangeRatesRelations = relations(exchangeRates, ({ one }) => ({
  from: one(currencies, {
    fields: [exchangeRates.fromCurrency],
    references: [currencies.code],
    relationName: "fromCurrency",
  }),
  to: one(currencies, {
    fields: [exchangeRates.toCurrency],
    references: [currencies.code],
    relationName: "toCurrency",
  }),
}));
