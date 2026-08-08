import { z } from "zod";

export const ApiErrorSchema = z.object({
    error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional()
  })
});