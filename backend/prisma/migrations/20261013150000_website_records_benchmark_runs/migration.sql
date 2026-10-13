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
