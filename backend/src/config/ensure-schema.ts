import { pgPool } from "./prisma.js";

const failedSchemaSteps: string[] = [];

async function execSafe(label: string, sql: string) {
  try {
    await pgPool.query(sql);
  } catch (err: any) {
    if (err?.code !== "42701" && err?.code !== "42P07") {
      failedSchemaSteps.push(label);
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
    ALTER TABLE websites ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(6);
    ALTER TABLE websites ADD COLUMN IF NOT EXISTS "teamId" UUID;
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

  // 29. AI Context Engine (Module 37)
  await execSafe("forge_ai_context_snapshots table", `
    CREATE TABLE IF NOT EXISTS forge_ai_context_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "taskId" UUID,
      "runId" UUID,
      "agentId" VARCHAR(100),
      profile VARCHAR(100) NOT NULL DEFAULT 'DEFAULT',
      "tokenBudget" INTEGER NOT NULL DEFAULT 32000,
      "tokensUsed" INTEGER NOT NULL DEFAULT 0,
      sources JSONB NOT NULL DEFAULT '[]'::jsonb,
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      "redactedCount" INTEGER NOT NULL DEFAULT 0,
      explainability JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ai_ctx_proj ON forge_ai_context_snapshots("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_ai_ctx_task ON forge_ai_context_snapshots("taskId");
  `);

  // 30. AI Project Memory (Module 38)
  await execSafe("forge_ai_project_memories table", `
    CREATE TABLE IF NOT EXISTS forge_ai_project_memories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "workspaceId" UUID,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      source VARCHAR(50) NOT NULL DEFAULT 'USER',
      provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
      confidence NUMERIC(3,2) NOT NULL DEFAULT 1.0,
      status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      severity VARCHAR(30) NOT NULL DEFAULT 'WARNING',
      version INTEGER NOT NULL DEFAULT 1,
      tags TEXT[] DEFAULT '{}',
      "relatedFiles" TEXT[] DEFAULT '{}',
      "relatedSymbols" TEXT[] DEFAULT '{}',
      "relatedModules" TEXT[] DEFAULT '{}',
      supersedes UUID REFERENCES forge_ai_project_memories(id) ON DELETE SET NULL,
      "supersededBy" UUID REFERENCES forge_ai_project_memories(id) ON DELETE SET NULL,
      "createdBy" UUID REFERENCES users(id) ON DELETE SET NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ai_mem_proj ON forge_ai_project_memories("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_ai_mem_type ON forge_ai_project_memories(type);
    CREATE INDEX IF NOT EXISTS idx_forge_ai_mem_status ON forge_ai_project_memories(status);
  `);

  await execSafe("forge_ai_memory_conflicts table", `
    CREATE TABLE IF NOT EXISTS forge_ai_memory_conflicts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "memoryId" UUID NOT NULL REFERENCES forge_ai_project_memories(id) ON DELETE CASCADE,
      "taskId" UUID,
      "runId" UUID,
      "ruleTitle" VARCHAR(255) NOT NULL,
      severity VARCHAR(30) NOT NULL DEFAULT 'WARNING',
      "targetFile" VARCHAR(512),
      "conflictDescription" TEXT NOT NULL,
      "suggestedRemedy" TEXT,
      "resolutionStatus" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      "resolvedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
      "resolvedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ai_mem_conf_proj ON forge_ai_memory_conflicts("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_ai_mem_conf_mem ON forge_ai_memory_conflicts("memoryId");
  `);

  // 31. AI Planning Agent (Module 39)
  await execSafe("forge_ai_plans table", `
    CREATE TABLE IF NOT EXISTS forge_ai_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "taskId" UUID,
      title VARCHAR(255) NOT NULL,
      objective TEXT NOT NULL,
      assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
      constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
      "currentState" TEXT,
      "targetState" TEXT,
      "architectureNotes" TEXT,
      "affectedFiles" JSONB NOT NULL DEFAULT '[]'::jsonb,
      dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
      steps JSONB NOT NULL DEFAULT '[]'::jsonb,
      "testStrategy" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "rollbackPlan" TEXT,
      "riskLevel" VARCHAR(20) NOT NULL DEFAULT 'LOW',
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      "approvedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
      "approvedAt" TIMESTAMPTZ,
      "rejectionReason" TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ai_plan_proj ON forge_ai_plans("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_ai_plan_task ON forge_ai_plans("taskId");
  `);

  // 32. AI Architecture Agent (Module 40)
  await execSafe("forge_ai_architecture_snapshots table", `
    CREATE TABLE IF NOT EXISTS forge_ai_architecture_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      score NUMERIC(5,2) NOT NULL DEFAULT 100.0,
      "moduleCount" INTEGER NOT NULL DEFAULT 0,
      "serviceCount" INTEGER NOT NULL DEFAULT 0,
      "circularDependencies" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "layerViolations" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "duplicatedModules" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "architectureDrift" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "couplingMetrics" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "diagramData" JSONB NOT NULL DEFAULT '{}'::jsonb,
      recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ai_arch_proj ON forge_ai_architecture_snapshots("projectId");
  `);

  await execSafe("forge_ai_architecture_findings table", `
    CREATE TABLE IF NOT EXISTS forge_ai_architecture_findings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "snapshotId" UUID NOT NULL REFERENCES forge_ai_architecture_snapshots(id) ON DELETE CASCADE,
      category VARCHAR(50) NOT NULL,
      severity VARCHAR(20) NOT NULL DEFAULT 'WARNING',
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      "affectedFiles" TEXT[] DEFAULT '{}',
      remediation TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ai_arch_find_proj ON forge_ai_architecture_findings("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_ai_arch_find_snap ON forge_ai_architecture_findings("snapshotId");
  `);

  // 33. Agent Task / Run Manager (Module 42)
  await execSafe("forge_ai_tasks table", `
    CREATE TABLE IF NOT EXISTS forge_ai_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "userId" UUID REFERENCES users(id) ON DELETE SET NULL,
      title VARCHAR(255) NOT NULL,
      objective TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
      priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
      "planId" UUID REFERENCES forge_ai_plans(id) ON DELETE SET NULL,
      "activeRunId" UUID,
      "contextSummary" JSONB DEFAULT '{}'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ai_task_proj ON forge_ai_tasks("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_ai_task_status ON forge_ai_tasks(status);
  `);

  await execSafe("forge_ai_runs table", `
    CREATE TABLE IF NOT EXISTS forge_ai_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "taskId" UUID NOT NULL REFERENCES forge_ai_tasks(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "attemptNumber" INTEGER NOT NULL DEFAULT 1,
      status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
      "currentStepId" VARCHAR(100),
      "orchestrationPlan" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "checkpointHash" VARCHAR(64),
      "totalDurationMs" INTEGER NOT NULL DEFAULT 0,
      "tokenUsage" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "costEstimateUsd" NUMERIC(10,6) NOT NULL DEFAULT 0,
      "errorMessage" TEXT,
      "startedAt" TIMESTAMPTZ,
      "completedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ai_run_task ON forge_ai_runs("taskId");
    CREATE INDEX IF NOT EXISTS idx_forge_ai_run_proj ON forge_ai_runs("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_ai_run_status ON forge_ai_runs(status);
  `);

  await execSafe("forge_ai_run_steps table", `
    CREATE TABLE IF NOT EXISTS forge_ai_run_steps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "runId" UUID NOT NULL REFERENCES forge_ai_runs(id) ON DELETE CASCADE,
      "stepKey" VARCHAR(100) NOT NULL,
      "agentId" VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      "orderIndex" INTEGER NOT NULL DEFAULT 0,
      dependencies TEXT[] DEFAULT '{}',
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      "inputPayload" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "outputPayload" JSONB DEFAULT '{}'::jsonb,
      "errorMessage" TEXT,
      "startedAt" TIMESTAMPTZ,
      "completedAt" TIMESTAMPTZ,
      "durationMs" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ai_step_run ON forge_ai_run_steps("runId");
    CREATE INDEX IF NOT EXISTS idx_forge_ai_step_status ON forge_ai_run_steps(status);
  `);

  await execSafe("forge_ai_events table", `
    CREATE TABLE IF NOT EXISTS forge_ai_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "taskId" UUID REFERENCES forge_ai_tasks(id) ON DELETE CASCADE,
      "runId" UUID REFERENCES forge_ai_runs(id) ON DELETE CASCADE,
      "stepId" UUID,
      "agentId" VARCHAR(100),
      "eventType" VARCHAR(100) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      "correlationId" VARCHAR(100),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ai_evt_proj ON forge_ai_events("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_ai_evt_run ON forge_ai_events("runId");
    CREATE INDEX IF NOT EXISTS idx_forge_ai_evt_task ON forge_ai_events("taskId");
  `);

  await execSafe("forge_ai_artifacts table", `
    CREATE TABLE IF NOT EXISTS forge_ai_artifacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "taskId" UUID REFERENCES forge_ai_tasks(id) ON DELETE CASCADE,
      "runId" UUID REFERENCES forge_ai_runs(id) ON DELETE CASCADE,
      "stepId" UUID,
      type VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ai_art_proj ON forge_ai_artifacts("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_ai_art_run ON forge_ai_artifacts("runId");
  `);

  // 34. Multi-Agent Orchestrator (Module 41)
  await execSafe("forge_ai_agent_handoffs table", `
    CREATE TABLE IF NOT EXISTS forge_ai_agent_handoffs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "runId" UUID NOT NULL REFERENCES forge_ai_runs(id) ON DELETE CASCADE,
      "fromAgent" VARCHAR(100) NOT NULL,
      "toAgent" VARCHAR(100) NOT NULL,
      objective TEXT NOT NULL,
      "contextSummary" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "previousResult" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "artifactsPassed" JSONB NOT NULL DEFAULT '[]'::jsonb,
      status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ai_handoff_run ON forge_ai_agent_handoffs("runId");
  `);

  // 35. Forge Database (Module 25)
  await execSafe("forge_databases table", `
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
  `);

  await execSafe("forge_database_migrations table", `
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
  `);

  // Same SQL as prisma/migrations/20261013160000_migration_authority_lifecycle.
  await execSafe("migration authority lifecycle", `
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
  `);

  await execSafe("forge_database_backups table", `
    CREATE TABLE IF NOT EXISTS forge_database_backups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "databaseId" UUID NOT NULL REFERENCES forge_databases(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      "backupType" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
      status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
      "sizeBytes" BIGINT NOT NULL DEFAULT 0,
      "schemaDdl" TEXT NOT NULL DEFAULT '',
      "dataJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
      checksum VARCHAR(64) NOT NULL DEFAULT '',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_db_bak_db ON forge_database_backups("databaseId");
  `);

  // 36. Database Studio (Module 26)
  await execSafe("forge_query_logs table", `
    CREATE TABLE IF NOT EXISTS forge_query_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "databaseId" UUID NOT NULL REFERENCES forge_databases(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "userId" UUID REFERENCES users(id) ON DELETE SET NULL,
      query TEXT NOT NULL,
      "durationMs" INTEGER NOT NULL DEFAULT 0,
      "rowCount" INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
      "errorMessage" TEXT,
      "isDestructive" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_qlog_db ON forge_query_logs("databaseId");
    CREATE INDEX IF NOT EXISTS idx_forge_qlog_proj ON forge_query_logs("projectId");
  `);

  // 37. Data / API Layer (Module 27)
  await execSafe("forge_api_configs table", `
    CREATE TABLE IF NOT EXISTS forge_api_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "databaseId" UUID NOT NULL REFERENCES forge_databases(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "tableName" VARCHAR(100) NOT NULL,
      "isExposed" BOOLEAN NOT NULL DEFAULT true,
      "allowedOperations" TEXT[] DEFAULT ARRAY['GET', 'POST', 'PATCH', 'DELETE'],
      "requireAuth" BOOLEAN NOT NULL DEFAULT true,
      "rateLimitPerMin" INTEGER NOT NULL DEFAULT 120,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("databaseId", "tableName")
    );
    CREATE INDEX IF NOT EXISTS idx_forge_api_cfg_proj ON forge_api_configs("projectId");
  `);

  // 38. Object Storage (Module 28)
  await execSafe("forge_storage_buckets table", `
    CREATE TABLE IF NOT EXISTS forge_storage_buckets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      "accessPolicy" VARCHAR(30) NOT NULL DEFAULT 'PUBLIC_READ',
      "allowedMimeTypes" TEXT[] DEFAULT '{}',
      "maxSizeBytes" BIGINT NOT NULL DEFAULT 52428800,
      "currentSizeBytes" BIGINT NOT NULL DEFAULT 0,
      "objectCount" INTEGER NOT NULL DEFAULT 0,
      "isEncrypted" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", name)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_bkt_proj ON forge_storage_buckets("projectId");
  `);

  await execSafe("forge_storage_objects table", `
    CREATE TABLE IF NOT EXISTS forge_storage_objects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "bucketId" UUID NOT NULL REFERENCES forge_storage_buckets(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      key VARCHAR(1024) NOT NULL,
      "fileName" VARCHAR(255) NOT NULL,
      "mimeType" VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
      "sizeBytes" BIGINT NOT NULL DEFAULT 0,
      sha256 VARCHAR(64),
      "versionId" VARCHAR(50) NOT NULL DEFAULT 'v1',
      "isCurrentVersion" BOOLEAN NOT NULL DEFAULT true,
      "storagePath" TEXT NOT NULL,
      "scanStatus" VARCHAR(30) NOT NULL DEFAULT 'CLEAN',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("bucketId", key, "versionId")
    );
    CREATE INDEX IF NOT EXISTS idx_forge_obj_bkt ON forge_storage_objects("bucketId");
    CREATE INDEX IF NOT EXISTS idx_forge_obj_proj ON forge_storage_objects("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_obj_key ON forge_storage_objects(key);
  `);

  await execSafe("forge_storage_multipart_sessions table", `
    CREATE TABLE IF NOT EXISTS forge_storage_multipart_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "bucketId" UUID NOT NULL REFERENCES forge_storage_buckets(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "uploadId" VARCHAR(100) UNIQUE NOT NULL,
      key VARCHAR(1024) NOT NULL,
      "fileName" VARCHAR(255) NOT NULL,
      "mimeType" VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
      "totalParts" INTEGER NOT NULL DEFAULT 0,
      parts JSONB NOT NULL DEFAULT '[]'::jsonb,
      status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS',
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_mp_sess_bkt ON forge_storage_multipart_sessions("bucketId");
    CREATE INDEX IF NOT EXISTS idx_forge_mp_sess_upl ON forge_storage_multipart_sessions("uploadId");
  `);

  // 39. Serverless & Edge Functions (Module 46)
  await execSafe("forge_serverless_functions table", `
    CREATE TABLE IF NOT EXISTS forge_serverless_functions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) NOT NULL,
      description TEXT,
      runtime VARCHAR(50) NOT NULL DEFAULT 'nodejs20',
      handler VARCHAR(100) NOT NULL DEFAULT 'index.handler',
      code TEXT NOT NULL,
      environment VARCHAR(50) NOT NULL DEFAULT 'development',
      "envVars" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "timeoutMs" INTEGER NOT NULL DEFAULT 5000,
      "memoryMb" INTEGER NOT NULL DEFAULT 128,
      status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", name, environment)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_fn_proj ON forge_serverless_functions("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_fn_slug ON forge_serverless_functions(slug);
  `);

  await execSafe("forge_function_invocations table", `
    CREATE TABLE IF NOT EXISTS forge_function_invocations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "functionId" UUID NOT NULL REFERENCES forge_serverless_functions(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      trigger VARCHAR(50) NOT NULL DEFAULT 'HTTP',
      status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
      "durationMs" INTEGER NOT NULL DEFAULT 0,
      "requestPayload" JSONB,
      "responsePayload" JSONB,
      logs TEXT,
      error TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_fn_inv_fn ON forge_function_invocations("functionId");
    CREATE INDEX IF NOT EXISTS idx_forge_fn_inv_proj ON forge_function_invocations("projectId");
  `);

  // 40. Background Jobs & Queue (Module 47)
  await execSafe("forge_task_queues table", `
    CREATE TABLE IF NOT EXISTS forge_task_queues (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      concurrency INTEGER NOT NULL DEFAULT 5,
      "maxRetries" INTEGER NOT NULL DEFAULT 3,
      "backoffMs" INTEGER NOT NULL DEFAULT 1000,
      "dlqEnabled" BOOLEAN NOT NULL DEFAULT true,
      "isPaused" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", name)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_queue_proj ON forge_task_queues("projectId");
  `);

  await execSafe("forge_queue_jobs table", `
    CREATE TABLE IF NOT EXISTS forge_queue_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "queueId" UUID NOT NULL REFERENCES forge_task_queues(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
      priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
      attempts INTEGER NOT NULL DEFAULT 0,
      "maxAttempts" INTEGER NOT NULL DEFAULT 3,
      "runAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "startedAt" TIMESTAMPTZ,
      "completedAt" TIMESTAMPTZ,
      "failedAt" TIMESTAMPTZ,
      "lastError" TEXT,
      result JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_qjob_q ON forge_queue_jobs("queueId");
    CREATE INDEX IF NOT EXISTS idx_forge_qjob_proj ON forge_queue_jobs("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_qjob_status ON forge_queue_jobs(status);
  `);

  // 41. Scheduler / Cron Engine (Module 48)
  await execSafe("forge_cron_schedules table", `
    CREATE TABLE IF NOT EXISTS forge_cron_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      "cronExpression" VARCHAR(100) NOT NULL,
      timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
      "targetType" VARCHAR(50) NOT NULL DEFAULT 'FUNCTION',
      "targetPayload" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "targetDestination" VARCHAR(255) NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "lastRunAt" TIMESTAMPTZ,
      "nextRunAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", name)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_cron_proj ON forge_cron_schedules("projectId");
  `);

  await execSafe("forge_cron_executions table", `
    CREATE TABLE IF NOT EXISTS forge_cron_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "scheduleId" UUID NOT NULL REFERENCES forge_cron_schedules(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
      "durationMs" INTEGER NOT NULL DEFAULT 0,
      output JSONB,
      "errorMessage" TEXT,
      "executedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_cron_exec_sch ON forge_cron_executions("scheduleId");
    CREATE INDEX IF NOT EXISTS idx_forge_cron_exec_proj ON forge_cron_executions("projectId");
  `);

  // 42. Event Bus & Webhook Platform (Module 49)
  await execSafe("forge_event_topics table", `
    CREATE TABLE IF NOT EXISTS forge_event_topics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      "schemaDefinition" JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", name)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_topic_proj ON forge_event_topics("projectId");
  `);

  await execSafe("forge_event_subscriptions table", `
    CREATE TABLE IF NOT EXISTS forge_event_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "topicId" UUID NOT NULL REFERENCES forge_event_topics(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      "destinationType" VARCHAR(50) NOT NULL DEFAULT 'FUNCTION',
      "destinationConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "filterPolicy" JSONB DEFAULT '{}'::jsonb,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_sub_top ON forge_event_subscriptions("topicId");
    CREATE INDEX IF NOT EXISTS idx_forge_sub_proj ON forge_event_subscriptions("projectId");
  `);

  await execSafe("forge_events table", `
    CREATE TABLE IF NOT EXISTS forge_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "topicId" UUID NOT NULL REFERENCES forge_event_topics(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "eventName" VARCHAR(100) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      "publishedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_evt_top ON forge_events("topicId");
    CREATE INDEX IF NOT EXISTS idx_forge_evt_proj ON forge_events("projectId");
  `);

  await execSafe("forge_webhook_deliveries table", `
    CREATE TABLE IF NOT EXISTS forge_webhook_deliveries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "subscriptionId" UUID NOT NULL REFERENCES forge_event_subscriptions(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "eventId" UUID,
      "endpointUrl" TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
      "statusCode" INTEGER,
      attempt INTEGER NOT NULL DEFAULT 1,
      "requestHeaders" JSONB,
      "responseBody" TEXT,
      "durationMs" INTEGER,
      "deliveredAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_wh_sub ON forge_webhook_deliveries("subscriptionId");
    CREATE INDEX IF NOT EXISTS idx_forge_wh_proj ON forge_webhook_deliveries("projectId");
  `);

  // 43. Realtime Engine (Module 50)
  await execSafe("forge_realtime_channels table", `
    CREATE TABLE IF NOT EXISTS forge_realtime_channels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      "isPrivate" BOOLEAN NOT NULL DEFAULT false,
      "presenceEnabled" BOOLEAN NOT NULL DEFAULT true,
      "authPolicy" VARCHAR(50) NOT NULL DEFAULT 'ALLOW_ALL',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", name)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_rt_chan_proj ON forge_realtime_channels("projectId");
  `);

  // 44. Cache / KV Layer (Module 51)
  await execSafe("forge_kv_namespaces table", `
    CREATE TABLE IF NOT EXISTS forge_kv_namespaces (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", name)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_kv_ns_proj ON forge_kv_namespaces("projectId");
  `);

  await execSafe("forge_kv_entries table", `
    CREATE TABLE IF NOT EXISTS forge_kv_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "namespaceId" UUID NOT NULL REFERENCES forge_kv_namespaces(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      key VARCHAR(255) NOT NULL,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      tags TEXT[] DEFAULT '{}',
      "expiresAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("namespaceId", key)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_kv_ent_ns ON forge_kv_entries("namespaceId");
    CREATE INDEX IF NOT EXISTS idx_forge_kv_ent_key ON forge_kv_entries(key);
  `);

  // 45. API Gateway & Schema Registry (Module 52)
  await execSafe("forge_api_gateway_routes table", `
    CREATE TABLE IF NOT EXISTS forge_api_gateway_routes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      path VARCHAR(255) NOT NULL,
      method VARCHAR(20) NOT NULL DEFAULT 'GET',
      "targetType" VARCHAR(50) NOT NULL DEFAULT 'FUNCTION',
      "targetDestination" VARCHAR(255) NOT NULL,
      "requireAuth" BOOLEAN NOT NULL DEFAULT false,
      "rateLimitPerMin" INTEGER NOT NULL DEFAULT 120,
      "corsOrigins" TEXT[] DEFAULT ARRAY['*'],
      "requestSchemaId" UUID,
      "responseSchemaId" UUID,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", path, method)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_gw_rt_proj ON forge_api_gateway_routes("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_gw_rt_path ON forge_api_gateway_routes(path);
  `);

  await execSafe("forge_schema_registry table", `
    CREATE TABLE IF NOT EXISTS forge_schema_registry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      version VARCHAR(50) NOT NULL DEFAULT 'v1',
      "schemaType" VARCHAR(30) NOT NULL DEFAULT 'JSON_SCHEMA',
      "schemaDefinition" JSONB NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", name, version)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_sch_reg_proj ON forge_schema_registry("projectId");
  `);

  // 46. Automated Testing Platform (Module 43)
  await execSafe("forge_test_suites table", `
    CREATE TABLE IF NOT EXISTS forge_test_suites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      "testType" VARCHAR(50) NOT NULL DEFAULT 'UNIT',
      "filePath" VARCHAR(255) NOT NULL,
      "totalTests" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", "filePath")
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ts_proj ON forge_test_suites("projectId");
  `);

  await execSafe("forge_test_runs table", `
    CREATE TABLE IF NOT EXISTS forge_test_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "suiteId" UUID REFERENCES forge_test_suites(id) ON DELETE SET NULL,
      trigger VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
      status VARCHAR(30) NOT NULL DEFAULT 'PASSED',
      total INTEGER NOT NULL DEFAULT 0,
      passed INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      skipped INTEGER NOT NULL DEFAULT 0,
      "durationMs" INTEGER NOT NULL DEFAULT 0,
      coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
      results JSONB NOT NULL DEFAULT '[]'::jsonb,
      "aiDiagnostic" JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_trun_proj ON forge_test_runs("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_trun_status ON forge_test_runs(status);
  `);

  // 47. API Testing Studio (Module 44)
  await execSafe("forge_api_collections table", `
    CREATE TABLE IF NOT EXISTS forge_api_collections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      variables JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", name)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_apicoll_proj ON forge_api_collections("projectId");
  `);

  await execSafe("forge_api_test_requests table", `
    CREATE TABLE IF NOT EXISTS forge_api_test_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "collectionId" UUID NOT NULL REFERENCES forge_api_collections(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      method VARCHAR(20) NOT NULL DEFAULT 'GET',
      url TEXT NOT NULL,
      headers JSONB NOT NULL DEFAULT '{}'::jsonb,
      params JSONB NOT NULL DEFAULT '{}'::jsonb,
      body JSONB NOT NULL DEFAULT '{}'::jsonb,
      auth JSONB NOT NULL DEFAULT '{}'::jsonb,
      assertions JSONB NOT NULL DEFAULT '[]'::jsonb,
      "preRequestScript" TEXT,
      "testScript" TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_apireq_coll ON forge_api_test_requests("collectionId");
    CREATE INDEX IF NOT EXISTS idx_forge_apireq_proj ON forge_api_test_requests("projectId");
  `);

  await execSafe("forge_api_test_runs table", `
    CREATE TABLE IF NOT EXISTS forge_api_test_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "collectionId" UUID NOT NULL REFERENCES forge_api_collections(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      status VARCHAR(30) NOT NULL DEFAULT 'PASSED',
      "totalRequests" INTEGER NOT NULL DEFAULT 0,
      "passedAssertions" INTEGER NOT NULL DEFAULT 0,
      "failedAssertions" INTEGER NOT NULL DEFAULT 0,
      "durationMs" INTEGER NOT NULL DEFAULT 0,
      results JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_apirun_coll ON forge_api_test_runs("collectionId");
    CREATE INDEX IF NOT EXISTS idx_forge_apirun_proj ON forge_api_test_runs("projectId");
  `);

  // 48. Browser DevTools & Runtime Inspector (Module 45)
  await execSafe("forge_runtime_snapshots table", `
    CREATE TABLE IF NOT EXISTS forge_runtime_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      url TEXT,
      "domTree" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "consoleLogs" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "networkLogs" JSONB NOT NULL DEFAULT '[]'::jsonb,
      vitals JSONB NOT NULL DEFAULT '{}'::jsonb,
      storage JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_rtsnap_proj ON forge_runtime_snapshots("projectId");
  `);

  // 49. Preview Environment Manager (Module 53)
  await execSafe("forge_preview_environments table", `
    CREATE TABLE IF NOT EXISTS forge_preview_environments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) NOT NULL,
      branch VARCHAR(255) NOT NULL,
      "pullRequestId" VARCHAR(100),
      url VARCHAR(500),
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      "envVars" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "databaseBranchId" VARCHAR(255),
      "ttlHours" INTEGER NOT NULL DEFAULT 72,
      "expiresAt" TIMESTAMPTZ,
      "lastDeployedAt" TIMESTAMPTZ DEFAULT now(),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", slug)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_preview_proj ON forge_preview_environments("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_preview_branch ON forge_preview_environments("projectId", branch);
  `);

  // 50. Developer Observability: Logs, Spans & Issues (Module 54)
  await execSafe("forge_observability_logs table", `
    CREATE TABLE IF NOT EXISTS forge_observability_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      environment VARCHAR(50) NOT NULL DEFAULT 'development',
      source VARCHAR(50) NOT NULL DEFAULT 'RUNTIME',
      level VARCHAR(20) NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      "traceId" VARCHAR(100),
      "spanId" VARCHAR(100),
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_obs_log_proj ON forge_observability_logs("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_obs_log_lvl ON forge_observability_logs(level);
    CREATE INDEX IF NOT EXISTS idx_forge_obs_log_trace ON forge_observability_logs("traceId");
    CREATE INDEX IF NOT EXISTS idx_forge_obs_log_time ON forge_observability_logs(timestamp);
  `);

  await execSafe("forge_observability_spans table", `
    CREATE TABLE IF NOT EXISTS forge_observability_spans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "traceId" VARCHAR(100) NOT NULL,
      "spanId" VARCHAR(100) NOT NULL,
      "parentSpanId" VARCHAR(100),
      name VARCHAR(255) NOT NULL,
      service VARCHAR(100) NOT NULL DEFAULT 'forge-app',
      "durationMs" INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'OK',
      attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
      events JSONB NOT NULL DEFAULT '[]'::jsonb,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_obs_span_proj ON forge_observability_spans("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_obs_span_trace ON forge_observability_spans("traceId");
  `);

  await execSafe("forge_observability_issues table", `
    CREATE TABLE IF NOT EXISTS forge_observability_issues (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      fingerprint VARCHAR(128) NOT NULL,
      title VARCHAR(500) NOT NULL,
      type VARCHAR(100) NOT NULL DEFAULT 'Error',
      status VARCHAR(30) NOT NULL DEFAULT 'UNRESOLVED',
      "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
      "firstSeenAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "sampleStack" TEXT,
      "sampleMetadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE("projectId", fingerprint)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_obs_issue_proj ON forge_observability_issues("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_obs_issue_stat ON forge_observability_issues(status);
  `);

  // 51. Application Security Scanning (Module 55)
  await execSafe("forge_security_scans table", `
    CREATE TABLE IF NOT EXISTS forge_security_scans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "scanType" VARCHAR(50) NOT NULL DEFAULT 'FULL',
      status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
      score INTEGER NOT NULL DEFAULT 100,
      "criticalCount" INTEGER NOT NULL DEFAULT 0,
      "highCount" INTEGER NOT NULL DEFAULT 0,
      "mediumCount" INTEGER NOT NULL DEFAULT 0,
      "lowCount" INTEGER NOT NULL DEFAULT 0,
      findings JSONB NOT NULL DEFAULT '[]'::jsonb,
      "passedGates" BOOLEAN NOT NULL DEFAULT true,
      "durationMs" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_sec_scan_proj ON forge_security_scans("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_sec_scan_time ON forge_security_scans("createdAt");
  `);

  // 52. Feature Flags & Remote Configuration (Module 56)
  await execSafe("forge_feature_flags table", `
    CREATE TABLE IF NOT EXISTS forge_feature_flags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      key VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      type VARCHAR(30) NOT NULL DEFAULT 'BOOLEAN',
      "defaultValue" JSONB NOT NULL DEFAULT 'false'::jsonb,
      "environmentOverrides" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "rolloutPercentage" INTEGER NOT NULL DEFAULT 100,
      "targetingRules" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "isEnabled" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", key)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ff_proj ON forge_feature_flags("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_ff_key ON forge_feature_flags("projectId", key);
  `);

  await execSafe("forge_remote_configs table", `
    CREATE TABLE IF NOT EXISTS forge_remote_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      key VARCHAR(100) NOT NULL,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      "valueType" VARCHAR(30) NOT NULL DEFAULT 'JSON',
      description TEXT,
      environment VARCHAR(50) NOT NULL DEFAULT 'all',
      version INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", key, environment)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_rc_proj ON forge_remote_configs("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_rc_key ON forge_remote_configs("projectId", key);
  `);

  // 53. Optimization Engine (Module 62)
  await execSafe("forge_optimization_audits table", `
    CREATE TABLE IF NOT EXISTS forge_optimization_audits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      score INTEGER NOT NULL DEFAULT 100,
      "totalBytes" INTEGER NOT NULL DEFAULT 0,
      "estimatedGzipBytes" INTEGER NOT NULL DEFAULT 0,
      "deadCodeCount" INTEGER NOT NULL DEFAULT 0,
      "heavyDepCount" INTEGER NOT NULL DEFAULT 0,
      "recommendationsCount" INTEGER NOT NULL DEFAULT 0,
      metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
      recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_opt_audit_proj ON forge_optimization_audits("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_opt_audit_time ON forge_optimization_audits("createdAt");
  `);

  // 54. Project Snapshot / Checkpoint / Recovery (Module 63)
  await execSafe("forge_project_checkpoints table", `
    CREATE TABLE IF NOT EXISTS forge_project_checkpoints (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      tag VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
      "filesCount" INTEGER NOT NULL DEFAULT 0,
      "totalBytes" INTEGER NOT NULL DEFAULT 0,
      "filesSnapshot" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "manifestSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "databaseSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "configSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdById" UUID REFERENCES users(id) ON DELETE SET NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_chkpt_proj ON forge_project_checkpoints("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_chkpt_tag ON forge_project_checkpoints("projectId", tag);
  `);

  await execSafe("forge_checkpoint_restores table", `
    CREATE TABLE IF NOT EXISTS forge_checkpoint_restores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "checkpointId" UUID NOT NULL REFERENCES forge_project_checkpoints(id) ON DELETE CASCADE,
      status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
      "filesRestoredCount" INTEGER NOT NULL DEFAULT 0,
      "filesDeletedCount" INTEGER NOT NULL DEFAULT 0,
      "durationMs" INTEGER NOT NULL DEFAULT 0,
      "restoreLog" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "restoredById" UUID REFERENCES users(id) ON DELETE SET NULL,
      "restoredAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_restore_proj ON forge_checkpoint_restores("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_restore_chkpt ON forge_checkpoint_restores("checkpointId");
  `);

  // ============================================================
  // Modules 57–61: Collaborative Development, Extension & Plugin SDK,
  // Project Import & Migration, Monorepo & Multi-service Support,
  // Container & Infrastructure Tooling
  // ============================================================

  // 55. Module 57: Collaborative Development
  await execSafe("forge_collaboration_sessions table", `
    CREATE TABLE IF NOT EXISTS forge_collaboration_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "socketId" VARCHAR(100),
      "activeFile" VARCHAR(1000),
      "cursorLine" INTEGER,
      "cursorColumn" INTEGER,
      selection JSONB DEFAULT '{}'::jsonb,
      "activePanel" VARCHAR(100),
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      "lastActiveAt" TIMESTAMPTZ DEFAULT now(),
      "createdAt" TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_collab_sess_proj ON forge_collaboration_sessions("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_collab_sess_user ON forge_collaboration_sessions("userId");
  `);

  await execSafe("forge_file_sessions table", `
    CREATE TABLE IF NOT EXISTS forge_file_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "filePath" VARCHAR(1000) NOT NULL,
      "currentRevision" INTEGER NOT NULL DEFAULT 1,
      "lockedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
      "lockedAt" TIMESTAMPTZ,
      "activeEditors" JSONB DEFAULT '[]'::jsonb,
      "updatedAt" TIMESTAMPTZ DEFAULT now(),
      UNIQUE("projectId", "filePath")
    );
    CREATE INDEX IF NOT EXISTS idx_forge_file_sess_proj ON forge_file_sessions("projectId");
  `);

  await execSafe("forge_file_comments table", `
    CREATE TABLE IF NOT EXISTS forge_file_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "filePath" VARCHAR(1000) NOT NULL,
      "authorId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "parentCommentId" UUID REFERENCES forge_file_comments(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      "startLine" INTEGER,
      "endLine" INTEGER,
      "startColumn" INTEGER,
      "endColumn" INTEGER,
      "selectedCodeSnippet" TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
      "resolvedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
      "resolvedAt" TIMESTAMPTZ,
      mentions TEXT[] DEFAULT '{}',
      reactions JSONB DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ DEFAULT now(),
      "updatedAt" TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_comment_proj ON forge_file_comments("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_comment_file ON forge_file_comments("projectId", "filePath");
    CREATE INDEX IF NOT EXISTS idx_forge_comment_author ON forge_file_comments("authorId");
  `);

  await execSafe("forge_review_requests table", `
    CREATE TABLE IF NOT EXISTS forge_review_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "requesterId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      "sourceBranch" VARCHAR(255) DEFAULT 'main',
      "targetBranch" VARCHAR(255) DEFAULT 'main',
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      reviewers UUID[] DEFAULT '{}',
      "assignedAt" TIMESTAMPTZ DEFAULT now(),
      "completedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ DEFAULT now(),
      "updatedAt" TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_review_proj ON forge_review_requests("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_review_req ON forge_review_requests("requesterId");
  `);

  await execSafe("forge_review_comments table", `
    CREATE TABLE IF NOT EXISTS forge_review_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "reviewId" UUID NOT NULL REFERENCES forge_review_requests(id) ON DELETE CASCADE,
      "authorId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "filePath" VARCHAR(1000),
      line INTEGER,
      comment TEXT NOT NULL,
      suggestion TEXT,
      "isResolved" BOOLEAN DEFAULT false,
      "createdAt" TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_rev_comment_rev ON forge_review_comments("reviewId");
  `);

  await execSafe("forge_review_approvals table", `
    CREATE TABLE IF NOT EXISTS forge_review_approvals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "reviewId" UUID NOT NULL REFERENCES forge_review_requests(id) ON DELETE CASCADE,
      "reviewerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      decision VARCHAR(30) NOT NULL,
      feedback TEXT,
      "decidedAt" TIMESTAMPTZ DEFAULT now(),
      UNIQUE("reviewId", "reviewerId")
    );
    CREATE INDEX IF NOT EXISTS idx_forge_rev_appr_rev ON forge_review_approvals("reviewId");
  `);

  await execSafe("forge_shared_preview_sessions table", `
    CREATE TABLE IF NOT EXISTS forge_shared_preview_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "createdById" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(100) UNIQUE NOT NULL,
      "currentRoute" VARCHAR(500) DEFAULT '/',
      viewport JSONB DEFAULT '{"width": 1280, "height": 800}'::jsonb,
      "isSyncActive" BOOLEAN DEFAULT true,
      "allowedUsers" UUID[] DEFAULT '{}',
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "createdAt" TIMESTAMPTZ DEFAULT now(),
      "updatedAt" TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_shared_prev_proj ON forge_shared_preview_sessions("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_shared_prev_tok ON forge_shared_preview_sessions(token);
  `);

  await execSafe("forge_activity_events table", `
    CREATE TABLE IF NOT EXISTS forge_activity_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "actorId" UUID REFERENCES users(id) ON DELETE SET NULL,
      category VARCHAR(50) NOT NULL,
      action VARCHAR(100) NOT NULL,
      "targetResource" VARCHAR(500) NOT NULL,
      details JSONB DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_act_evt_proj ON forge_activity_events("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_act_evt_cat ON forge_activity_events(category);
    CREATE INDEX IF NOT EXISTS idx_forge_act_evt_time ON forge_activity_events("createdAt");
  `);

  // 56. Module 58: Forge Extension & Plugin SDK
  await execSafe("forge_plugins table", `
    CREATE TABLE IF NOT EXISTS forge_plugins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "pluginId" VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
      description TEXT,
      author VARCHAR(255) NOT NULL,
      "trustLevel" VARCHAR(50) NOT NULL DEFAULT 'UNTRUSTED',
      "isOfficial" BOOLEAN DEFAULT false,
      "isPrivate" BOOLEAN DEFAULT false,
      "organizationId" UUID REFERENCES organizations(id) ON DELETE SET NULL,
      manifest JSONB NOT NULL,
      rating NUMERIC(3,2) DEFAULT 5.0,
      "downloadsCount" INTEGER DEFAULT 0,
      "createdAt" TIMESTAMPTZ DEFAULT now(),
      "updatedAt" TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_plugin_id ON forge_plugins("pluginId");
    CREATE INDEX IF NOT EXISTS idx_forge_plugin_trust ON forge_plugins("trustLevel");
  `);

  await execSafe("forge_plugin_versions table", `
    CREATE TABLE IF NOT EXISTS forge_plugin_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "pluginId" UUID NOT NULL REFERENCES forge_plugins(id) ON DELETE CASCADE,
      version VARCHAR(50) NOT NULL,
      manifest JSONB NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      signature TEXT,
      "entrypointUrl" TEXT,
      "publishedAt" TIMESTAMPTZ DEFAULT now(),
      UNIQUE("pluginId", version)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_plugin_ver_plug ON forge_plugin_versions("pluginId");
  `);

  await execSafe("forge_plugin_installations table", `
    CREATE TABLE IF NOT EXISTS forge_plugin_installations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "pluginId" UUID NOT NULL REFERENCES forge_plugins(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "installedById" UUID REFERENCES users(id) ON DELETE SET NULL,
      version VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'ENABLED',
      config JSONB DEFAULT '{}'::jsonb,
      "healthStatus" VARCHAR(50) DEFAULT 'HEALTHY',
      "lastHealthCheck" TIMESTAMPTZ DEFAULT now(),
      "installedAt" TIMESTAMPTZ DEFAULT now(),
      "updatedAt" TIMESTAMPTZ DEFAULT now(),
      UNIQUE("pluginId", "projectId")
    );
    CREATE INDEX IF NOT EXISTS idx_forge_plugin_inst_proj ON forge_plugin_installations("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_plugin_inst_plug ON forge_plugin_installations("pluginId");
  `);

  await execSafe("forge_plugin_permissions table", `
    CREATE TABLE IF NOT EXISTS forge_plugin_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "installationId" UUID NOT NULL REFERENCES forge_plugin_installations(id) ON DELETE CASCADE,
      permission VARCHAR(100) NOT NULL,
      "isGranted" BOOLEAN NOT NULL DEFAULT true,
      "grantedAt" TIMESTAMPTZ DEFAULT now(),
      "grantedById" UUID REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE("installationId", permission)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_plugin_perm_inst ON forge_plugin_permissions("installationId");
  `);

  await execSafe("forge_plugin_trust_records table", `
    CREATE TABLE IF NOT EXISTS forge_plugin_trust_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "pluginId" UUID NOT NULL REFERENCES forge_plugins(id) ON DELETE CASCADE,
      "publisherIdentity" VARCHAR(255) NOT NULL,
      "signatureAlgorithm" VARCHAR(100) DEFAULT 'ED25519',
      "publicKeyFingerprint" VARCHAR(128),
      "isVerified" BOOLEAN DEFAULT false,
      "verifiedAt" TIMESTAMPTZ,
      "revokedAt" TIMESTAMPTZ,
      "revocationReason" TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_plugin_trust_plug ON forge_plugin_trust_records("pluginId");
  `);

  await execSafe("forge_plugin_executions table", `
    CREATE TABLE IF NOT EXISTS forge_plugin_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "installationId" UUID NOT NULL REFERENCES forge_plugin_installations(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "hookType" VARCHAR(50) NOT NULL,
      "actionName" VARCHAR(100) NOT NULL,
      "durationMs" INTEGER DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
      "errorMessage" TEXT,
      "executedAt" TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_plug_exec_inst ON forge_plugin_executions("installationId");
    CREATE INDEX IF NOT EXISTS idx_forge_plug_exec_proj ON forge_plugin_executions("projectId");
  `);

  // 57. Module 59: Project Import & Migration
  await execSafe("forge_import_jobs table", `
    CREATE TABLE IF NOT EXISTS forge_import_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID REFERENCES forge_projects(id) ON DELETE CASCADE,
      "ownerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "sourceType" VARCHAR(50) NOT NULL,
      "sourceUrl" TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'ACQUIRING',
      stage VARCHAR(50) NOT NULL DEFAULT 'DISCOVER',
      "progressPercent" INTEGER DEFAULT 0,
      "stagedPath" TEXT,
      "errorMessage" TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT now(),
      "updatedAt" TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_imp_job_owner ON forge_import_jobs("ownerId");
    CREATE INDEX IF NOT EXISTS idx_forge_imp_job_proj ON forge_import_jobs("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_imp_job_status ON forge_import_jobs(status);
  `);

  await execSafe("forge_import_sources table", `
    CREATE TABLE IF NOT EXISTS forge_import_sources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "jobId" UUID NOT NULL REFERENCES forge_import_jobs(id) ON DELETE CASCADE,
      "archiveName" VARCHAR(255),
      "repoOwner" VARCHAR(255),
      "repoName" VARCHAR(255),
      "defaultBranch" VARCHAR(100) DEFAULT 'main',
      "commitHash" VARCHAR(64),
      "totalFiles" INTEGER DEFAULT 0,
      "totalBytes" BIGINT DEFAULT 0,
      "detectedType" VARCHAR(50) DEFAULT 'NODE',
      "createdAt" TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_imp_src_job ON forge_import_sources("jobId");
  `);

  await execSafe("forge_import_analyses table", `
    CREATE TABLE IF NOT EXISTS forge_import_analyses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "jobId" UUID NOT NULL REFERENCES forge_import_jobs(id) ON DELETE CASCADE,
      framework VARCHAR(100) NOT NULL DEFAULT 'UNKNOWN',
      "frameworkVersion" VARCHAR(50),
      runtime VARCHAR(100) NOT NULL DEFAULT 'node',
      "runtimeVersion" VARCHAR(50),
      "packageManager" VARCHAR(50) NOT NULL DEFAULT 'npm',
      "buildTools" TEXT[] DEFAULT '{}',
      scripts JSONB DEFAULT '{}'::jsonb,
      "envReferences" TEXT[] DEFAULT '{}',
      "discoveredSecretKeys" TEXT[] DEFAULT '{}',
      "isMonorepo" BOOLEAN DEFAULT false,
      "createdAt" TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_imp_ana_job ON forge_import_analyses("jobId");
  `);

  await execSafe("forge_import_reports table", `
    CREATE TABLE IF NOT EXISTS forge_import_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "jobId" UUID NOT NULL REFERENCES forge_import_jobs(id) ON DELETE CASCADE,
      "overallScore" INTEGER DEFAULT 100,
      "compatibilityLevel" VARCHAR(50) DEFAULT 'COMPATIBLE',
      "unsupportedPatterns" JSONB DEFAULT '[]'::jsonb,
      recommendations JSONB DEFAULT '[]'::jsonb,
      "filesIndexedCount" INTEGER DEFAULT 0,
      "symbolsIndexedCount" INTEGER DEFAULT 0,
      "routesDiscovered" JSONB DEFAULT '[]'::jsonb,
      "apisDiscovered" JSONB DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_imp_rep_job ON forge_import_reports("jobId");
  `);

  await execSafe("forge_migration_plans table", `
    CREATE TABLE IF NOT EXISTS forge_migration_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "jobId" UUID NOT NULL REFERENCES forge_import_jobs(id) ON DELETE CASCADE,
      "projectId" UUID REFERENCES forge_projects(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      "recommendedSteps" JSONB DEFAULT '[]'::jsonb,
      "configPatches" JSONB DEFAULT '[]'::jsonb,
      "dependencyChanges" JSONB DEFAULT '[]'::jsonb,
      status VARCHAR(50) NOT NULL DEFAULT 'PROPOSED',
      "appliedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_mig_plan_job ON forge_migration_plans("jobId");
  `);

  // 58. Module 60: Monorepo & Multi-service Support
  await execSafe("forge_monorepo_workspaces table", `
    CREATE TABLE IF NOT EXISTS forge_monorepo_workspaces (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL UNIQUE REFERENCES forge_projects(id) ON DELETE CASCADE,
      "managerType" VARCHAR(50) NOT NULL DEFAULT 'npm',
      "rootConfig" JSONB DEFAULT '{}'::jsonb,
      "packageCount" INTEGER DEFAULT 0,
      "serviceCount" INTEGER DEFAULT 0,
      "hasCircularDependencies" BOOLEAN DEFAULT false,
      "lastScannedAt" TIMESTAMPTZ DEFAULT now(),
      "createdAt" TIMESTAMPTZ DEFAULT now(),
      "updatedAt" TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_mono_ws_proj ON forge_monorepo_workspaces("projectId");
  `);

  await execSafe("forge_workspace_packages table", `
    CREATE TABLE IF NOT EXISTS forge_workspace_packages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "workspaceId" UUID NOT NULL REFERENCES forge_monorepo_workspaces(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      path VARCHAR(1000) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'PACKAGE',
      version VARCHAR(50) DEFAULT '1.0.0',
      scripts JSONB DEFAULT '{}'::jsonb,
      "isPrivate" BOOLEAN DEFAULT false,
      "createdAt" TIMESTAMPTZ DEFAULT now(),
      UNIQUE("workspaceId", name)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ws_pkg_ws ON forge_workspace_packages("workspaceId");
    CREATE INDEX IF NOT EXISTS idx_forge_ws_pkg_proj ON forge_workspace_packages("projectId");
  `);

  await execSafe("forge_package_dependencies table", `
    CREATE TABLE IF NOT EXISTS forge_package_dependencies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "workspaceId" UUID NOT NULL REFERENCES forge_monorepo_workspaces(id) ON DELETE CASCADE,
      "fromPackage" VARCHAR(255) NOT NULL,
      "toPackage" VARCHAR(255) NOT NULL,
      "dependencyType" VARCHAR(50) NOT NULL DEFAULT 'INTERNAL',
      "versionRange" VARCHAR(100),
      "createdAt" TIMESTAMPTZ DEFAULT now(),
      UNIQUE("workspaceId", "fromPackage", "toPackage")
    );
    CREATE INDEX IF NOT EXISTS idx_forge_pkg_dep_ws ON forge_package_dependencies("workspaceId");
  `);

  await execSafe("forge_service_runtimes table", `
    CREATE TABLE IF NOT EXISTS forge_service_runtimes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "packageId" UUID NOT NULL REFERENCES forge_workspace_packages(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "serviceName" VARCHAR(255) NOT NULL,
      "assignedPort" INTEGER NOT NULL,
      "startCommand" VARCHAR(500) NOT NULL,
      "envOverrides" JSONB DEFAULT '{}'::jsonb,
      "healthEndpoint" VARCHAR(255) DEFAULT '/health',
      status VARCHAR(50) NOT NULL DEFAULT 'STOPPED',
      "lastStartedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ DEFAULT now(),
      "updatedAt" TIMESTAMPTZ DEFAULT now(),
      UNIQUE("projectId", "serviceName")
    );
    CREATE INDEX IF NOT EXISTS idx_forge_srv_rt_proj ON forge_service_runtimes("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_srv_rt_pkg ON forge_service_runtimes("packageId");
  `);

  await execSafe("forge_coordinated_deployments table", `
    CREATE TABLE IF NOT EXISTS forge_coordinated_deployments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      stages JSONB NOT NULL DEFAULT '[]'::jsonb,
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      "targetServices" TEXT[] DEFAULT '{}',
      logs JSONB DEFAULT '[]'::jsonb,
      "startedAt" TIMESTAMPTZ,
      "completedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_coord_dep_proj ON forge_coordinated_deployments("projectId");
  `);

  // 59. Module 61: Container & Infrastructure Tooling
  await execSafe("forge_container_definitions table", `
    CREATE TABLE IF NOT EXISTS forge_container_definitions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      "filePath" VARCHAR(1000) NOT NULL DEFAULT 'Dockerfile',
      "dockerfileContent" TEXT NOT NULL,
      "baseImage" VARCHAR(255) NOT NULL,
      "isMultiStage" BOOLEAN DEFAULT false,
      stages JSONB DEFAULT '[]'::jsonb,
      "exposedPorts" INTEGER[] DEFAULT '{}',
      entrypoint TEXT[] DEFAULT '{}',
      cmd TEXT[] DEFAULT '{}',
      "isGenerated" BOOLEAN DEFAULT false,
      "createdAt" TIMESTAMPTZ DEFAULT now(),
      "updatedAt" TIMESTAMPTZ DEFAULT now(),
      UNIQUE("projectId", "filePath")
    );
    CREATE INDEX IF NOT EXISTS idx_forge_cont_def_proj ON forge_container_definitions("projectId");
  `);

  await execSafe("forge_container_builds table", `
    CREATE TABLE IF NOT EXISTS forge_container_builds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "definitionId" UUID NOT NULL REFERENCES forge_container_definitions(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      tag VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'BUILDING',
      digest VARCHAR(128),
      "sizeBytes" BIGINT DEFAULT 0,
      "durationMs" INTEGER DEFAULT 0,
      "buildLogs" TEXT DEFAULT '',
      "errorMessage" TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT now(),
      "completedAt" TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_forge_cont_bld_def ON forge_container_builds("definitionId");
    CREATE INDEX IF NOT EXISTS idx_forge_cont_bld_proj ON forge_container_builds("projectId");
  `);

  await execSafe("forge_container_runs table", `
    CREATE TABLE IF NOT EXISTS forge_container_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "definitionId" UUID NOT NULL REFERENCES forge_container_definitions(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "containerName" VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'RUNNING',
      "portBindings" JSONB DEFAULT '{}'::jsonb,
      "volumeBindings" JSONB DEFAULT '[]'::jsonb,
      "envVars" JSONB DEFAULT '{}'::jsonb,
      "memoryLimitMb" INTEGER DEFAULT 512,
      "cpuQuotaPercent" INTEGER DEFAULT 100,
      logs TEXT DEFAULT '',
      "startedAt" TIMESTAMPTZ DEFAULT now(),
      "stoppedAt" TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_forge_cont_run_def ON forge_container_runs("definitionId");
    CREATE INDEX IF NOT EXISTS idx_forge_cont_run_proj ON forge_container_runs("projectId");
  `);

  await execSafe("forge_compose_definitions table", `
    CREATE TABLE IF NOT EXISTS forge_compose_definitions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "filePath" VARCHAR(1000) NOT NULL DEFAULT 'docker-compose.yml',
      content TEXT NOT NULL,
      version VARCHAR(50) DEFAULT '3.8',
      services JSONB NOT NULL DEFAULT '{}'::jsonb,
      networks JSONB DEFAULT '{}'::jsonb,
      volumes JSONB DEFAULT '{}'::jsonb,
      "isValid" BOOLEAN DEFAULT true,
      "validationErrors" TEXT[] DEFAULT '{}',
      "createdAt" TIMESTAMPTZ DEFAULT now(),
      "updatedAt" TIMESTAMPTZ DEFAULT now(),
      UNIQUE("projectId", "filePath")
    );
    CREATE INDEX IF NOT EXISTS idx_forge_comp_def_proj ON forge_compose_definitions("projectId");
  `);

  await execSafe("forge_infrastructure_definitions table", `
    CREATE TABLE IF NOT EXISTS forge_infrastructure_definitions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "targetType" VARCHAR(50) NOT NULL,
      environment VARCHAR(50) NOT NULL DEFAULT 'development',
      name VARCHAR(255) NOT NULL,
      files JSONB NOT NULL DEFAULT '{}'::jsonb,
      "resourceManifests" JSONB DEFAULT '[]'::jsonb,
      "secretReferences" TEXT[] DEFAULT '{}',
      status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
      "createdAt" TIMESTAMPTZ DEFAULT now(),
      "updatedAt" TIMESTAMPTZ DEFAULT now(),
      UNIQUE("projectId", "targetType", environment, name)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_infra_def_proj ON forge_infrastructure_definitions("projectId");
  `);

  await execSafe("forge_infrastructure_validations table", `
    CREATE TABLE IF NOT EXISTS forge_infrastructure_validations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "infraId" UUID NOT NULL REFERENCES forge_infrastructure_definitions(id) ON DELETE CASCADE,
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "isValid" BOOLEAN NOT NULL DEFAULT true,
      "syntaxErrors" TEXT[] DEFAULT '{}',
      "securityScore" INTEGER DEFAULT 100,
      "detectedSecrets" TEXT[] DEFAULT '{}',
      "dangerousConfigs" TEXT[] DEFAULT '{}',
      summary TEXT,
      "validatedAt" TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_infra_val_inf ON forge_infrastructure_validations("infraId");
    CREATE INDEX IF NOT EXISTS idx_forge_infra_val_proj ON forge_infrastructure_validations("projectId");
  `);

  // =========================================================================
  // Milestone 1: Feature 35 (Code Intelligence) & Feature 36 (Knowledge Graph)
  // =========================================================================
  await execSafe("forge_code_symbols table", `
    CREATE TABLE IF NOT EXISTS forge_code_symbols (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "fileId" UUID NOT NULL REFERENCES forge_project_files(id) ON DELETE CASCADE,
      "filePath" VARCHAR(1000) NOT NULL,
      name VARCHAR(255) NOT NULL,
      kind VARCHAR(50) NOT NULL,
      "containerName" VARCHAR(255),
      "startLine" INTEGER NOT NULL,
      "startCol" INTEGER NOT NULL,
      "endLine" INTEGER NOT NULL,
      "endCol" INTEGER NOT NULL,
      "startOffset" INTEGER NOT NULL,
      "endOffset" INTEGER NOT NULL,
      signature TEXT,
      documentation TEXT,
      "isExported" BOOLEAN NOT NULL DEFAULT false,
      "isDefaultExport" BOOLEAN NOT NULL DEFAULT false,
      metadata JSONB DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_sym_proj ON forge_code_symbols("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_sym_file ON forge_code_symbols("fileId");
    CREATE INDEX IF NOT EXISTS idx_forge_sym_name ON forge_code_symbols("projectId", name);
    CREATE INDEX IF NOT EXISTS idx_forge_sym_kind ON forge_code_symbols("projectId", kind);
    CREATE INDEX IF NOT EXISTS idx_forge_sym_path ON forge_code_symbols("projectId", "filePath");
  `);

  await execSafe("forge_code_references table", `
    CREATE TABLE IF NOT EXISTS forge_code_references (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "sourceFileId" UUID NOT NULL REFERENCES forge_project_files(id) ON DELETE CASCADE,
      "sourceFilePath" VARCHAR(1000) NOT NULL,
      "targetSymbolId" UUID REFERENCES forge_code_symbols(id) ON DELETE CASCADE,
      "symbolName" VARCHAR(255) NOT NULL,
      kind VARCHAR(50) NOT NULL,
      line INTEGER NOT NULL,
      col INTEGER NOT NULL,
      snippet TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_ref_proj ON forge_code_references("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_ref_file ON forge_code_references("sourceFileId");
    CREATE INDEX IF NOT EXISTS idx_forge_ref_target ON forge_code_references("targetSymbolId");
    CREATE INDEX IF NOT EXISTS idx_forge_ref_sym ON forge_code_references("projectId", "symbolName");
  `);

  await execSafe("forge_file_dependencies table", `
    CREATE TABLE IF NOT EXISTS forge_file_dependencies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "sourceFileId" UUID NOT NULL REFERENCES forge_project_files(id) ON DELETE CASCADE,
      "sourceFilePath" VARCHAR(1000) NOT NULL,
      "targetFilePath" VARCHAR(1000) NOT NULL,
      "targetFileId" UUID REFERENCES forge_project_files(id) ON DELETE SET NULL,
      specifier VARCHAR(1000) NOT NULL,
      "isExternal" BOOLEAN NOT NULL DEFAULT false,
      "importedSymbols" JSONB DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_fdep_proj ON forge_file_dependencies("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_fdep_src ON forge_file_dependencies("sourceFileId");
    CREATE INDEX IF NOT EXISTS idx_forge_fdep_tgt ON forge_file_dependencies("projectId", "targetFilePath");
  `);

  await execSafe("forge_index_status table", `
    CREATE TABLE IF NOT EXISTS forge_index_status (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL UNIQUE REFERENCES forge_projects(id) ON DELETE CASCADE,
      status VARCHAR(50) NOT NULL DEFAULT 'IDLE',
      "totalFiles" INTEGER NOT NULL DEFAULT 0,
      "indexedFiles" INTEGER NOT NULL DEFAULT 0,
      "totalSymbols" INTEGER NOT NULL DEFAULT 0,
      "parserErrors" JSONB DEFAULT '[]'::jsonb,
      "fileHashes" JSONB DEFAULT '{}'::jsonb,
      "lastIndexedAt" TIMESTAMPTZ,
      "durationMs" INTEGER DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_idx_status_proj ON forge_index_status("projectId");
  `);

  await execSafe("forge_knowledge_graph_nodes table", `
    CREATE TABLE IF NOT EXISTS forge_knowledge_graph_nodes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "nodeKey" VARCHAR(500) NOT NULL,
      name VARCHAR(255) NOT NULL,
      "nodeType" VARCHAR(50) NOT NULL,
      "filePath" VARCHAR(1000),
      "symbolId" UUID REFERENCES forge_code_symbols(id) ON DELETE CASCADE,
      metadata JSONB DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", "nodeKey")
    );
    CREATE INDEX IF NOT EXISTS idx_forge_kg_nodes_proj ON forge_knowledge_graph_nodes("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_kg_nodes_type ON forge_knowledge_graph_nodes("projectId", "nodeType");
    CREATE INDEX IF NOT EXISTS idx_forge_kg_nodes_sym ON forge_knowledge_graph_nodes("symbolId");
  `);

  await execSafe("forge_knowledge_graph_edges table", `
    CREATE TABLE IF NOT EXISTS forge_knowledge_graph_edges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "sourceNodeId" UUID NOT NULL REFERENCES forge_knowledge_graph_nodes(id) ON DELETE CASCADE,
      "targetNodeId" UUID NOT NULL REFERENCES forge_knowledge_graph_nodes(id) ON DELETE CASCADE,
      "edgeType" VARCHAR(50) NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", "sourceNodeId", "targetNodeId", "edgeType")
    );
    CREATE INDEX IF NOT EXISTS idx_forge_kg_edges_proj ON forge_knowledge_graph_edges("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_kg_edges_src ON forge_knowledge_graph_edges("sourceNodeId");
    CREATE INDEX IF NOT EXISTS idx_forge_kg_edges_tgt ON forge_knowledge_graph_edges("targetNodeId");
    CREATE INDEX IF NOT EXISTS idx_forge_kg_edges_type ON forge_knowledge_graph_edges("edgeType");
  `);

  // =========================================================================
  // Milestone A: Features 34, 33, 32 (Design System, Component Registry, Project Templates)
  // =========================================================================
  await execSafe("forge_design_tokens table", `
    CREATE TABLE IF NOT EXISTS forge_design_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      category VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      value JSONB NOT NULL,
      "resolvedValue" JSONB,
      theme VARCHAR(50) NOT NULL DEFAULT 'default',
      description TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", category, name, theme)
    );
    CREATE INDEX IF NOT EXISTS idx_forge_tokens_proj ON forge_design_tokens("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_tokens_cat ON forge_design_tokens("projectId", category);
  `);

  await execSafe("forge_component_registry table", `
    CREATE TABLE IF NOT EXISTS forge_component_registry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      "filePath" VARCHAR(1000) NOT NULL,
      version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
      description TEXT,
      "propsSchema" JSONB DEFAULT '{}'::jsonb,
      variants JSONB DEFAULT '[]'::jsonb,
      dependencies TEXT[] DEFAULT '{}',
      tags TEXT[] DEFAULT '{}',
      "previewSnippet" TEXT,
      "isExported" BOOLEAN NOT NULL DEFAULT true,
      metadata JSONB DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE("projectId", name, "filePath")
    );
    CREATE INDEX IF NOT EXISTS idx_forge_comp_reg_proj ON forge_component_registry("projectId");
    CREATE INDEX IF NOT EXISTS idx_forge_comp_reg_name ON forge_component_registry("projectId", name);
  `);

  await execSafe("forge_project_templates table", `
    CREATE TABLE IF NOT EXISTS forge_project_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "templateId" VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      framework VARCHAR(50) NOT NULL,
      category VARCHAR(50) NOT NULL,
      version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
      dependencies JSONB NOT NULL DEFAULT '{}'::jsonb,
      "devDependencies" JSONB NOT NULL DEFAULT '{}'::jsonb,
      files JSONB NOT NULL DEFAULT '[]'::jsonb,
      "defaultConfig" JSONB DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_proj_tmpl_id ON forge_project_templates("templateId");
  `);

  // 38. Data Platform Tables (Module 25 - 28)
  await execSafe("data platform enums", `
    DO $$ BEGIN
      CREATE TYPE "DatabaseEnvironment" AS ENUM ('PRODUCTION', 'STAGING', 'DEVELOPMENT');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
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
  `);

  await execSafe("project_databases table", `
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
  `);

  await execSafe("project_database_backups table", `
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
  `);

  await execSafe("database_migration_records table", `
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
  `);

  await execSafe("project_api_keys table", `
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
  `);

  await execSafe("storage_buckets table", `
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
  `);

  await execSafe("storage_objects table", `
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
  `);

  // Databases created before Prisma's enum have STAGING but not PREVIEW (and vice versa); both
  // labels are kept valid so neither API value fails at the database (additive, nothing renamed).
  await execSafe("database environment enum labels", `
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DatabaseEnvironment') THEN
        ALTER TYPE "DatabaseEnvironment" ADD VALUE IF NOT EXISTS 'PREVIEW';
        ALTER TYPE "DatabaseEnvironment" ADD VALUE IF NOT EXISTS 'STAGING';
      END IF;
    END $$;
  `);

  // Recoverable CMS entry trash and approved purge requests (blueprint §10).
  await execSafe("content trash and purge requests", `
ALTER TABLE "custom_entries" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "custom_entries" ADD COLUMN IF NOT EXISTS "deletedById" UUID;
ALTER TABLE "custom_entries" ADD COLUMN IF NOT EXISTS "deleteReason" TEXT;

CREATE TABLE IF NOT EXISTS "content_purge_requests" (
  "id" UUID NOT NULL,
  "websiteId" UUID NOT NULL,
  "manifest" JSONB NOT NULL,
  "manifestHash" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "requestedById" UUID NOT NULL,
  "approvedById" UUID,
  "approvedAt" TIMESTAMP(3),
  "singleOwnerException" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "executedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "content_purge_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "content_purge_requests_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "content_purge_requests_websiteId_status_idx" ON "content_purge_requests"("websiteId", "status");
  `);

  // Durable Visual Editor <-> Code Workspace checkpoints (blueprint §33.3, §34).
  await execSafe("forge_workspace_checkpoints table", `
    CREATE TABLE IF NOT EXISTS forge_workspace_checkpoints (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      sequence BIGINT NOT NULL,
      origin VARCHAR(16) NOT NULL CHECK (origin IN ('CODE', 'VISUAL')),
      kind VARCHAR(16) NOT NULL CHECK (kind IN ('SYNCHRONIZED', 'DRAFT', 'CONFLICT', 'SOURCE_ONLY')),
      "filePath" TEXT,
      message TEXT,
      "documentVersion" INTEGER,
      "documentHash" VARCHAR(64),
      "sourceManifest" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "changeSetId" VARCHAR(128),
      response JSONB,
      "createdById" UUID,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_workspace_checkpoint_sequence UNIQUE ("projectId", sequence),
      CONSTRAINT uq_workspace_checkpoint_change_set UNIQUE ("projectId", "changeSetId")
    );
  `);

  // Full-stack application generation runs (blueprint §38): durable job state and evidence.
  await execSafe("forge_app_generation_runs table", `
    CREATE TABLE IF NOT EXISTS forge_app_generation_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "requestedById" UUID NOT NULL,
      mode VARCHAR(32) NOT NULL CHECK (mode IN ('AI_PROVIDER', 'APPROVED_TEMPLATE')),
      status VARCHAR(32) NOT NULL,
      brief TEXT NOT NULL DEFAULT '',
      "templateId" VARCHAR(64),
      "idempotencyKey" VARCHAR(128) NOT NULL,
      "retryOfRunId" UUID REFERENCES forge_app_generation_runs(id) ON DELETE SET NULL,
      provider VARCHAR(32),
      model VARCHAR(128),
      "providerRequestIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "inputTokens" INTEGER,
      "outputTokens" INTEGER,
      "providerCalls" INTEGER NOT NULL DEFAULT 0,
      "repairAttempts" INTEGER NOT NULL DEFAULT 0,
      "appModel" JSONB,
      spec JSONB,
      files JSONB NOT NULL DEFAULT '[]'::jsonb,
      diagnostics JSONB NOT NULL DEFAULT '[]'::jsonb,
      "errorCode" VARCHAR(64),
      "errorMessage" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "completedAt" TIMESTAMPTZ,
      CONSTRAINT uq_app_generation_idempotency UNIQUE ("projectId", "idempotencyKey")
    );
    CREATE INDEX IF NOT EXISTS idx_app_generation_runs_project ON forge_app_generation_runs ("projectId", "createdAt" DESC);
  `);

  await execSafe("custom post type label columns", `
    ALTER TABLE custom_post_types ADD COLUMN IF NOT EXISTS "singular" TEXT;
    ALTER TABLE custom_post_types ADD COLUMN IF NOT EXISTS "plural" TEXT;
    ALTER TABLE custom_post_types ADD COLUMN IF NOT EXISTS "hasArchive" BOOLEAN NOT NULL DEFAULT false;
  `);

  // Same SQL as prisma/migrations/20261013110000_durable_lead_intake.
  await execSafe("durable lead intake", `
    -- Durable lead intake (blueprint §12). Additive only.
    CREATE TABLE IF NOT EXISTS form_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "websiteId" UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
      "formId" VARCHAR(255) NOT NULL,
      "formName" VARCHAR(255) NOT NULL DEFAULT 'Contact Form',
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS "formName" VARCHAR(255) DEFAULT 'Contact Form';
    ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(200);
    ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS "requestHash" CHAR(64);
    ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS "leadId" UUID;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_form_submissions_idempotency
      ON form_submissions ("websiteId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;

    CREATE TABLE IF NOT EXISTS forge_leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "websiteId" UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
      "submissionId" UUID REFERENCES form_submissions(id) ON DELETE SET NULL,
      provenance VARCHAR(30) NOT NULL DEFAULT 'WEBSITE_FORM',
      "formId" VARCHAR(255),
      "displayName" VARCHAR(255),
      email VARCHAR(320),
      phone VARCHAR(64),
      stage VARCHAR(20) NOT NULL DEFAULT 'NEW' CHECK (stage IN ('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST', 'SPAM')),
      "assignedToId" UUID REFERENCES users(id) ON DELETE SET NULL,
      "qualificationEvidence" TEXT,
      revision INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "stageChangedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_leads_website ON forge_leads ("websiteId", "createdAt" DESC);
    CREATE INDEX IF NOT EXISTS idx_forge_leads_website_stage ON forge_leads ("websiteId", stage);

    CREATE TABLE IF NOT EXISTS forge_lead_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "leadId" UUID NOT NULL REFERENCES forge_leads(id) ON DELETE CASCADE,
      "websiteId" UUID NOT NULL,
      "actorId" UUID,
      type VARCHAR(30) NOT NULL,
      "fromStage" VARCHAR(20),
      "toStage" VARCHAR(20),
      note TEXT,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_forge_lead_events_lead ON forge_lead_events ("leadId", "createdAt");
  `);

  // Same SQL as prisma/migrations/20261013120000_durable_workflow_definitions.
  await execSafe("durable workflow definitions", `
    -- Durable, immutable workflow definitions (blueprint §15). Additive only.
    CREATE TABLE IF NOT EXISTS forge_workflow_definitions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "websiteId" UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
      "workflowKey" VARCHAR(100) NOT NULL,
      version INTEGER NOT NULL CHECK (version >= 1),
      status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'DEPRECATED')),
      name VARCHAR(200) NOT NULL,
      definition JSONB NOT NULL,
      "definitionHash" CHAR(64) NOT NULL,
      "createdById" UUID NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "publishedById" UUID,
      "publishedAt" TIMESTAMPTZ,
      CONSTRAINT uq_forge_workflow_version UNIQUE ("websiteId", "workflowKey", version)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_forge_workflow_published
      ON forge_workflow_definitions ("websiteId", "workflowKey") WHERE status = 'PUBLISHED';

    CREATE OR REPLACE FUNCTION forge_workflow_definitions_guard() RETURNS trigger AS $fn$
    BEGIN
      IF NEW."websiteId" IS DISTINCT FROM OLD."websiteId" OR NEW."workflowKey" IS DISTINCT FROM OLD."workflowKey"
         OR NEW.version IS DISTINCT FROM OLD.version OR NEW.name IS DISTINCT FROM OLD.name
         OR NEW.definition IS DISTINCT FROM OLD.definition OR NEW."definitionHash" IS DISTINCT FROM OLD."definitionHash"
         OR NEW."createdById" IS DISTINCT FROM OLD."createdById" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
        RAISE EXCEPTION 'workflow definitions are immutable' USING ERRCODE = 'check_violation';
      END IF;
      IF NEW.status IS DISTINCT FROM OLD.status
         AND NOT ((OLD.status = 'DRAFT' AND NEW.status = 'PUBLISHED') OR (OLD.status = 'PUBLISHED' AND NEW.status = 'DEPRECATED')) THEN
        RAISE EXCEPTION 'illegal workflow status transition % -> %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
      END IF;
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS trg_forge_workflow_definitions_guard ON forge_workflow_definitions;
    CREATE TRIGGER trg_forge_workflow_definitions_guard BEFORE UPDATE ON forge_workflow_definitions
      FOR EACH ROW EXECUTE FUNCTION forge_workflow_definitions_guard();
  `);

  // Same SQL as prisma/migrations/20261013130000_website_purge_requests.
  await execSafe("website purge requests", `
    -- Approved website purge (blueprint §10). Additive only.
    -- Deliberately no foreign key to websites: the request must outlive the website it purges.
    CREATE TABLE IF NOT EXISTS website_purge_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "websiteId" UUID NOT NULL,
      manifest JSONB NOT NULL,
      "manifestHash" CHAR(64) NOT NULL,
      reason VARCHAR(500) NOT NULL,
      "requestedById" UUID NOT NULL,
      "approvedById" UUID,
      "approvedAt" TIMESTAMPTZ,
      "executedById" UUID,
      "executedAt" TIMESTAMPTZ,
      "singleOwnerException" BOOLEAN NOT NULL DEFAULT false,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING_APPROVAL'
        CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'EXECUTING', 'EXECUTED', 'EXPIRED')),
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_website_purge_requests_website ON website_purge_requests ("websiteId", status);
  `);

  // Same SQL as prisma/migrations/20261013140000_environment_bindings.
  await execSafe("environment bindings", `
    -- Persistent environment bindings (blueprint §42.1, WP-17). Additive only.
    -- One row per project and environment class; "secretRef" holds a vault key reference, never a credential.
    CREATE TABLE IF NOT EXISTS forge_environment_bindings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE CASCADE,
      "environmentClass" VARCHAR(20) NOT NULL CHECK ("environmentClass" IN ('DEVELOPMENT', 'STAGING', 'PRODUCTION')),
      "bindingId" VARCHAR(120) NOT NULL,
      version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
      "applicationId" VARCHAR(120) NOT NULL,
      "databaseProvider" VARCHAR(30) NOT NULL DEFAULT 'postgresql',
      "targetFingerprint" CHAR(64) NOT NULL,
      "safeDisplayLabel" VARCHAR(120) NOT NULL,
      "secretRef" VARCHAR(300) NOT NULL CHECK ("secretRef" !~ '://[^/]*:[^/]*@' AND position('password=' in "secretRef") = 0),
      roles JSONB NOT NULL,
      "poolLimits" JSONB NOT NULL,
      "protectionLevel" VARCHAR(30) NOT NULL,
      "verificationHistory" JSONB NOT NULL DEFAULT '[]'::jsonb,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RETIRED')),
      "createdById" UUID,
      "updatedById" UUID,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_forge_environment_binding UNIQUE ("projectId", "environmentClass")
    );
  `);

  // Same SQL as prisma/migrations/20261013150000_website_records_benchmark_runs.
  await execSafe("website records and benchmark runs", `
    -- Durable state for the blueprint v2 feature routers (WP-01, WP-16). Additive only.
    -- One row per website, kind and key. "tenantId" is derived from verified membership, never from the
    -- client. "requestHash" makes a repeated identical write a replay instead of a new revision.
    CREATE TABLE IF NOT EXISTS forge_website_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "websiteId" UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
      "tenantId" VARCHAR(64) NOT NULL,
      kind VARCHAR(40) NOT NULL,
      "recordKey" VARCHAR(200) NOT NULL,
      data JSONB NOT NULL,
      "requestHash" CHAR(64) NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
      "createdById" UUID NOT NULL,
      "updatedById" UUID NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_forge_website_records UNIQUE ("websiteId", kind, "recordKey")
    );

    -- Operator-submitted benchmark runs (blueprint §03). Platform-wide, so there is no website scope.
    CREATE TABLE IF NOT EXISTS forge_benchmark_runs (
      "runId" VARCHAR(64) PRIMARY KEY,
      "requestHash" CHAR(64) NOT NULL,
      report JSONB NOT NULL,
      "recordedById" UUID NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_forge_benchmark_runs_request UNIQUE ("requestHash")
    );
  `);

  // Same SQL as prisma/migrations/20261013170000_tenant_rls_stage1.
  await execSafe("tenant row-level security, stage 1", `
    -- Tenant row-level security, stage 1 (blueprint §18, WP-02/WP-19). Additive and reversible
    -- (prisma/rls/rollback_stage1.sql). It changes nothing for the table owner or a superuser:
    -- policies apply to the restricted roles below, which the application switches to inside a
    -- transaction (platform/tenancy/rls.ts). Stage 2 (prisma/rls/stage2_force.sql) is applied
    -- separately, once every owner-level path to a table has been converted.

    -- Restricted roles. They cannot log in, own nothing and hold only the grants listed here.
    DO $$ BEGIN
      CREATE ROLE forge_tenant_rls NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE ROLE forge_platform_rls NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    -- The application role must be able to switch to them (a superuser can anyway).
    DO $$ BEGIN
      EXECUTE format('GRANT forge_tenant_rls, forge_platform_rls TO %I', current_user);
    EXCEPTION WHEN OTHERS THEN NULL; END $$;
    GRANT USAGE ON SCHEMA public TO forge_tenant_rls, forge_platform_rls;

    -- The tenant authorised for the current transaction. Unset or empty means none; a value that is
    -- not a UUID is an error, so the statement fails rather than matching anything.
    CREATE OR REPLACE FUNCTION forge_current_tenant() RETURNS uuid
      LANGUAGE sql STABLE
      AS $fn$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $fn$;

    -- Ownership differs per table family. A website belongs to its workspace, else its organization,
    -- else its owner; a project to its workspace, else its owner. These run with the owner's rights
    -- so the restricted role needs no access to websites or forge_projects themselves.
    CREATE OR REPLACE FUNCTION forge_website_tenant(site uuid) RETURNS uuid
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
      AS $fn$ SELECT COALESCE(w."workspaceId", w."organizationId", w."userId") FROM websites w WHERE w.id = site $fn$;
    CREATE OR REPLACE FUNCTION forge_project_tenant(project uuid) RETURNS uuid
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
      AS $fn$ SELECT COALESCE(p."workspaceId", p."ownerId") FROM forge_projects p WHERE p.id = project AND p."deletedAt" IS NULL $fn$;
    REVOKE ALL ON FUNCTION forge_website_tenant(uuid), forge_project_tenant(uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION forge_current_tenant(), forge_website_tenant(uuid), forge_project_tenant(uuid) TO forge_tenant_rls;

    -- forge_website_records: owned through its website. A row may only be written with the tenant
    -- of the transaction in its own "tenantId" column.
    ALTER TABLE forge_website_records ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS forge_website_records_tenant ON forge_website_records;
    CREATE POLICY forge_website_records_tenant ON forge_website_records FOR ALL TO forge_tenant_rls
      USING (forge_website_tenant("websiteId") = forge_current_tenant())
      WITH CHECK (forge_website_tenant("websiteId") = forge_current_tenant() AND "tenantId" = forge_current_tenant()::text);
    GRANT SELECT, INSERT, UPDATE ON forge_website_records TO forge_tenant_rls;

    -- forge_workflow_definitions: owned through its website; it has no tenant column of its own.
    ALTER TABLE forge_workflow_definitions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS forge_workflow_definitions_tenant ON forge_workflow_definitions;
    CREATE POLICY forge_workflow_definitions_tenant ON forge_workflow_definitions FOR ALL TO forge_tenant_rls
      USING (forge_website_tenant("websiteId") = forge_current_tenant())
      WITH CHECK (forge_website_tenant("websiteId") = forge_current_tenant());
    GRANT SELECT, INSERT, UPDATE ON forge_workflow_definitions TO forge_tenant_rls;

    -- forge_environment_bindings: owned through its project.
    ALTER TABLE forge_environment_bindings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS forge_environment_bindings_tenant ON forge_environment_bindings;
    CREATE POLICY forge_environment_bindings_tenant ON forge_environment_bindings FOR ALL TO forge_tenant_rls
      USING (forge_project_tenant("projectId") = forge_current_tenant())
      WITH CHECK (forge_project_tenant("projectId") = forge_current_tenant());
    GRANT SELECT, INSERT, UPDATE ON forge_environment_bindings TO forge_tenant_rls;

    -- forge_benchmark_runs: platform data with no tenant. Only the platform role, and only in a
    -- transaction explicitly marked as platform administration. The tenant role has no grant on it.
    ALTER TABLE forge_benchmark_runs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS forge_benchmark_runs_platform ON forge_benchmark_runs;
    CREATE POLICY forge_benchmark_runs_platform ON forge_benchmark_runs FOR ALL TO forge_platform_rls
      USING (current_setting('app.platform_admin', true) = 'on')
      WITH CHECK (current_setting('app.platform_admin', true) = 'on');
    GRANT SELECT, INSERT ON forge_benchmark_runs TO forge_platform_rls;

    -- The workspace lifecycle trigger on website-owned tables checks that the website's workspace is
    -- not archived. It reads websites and workspaces, which the restricted roles cannot (and must
    -- not) read, so it runs with its owner's rights. Its logic does not depend on the caller.
    DO $$ BEGIN
      ALTER FUNCTION forge_workspace_child_admission() SECURITY DEFINER SET search_path = public, pg_temp;
    EXCEPTION WHEN undefined_function THEN NULL; END $$;
  `);

  // Ensure forge_application_spec_revisions table exists (WP-17/WP-20)
  await execSafe("forge_application_spec_revisions table", `
    CREATE TABLE IF NOT EXISTS forge_application_spec_revisions (
      "applicationId" VARCHAR(120) NOT NULL,
      "revision" INTEGER NOT NULL CHECK ("revision" >= 1),
      "parentRevision" INTEGER NOT NULL CHECK ("parentRevision" >= 0),
      "projectId" UUID NOT NULL REFERENCES forge_projects(id) ON DELETE RESTRICT,
      "tenantId" VARCHAR(120) NOT NULL,
      "digest" CHAR(64) NOT NULL CHECK ("digest" ~ '^[a-f0-9]{64}$'),
      "spec" JSONB NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "forge_appspec_revision_pk" PRIMARY KEY ("applicationId", "revision"),
      CONSTRAINT "forge_appspec_parent_chain" CHECK (
        ("revision" = 1 AND "parentRevision" = 0)
        OR ("revision" > 1 AND "parentRevision" = "revision" - 1)
      ),
      CONSTRAINT "forge_appspec_nonempty_identity" CHECK (
        length(trim("applicationId")) > 0 AND length(trim("tenantId")) > 0
      )
    );
    CREATE INDEX IF NOT EXISTS "forge_appspec_project_idx"
      ON forge_application_spec_revisions ("projectId", "applicationId", "revision" DESC);
  `);

  if (failedSchemaSteps.length > 0) {
    const errorMsg = `[DATABASE] Schema initialization failed with ${failedSchemaSteps.length} failed step(s): ${failedSchemaSteps.join(", ")}`;
    console.error(`❌ ${errorMsg}`);
    const failureList = [...failedSchemaSteps];
    failedSchemaSteps.length = 0;
    throw new Error(errorMsg);
  } else {
    console.log("✅ [DATABASE] Schema verified all tables & columns successfully.");
  }
  failedSchemaSteps.length = 0;
}


