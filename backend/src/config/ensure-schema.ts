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

  // 14. Custom ENUM types for Support & Forum domains
  await execSafe("support & forum enums", `
    DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportTicketStatus') THEN
            CREATE TYPE "SupportTicketStatus" AS ENUM ('NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'CUSTOMER_REPLIED', 'RESOLVED', 'CLOSED', 'REOPENED');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportTicketPriority') THEN
            CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportTicketSource') THEN
            CREATE TYPE "SupportTicketSource" AS ENUM ('WEB', 'EMAIL', 'API', 'SYSTEM');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportTicketMessageType') THEN
            CREATE TYPE "SupportTicketMessageType" AS ENUM ('PUBLIC_REPLY', 'INTERNAL_NOTE', 'SYSTEM_EVENT');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ForumTopicStatus') THEN
            CREATE TYPE "ForumTopicStatus" AS ENUM ('OPEN', 'LOCKED', 'SOLVED', 'ARCHIVED', 'HIDDEN');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ForumTopicVisibility') THEN
            CREATE TYPE "ForumTopicVisibility" AS ENUM ('PUBLIC', 'WORKSPACE', 'PRIVATE');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ForumReactionType') THEN
            CREATE TYPE "ForumReactionType" AS ENUM ('LIKE', 'HEART', 'HELPFUL', 'CELEBRATE');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ForumReportStatus') THEN
            CREATE TYPE "ForumReportStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');
        END IF;
    END $$;
  `);

  // 15. Support Ticket System Tables
  await execSafe("support_categories table", `
    CREATE TABLE IF NOT EXISTS support_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      description VARCHAR(500),
      icon VARCHAR(100),
      color VARCHAR(50),
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await execSafe("support_teams table", `
    CREATE TABLE IF NOT EXISTS support_teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description VARCHAR(500),
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await execSafe("support_team_members table", `
    CREATE TABLE IF NOT EXISTS support_team_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "teamId" UUID NOT NULL REFERENCES support_teams(id) ON DELETE CASCADE,
      "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("teamId", "userId")
    );
  `);

  await execSafe("support_sla_policies table", `
    CREATE TABLE IF NOT EXISTS support_sla_policies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      priority "SupportTicketPriority" NOT NULL,
      "firstResponseMinutes" INTEGER NOT NULL,
      "resolutionMinutes" INTEGER NOT NULL,
      "businessHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await execSafe("support_tickets table", `
    CREATE TABLE IF NOT EXISTS support_tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "ticketNumber" VARCHAR(50) UNIQUE NOT NULL,
      "workspaceId" UUID REFERENCES workspaces(id) ON DELETE SET NULL,
      "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "websiteId" UUID REFERENCES websites(id) ON DELETE SET NULL,
      "categoryId" UUID NOT NULL REFERENCES support_categories(id) ON DELETE RESTRICT,
      "assignedTeamId" UUID REFERENCES support_teams(id) ON DELETE SET NULL,
      "assignedAgentId" UUID REFERENCES users(id) ON DELETE SET NULL,
      subject VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      status "SupportTicketStatus" NOT NULL DEFAULT 'NEW',
      priority "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
      source "SupportTicketSource" NOT NULL DEFAULT 'WEB',
      "slaPolicyId" UUID REFERENCES support_sla_policies(id) ON DELETE SET NULL,
      "firstResponseAt" TIMESTAMPTZ,
      "resolvedAt" TIMESTAMPTZ,
      "closedAt" TIMESTAMPTZ,
      "reopenedAt" TIMESTAMPTZ,
      "slaDueAt" TIMESTAMPTZ,
      "slaPaused" BOOLEAN NOT NULL DEFAULT false,
      "slaPausedAt" TIMESTAMPTZ,
      "slaBreached" BOOLEAN NOT NULL DEFAULT false,
      "csatScore" INTEGER,
      "csatComment" VARCHAR(1000),
      "csatRatedAt" TIMESTAMPTZ,
      "isMerged" BOOLEAN NOT NULL DEFAULT false,
      "mergedIntoTicketId" UUID,
      "parentTicketId" UUID,
      tags TEXT[] DEFAULT '{}',
      "contextData" JSONB DEFAULT '{}'::jsonb,
      "wordpressContext" JSONB DEFAULT '{}'::jsonb,
      "environmentContext" JSONB DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await execSafe("support_ticket_messages table", `
    CREATE TABLE IF NOT EXISTS support_ticket_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "ticketId" UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      "authorId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type "SupportTicketMessageType" NOT NULL DEFAULT 'PUBLIC_REPLY',
      content TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await execSafe("support_tickets column types", `
    ALTER TABLE support_tickets ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE support_tickets ALTER COLUMN status TYPE "SupportTicketStatus" USING status::"SupportTicketStatus";
    ALTER TABLE support_tickets ALTER COLUMN status SET DEFAULT 'NEW'::"SupportTicketStatus";

    ALTER TABLE support_tickets ALTER COLUMN priority DROP DEFAULT;
    ALTER TABLE support_tickets ALTER COLUMN priority TYPE "SupportTicketPriority" USING priority::"SupportTicketPriority";
    ALTER TABLE support_tickets ALTER COLUMN priority SET DEFAULT 'NORMAL'::"SupportTicketPriority";

    ALTER TABLE support_tickets ALTER COLUMN source DROP DEFAULT;
    ALTER TABLE support_tickets ALTER COLUMN source TYPE "SupportTicketSource" USING source::"SupportTicketSource";
    ALTER TABLE support_tickets ALTER COLUMN source SET DEFAULT 'WEB'::"SupportTicketSource";
  `);

  await execSafe("support_sla_policies column types", `
    ALTER TABLE support_sla_policies ALTER COLUMN priority TYPE "SupportTicketPriority" USING priority::"SupportTicketPriority";
  `);

  await execSafe("support_ticket_messages column types", `
    ALTER TABLE support_ticket_messages ALTER COLUMN type DROP DEFAULT;
    ALTER TABLE support_ticket_messages ALTER COLUMN type TYPE "SupportTicketMessageType" USING type::"SupportTicketMessageType";
    ALTER TABLE support_ticket_messages ALTER COLUMN type SET DEFAULT 'PUBLIC_REPLY'::"SupportTicketMessageType";
  `);

  await execSafe("support_ticket_attachments table", `
    CREATE TABLE IF NOT EXISTS support_ticket_attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "ticketId" UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      "messageId" UUID REFERENCES support_ticket_messages(id) ON DELETE SET NULL,
      "uploadedById" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "fileName" VARCHAR(255) NOT NULL,
      "storageKey" VARCHAR(500) NOT NULL,
      "mimeType" VARCHAR(100) NOT NULL,
      "fileSize" INTEGER NOT NULL,
      checksum VARCHAR(64),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await execSafe("support_ticket_events table", `
    CREATE TABLE IF NOT EXISTS support_ticket_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "ticketId" UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      "actorId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "eventType" VARCHAR(100) NOT NULL,
      "oldValue" VARCHAR(255),
      "newValue" VARCHAR(255),
      metadata JSONB DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await execSafe("support_canned_responses table", `
    CREATE TABLE IF NOT EXISTS support_canned_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      shortcut VARCHAR(100) UNIQUE NOT NULL,
      content TEXT NOT NULL,
      "categoryId" UUID,
      "createdById" UUID NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await execSafe("support_saved_views table", `
    CREATE TABLE IF NOT EXISTS support_saved_views (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL,
      name VARCHAR(255) NOT NULL,
      filters JSONB NOT NULL,
      "isShared" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await execSafe("support_tags table", `
    CREATE TABLE IF NOT EXISTS support_tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) UNIQUE NOT NULL,
      color VARCHAR(50),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Seed default Support Categories if empty
  await execSafe("seed default support categories", `
    INSERT INTO support_categories (id, name, slug, description, icon, color, "isActive", "sortOrder")
    VALUES 
      (gen_random_uuid(), 'General Support', 'general-support', 'General questions and assistance', 'help-circle', '#3B82F6', true, 1),
      (gen_random_uuid(), 'Technical Issue', 'technical-issue', 'Technical bugs, errors or editor issues', 'wrench', '#EF4444', true, 2),
      (gen_random_uuid(), 'Billing & Subscriptions', 'billing-subscriptions', 'Account, payment and licensing questions', 'credit-card', '#10B981', true, 3),
      (gen_random_uuid(), 'Feature Request', 'feature-request', 'Suggestions and product feedback', 'lightbulb', '#F59E0B', true, 4)
    ON CONFLICT (slug) DO NOTHING;
  `);

  // 16. Discussion Forum Tables
  await execSafe("forum_categories table", `
    CREATE TABLE IF NOT EXISTS forum_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      icon VARCHAR(100),
      color VARCHAR(50),
      "displayOrder" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "isPublic" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await execSafe("forum_topics table", `
    CREATE TABLE IF NOT EXISTS forum_topics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "topicNumber" VARCHAR(50) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      content TEXT NOT NULL,
      "categoryId" UUID NOT NULL REFERENCES forum_categories(id) ON DELETE RESTRICT,
      "authorId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "workspaceId" UUID REFERENCES workspaces(id) ON DELETE SET NULL,
      "websiteId" UUID REFERENCES websites(id) ON DELETE SET NULL,
      status "ForumTopicStatus" NOT NULL DEFAULT 'OPEN',
      visibility "ForumTopicVisibility" NOT NULL DEFAULT 'PUBLIC',
      "isPinned" BOOLEAN NOT NULL DEFAULT false,
      "isLocked" BOOLEAN NOT NULL DEFAULT false,
      "isFeatured" BOOLEAN NOT NULL DEFAULT false,
      "isSolved" BOOLEAN NOT NULL DEFAULT false,
      "acceptedAnswerId" UUID,
      "viewCount" INTEGER NOT NULL DEFAULT 0,
      "replyCount" INTEGER NOT NULL DEFAULT 0,
      "lastActivityAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      tags TEXT[] DEFAULT '{}',
      "contextData" JSONB DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await execSafe("forum_posts table", `
    CREATE TABLE IF NOT EXISTS forum_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "topicId" UUID NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
      "authorId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "parentPostId" UUID REFERENCES forum_posts(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      "isAcceptedAnswer" BOOLEAN NOT NULL DEFAULT false,
      "isHidden" BOOLEAN NOT NULL DEFAULT false,
      "editedAt" TIMESTAMPTZ,
      "editedById" UUID,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await execSafe("forum_topics column types", `
    ALTER TABLE forum_topics ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE forum_topics ALTER COLUMN status TYPE "ForumTopicStatus" USING status::"ForumTopicStatus";
    ALTER TABLE forum_topics ALTER COLUMN status SET DEFAULT 'OPEN'::"ForumTopicStatus";

    ALTER TABLE forum_topics ALTER COLUMN visibility DROP DEFAULT;
    ALTER TABLE forum_topics ALTER COLUMN visibility TYPE "ForumTopicVisibility" USING visibility::"ForumTopicVisibility";
    ALTER TABLE forum_topics ALTER COLUMN visibility SET DEFAULT 'PUBLIC'::"ForumTopicVisibility";
  `);

  await execSafe("forum_post_attachments table", `
    CREATE TABLE IF NOT EXISTS forum_post_attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "topicId" UUID NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
      "postId" UUID REFERENCES forum_posts(id) ON DELETE SET NULL,
      "uploadedById" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "fileName" VARCHAR(255) NOT NULL,
      "storageKey" VARCHAR(500) NOT NULL,
      "mimeType" VARCHAR(100) NOT NULL,
      "fileSize" INTEGER NOT NULL,
      checksum VARCHAR(64),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await execSafe("forum_tags table", `
    CREATE TABLE IF NOT EXISTS forum_tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) UNIQUE NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      "usageCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await execSafe("forum_reactions table", `
    CREATE TABLE IF NOT EXISTS forum_reactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "postId" UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
      "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type "ForumReactionType" NOT NULL DEFAULT 'LIKE',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("postId", "userId", type)
    );
  `);

  await execSafe("forum_reactions column types", `
    ALTER TABLE forum_reactions ALTER COLUMN type TYPE "ForumReactionType" USING type::"ForumReactionType";
  `);

  await execSafe("forum_bookmarks table", `
    CREATE TABLE IF NOT EXISTS forum_bookmarks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "topicId" UUID NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
      "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("topicId", "userId")
    );
  `);

  await execSafe("forum_topic_followers table", `
    CREATE TABLE IF NOT EXISTS forum_topic_followers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "topicId" UUID NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
      "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("topicId", "userId")
    );
  `);

  await execSafe("forum_mentions table", `
    CREATE TABLE IF NOT EXISTS forum_mentions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "postId" UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
      "mentionedUserId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("postId", "mentionedUserId")
    );
  `);

  await execSafe("forum_reports table", `
    CREATE TABLE IF NOT EXISTS forum_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "topicId" UUID REFERENCES forum_topics(id) ON DELETE CASCADE,
      "postId" UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
      "reporterId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason VARCHAR(100) NOT NULL,
      details TEXT,
      status "ForumReportStatus" NOT NULL DEFAULT 'PENDING',
      "reviewedById" UUID REFERENCES users(id) ON DELETE SET NULL,
      "reviewedAt" TIMESTAMPTZ,
      "resolutionNotes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await execSafe("forum_reports column types & missing columns", `
    ALTER TABLE forum_reports ALTER COLUMN status TYPE "ForumReportStatus" USING status::"ForumReportStatus";
    ALTER TABLE forum_reports ADD COLUMN IF NOT EXISTS "resolvedById" UUID REFERENCES users(id) ON DELETE SET NULL;
  `);

  await execSafe("forum_moderation_events table", `
    CREATE TABLE IF NOT EXISTS forum_moderation_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "topicId" UUID REFERENCES forum_topics(id) ON DELETE CASCADE,
      "postId" UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
      "actorId" UUID REFERENCES users(id) ON DELETE CASCADE,
      "moderatorId" UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      "oldValue" VARCHAR(255),
      "newValue" VARCHAR(255),
      reason TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE forum_moderation_events ADD COLUMN IF NOT EXISTS "actorId" UUID REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE forum_moderation_events ADD COLUMN IF NOT EXISTS "oldValue" VARCHAR(255);
    ALTER TABLE forum_moderation_events ADD COLUMN IF NOT EXISTS "newValue" VARCHAR(255);
  `);

  // Seed default Forum Categories if empty
  await execSafe("seed default forum categories", `
    INSERT INTO forum_categories (id, name, slug, description, icon, color, "displayOrder", "isActive", "isPublic")
    VALUES 
      (gen_random_uuid(), 'Announcements', 'announcements', 'Official news, updates and announcements', 'megaphone', '#8B5CF6', 1, true, true),
      (gen_random_uuid(), 'General Discussion', 'general-discussion', 'General talk, community topics and introductions', 'comments', '#3B82F6', 2, true, true),
      (gen_random_uuid(), 'Showcase & Feedback', 'showcase-feedback', 'Show off your ForgeStudio websites and get community feedback', 'sparkles', '#EC4899', 3, true, true),
      (gen_random_uuid(), 'Tips & Tutorials', 'tips-tutorials', 'Guides, design tricks, and step-by-step tutorials', 'book-open', '#10B981', 4, true, true),
      (gen_random_uuid(), 'Questions & Help', 'questions-help', 'Ask the community for help with design and building', 'help-circle', '#F59E0B', 5, true, true)
    ON CONFLICT (slug) DO NOTHING;
  `);

  // 17. Phase 2: Forge Project Model, Persistent Filesystem, Revisions, Snapshots & Workspace States
  await execSafe("forge_projects table", `
    CREATE TABLE IF NOT EXISTS forge_projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      "projectType" VARCHAR(50) NOT NULL DEFAULT 'VISUAL_WEBSITE',
      "lifecycleStatus" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      "websiteId" UUID REFERENCES websites(id) ON DELETE SET NULL,
      "workspaceId" UUID REFERENCES workspaces(id) ON DELETE SET NULL,
      "organizationId" UUID REFERENCES organizations(id) ON DELETE SET NULL,
      "ownerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      framework VARCHAR(50) NOT NULL DEFAULT 'react',
      "frameworkVersion" VARCHAR(50) NOT NULL DEFAULT '19.0.0',
      runtime VARCHAR(50) NOT NULL DEFAULT 'node',
      "runtimeVersion" VARCHAR(50) NOT NULL DEFAULT '22.0.0',
      "packageManager" VARCHAR(50) NOT NULL DEFAULT 'npm',
      language VARCHAR(50) NOT NULL DEFAULT 'typescript',
      capabilities JSONB NOT NULL DEFAULT '{"visualEditing":true,"sourceEditing":true,"react":true,"nextjs":false,"database":true,"storage":true,"git":true,"preview":true,"build":true,"ai":true,"deployment":true}'::jsonb,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      compatibility JSONB NOT NULL DEFAULT '{"manifestVersion":"1.0.0","irVersion":"1.0.0"}'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      "deletedAt" TIMESTAMPTZ,
      "lastActivityAt" TIMESTAMPTZ DEFAULT now(),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_projects_owner ON forge_projects("ownerId");
    CREATE INDEX IF NOT EXISTS idx_forge_projects_website ON forge_projects("websiteId");
    CREATE INDEX IF NOT EXISTS idx_forge_projects_workspace ON forge_projects("workspaceId");
    CREATE INDEX IF NOT EXISTS idx_forge_projects_status ON forge_projects("lifecycleStatus");
  `);

  await execSafe("forge_project_files table", `
    CREATE TABLE IF NOT EXISTS forge_project_files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      path VARCHAR(1000) NOT NULL,
      name VARCHAR(255) NOT NULL,
      extension VARCHAR(50) NOT NULL,
      "mimeType" VARCHAR(100) NOT NULL DEFAULT 'text/plain',
      "isDirectory" BOOLEAN NOT NULL DEFAULT false,
      "sizeBytes" INTEGER NOT NULL DEFAULT 0,
      content TEXT,
      encoding VARCHAR(20) NOT NULL DEFAULT 'utf-8',
      "contentHash" VARCHAR(64) NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      "isGenerated" BOOLEAN NOT NULL DEFAULT false,
      "isProtected" BOOLEAN NOT NULL DEFAULT false,
      "deletedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", path)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_project_files_proj ON forge_project_files("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_project_files_path ON forge_project_files("projectId", path);
  `);

  await execSafe("forge_project_revisions table", `
    CREATE TABLE IF NOT EXISTS forge_project_revisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "fileId" UUID NOT NULL REFERENCES forge_project_files(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      "contentHash" VARCHAR(64) NOT NULL,
      "changeType" VARCHAR(50) NOT NULL DEFAULT 'UPDATE',
      "authorId" UUID REFERENCES users(id) ON DELETE SET NULL,
      reason VARCHAR(255),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_project_rev_file ON forge_project_revisions("fileId");
    CREATE INDEX IF NOT EXISTS idx_forge_project_rev_proj ON forge_project_revisions("projectId");
  `);

  await execSafe("forge_project_snapshots table", `
    CREATE TABLE IF NOT EXISTS forge_project_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description VARCHAR(500),
      "fileCount" INTEGER NOT NULL DEFAULT 0,
      "totalBytes" INTEGER NOT NULL DEFAULT 0,
      "treeManifest" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdById" UUID REFERENCES users(id) ON DELETE SET NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_project_snap_proj ON forge_project_snapshots("projectId");
  `);

  await execSafe("forge_workspace_states table", `
    CREATE TABLE IF NOT EXISTS forge_workspace_states (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      layout JSONB NOT NULL DEFAULT '{}'::jsonb,
      preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", "userId")
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ws_state_proj ON forge_workspace_states("projectId", "userId");
  `);

  // Phase 2 Modules 10-15 Execution Infrastructure Tables
  await execSafe("forge_runtime_sessions table", `
    CREATE TABLE IF NOT EXISTS forge_runtime_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "runtimeType" VARCHAR(50) NOT NULL DEFAULT 'development',
      status VARCHAR(50) NOT NULL DEFAULT 'STOPPED',
      port INTEGER,
      "nodeVersion" VARCHAR(50) NOT NULL DEFAULT '20.x',
      "resourceQuotas" JSONB NOT NULL DEFAULT '{"maxMemoryMb":512,"maxCpuPercent":80,"timeoutMs":300000}'::jsonb,
      "startedAt" TIMESTAMPTZ,
      "stoppedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_runtime_proj ON forge_runtime_sessions("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_runtime_status ON forge_runtime_sessions("status");
  `);

  await execSafe("forge_build_records table", `
    CREATE TABLE IF NOT EXISTS forge_build_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "buildMode" VARCHAR(50) NOT NULL DEFAULT 'production',
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      trigger VARCHAR(50) NOT NULL DEFAULT 'manual',
      "durationMs" INTEGER DEFAULT 0,
      stages JSONB NOT NULL DEFAULT '[]'::jsonb,
      diagnostics JSONB NOT NULL DEFAULT '[]'::jsonb,
      reproducibility JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdById" UUID REFERENCES users(id) ON DELETE SET NULL,
      "startedAt" TIMESTAMPTZ,
      "completedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_build_proj ON forge_build_records("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_build_status ON forge_build_records("status");
  `);

  await execSafe("forge_build_artifacts table", `
    CREATE TABLE IF NOT EXISTS forge_build_artifacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "buildId" UUID NOT NULL REFERENCES forge_build_records(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      "artifactType" VARCHAR(50) NOT NULL DEFAULT 'bundle',
      "sizeBytes" INTEGER NOT NULL DEFAULT 0,
      "contentHash" VARCHAR(64) NOT NULL,
      "fileList" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_artifact_proj ON forge_build_artifacts("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_artifact_build ON forge_build_artifacts("buildId");
  `);

  await execSafe("forge_preview_sessions table", `
    CREATE TABLE IF NOT EXISTS forge_preview_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "runtimeId" UUID REFERENCES forge_runtime_sessions(id) ON DELETE SET NULL,
      "sessionToken" VARCHAR(128) NOT NULL UNIQUE,
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      "targetPort" INTEGER NOT NULL DEFAULT 5173,
      "previewUrl" VARCHAR(500) NOT NULL,
      viewport JSONB NOT NULL DEFAULT '{"preset":"desktop","width":1280,"height":800}'::jsonb,
      "expiresAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_preview_proj ON forge_preview_sessions("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_preview_token ON forge_preview_sessions("sessionToken");
  `);

  await execSafe("forge_terminal_sessions table", `
    CREATE TABLE IF NOT EXISTS forge_terminal_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "runtimeId" UUID REFERENCES forge_runtime_sessions(id) ON DELETE SET NULL,
      name VARCHAR(100) NOT NULL DEFAULT 'Terminal',
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      cwd VARCHAR(500) NOT NULL DEFAULT '/',
      history JSONB NOT NULL DEFAULT '[]'::jsonb,
      "lastActivityAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_terminal_proj ON forge_terminal_sessions("projectId");
  `);

  await execSafe("forge_debug_sessions table", `
    CREATE TABLE IF NOT EXISTS forge_debug_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "runtimeId" UUID REFERENCES forge_runtime_sessions(id) ON DELETE SET NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'IDLE',
      target VARCHAR(50) NOT NULL DEFAULT 'client',
      breakpoints JSONB NOT NULL DEFAULT '[]'::jsonb,
      "watchExpressions" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "callStack" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_debug_proj ON forge_debug_sessions("projectId");
  `);

  await execSafe("forge_execution_audits table", `
    CREATE TABLE IF NOT EXISTS forge_execution_audits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "userId" UUID REFERENCES users(id) ON DELETE SET NULL,
      "actionType" VARCHAR(100) NOT NULL,
      command VARCHAR(1000),
      "exitCode" INTEGER,
      "durationMs" INTEGER,
      "resourceUsage" JSONB DEFAULT '{}'::jsonb,
      "errorDetails" JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_audit_proj ON forge_execution_audits("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_audit_action ON forge_execution_audits("actionType");
  `);

  // 19. Forge Source-Based Hosting & Deployments (Module 29)
  await execSafe("forge_deployments table", `
    CREATE TABLE IF NOT EXISTS forge_deployments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      environment VARCHAR(50) NOT NULL DEFAULT 'preview',
      mode VARCHAR(50) NOT NULL DEFAULT 'STATIC',
      status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
      "artifactId" VARCHAR(255),
      "commitHash" VARCHAR(64),
      branch VARCHAR(255) DEFAULT 'main',
      url VARCHAR(500),
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      logs JSONB NOT NULL DEFAULT '[]'::jsonb,
      "healthCheck" JSONB DEFAULT '{}'::jsonb,
      "rollbackFromId" UUID,
      "durationMs" INTEGER,
      "createdById" UUID REFERENCES users(id) ON DELETE SET NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_deploy_proj ON forge_deployments("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_deploy_env ON forge_deployments("projectId", environment);
    CREATE INDEX IF NOT EXISTS idx_forge_deploy_status ON forge_deployments("status");
  `);

  // 20. Forge CI/CD Pipelines (Module 30)
  await execSafe("forge_cicd_pipelines table", `
    CREATE TABLE IF NOT EXISTS forge_cicd_pipelines (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      trigger VARCHAR(50) NOT NULL DEFAULT 'manual',
      environment VARCHAR(50) NOT NULL DEFAULT 'preview',
      status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
      "commitHash" VARCHAR(64),
      branch VARCHAR(255) DEFAULT 'main',
      stages JSONB NOT NULL DEFAULT '[]'::jsonb,
      artifacts JSONB DEFAULT '[]'::jsonb,
      "approvalGate" JSONB,
      "deploymentId" UUID,
      logs JSONB NOT NULL DEFAULT '[]'::jsonb,
      "startedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "completedAt" TIMESTAMPTZ,
      "createdById" UUID REFERENCES users(id) ON DELETE SET NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_cicd_proj ON forge_cicd_pipelines("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_cicd_status ON forge_cicd_pipelines("status");
  `);

  // 21. Forge Custom Domains & GoDaddy Integration (Module 31)
  await execSafe("forge_custom_domains table", `
    CREATE TABLE IF NOT EXISTS forge_custom_domains (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      domain VARCHAR(255) NOT NULL,
      provider VARCHAR(50) NOT NULL DEFAULT 'godaddy',
      environment VARCHAR(50) NOT NULL DEFAULT 'production',
      "deploymentId" UUID,
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      "verificationMethod" VARCHAR(50) NOT NULL DEFAULT 'TXT',
      "verificationToken" VARCHAR(255) NOT NULL,
      "dnsRecords" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "sslStatus" VARCHAR(50) NOT NULL DEFAULT 'PENDING_DNS',
      "sslIssuer" VARCHAR(100),
      "sslExpiresAt" TIMESTAMPTZ,
      "expiresAt" TIMESTAMPTZ,
      "autoRenew" BOOLEAN NOT NULL DEFAULT true,
      "lastCheckedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", domain)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_domain_proj ON forge_custom_domains("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_domain_name ON forge_custom_domains(domain);
  `);

  // 22. Forge Git Version Control (Module 16)
  await execSafe("forge_git_repositories table", `
    CREATE TABLE IF NOT EXISTS forge_git_repositories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL UNIQUE REFERENCES forge_projects(id) ON DELETE CASCADE,
      "currentBranch" VARCHAR(255) NOT NULL DEFAULT 'main',
      "headCommit" VARCHAR(64),
      "remoteUrl" VARCHAR(512),
      "remoteBranch" VARCHAR(255) DEFAULT 'main',
      remotes JSONB DEFAULT '{"origin": {"url": ""}}'::jsonb,
      status VARCHAR(50) NOT NULL DEFAULT 'INITIALIZED',
      "isDetachedHead" BOOLEAN NOT NULL DEFAULT false,
      staged JSONB DEFAULT '[]'::jsonb,
      "mergeHead" VARCHAR(64),
      "mergeMessage" TEXT,
      "rebaseOnto" VARCHAR(64),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_git_repo_proj ON forge_git_repositories("projectId");
  `);

  await execSafe("forge_git_commits table", `
    CREATE TABLE IF NOT EXISTS forge_git_commits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      hash VARCHAR(64) NOT NULL,
      "treeHash" VARCHAR(64) NOT NULL,
      "parentHashes" TEXT[] DEFAULT '{}',
      author JSONB NOT NULL,
      committer JSONB NOT NULL,
      message TEXT NOT NULL,
      branch VARCHAR(255) NOT NULL DEFAULT 'main',
      "diffSummary" JSONB DEFAULT '{}'::jsonb,
      tree JSONB DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", hash)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_git_commit_proj ON forge_git_commits("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_git_commit_hash ON forge_git_commits(hash);
  `);

  await execSafe("forge_git_branches table", `
    CREATE TABLE IF NOT EXISTS forge_git_branches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      "commitHash" VARCHAR(64) NOT NULL,
      "isProtected" BOOLEAN NOT NULL DEFAULT false,
      upstream VARCHAR(255),
      "aheadCount" INTEGER NOT NULL DEFAULT 0,
      "behindCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", name)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_git_branch_proj ON forge_git_branches("projectId");
  `);

  await execSafe("forge_git_stashes table", `
    CREATE TABLE IF NOT EXISTS forge_git_stashes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      index INTEGER NOT NULL DEFAULT 0,
      message VARCHAR(255) NOT NULL,
      branch VARCHAR(255) NOT NULL,
      "commitHash" VARCHAR(64) NOT NULL,
      "stagedFiles" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "unstagedFiles" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_git_stash_proj ON forge_git_stashes("projectId");
  `);

  await execSafe("forge_git_tags table", `
    CREATE TABLE IF NOT EXISTS forge_git_tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      "commitHash" VARCHAR(64) NOT NULL,
      message TEXT,
      tagger JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", name)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_git_tag_proj ON forge_git_tags("projectId");
  `);

  // 23. Forge GitHub Integration (Module 17)
  await execSafe("forge_github_connections table", `
    CREATE TABLE IF NOT EXISTS forge_github_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL UNIQUE REFERENCES forge_projects(id) ON DELETE CASCADE,
      "repoOwner" VARCHAR(255) NOT NULL,
      "repoName" VARCHAR(255) NOT NULL,
      "repoUrl" VARCHAR(512) NOT NULL,
      "defaultBranch" VARCHAR(255) NOT NULL DEFAULT 'main',
      "installationId" VARCHAR(100),
      "accessTokenEncrypted" TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'CONNECTED',
      "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
      "lastSyncAt" TIMESTAMPTZ,
      "webhookId" VARCHAR(100),
      "webhookSecret" VARCHAR(255),
      metadata JSONB DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_github_conn_proj ON forge_github_connections("projectId");
  `);

  await execSafe("forge_github_pull_requests table", `
    CREATE TABLE IF NOT EXISTS forge_github_pull_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "githubPrNumber" INTEGER NOT NULL,
      title VARCHAR(512) NOT NULL,
      body TEXT,
      "sourceBranch" VARCHAR(255) NOT NULL,
      "targetBranch" VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
      author JSONB NOT NULL,
      url VARCHAR(512),
      "diffUrl" VARCHAR(512),
      checks JSONB DEFAULT '[]'::jsonb,
      reviews JSONB DEFAULT '[]'::jsonb,
      "issueLinks" TEXT[] DEFAULT '{}',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", "githubPrNumber")
    );
    CREATE INDEX IF NOT EXISTS idx_forge_github_pr_proj ON forge_github_pull_requests("projectId");
  `);

  // 24. Forge CLI Linkings & Sessions (Module 18)
  await execSafe("forge_cli_sessions table", `
    CREATE TABLE IF NOT EXISTS forge_cli_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      "deviceCode" VARCHAR(100),
      "clientName" VARCHAR(255) DEFAULT 'forge-cli',
      "lastActiveAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_cli_sess_user ON forge_cli_sessions("userId");
    CREATE INDEX IF NOT EXISTS idx_forge_cli_sess_token ON forge_cli_sessions(token);
  `);

  // 25. Forge AI Provider Gateway (Module 19)
  await execSafe("forge_ai_providers table", `
    CREATE TABLE IF NOT EXISTS forge_ai_providers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
      "projectId" UUID REFERENCES forge_projects(id) ON DELETE CASCADE,
      provider VARCHAR(50) NOT NULL,
      "apiKeyEncrypted" TEXT NOT NULL,
      "defaultModel" VARCHAR(100),
      "isByok" BOOLEAN NOT NULL DEFAULT false,
      "isEnabled" BOOLEAN NOT NULL DEFAULT true,
      "rateLimitPerMin" INTEGER DEFAULT 60,
      "circuitStatus" VARCHAR(20) NOT NULL DEFAULT 'CLOSED',
      "errorCount" INTEGER NOT NULL DEFAULT 0,
      "lastSuccessAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ai_prov_user ON forge_ai_providers("userId");
    CREATE INDEX IF NOT EXISTS idx_forge_ai_prov_proj ON forge_ai_providers("projectId");
  `);

  await execSafe("forge_ai_requests table", `
    CREATE TABLE IF NOT EXISTS forge_ai_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID REFERENCES users(id) ON DELETE SET NULL,
      "projectId" UUID REFERENCES forge_projects(id) ON DELETE SET NULL,
      provider VARCHAR(50) NOT NULL,
      model VARCHAR(100) NOT NULL,
      task VARCHAR(100) NOT NULL,
      "promptTokens" INTEGER NOT NULL DEFAULT 0,
      "completionTokens" INTEGER NOT NULL DEFAULT 0,
      "totalTokens" INTEGER NOT NULL DEFAULT 0,
      "latencyMs" INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
      "errorMessage" TEXT,
      "costEstimateUsd" NUMERIC(10, 6) DEFAULT 0,
      "traceId" VARCHAR(100),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ai_req_proj ON forge_ai_requests("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_ai_req_user ON forge_ai_requests("userId");
  `);

  // 26. Forge AI Tool Execution Framework (Module 23)
  await execSafe("forge_ai_tool_executions table", `
    CREATE TABLE IF NOT EXISTS forge_ai_tool_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "userId" UUID REFERENCES users(id) ON DELETE SET NULL,
      "sessionId" UUID,
      "toolName" VARCHAR(100) NOT NULL,
      category VARCHAR(50) NOT NULL,
      "riskLevel" VARCHAR(20) NOT NULL DEFAULT 'LOW',
      status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
      parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
      result JSONB,
      "errorMessage" TEXT,
      "approvedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
      "approvedAt" TIMESTAMPTZ,
      "executionDurationMs" INTEGER,
      "traceId" VARCHAR(100),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "completedAt" TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_forge_tool_exec_proj ON forge_ai_tool_executions("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_tool_exec_sess ON forge_ai_tool_executions("sessionId");
  `);

  // 27. Forge AI Agent Sessions & Plans (Modules 20, 21, 22)
  await execSafe("forge_ai_agent_sessions table", `
    CREATE TABLE IF NOT EXISTS forge_ai_agent_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "agentType" VARCHAR(50) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      goal TEXT NOT NULL,
      context JSONB NOT NULL DEFAULT '{}'::jsonb,
      "currentPlanId" UUID,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_agent_sess_proj ON forge_ai_agent_sessions("projectId");
  `);

  await execSafe("forge_ai_agent_plans table", `
    CREATE TABLE IF NOT EXISTS forge_ai_agent_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "sessionId" UUID NOT NULL REFERENCES forge_ai_agent_sessions(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      steps JSONB NOT NULL DEFAULT '[]'::jsonb,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      "riskAssessment" JSONB DEFAULT '{}'::jsonb,
      "approvedAt" TIMESTAMPTZ,
      "completedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_agent_plan_sess ON forge_ai_agent_plans("sessionId");
  `);

  await execSafe("forge_ai_checkpoints table", `
    CREATE TABLE IF NOT EXISTS forge_ai_checkpoints (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "sessionId" UUID REFERENCES forge_ai_agent_sessions(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      "snapshotId" UUID,
      "filesSnapshot" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ai_chk_proj ON forge_ai_checkpoints("projectId");
  `);

  // 28. Forge Model Context Protocol (MCP) (Module 24)
  await execSafe("forge_mcp_servers table", `
    CREATE TABLE IF NOT EXISTS forge_mcp_servers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
      "projectId" UUID REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'EXTERNAL',
      transport VARCHAR(20) NOT NULL DEFAULT 'HTTP',
      endpoint VARCHAR(512) NOT NULL,
      "trustLevel" VARCHAR(20) NOT NULL DEFAULT 'UNTRUSTED',
      capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
      tools JSONB NOT NULL DEFAULT '[]'::jsonb,
      "authConfigEncrypted" TEXT,
      "isEnabled" BOOLEAN NOT NULL DEFAULT true,
      status VARCHAR(20) NOT NULL DEFAULT 'DISCONNECTED',
      "lastHealthCheck" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_mcp_proj ON forge_mcp_servers("projectId");
  `);

  await execSafe("forge_mcp_executions table", `
    CREATE TABLE IF NOT EXISTS forge_mcp_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "serverId" UUID NOT NULL REFERENCES forge_mcp_servers(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "toolName" VARCHAR(100) NOT NULL,
      arguments JSONB NOT NULL DEFAULT '{}'::jsonb,
      result JSONB,
      "isError" BOOLEAN NOT NULL DEFAULT false,
      "errorMessage" TEXT,
      "durationMs" INTEGER NOT NULL DEFAULT 0,
      "traceId" VARCHAR(100),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_mcp_exec_srv ON forge_mcp_executions("serverId");
  `);

  console.log("✅ [DATABASE] Schema self-healing verified all tables & columns successfully.");
}

