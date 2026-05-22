import dotenv from 'dotenv';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load .env file if it exists
const envPath = join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`[ENV] Loading from: ${envPath}`);
} else {
  console.log('[ENV] No .env file found, using environment variables only');
}

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

  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().optional(),
  MAILGUN_SMTP_HOST: z.string().default('smtp.mailgun.org'),
  MAILGUN_SMTP_PORT: z.coerce.number().default(587),
  MAILGUN_SMTP_USER: z.string().optional(),
  MAILGUN_SMTP_PASS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[FATAL] Environment validation failed:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

// Debug: print which env vars we got (without secrets)
console.log('[ENV] Environment loaded:');
console.log(`  - PORT: ${parsed.data.PORT}`);
console.log(`  - NODE_ENV: ${parsed.data.NODE_ENV}`);
console.log(`  - DATABASE_URL: ${parsed.data.DATABASE_URL ? '✓ set' : '✗ missing'}`);
console.log(`  - REDIS_URL: ${parsed.data.REDIS_URL ? '✓ set' : '✗ missing'}`);
console.log(`  - SECRET_KEY: ${parsed.data.SECRET_KEY ? '✓ set' : '✗ missing'}`);

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