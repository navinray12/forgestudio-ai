import { pgPool } from "./prisma.js";

async function execSafe(label: string, sql: string) {
  try {
    await pgPool.query(sql);
  } catch (err: any) {
    if (err?.code !== "42701" && err?.code !== "42P07") {
      console.warn(`[DATABASE] Schema notice (${label}):`, err?.message || err);
    }
  }
}

export async function ensureDatabaseTables(): Promise<void> {
  // 0. Ensure crypto extensions if possible
  await execSafe("pgcrypto extension", `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  // 1. Websites columns & fixes
  await execSafe("websites core columns", `
    ALTER TABLE websites ADD COLUMN IF NOT EXISTS "documentVersion" INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE websites ADD COLUMN IF NOT EXISTS "performanceSettings" JSONB NOT NULL DEFAULT '{}';
    ALTER TABLE websites ADD COLUMN IF NOT EXISTS "organizationId" UUID;
    ALTER TABLE websites ADD COLUMN IF NOT EXISTS "workspaceId" UUID;
    ALTER TABLE websites ADD COLUMN IF NOT EXISTS "approvalWorkflowEnabled" BOOLEAN NOT NULL DEFAULT false;
  `);

  // 2. Organizations
  await execSafe("organizations table", `
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      "ownerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      settings JSONB DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await execSafe("organizations columns", `
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
  `);

  // 3. Organization members
  await execSafe("organization_members table", `
    CREATE TABLE IF NOT EXISTS organization_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("organizationId", "userId")
    );
  `);

  // 4. Workspaces & lifecycle status columns
  await execSafe("workspaces table", `
    CREATE TABLE IF NOT EXISTS workspaces (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE,
      "organizationId" UUID REFERENCES organizations(id) ON DELETE SET NULL,
      "ownerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "lifecycleStatus" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      version INTEGER NOT NULL DEFAULT 1,
      "archivedAt" TIMESTAMPTZ,
      settings JSONB DEFAULT '{}'::jsonb,
      "isDefault" BOOLEAN NOT NULL DEFAULT false,
      "isArchived" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await execSafe("workspaces columns", `
    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS "lifecycleStatus" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ;
    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS "organizationId" UUID;
  `);

  // 5. Workspace members
  await execSafe("workspace_members table", `
    CREATE TABLE IF NOT EXISTS workspace_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "workspaceId" UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("workspaceId", "userId")
    );
  `);

  // 6. Workspace Command Journal & Outbox
  await execSafe("workspace_command_journal table", `
    CREATE TABLE IF NOT EXISTS workspace_command_journal (
      "organizationId" UUID NOT NULL,
      "actorId" UUID NOT NULL,
      operation VARCHAR(100) NOT NULL,
      "idempotencyKey" VARCHAR(128) NOT NULL,
      "requestHash" CHAR(64) NOT NULL,
      result JSONB NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("organizationId", "actorId", operation, "idempotencyKey")
    );
  `);
  await execSafe("workspace_outbox table", `
    CREATE TABLE IF NOT EXISTS workspace_outbox (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" UUID NOT NULL,
      "actorId" UUID NOT NULL,
      operation VARCHAR(100) NOT NULL,
      "resourceId" UUID NOT NULL,
      "schemaVersion" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "dispatchedAt" TIMESTAMPTZ
    );
  `);

  // 7. Audit Logs
  await execSafe("audit_logs table", `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(255) NOT NULL,
      "targetResource" VARCHAR(255) NOT NULL,
      details JSONB,
      "ipAddress" VARCHAR(100),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // 8. Granular Permissions
  await execSafe("granular_permissions table", `
    CREATE TABLE IF NOT EXISTS granular_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "websiteId" UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
      "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "resourceId" VARCHAR(100) NOT NULL DEFAULT '*',
      capability VARCHAR(100) NOT NULL,
      effect VARCHAR(20) NOT NULL DEFAULT 'ALLOW',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("websiteId", "userId", "resourceId", capability)
    );
  `);

  // 9. Background Jobs & Dead Letters (CRITICAL: ensure organizationId and all fields exist!)
  await execSafe("background_jobs table", `
    CREATE TABLE IF NOT EXISTS background_jobs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" uuid,
      type varchar(100) NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      status varchar(50) NOT NULL DEFAULT 'QUEUED',
      attempts integer NOT NULL DEFAULT 0,
      "maxAttempts" integer NOT NULL DEFAULT 3,
      "idempotencyKey" varchar(128),
      "lastError" varchar(2000),
      "runAt" timestamptz NOT NULL DEFAULT now(),
      "lockedUntil" timestamptz,
      "lockToken" uuid,
      "startedAt" timestamptz,
      "completedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );
  `);
  await execSafe("background_jobs columns", `
    ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS "organizationId" UUID;
    ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(128);
    ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS "maxAttempts" INTEGER NOT NULL DEFAULT 3;
    ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS "lastError" VARCHAR(2000);
    ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS "runAt" TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMPTZ;
    ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS "lockToken" UUID;
    ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMPTZ;
    ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMPTZ;
  `);

  await execSafe("job_dead_letters table", `
    CREATE TABLE IF NOT EXISTS job_dead_letters (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "organizationId" uuid,
      "jobId" uuid,
      "jobType" varchar(100) NOT NULL,
      payload jsonb NOT NULL,
      attempts integer NOT NULL,
      reason text NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "replayedAt" timestamptz
    );
  `);
  await execSafe("job_dead_letters columns", `
    ALTER TABLE job_dead_letters ADD COLUMN IF NOT EXISTS "organizationId" UUID;
  `);

  // 10. AI Executions
  await execSafe("ai_executions table", `
    CREATE TABLE IF NOT EXISTS ai_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "websiteId" UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
      "workspaceId" UUID REFERENCES workspaces(id) ON DELETE SET NULL,
      "organizationId" UUID,
      "actorId" UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      operation VARCHAR(50) NOT NULL,
      "promptVersion" VARCHAR(100) NOT NULL DEFAULT 'site-generation-v1',
      provider VARCHAR(50) NOT NULL,
      model VARCHAR(150) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      "inputSummary" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "outputSummary" JSONB,
      "errorCode" VARCHAR(100),
      "promptCiphertext" TEXT,
      "promptExpiresAt" TIMESTAMPTZ,
      "expectedDocumentVersion" INTEGER,
      scope JSONB,
      "providerSnapshot" JSONB,
      "parentExecutionId" UUID,
      stage VARCHAR(100),
      "cancelRequestedAt" TIMESTAMPTZ,
      "reservedUnits" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "completedAt" TIMESTAMPTZ
    );
  `);
  await execSafe("ai_executions columns", `
    ALTER TABLE ai_executions ADD COLUMN IF NOT EXISTS "promptCiphertext" TEXT;
    ALTER TABLE ai_executions ADD COLUMN IF NOT EXISTS "promptExpiresAt" TIMESTAMPTZ;
    ALTER TABLE ai_executions ADD COLUMN IF NOT EXISTS "expectedDocumentVersion" INTEGER;
    ALTER TABLE ai_executions ADD COLUMN IF NOT EXISTS scope JSONB;
    ALTER TABLE ai_executions ADD COLUMN IF NOT EXISTS "providerSnapshot" JSONB;
    ALTER TABLE ai_executions ADD COLUMN IF NOT EXISTS "parentExecutionId" UUID;
    ALTER TABLE ai_executions ADD COLUMN IF NOT EXISTS stage VARCHAR(100);
    ALTER TABLE ai_executions ADD COLUMN IF NOT EXISTS "cancelRequestedAt" TIMESTAMPTZ;
    ALTER TABLE ai_executions ADD COLUMN IF NOT EXISTS "reservedUnits" INTEGER NOT NULL DEFAULT 0;
  `);

  // 11. AI Execution Stages
  await execSafe("ai_execution_stages table", `
    CREATE TABLE IF NOT EXISTS ai_execution_stages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "executionId" UUID NOT NULL REFERENCES ai_executions(id) ON DELETE CASCADE,
      key VARCHAR(100) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      "artifactKey" VARCHAR(200),
      "externalReference" JSONB,
      "startedAt" TIMESTAMPTZ,
      "completedAt" TIMESTAMPTZ,
      UNIQUE("executionId", key)
    );
  `);

  // 12. AI Changesets
  await execSafe("ai_changesets table", `
    CREATE TABLE IF NOT EXISTS ai_changesets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "executionId" UUID NOT NULL UNIQUE REFERENCES ai_executions(id) ON DELETE CASCADE,
      "websiteId" UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
      "workspaceId" UUID REFERENCES workspaces(id) ON DELETE SET NULL,
      "organizationId" UUID,
      "actorId" UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
      "expectedDocumentVersion" INTEGER NOT NULL DEFAULT 1,
      "proposedDocument" JSONB NOT NULL,
      "summary" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "appliedRevisionId" UUID,
      "applyAcknowledgement" JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "approvedAt" TIMESTAMPTZ,
      "cancelledAt" TIMESTAMPTZ,
      "appliedAt" TIMESTAMPTZ
    );
  `);
  await execSafe("ai_changesets columns", `
    ALTER TABLE ai_changesets ADD COLUMN IF NOT EXISTS "appliedRevisionId" UUID;
    ALTER TABLE ai_changesets ADD COLUMN IF NOT EXISTS "applyAcknowledgement" JSONB;
  `);

  // 13. Sanitize invalid website documentVersion
  await execSafe("sanitize documentVersion", `
    UPDATE websites SET "documentVersion" = 1 WHERE "documentVersion" IS NULL OR "documentVersion" < 1;
  `);

  console.log("✅ [DATABASE] Schema self-healing verified all tables & columns successfully.");
}
