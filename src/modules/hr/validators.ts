import { z } from "zod";

export const createJobFamilySchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
});

export const createJobSlotSchema = z.object({
  envelopeId: z.string().uuid(),
  roleTitle: z.string().min(1).max(255),
  jobFamilyId: z.string().uuid().optional(),
  level: z.string().max(50).optional(),
  workerType: z.enum(["fte", "contractor", "contingent"]).optional(),
  hiringManagerId: z.string().uuid().optional(),
  recruiterId: z.string().uuid().optional(),
  targetStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional(),
  justification: z.string().optional(),
  baseSalary: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a decimal string").optional(),
  equityValue: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a decimal string").optional(),
  bonusTarget: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a decimal string").optional(),
  benefitsCost: z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a decimal string").optional(),
  currencyCode: z.string().length(3).default("USD"),
  sourceType: z.enum(["new_hire", "backfill", "transfer", "promotion"]).optional(),
  sourceSlotId: z.string().uuid().optional(),
});

export const updateJobSlotSchema = createJobSlotSchema.partial();

export const transitionSlotStatusSchema = z.object({
  status: z.enum(["draft", "open", "sourcing", "offer", "filled", "cancelled"]),
});

export const createChangeRequestSchema = z.object({
  orgUnitId: z.string().uuid(),
  requestType: z.enum([
    "new_role",
    "swap_role",
    "modify_role",
    "cancel_role",
    "accelerate",
    "add_headcount",
  ]),
  description: z.string().min(1),
  targetRoleTitle: z.string().max(255).optional(),
  targetLevel: z.string().max(50).optional(),
  targetJobFamilyId: z.string().uuid().optional(),
  replaceSlotId: z.string().uuid().optional(),
  desiredStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional(),
});

export type CreateJobFamilyInput = z.infer<typeof createJobFamilySchema>;
export type CreateJobSlotInput = z.infer<typeof createJobSlotSchema>;
export type UpdateJobSlotInput = z.infer<typeof updateJobSlotSchema>;
export type TransitionSlotStatusInput = z.infer<typeof transitionSlotStatusSchema>;
export type CreateChangeRequestInput = z.infer<typeof createChangeRequestSchema>;
