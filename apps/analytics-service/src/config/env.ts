import { z } from 'zod';

const envSchema = z.object({
  // Allow `test` so automated test runs can validate code without requiring
  // an explicit NODE_ENV override.
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3005),
  DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),
  LOG_LEVEL: z.string().default('info'),
});

export const env = envSchema.parse(process.env);
