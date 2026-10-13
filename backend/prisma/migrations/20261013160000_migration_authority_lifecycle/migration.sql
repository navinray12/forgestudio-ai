-- One migration authority (blueprint §43, WP-21). Additive only.
-- The existing row per migration becomes the durable plan and its lifecycle record.
ALTER TABLE forge_database_migrations ADD COLUMN IF NOT EXISTS plan JSONB;
ALTER TABLE forge_database_migrations ADD COLUMN IF NOT EXISTS lifecycle JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE forge_database_migrations ADD COLUMN IF NOT EXISTS "leaseToken" VARCHAR(64);
ALTER TABLE forge_database_migrations ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMPTZ;
ALTER TABLE forge_database_migrations ADD COLUMN IF NOT EXISTS "requestKey" VARCHAR(128);
ALTER TABLE forge_database_migrations ADD COLUMN IF NOT EXISTS "createdById" UUID;
ALTER TABLE forge_database_migrations ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now();
-- A repeated plan request returns the plan it already created.
CREATE UNIQUE INDEX IF NOT EXISTS uq_forge_db_mig_request ON forge_database_migrations ("databaseId", "requestKey") WHERE "requestKey" IS NOT NULL;
-- The fenced lease: at most one migration may be executing against a database, on any instance.
CREATE UNIQUE INDEX IF NOT EXISTS uq_forge_db_mig_in_flight ON forge_database_migrations ("databaseId") WHERE status IN ('APPLYING', 'VALIDATING');
