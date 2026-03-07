import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  IDENTITY_SERVICE_URL: z.string().url(),
  IDENTITY_SERVICE_JWKS_URL: z.string().url(),
  INCIDENT_SERVICE_URL: z.string().url().default('http://localhost:3002'),
  USER_SERVICE_URL: z.string().url().default('http://localhost:3003'),
  NOTIFICATION_SERVICE_URL: z.string().url().default('http://localhost:3004'),
  ANALYTICS_SERVICE_URL: z.string().url().default('http://localhost:3005'),
  LOG_LEVEL: z.string().default('info'),
});

export const env = envSchema.parse(process.env);