import { z } from "zod";

const shared = {
  DATABASE_URL: z.url(),
  S3_REGION: z.string().min(1),
  S3_ENDPOINT: z.url().optional(),
  S3_PUBLIC_ENDPOINT: z.url().optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  S3_BUCKET: z.string().min(1),
};
export const apiConfigSchema = z.object({
  ...shared,
  CONFIRMATION_SECRET: z.string().min(32),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_COPILOT_MODEL: z.string().min(1),
});
export const workerConfigSchema = z.object({
  ...shared,
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_COPILOT_MODEL: z.string().min(1),
});

export type ProductionApiConfig = z.infer<typeof apiConfigSchema>;
export type ProductionWorkerConfig = z.infer<typeof workerConfigSchema>;
export const loadProductionApiConfig = (
  env: NodeJS.ProcessEnv,
): ProductionApiConfig => apiConfigSchema.parse(env);

export const loadProductionWorkerConfig = (
  env: NodeJS.ProcessEnv,
): ProductionWorkerConfig => workerConfigSchema.parse(env);
