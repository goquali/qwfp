import { z } from "zod";

// ---- Planning Cycles ----

export const createPlanningCycleSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  baseCurrency: z.string().length(3).default("USD"),
});

export const updatePlanningCycleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional(),
  baseCurrency: z.string().length(3).optional(),
  status: z
    .enum(["draft", "under_review", "approved", "active", "closed"])
    .optional(),
});

// ---- Budget Envelopes ----

export const createEnvelopeSchema = z.object({
  orgUnitId: z.string().uuid(),
  costCenterId: z.string().uuid().nullable().optional(),
  parentEnvelopeId: z.string().uuid().nullable().optional(),
  envelopeType: z
    .enum(["new_headcount", "backfill", "conversion", "contractor_to_fte"])
    .default("new_headcount"),
  headcountCap: z.number().int().min(0),
  totalCompBudget: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a decimal string"),
  compBandLow: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .nullable()
    .optional(),
  compBandHigh: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .nullable()
    .optional(),
  startWindow: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  endWindow: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  currencyCode: z.string().length(3).default("USD"),
  autoApproveThresholdPct: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .default("10.00"),
});

export const updateEnvelopeSchema = z.object({
  headcountCap: z.number().int().min(0).optional(),
  totalCompBudget: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  compBandLow: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .nullable()
    .optional(),
  compBandHigh: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .nullable()
    .optional(),
  startWindow: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  endWindow: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  status: z.enum(["draft", "approved", "active", "frozen", "closed"]).optional(),
  autoApproveThresholdPct: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
});

// ---- Budget Amendments ----

export const createAmendmentSchema = z.object({
  amendmentType: z.enum(["increase", "decrease", "transfer", "reallocation"]),
  fieldChanged: z.string().min(1).max(100),
  oldValue: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  newValue: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  transferToEnvelopeId: z.string().uuid().nullable().optional(),
  justification: z.string().min(1),
  businessContext: z.string().nullable().optional(),
});

export const updateAmendmentSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

// ---- Guardrail Configs ----

export const createGuardrailSchema = z.object({
  guardrailType: z.enum([
    "headcount",
    "total_comp",
    "comp_band",
    "timeline",
    "vacancy_rate",
  ]),
  enforcement: z.enum(["soft", "hard"]).default("soft"),
  warningThresholdPct: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .default("80.00"),
  breachThresholdPct: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .default("100.00"),
});

export type CreatePlanningCycleInput = z.infer<typeof createPlanningCycleSchema>;
export type UpdatePlanningCycleInput = z.infer<typeof updatePlanningCycleSchema>;
export type CreateEnvelopeInput = z.infer<typeof createEnvelopeSchema>;
export type UpdateEnvelopeInput = z.infer<typeof updateEnvelopeSchema>;
export type CreateAmendmentInput = z.infer<typeof createAmendmentSchema>;
export type UpdateAmendmentInput = z.infer<typeof updateAmendmentSchema>;
export type CreateGuardrailInput = z.infer<typeof createGuardrailSchema>;
