-- The runtime schema bootstrap already defines these two tables. A clean
-- Prisma migration sequence must provide them before migration lifecycle DDL.
-- This mirrors their existing CREATE TABLE / INDEX definitions and preserves
-- all existing rows via IF NOT EXISTS. No tables are dropped or renamed.
CREATE TABLE IF NOT EXISTS forge_databases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      environment VARCHAR(30) NOT NULL DEFAULT 'development',
      status VARCHAR(30) NOT NULL DEFAULT 'READY',
      engine VARCHAR(30) NOT NULL DEFAULT 'postgresql',
      "engineVersion" VARCHAR(30) NOT NULL DEFAULT '16',
      "databaseName" VARCHAR(100) NOT NULL DEFAULT 'forge_customer_db',
      "schemaName" VARCHAR(100) NOT NULL,
      "connectionUrlEncrypted" TEXT,
      "maxConnections" INTEGER NOT NULL DEFAULT 10,
      "storageLimitBytes" BIGINT NOT NULL DEFAULT 1073741824,
      "storageUsedBytes" BIGINT NOT NULL DEFAULT 0,
      "isBranch" BOOLEAN NOT NULL DEFAULT false,
      "parentDatabaseId" UUID REFERENCES forge_databases(id) ON DELETE SET NULL,
      "branchName" VARCHAR(100),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", environment)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_db_proj ON forge_databases("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_db_status ON forge_databases(status);

CREATE TABLE IF NOT EXISTS forge_database_migrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "databaseId" UUID NOT NULL REFERENCES forge_databases(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      "upSql" TEXT NOT NULL,
      "downSql" TEXT,
      checksum VARCHAR(64) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      "executionTimeMs" INTEGER NOT NULL DEFAULT 0,
      "errorMessage" TEXT,
      "appliedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_db_mig_db ON forge_database_migrations("databaseId");
    CREATE INDEX IF NOT EXISTS idx_forge_db_mig_proj ON forge_database_migrations("projectId");
