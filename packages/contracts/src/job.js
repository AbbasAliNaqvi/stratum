import { z } from "zod";

export const JOB_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled"
];

export const JobSubmitInputSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  priority: z.number().int().optional(),
  maxRetries: z.number().int().min(0).optional(),
  idempotencyKey: z.string().min(1).optional()
});