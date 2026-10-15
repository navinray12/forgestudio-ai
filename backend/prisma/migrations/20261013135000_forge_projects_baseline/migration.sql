-- Fresh-install baseline for forge_projects.
-- The legacy runtime schema setup already creates this table; the migration
-- chain must establish it before environment bindings reference its ID.
-- Identical schema definition retained; no existing records are removed.
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
