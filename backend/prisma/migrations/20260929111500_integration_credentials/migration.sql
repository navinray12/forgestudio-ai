BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE connector_credentials ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMIT;
