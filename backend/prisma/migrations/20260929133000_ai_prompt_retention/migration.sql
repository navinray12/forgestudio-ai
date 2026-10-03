BEGIN;
ALTER TABLE "ai_executions" ADD COLUMN "promptCiphertext" text, ADD COLUMN "promptExpiresAt" timestamptz;
CREATE INDEX "ai_executions_prompt_expiry_idx" ON "ai_executions"("promptExpiresAt") WHERE "promptExpiresAt" IS NOT NULL;
COMMIT;
