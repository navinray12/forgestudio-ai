BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE ai_changesets ADD COLUMN "appliedRevisionId" UUID;
ALTER TABLE ai_changesets ADD COLUMN "applyAcknowledgement" JSONB;
CREATE INDEX "ai_executions_promptExpiresAt_idx" ON ai_executions("promptExpiresAt");
COMMIT;
