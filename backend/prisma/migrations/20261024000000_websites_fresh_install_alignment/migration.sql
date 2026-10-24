-- WP-00: reconcile the canonical Website Prisma model with the clean-install migration ledger.
-- The original websites baseline predates these additive columns.
-- IF NOT EXISTS preserves existing sites and permits fresh-install qualification.
ALTER TABLE "websites"
  ADD COLUMN IF NOT EXISTS "documentVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "performanceSettings" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "teamId" UUID,
  ADD COLUMN IF NOT EXISTS "workspaceId" UUID,
  ADD COLUMN IF NOT EXISTS "organizationId" UUID,
  ADD COLUMN IF NOT EXISTS "approvalWorkflowEnabled" BOOLEAN NOT NULL DEFAULT FALSE;

-- Additive indexes match the Prisma model; existing indexes are retained.
CREATE INDEX IF NOT EXISTS "websites_organizationId_idx" ON "websites" ("organizationId");
