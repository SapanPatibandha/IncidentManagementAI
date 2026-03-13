import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().default(3004),
  DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().url(),
  MAIL_HOST: z.string().default('smtp.mailtrap.io'),
  MAIL_PORT: z.coerce.number().default(2525),
  MAIL_USER: z.string().optional(),
  MAIL_PASS: z.string().optional(),
  MAIL_TO_OVERRIDE: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
});

export const env = envSchema.parse(process.env);
