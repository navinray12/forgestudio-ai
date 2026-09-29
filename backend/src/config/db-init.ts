import { pgPool } from "./prisma.js";

let initialized = false;

export async function ensureDatabaseReady(): Promise<void> {
  if (initialized) return;

  try {
    const client = await pgPool.connect();
    try {
      // 1. users & sessions columns
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'authEpoch') THEN
            ALTER TABLE "users" ADD COLUMN "authEpoch" INTEGER NOT NULL DEFAULT 1;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'assurance') THEN
            ALTER TABLE "sessions" ADD COLUMN "assurance" TEXT NOT NULL DEFAULT 'none';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'audience') THEN
            ALTER TABLE "sessions" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'TENANT';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'authEpoch') THEN
            ALTER TABLE "sessions" ADD COLUMN "authEpoch" INTEGER NOT NULL DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'authMethod') THEN
            ALTER TABLE "sessions" ADD COLUMN "authMethod" TEXT NOT NULL DEFAULT 'legacy';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'authTime') THEN
            ALTER TABLE "sessions" ADD COLUMN "authTime" TIMESTAMP(3);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'mfaVerifiedAt') THEN
            ALTER TABLE "sessions" ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3);
          END IF;
        END $$;
      `);

      // 2. identity tables
      await client.query(`
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

        CREATE TABLE IF NOT EXISTS "identity_rate_buckets" (
          "key" TEXT NOT NULL,
          "windowStart" TIMESTAMP(3) NOT NULL,
          "attempts" INTEGER NOT NULL,
          "expiresAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "identity_rate_buckets_pkey" PRIMARY KEY ("key","windowStart")
        );
        CREATE INDEX IF NOT EXISTS "identity_rate_buckets_expiresAt_idx" ON "identity_rate_buckets"("expiresAt");

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

      // 3. organizations and workspace columns
      await client.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'lifecycleStatus') THEN
              ALTER TABLE "workspaces" ADD COLUMN "lifecycleStatus" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'version') THEN
              ALTER TABLE "workspaces" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'archivedAt') THEN
              ALTER TABLE "workspaces" ADD COLUMN "archivedAt" TIMESTAMPTZ;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'settings') THEN
              ALTER TABLE "workspaces" ADD COLUMN "settings" JSONB DEFAULT '{}';
            END IF;
          END IF;

          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'websites') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'websites' AND column_name = 'documentVersion') THEN
              ALTER TABLE "websites" ADD COLUMN "documentVersion" INTEGER NOT NULL DEFAULT 1;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'websites' AND column_name = 'performanceSettings') THEN
              ALTER TABLE "websites" ADD COLUMN "performanceSettings" JSONB NOT NULL DEFAULT '{}';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'websites' AND column_name = 'workspaceId') THEN
              ALTER TABLE "websites" ADD COLUMN "workspaceId" UUID REFERENCES "workspaces"("id") ON DELETE SET NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'websites' AND column_name = 'organizationId') THEN
              ALTER TABLE "websites" ADD COLUMN "organizationId" UUID;
            END IF;
          END IF;
        END $$;
      `);

      // 4. workspace_invitations table
      await client.query(`
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
        CREATE INDEX IF NOT EXISTS "workspace_invitations_organizationId_recipientUserId_status_idx" ON "workspace_invitations"("organizationId","recipientUserId","status");
        CREATE INDEX IF NOT EXISTS "workspace_invitations_workspaceId_idx" ON "workspace_invitations"("workspaceId");
      `);

      // 5. workspace command journal and outbox
      await client.query(`
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

      // 6. platform foundations tables
      await client.query(`
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

      // 7. Seed default subscription plans if empty
      await client.query(`
        INSERT INTO "subscription_plans" ("id", "name", "slug", "price", "currency", "billingInterval", "websiteLimit", "storageLimitMb", "aiCreditLimit", "features", "isActive", "createdAt", "updatedAt")
        VALUES 
          ('a0000000-0000-0000-0000-000000000001', 'Free', 'free', 0, 'INR', 'monthly', 1, 100, 10, '{"customDomain": false, "analytics": false, "codeExport": false, "whiteLabel": false, "prioritySupport": false, "unlimitedStorage": false, "agencyFeatures": false, "aiAssistant": true}', true, NOW(), NOW()),
          ('a0000000-0000-0000-0000-000000000002', 'Starter', 'starter', 499, 'INR', 'monthly', 3, 500, 50, '{"customDomain": true, "analytics": true, "codeExport": false, "whiteLabel": false, "prioritySupport": false, "unlimitedStorage": false, "agencyFeatures": false, "aiAssistant": true}', true, NOW(), NOW()),
          ('a0000000-0000-0000-0000-000000000003', 'Professional', 'professional', 1499, 'INR', 'monthly', 10, 2048, 200, '{"customDomain": true, "analytics": true, "codeExport": true, "whiteLabel": false, "prioritySupport": true, "unlimitedStorage": false, "agencyFeatures": false, "aiAssistant": true}', true, NOW(), NOW()),
          ('a0000000-0000-0000-0000-000000000004', 'Agency', 'agency', 4999, 'INR', 'monthly', 100, 10240, 1000, '{"customDomain": true, "analytics": true, "codeExport": true, "whiteLabel": true, "prioritySupport": true, "unlimitedStorage": true, "agencyFeatures": true, "aiAssistant": true}', true, NOW(), NOW())
        ON CONFLICT ("slug") DO UPDATE SET "isActive" = true;
      `);

      // 8. Safe tenancy backfill for legacy workspaces and websites
      await client.query(`
        -- Ensure an organization exists for users owning workspaces
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

        -- Ensure owner is in organization_members
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

        -- Link workspaces to owner's organization if organizationId is NULL
        UPDATE "workspaces" w
        SET "organizationId" = o.id
        FROM "organizations" o
        WHERE w."organizationId" IS NULL 
          AND w."ownerId" = o."ownerId";

        -- Ensure workspace_members contains the owner for every workspace
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

        -- Propagate organizationId from workspaces to websites
        UPDATE "websites" s
        SET "organizationId" = w."organizationId"
        FROM "workspaces" w
        WHERE s."workspaceId" = w.id
          AND s."organizationId" IS NULL
          AND w."organizationId" IS NOT NULL;
      `);

      initialized = true;
      console.log("✅ [DB] Database schema verified and ready.");
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("⚠️ [DB] Database verification warning:", (error as Error).message);
  }
}
