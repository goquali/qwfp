import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(255),
  role: z.enum(["admin", "finance", "hr", "ta", "business_owner"]),
});

export const createOrgUnitSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  level: z.enum(["company", "division", "department", "team"]),
  headUserId: z.string().uuid().nullable().optional(),
});

export const createCostCenterSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  orgUnitId: z.string().uuid().nullable().optional(),
});

export const createCurrencySchema = z.object({
  code: z.string().length(3),
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(10),
});

export const createExchangeRateSchema = z.object({
  fromCurrency: z.string().length(3),
  toCurrency: z.string().length(3),
  rate: z.string().min(1).max(30),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  source: z.string().max(100).nullable().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateOrgUnitInput = z.infer<typeof createOrgUnitSchema>;
export type CreateCostCenterInput = z.infer<typeof createCostCenterSchema>;
export type CreateCurrencyInput = z.infer<typeof createCurrencySchema>;
export type CreateExchangeRateInput = z.infer<typeof createExchangeRateSchema>;
