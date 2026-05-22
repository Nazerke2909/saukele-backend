import dotenv from 'dotenv';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  SECRET_KEY: z.string().min(16, 'SECRET_KEY must be at least 16 characters'),
  ACCESS_TOKEN_EXPIRE_MINUTES: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? '15' : val),
    z.coerce.number().int().positive()
  ),
  REFRESH_TOKEN_EXPIRE_DAYS: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? '7' : val),
    z.coerce.number().int().positive()
  ),
  FRONTEND_URL: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? 'http://localhost:3000' : val),
    z.string().min(1, 'FRONTEND_URL is required')
  ),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  SMTP_FROM: z.string().default('noreply@saukele.kz'),
  APP_URL: z.string().default('http://localhost:3000'),
  MAILGUN_SMTP_USER: z.string().optional(),
  MAILGUN_SMTP_PASS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('FAILED:');
  for (const issue of parsed.error.issues) {
    console.error(' -', issue.path.join('.'), issue.message);
  }
} else {
  console.log('SUCCESS:', JSON.stringify(parsed.data, null, 2));
}
