-- Blueprint v2.1 §33.1/33.3, WP-17/WP-20: immutable, project-scoped application contract history.
-- Additive only. This table holds definitions, never application customer rows or secrets.
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
-- Deliberately no UPDATE/DELETE endpoint; revisions form append-only evidence.
