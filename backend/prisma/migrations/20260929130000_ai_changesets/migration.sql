BEGIN;
CREATE TABLE "ai_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "websiteId" uuid NOT NULL REFERENCES "websites"("id") ON DELETE CASCADE,
  "workspaceId" uuid REFERENCES "workspaces"("id") ON DELETE SET NULL, "organizationId" uuid,
  "actorId" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT, "operation" varchar(50) NOT NULL,
  "promptVersion" varchar(100) NOT NULL DEFAULT 'site-generation-v1', "provider" varchar(50) NOT NULL,
  "model" varchar(150) NOT NULL, "status" varchar(30) NOT NULL DEFAULT 'PENDING', "inputSummary" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "outputSummary" jsonb, "errorCode" varchar(100), "createdAt" timestamptz NOT NULL DEFAULT now(), "completedAt" timestamptz
);
CREATE TABLE "ai_changesets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "executionId" uuid NOT NULL UNIQUE REFERENCES "ai_executions"("id") ON DELETE CASCADE,
  "websiteId" uuid NOT NULL REFERENCES "websites"("id") ON DELETE CASCADE, "workspaceId" uuid REFERENCES "workspaces"("id") ON DELETE SET NULL,
  "organizationId" uuid, "actorId" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT, "status" varchar(30) NOT NULL DEFAULT 'PENDING_REVIEW',
  "expectedDocumentVersion" integer NOT NULL CHECK ("expectedDocumentVersion" > 0), "proposedDocument" jsonb NOT NULL, "summary" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "approvedAt" timestamptz, "cancelledAt" timestamptz, "appliedAt" timestamptz, "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "ai_executions_website_created_idx" ON "ai_executions"("websiteId", "createdAt");
CREATE INDEX "ai_executions_actor_created_idx" ON "ai_executions"("actorId", "createdAt");
CREATE INDEX "ai_changesets_website_status_created_idx" ON "ai_changesets"("websiteId", "status", "createdAt");
COMMIT;
