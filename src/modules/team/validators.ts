import { z } from "zod";

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

export type CreateChangeRequestInput = z.infer<
  typeof createChangeRequestSchema
>;
