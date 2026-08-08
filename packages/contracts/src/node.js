import { z } from "zod";

export const NODE_STATUSES = ["registered", "unreachable"];

export const NodeRegisterInputSchema = z.object({
  nodeId: z
    .string()
    .min(1, "nodeId is required")
    .max(64)
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/,
      "nodeId contains invalid characters"
    ),

  hostname: z
    .string()
    .min(1)
    .max(255),

  cpuCores: z
    .number()
    .int()
    .positive(),

  memoryMb: z
    .number()
    .int()
    .positive(),

  platform: z
    .string()
    .max(64)
    .optional(),
});

export const NodeSchema = z.object({
  id: z.string().uuid(),

  nodeId: z.string(),

  hostname: z.string(),

  cpuCores: z.number().int(),

  memoryMb: z.number().int(),

  platform: z.string().nullable(),

  status: z.enum(NODE_STATUSES),

  createdAt: z.string(),

  updatedAt: z.string(),
});