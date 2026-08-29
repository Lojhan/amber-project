import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().min(1).default("0.0.0.0"),
  ACTOR_ID: z.uuid().default("11111111-1111-4111-8111-111111111111"),
  BRAND_ID: z.uuid().default("99999999-0000-4000-8000-000000000001"),
});

export type ApiConfig = z.infer<typeof configSchema>;

export const loadConfig = (environment: NodeJS.ProcessEnv): ApiConfig =>
  configSchema.parse(environment);
