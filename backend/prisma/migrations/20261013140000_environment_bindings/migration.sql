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
