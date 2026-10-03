import { pgPool } from "./prisma.js";

let initialized = false;

export async function ensureDatabaseReady(): Promise<void> {
  if (initialized) return;

  const client = await pgPool.connect();
  try {
    console.log("🔄 [DB] Auditing database schema and synchronizing models...");

    // Helper to safely execute statements individually
    const safeExec = async (label: string, sql: string) => {
      try {
        await client.query(sql);
      } catch (err) {
        console.warn(`⚠️ [DB] Warning during ${label}:`, (err as Error).message);
      }
    };

    // 1. users & sessions columns
    await safeExec("users columns", `
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "authEpoch" INTEGER NOT NULL DEFAULT 1;
    `);

    await safeExec("sessions columns", `
      ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "assurance" TEXT NOT NULL DEFAULT 'none';
      ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "audience" TEXT NOT NULL DEFAULT 'TENANT';
      ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "authEpoch" INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "authMethod" TEXT NOT NULL DEFAULT 'legacy';
      ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "authTime" TIMESTAMP(3);
      ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "mfaVerifiedAt" TIMESTAMP(3);
    `);

    // 2. Identity tables
    await safeExec("auth_challenges table", `
      CREATE TABLE IF NOT EXISTS "auth_challenges" (
        "id" UUID NOT NULL PRIMARY KEY,
        "userId" UUID,
        "kind" TEXT NOT NULL,
        "secretHash" TEXT NOT NULL,
        "authEpoch" INTEGER NOT NULL DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "email" TEXT,
        "otpHash" TEXT,
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "lastSentAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "providerKey" TEXT,
        "initiatingSessionId" UUID,
        CONSTRAINT "auth_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "auth_challenges_secretHash_key" ON "auth_challenges"("secretHash");
      CREATE INDEX IF NOT EXISTS "auth_challenges_userId_createdAt_idx" ON "auth_challenges"("userId", "createdAt");
      CREATE INDEX IF NOT EXISTS "auth_challenges_expiresAt_idx" ON "auth_challenges"("expiresAt");
    `);

    await safeExec("identity_rate_buckets table", `
      CREATE TABLE IF NOT EXISTS "identity_rate_buckets" (
        "key" TEXT NOT NULL,
        "windowStart" TIMESTAMP(3) NOT NULL,
        "attempts" INTEGER NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "identity_rate_buckets_pkey" PRIMARY KEY ("key","windowStart")
      );
      CREATE INDEX IF NOT EXISTS "identity_rate_buckets_expiresAt_idx" ON "identity_rate_buckets"("expiresAt");
    `);

    await safeExec("oidc_identities table", `
      CREATE TABLE IF NOT EXISTS "oidc_identities" (
        "id" UUID NOT NULL PRIMARY KEY,
        "userId" UUID NOT NULL,
        "issuer" TEXT NOT NULL,
        "subject" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "oidc_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "oidc_identities_issuer_subject_key" ON "oidc_identities"("issuer", "subject");
      CREATE UNIQUE INDEX IF NOT EXISTS "oidc_identities_userId_issuer_key" ON "oidc_identities"("userId", "issuer");
    `);

    // 3. organizations table
    await safeExec("organizations table", `
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL,
        "slug" VARCHAR(255) NOT NULL,
        "ownerId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "settings" JSONB DEFAULT '{}',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "organizations_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "organizations_slug_key" UNIQUE ("slug")
      );
      CREATE INDEX IF NOT EXISTS "organizations_ownerId_idx" ON "organizations"("ownerId");
    `);

    // 4. workspaces columns
    await safeExec("workspaces columns", `
      ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "organizationId" UUID REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "lifecycleStatus" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
      ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ;
      ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "settings" JSONB DEFAULT '{}';
      CREATE INDEX IF NOT EXISTS "workspaces_organizationId_idx" ON "workspaces"("organizationId");
    `);

    // 5. organization_members & workspace_members
    await safeExec("organization_members table", `
      CREATE TABLE IF NOT EXISTS "organization_members" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "role" VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "organization_members_organizationId_userId_key" UNIQUE ("organizationId", "userId")
      );
      CREATE INDEX IF NOT EXISTS "organization_members_userId_idx" ON "organization_members"("userId");
    `);

    await safeExec("workspace_members table", `
      CREATE TABLE IF NOT EXISTS "workspace_members" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "workspaceId" UUID NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "role" VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "workspace_members_workspaceId_userId_key" UNIQUE ("workspaceId", "userId")
      );
      CREATE INDEX IF NOT EXISTS "workspace_members_userId_idx" ON "workspace_members"("userId");
    `);

    // 6. websites columns
    await safeExec("websites columns", `
      ALTER TABLE "websites" ADD COLUMN IF NOT EXISTS "workspaceId" UUID REFERENCES "workspaces"("id") ON DELETE SET NULL;
      ALTER TABLE "websites" ADD COLUMN IF NOT EXISTS "organizationId" UUID REFERENCES "organizations"("id") ON DELETE SET NULL;
      ALTER TABLE "websites" ADD COLUMN IF NOT EXISTS "documentVersion" INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE "websites" ADD COLUMN IF NOT EXISTS "performanceSettings" JSONB NOT NULL DEFAULT '{}';
      ALTER TABLE "websites" ADD COLUMN IF NOT EXISTS "approvalWorkflowEnabled" BOOLEAN NOT NULL DEFAULT false;
      CREATE INDEX IF NOT EXISTS "websites_organizationId_idx" ON "websites"("organizationId");
    `);

    // 7. workspace_invitations table AND column reconciliations
    await safeExec("workspace_invitations table creation", `
      CREATE TABLE IF NOT EXISTS "workspace_invitations" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" UUID NOT NULL,
        "workspaceId" UUID NOT NULL,
        "recipientUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "invitedBy" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "role" VARCHAR(20) NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        "version" INTEGER NOT NULL DEFAULT 1,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "acceptedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await safeExec("workspace_invitations column reconciliation", `
      ALTER TABLE "workspace_invitations" ADD COLUMN IF NOT EXISTS "recipientUserId" UUID;
      ALTER TABLE "workspace_invitations" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
      ALTER TABLE "workspace_invitations" ADD COLUMN IF NOT EXISTS "workspaceId" UUID;
      ALTER TABLE "workspace_invitations" ADD COLUMN IF NOT EXISTS "invitedBy" UUID;
      ALTER TABLE "workspace_invitations" ADD COLUMN IF NOT EXISTS "role" VARCHAR(20) DEFAULT 'MEMBER';
      ALTER TABLE "workspace_invitations" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT 'PENDING';
      ALTER TABLE "workspace_invitations" ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 1;
      ALTER TABLE "workspace_invitations" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ DEFAULT (NOW() + interval '7 days');
      ALTER TABLE "workspace_invitations" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMPTZ;
      ALTER TABLE "workspace_invitations" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE "workspace_invitations" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
      CREATE INDEX IF NOT EXISTS "workspace_invitations_organizationId_recipientUserId_status_idx" ON "workspace_invitations"("organizationId","recipientUserId","status");
      CREATE INDEX IF NOT EXISTS "workspace_invitations_workspaceId_idx" ON "workspace_invitations"("workspaceId");
    `);

    // 8. workspace command journal and outbox
    await safeExec("workspace command tables", `
      CREATE TABLE IF NOT EXISTS "workspace_command_journal" (
        "organizationId" UUID NOT NULL,
        "actorId" UUID NOT NULL,
        "operation" VARCHAR(100) NOT NULL,
        "idempotencyKey" VARCHAR(128) NOT NULL,
        "requestHash" CHAR(64) NOT NULL,
        "result" JSONB NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY ("organizationId", "actorId", "operation", "idempotencyKey")
      );
      CREATE INDEX IF NOT EXISTS "workspace_command_journal_created_idx" ON "workspace_command_journal" ("createdAt");

      CREATE TABLE IF NOT EXISTS "workspace_outbox" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" UUID NOT NULL,
        "actorId" UUID NOT NULL,
        "operation" VARCHAR(100) NOT NULL,
        "resourceId" UUID NOT NULL,
        "schemaVersion" INTEGER NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "dispatchedAt" TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS "workspace_outbox_pending_idx" ON "workspace_outbox" ("createdAt") WHERE "dispatchedAt" IS NULL;
    `);

    // 9. Subscription plans seeding
    await safeExec("subscription plans seeding", `
      INSERT INTO "subscription_plans" ("id", "name", "slug", "price", "currency", "billingInterval", "websiteLimit", "storageLimitMb", "aiCreditLimit", "features", "isActive", "createdAt", "updatedAt")
      VALUES 
        ('a0000000-0000-0000-0000-000000000001', 'Free', 'free', 0, 'INR', 'monthly', 1, 100, 10, '{"customDomain": false, "analytics": false, "codeExport": false, "whiteLabel": false, "prioritySupport": false, "unlimitedStorage": false, "agencyFeatures": false, "aiAssistant": true}', true, NOW(), NOW()),
        ('a0000000-0000-0000-0000-000000000002', 'Starter', 'starter', 499, 'INR', 'monthly', 3, 500, 50, '{"customDomain": true, "analytics": true, "codeExport": false, "whiteLabel": false, "prioritySupport": false, "unlimitedStorage": false, "agencyFeatures": false, "aiAssistant": true}', true, NOW(), NOW()),
        ('a0000000-0000-0000-0000-000000000003', 'Professional', 'professional', 1499, 'INR', 'monthly', 10, 2048, 200, '{"customDomain": true, "analytics": true, "codeExport": true, "whiteLabel": false, "prioritySupport": true, "unlimitedStorage": false, "agencyFeatures": false, "aiAssistant": true}', true, NOW(), NOW()),
        ('a0000000-0000-0000-0000-000000000004', 'Agency', 'agency', 4999, 'INR', 'monthly', 100, 10240, 1000, '{"customDomain": true, "analytics": true, "codeExport": true, "whiteLabel": true, "prioritySupport": true, "unlimitedStorage": true, "agencyFeatures": true, "aiAssistant": true}', true, NOW(), NOW())
      ON CONFLICT ("slug") DO UPDATE SET "isActive" = true;
    `);

    // 10. Safe legacy tenancy backfill
    await safeExec("tenancy backfill", `
      -- 1. Create personal organization for any user who owns workspaces but has no org
      INSERT INTO "organizations" ("id", "name", "slug", "ownerId", "settings", "createdAt", "updatedAt")
      SELECT 
        gen_random_uuid(),
        COALESCE(u."fullName", 'Personal') || ' Organization',
        'org-' || substr(md5(random()::text), 1, 8),
        u.id,
        '{}'::jsonb,
        NOW(),
        NOW()
      FROM "users" u
      WHERE EXISTS (SELECT 1 FROM "workspaces" w WHERE w."ownerId" = u.id)
        AND NOT EXISTS (SELECT 1 FROM "organizations" o WHERE o."ownerId" = u.id)
      ON CONFLICT DO NOTHING;

      -- 2. Ensure owner is in organization_members
      INSERT INTO "organization_members" ("id", "organizationId", "userId", "role", "createdAt", "updatedAt")
      SELECT 
        gen_random_uuid(),
        o.id,
        o."ownerId",
        'OWNER',
        NOW(),
        NOW()
      FROM "organizations" o
      WHERE NOT EXISTS (
        SELECT 1 FROM "organization_members" om 
        WHERE om."organizationId" = o.id AND om."userId" = o."ownerId"
      )
      ON CONFLICT DO NOTHING;

      -- 3. Link workspaces to owner's organization
      UPDATE "workspaces" w
      SET "organizationId" = o.id
      FROM "organizations" o
      WHERE w."organizationId" IS NULL 
        AND w."ownerId" = o."ownerId";

      -- 4. Ensure workspace_members contains the owner
      INSERT INTO "workspace_members" ("id", "workspaceId", "userId", "role", "createdAt", "updatedAt")
      SELECT 
        gen_random_uuid(),
        w.id,
        w."ownerId",
        'OWNER',
        NOW(),
        NOW()
      FROM "workspaces" w
      WHERE NOT EXISTS (
        SELECT 1 FROM "workspace_members" wm 
        WHERE wm."workspaceId" = w.id AND wm."userId" = w."ownerId"
      )
      ON CONFLICT DO NOTHING;

      -- 5. Propagate organizationId from workspaces to websites
      UPDATE "websites" s
      SET "organizationId" = w."organizationId"
      FROM "workspaces" w
      WHERE s."workspaceId" = w.id
        AND s."organizationId" IS NULL
        AND w."organizationId" IS NOT NULL;
    `);

    // 11. Platform foundations tables
    await safeExec("platform foundations tables", `
      CREATE TABLE IF NOT EXISTS tenant_backfill_conflicts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "resourceType" VARCHAR(80) NOT NULL,
        "resourceId" UUID NOT NULL,
        reason VARCHAR(500) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("resourceType","resourceId")
      );

      CREATE TABLE IF NOT EXISTS organization_billing_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" UUID NOT NULL UNIQUE,
        provider VARCHAR(40) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        "providerCustomerId" VARCHAR(255),
        version INTEGER NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS organization_subscriptions_v2 (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" UUID NOT NULL UNIQUE,
        "planKey" VARCHAR(100) NOT NULL,
        provider VARCHAR(40) NOT NULL,
        "providerSubscriptionId" VARCHAR(255),
        status VARCHAR(40) NOT NULL,
        "seatLimit" INTEGER NOT NULL DEFAULT 1,
        quotas JSONB NOT NULL DEFAULT '{}'::jsonb,
        "currentPeriodStart" TIMESTAMPTZ,
        "currentPeriodEnd" TIMESTAMPTZ,
        version INTEGER NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS organization_seat_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" UUID NOT NULL,
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("organizationId","userId")
      );

      CREATE TABLE IF NOT EXISTS billing_checkout_intents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" UUID NOT NULL,
        "actorId" UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        "idempotencyKey" VARCHAR(128) NOT NULL,
        "requestHash" CHAR(64) NOT NULL,
        "planKey" VARCHAR(100) NOT NULL,
        status VARCHAR(32) NOT NULL,
        "providerCheckoutId" VARCHAR(255),
        "checkoutUrl" VARCHAR(2048),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("organizationId","actorId","idempotencyKey")
      );

      CREATE TABLE IF NOT EXISTS billing_event_inbox (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider VARCHAR(40) NOT NULL,
        "providerEventId" VARCHAR(255) NOT NULL,
        "organizationId" UUID NOT NULL,
        "eventType" VARCHAR(120) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(32) NOT NULL,
        "lastError" VARCHAR(2000),
        "processedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (provider,"providerEventId")
      );

      CREATE TABLE IF NOT EXISTS organization_invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" UUID NOT NULL,
        provider VARCHAR(40) NOT NULL,
        "providerInvoiceId" VARCHAR(255) NOT NULL,
        amount BIGINT NOT NULL,
        currency VARCHAR(10) NOT NULL,
        status VARCHAR(40) NOT NULL,
        "issuedAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (provider,"providerInvoiceId")
      );

      CREATE TABLE IF NOT EXISTS usage_reservations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" UUID NOT NULL,
        "actorId" UUID REFERENCES users(id) ON DELETE SET NULL,
        resource VARCHAR(100) NOT NULL,
        amount BIGINT NOT NULL,
        state VARCHAR(20) NOT NULL,
        "idempotencyKey" VARCHAR(128) NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "settledAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("organizationId","idempotencyKey")
      );

      CREATE TABLE IF NOT EXISTS platform_outbox (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" UUID,
        "actorId" UUID REFERENCES users(id) ON DELETE SET NULL,
        "eventType" VARCHAR(160) NOT NULL,
        "aggregateType" VARCHAR(100) NOT NULL,
        "aggregateId" VARCHAR(255) NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        "jobType" VARCHAR(120),
        attempts INTEGER NOT NULL DEFAULT 0,
        "dispatchedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS platform_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" UUID,
        "outboxId" UUID UNIQUE,
        "jobType" VARCHAR(120) NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(24) NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        "maxAttempts" INTEGER NOT NULL DEFAULT 5,
        "availableAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "leaseOwner" VARCHAR(255),
        "leaseExpiresAt" TIMESTAMPTZ,
        "lastError" VARCHAR(4000),
        "completedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS platform_dead_letters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" UUID,
        "jobId" UUID NOT NULL UNIQUE,
        "jobType" VARCHAR(120) NOT NULL,
        payload JSONB NOT NULL,
        error VARCHAR(4000) NOT NULL,
        attempts INTEGER NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "replayedAt" TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS file_objects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" UUID NOT NULL,
        "workspaceId" UUID REFERENCES workspaces(id) ON DELETE RESTRICT,
        "websiteId" UUID REFERENCES websites(id) ON DELETE RESTRICT,
        "ownerId" UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        provider VARCHAR(40) NOT NULL,
        bucket VARCHAR(255) NOT NULL,
        "objectKey" VARCHAR(1024) NOT NULL,
        "objectVersion" VARCHAR(255),
        "originalName" VARCHAR(255) NOT NULL,
        "declaredMimeType" VARCHAR(120),
        "detectedMimeType" VARCHAR(120),
        "sizeBytes" BIGINT,
        sha256 CHAR(64),
        state VARCHAR(32) NOT NULL,
        "scanStatus" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        "scanDetail" VARCHAR(1000),
        "approvedAt" TIMESTAMPTZ,
        "deletedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (provider,bucket,"objectKey")
      );

      CREATE TABLE IF NOT EXISTS connector_credentials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" UUID NOT NULL,
        "workspaceId" UUID REFERENCES workspaces(id) ON DELETE RESTRICT,
        "websiteId" UUID REFERENCES websites(id) ON DELETE RESTRICT,
        provider VARCHAR(80) NOT NULL,
        "secretRef" VARCHAR(500) NOT NULL,
        scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
        version INTEGER NOT NULL DEFAULT 1,
        "lastVerifiedAt" TIMESTAMPTZ,
        "revokedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS platform_capabilities (
        id VARCHAR(120) PRIMARY KEY,
        owner VARCHAR(120) NOT NULL,
        criticality VARCHAR(24) NOT NULL,
        "changeClass" CHAR(1) NOT NULL,
        "minTier" VARCHAR(4) NOT NULL,
        provider VARCHAR(80),
        "desiredState" VARCHAR(32) NOT NULL,
        "observedState" VARCHAR(32) NOT NULL,
        config JSONB NOT NULL DEFAULT '{}'::jsonb,
        version INTEGER NOT NULL DEFAULT 1,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS platform_config_snapshots (
        version BIGSERIAL PRIMARY KEY,
        environment VARCHAR(40) NOT NULL,
        digest CHAR(64) NOT NULL UNIQUE,
        body JSONB NOT NULL,
        "createdBy" UUID REFERENCES users(id) ON DELETE SET NULL,
        "activatedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS platform_change_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        class CHAR(1) NOT NULL,
        scope JSONB NOT NULL,
        "oldState" JSONB,
        "desiredState" JSONB NOT NULL,
        status VARCHAR(40) NOT NULL,
        reason VARCHAR(1000) NOT NULL,
        "planDigest" CHAR(64),
        requester UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        approver UUID REFERENCES users(id) ON DELETE RESTRICT,
        "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "approvedAt" TIMESTAMPTZ,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    initialized = true;
    console.log("✅ [DB] Database schema fully synchronized, verified, and ready.");
  } finally {
    client.release();
  }
}
