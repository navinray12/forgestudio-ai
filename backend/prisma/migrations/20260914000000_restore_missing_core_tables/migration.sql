-- Reconciled migration stub: 20260914000000_restore_missing_core_tables
-- Ensures baseline core tables exist idempotently on fresh installs while preserving existing database history.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core websites table baseline check
CREATE TABLE IF NOT EXISTS "websites" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "slug" VARCHAR(255) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  "editorData" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "websites_userId_idx" ON "websites"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "websites_slug_key" ON "websites"("slug");
