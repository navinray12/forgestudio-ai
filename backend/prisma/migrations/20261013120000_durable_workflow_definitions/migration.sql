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
