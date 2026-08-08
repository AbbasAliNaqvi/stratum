import { z } from "zod";
import dotenv from "dotenv";

dotenv.config({
  path: new URL("../../../.env", import.meta.url)
});

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

  HEARTBEAT_TIMEOUT_MS: z
    .coerce
    .number()
    .int()
    .positive()
    .default(30000),

  HEARTBEAT_CHECK_INTERVAL_MS: z
    .coerce
    .number()
    .int()
    .positive()
    .default(5000)
});

const result = EnvSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment configuration:");

  for (const issue of result.error.issues) {
    console.error(
      `- ${issue.path.join(".")}: ${issue.message}`
    );
  }

  process.exit(1);
}

export const config = result.data;
