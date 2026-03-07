import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().default(3002),
  DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),
  LOG_LEVEL: z.string().default('info'),
});

export const env = envSchema.parse(process.env);