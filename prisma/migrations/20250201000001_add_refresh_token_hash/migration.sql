-- Add refreshTokenHash column to users table
ALTER TABLE "users" ADD COLUMN "refresh_token_hash" TEXT;
