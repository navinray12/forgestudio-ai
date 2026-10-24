-- WP-00: move the legacy lazy data-platform DDL into the authoritative migration ledger.
-- Retain existing IF NOT EXISTS definitions to preserve legacy installations.
DO $$ BEGIN
        CREATE TYPE "DatabaseEnvironment" AS ENUM ('DEVELOPMENT', 'PREVIEW', 'PRODUCTION', 'STAGING');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      -- Older databases have only one of PREVIEW/STAGING; both labels are kept valid (additive).
      ALTER TYPE "DatabaseEnvironment" ADD VALUE IF NOT EXISTS 'PREVIEW';
      ALTER TYPE "DatabaseEnvironment" ADD VALUE IF NOT EXISTS 'STAGING';
      DO $$ BEGIN
        CREATE TYPE "DatabaseProvisioningStatus" AS ENUM ('PENDING', 'PROVISIONING', 'READY', 'FAILED', 'SUSPENDED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      DO $$ BEGIN
        CREATE TYPE "BucketVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
      DO $$ BEGIN
        CREATE TYPE "ApiKeyType" AS ENUM ('ANON', 'SERVICE_ROLE');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS project_databases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "websiteId" UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
        environment "DatabaseEnvironment" NOT NULL DEFAULT 'PRODUCTION',
        status "DatabaseProvisioningStatus" NOT NULL DEFAULT 'PENDING',
        "dbName" VARCHAR(63) NOT NULL,
        "dbUser" VARCHAR(63) NOT NULL,
        "encryptedPassword" VARCHAR(500) NOT NULL,
        host VARCHAR(255) NOT NULL,
        port INTEGER NOT NULL DEFAULT 5432,
        "connectionPoolMax" INTEGER NOT NULL DEFAULT 10,
        "connectionPoolIdleMs" INTEGER NOT NULL DEFAULT 10000,
        "storageSizeBytes" BIGINT NOT NULL DEFAULT 0,
        "lastBackupAt" TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_project_databases_website_env UNIQUE ("websiteId", environment)
      );
      CREATE INDEX IF NOT EXISTS idx_project_databases_status ON project_databases(status);

      CREATE TABLE IF NOT EXISTS project_database_backups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "databaseId" UUID NOT NULL REFERENCES project_databases(id) ON DELETE CASCADE,
        "backupName" VARCHAR(255) NOT NULL,
        "storageKey" VARCHAR(1000) NOT NULL,
        "sizeBytes" BIGINT NOT NULL,
        "checksumSha256" VARCHAR(64) NOT NULL,
        "completedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_project_db_backups_db ON project_database_backups("databaseId", "completedAt");

      CREATE TABLE IF NOT EXISTS database_migration_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "databaseId" UUID NOT NULL REFERENCES project_databases(id) ON DELETE CASCADE,
        "migrationName" VARCHAR(255) NOT NULL,
        "batchNumber" INTEGER NOT NULL DEFAULT 1,
        "appliedByUserId" UUID REFERENCES users(id) ON DELETE SET NULL,
        checksum VARCHAR(64) NOT NULL,
        "sqlScript" TEXT NOT NULL,
        "executionTimeMs" INTEGER NOT NULL,
        "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_db_mig_records_db_name UNIQUE ("databaseId", "migrationName")
      );
      CREATE INDEX IF NOT EXISTS idx_db_mig_records_db_batch ON database_migration_records("databaseId", "batchNumber");

      CREATE TABLE IF NOT EXISTS project_api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "databaseId" UUID NOT NULL REFERENCES project_databases(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        "keyType" "ApiKeyType" NOT NULL DEFAULT 'ANON',
        "tokenHash" VARCHAR(128) UNIQUE NOT NULL,
        prefix VARCHAR(16) NOT NULL,
        scopes JSONB NOT NULL DEFAULT '["data:read", "data:write"]'::jsonb,
        "rateLimitRpm" INTEGER NOT NULL DEFAULT 120,
        "expiresAt" TIMESTAMPTZ,
        "lastUsedAt" TIMESTAMPTZ,
        "revokedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_project_api_keys_db_type ON project_api_keys("databaseId", "keyType");

      CREATE TABLE IF NOT EXISTS storage_buckets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "websiteId" UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
        name VARCHAR(63) NOT NULL,
        visibility "BucketVisibility" NOT NULL DEFAULT 'PRIVATE',
        "maxSizeBytes" BIGINT NOT NULL DEFAULT 524288000,
        "usedSizeBytes" BIGINT NOT NULL DEFAULT 0,
        "allowedMimeTypes" JSONB NOT NULL DEFAULT '["*/*"]'::jsonb,
        "corsRules" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_storage_buckets_website_name UNIQUE ("websiteId", name)
      );
      CREATE INDEX IF NOT EXISTS idx_storage_buckets_website ON storage_buckets("websiteId");

      CREATE TABLE IF NOT EXISTS storage_objects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "bucketId" UUID NOT NULL REFERENCES storage_buckets(id) ON DELETE CASCADE,
        "objectKey" VARCHAR(900) NOT NULL,
        "originalName" VARCHAR(255) NOT NULL,
        "mimeType" VARCHAR(150) NOT NULL,
        "sizeBytes" BIGINT NOT NULL,
        "checksumSha256" VARCHAR(64) NOT NULL,
        "eTag" VARCHAR(100),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
