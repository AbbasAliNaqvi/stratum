import { z } from "zod";

import { loadEnv } from "@stratum/config";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  CONTROL_PLANE_HOST: z
    .string()
    .default("127.0.0.1"),

  CONTROL_PLANE_PORT: z
    .coerce
    .number()
    .int()
    .positive()
    .default(3000),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required"),
});

export const config = loadEnv(EnvSchema);