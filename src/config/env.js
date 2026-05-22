import dotenv from 'dotenv';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');

dotenv.config({ path: envPath });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  SECRET_KEY: z.string().min(16, 'SECRET_KEY must be at least 16 characters'),
  ACCESS_TOKEN_EXPIRE_MINUTES: z.coerce.number().int().positive('ACCESS_TOKEN_EXPIRE_MINUTES must be a positive integer'),
  REFRESH_TOKEN_EXPIRE_DAYS: z.coerce.number().int().positive('REFRESH_TOKEN_EXPIRE_DAYS must be a positive integer'),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  SMTP_FROM: z.string().default('noreply@saukele.kz'),
  APP_URL: z.string().default('http://localhost:3000'),

  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().optional(),
  MAILGUN_SMTP_HOST: z.string().default('smtp.mailgun.org'),
  MAILGUN_SMTP_PORT: z.coerce.number().default(587),
  MAILGUN_SMTP_USER: z.string().optional(),
  MAILGUN_SMTP_PASS: z.string().optional(),
});

console.log(`[ENV] Loading from: ${envPath}`);

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[FATAL] Environment validation failed:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

if (parsed.data.MAILGUN_SMTP_USER) {
  console.log('[ENV] ✅ Mailgun configured:');
  console.log(`  - User: ${parsed.data.MAILGUN_SMTP_USER}`);
  console.log(`  - Domain: ${parsed.data.MAILGUN_DOMAIN}`);
  console.log(`  - From: ${parsed.data.SMTP_FROM}`);
} else {
  console.warn('[ENV] ⚠️  Mailgun not fully configured');
}

const env = parsed.data;

export { env };