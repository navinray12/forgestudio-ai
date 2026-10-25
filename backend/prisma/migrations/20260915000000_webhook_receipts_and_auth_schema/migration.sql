-- Reconciled migration stub: 20260915000000_webhook_receipts_and_auth_schema
-- Ensures webhook receipts and auth challenge idempotency tables exist safely.
CREATE TABLE IF NOT EXISTS "webhook_receipts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" VARCHAR(50) NOT NULL,
  "eventId" VARCHAR(255) NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "processedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("provider", "eventId")
);
CREATE INDEX IF NOT EXISTS "idx_webhook_receipts_provider_event" ON "webhook_receipts"("provider", "eventId");
