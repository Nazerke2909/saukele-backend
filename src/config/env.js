import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  SECRET_KEY: z.string().min(16, 'SECRET_KEY must be at least 16 characters'),
  ACCESS_TOKEN_EXPIRE_MINUTES: z.coerce.number().int().positive('ACCESS_TOKEN_EXPIRE_MINUTES must be a positive integer'),
  REFRESH_TOKEN_EXPIRE_DAYS: z.coerce.number().int().positive('REFRESH_TOKEN_EXPIRE_DAYS must be a positive integer'),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),
  EMAIL_HOST: z.string().optional(),
  EMAIL_API_KEY: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.string().default('false'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('noreply@saukele.kz'),
  APP_URL: z.string().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[FATAL] Environment validation failed:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;
if (!env.EMAIL_HOST && !env.EMAIL_API_KEY) {
  console.error('[FATAL] Either EMAIL_HOST or EMAIL_API_KEY must be set');
  process.exit(1);
}

export { env };