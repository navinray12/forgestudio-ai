BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE ai_executions
 ADD COLUMN "expectedDocumentVersion" INTEGER,
 ADD COLUMN scope JSONB,
 ADD COLUMN "providerSnapshot" JSONB,
 ADD COLUMN "parentExecutionId" UUID,
 ADD COLUMN stage VARCHAR(100),
 ADD COLUMN "cancelRequestedAt" TIMESTAMPTZ,
 ADD COLUMN "reservedUnits" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE ai_execution_stages (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 "executionId" UUID NOT NULL REFERENCES ai_executions(id) ON DELETE CASCADE,
 key VARCHAR(100) NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
 "artifactKey" VARCHAR(200),
 "externalReference" JSONB,
 "startedAt" TIMESTAMPTZ,
 "completedAt" TIMESTAMPTZ,
 UNIQUE("executionId",key)
);
CREATE INDEX ai_design_workspace_budget ON ai_executions("workspaceId","createdAt") WHERE "reservedUnits">0;
COMMIT;
