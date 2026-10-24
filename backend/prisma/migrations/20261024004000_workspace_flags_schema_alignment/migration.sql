-- WP-07 / WP-00: clean-install schema alignment for the canonical Workspace model.
-- Earlier workspace migrations created the table but omitted these required
-- Prisma Boolean fields. Existing tenant rows default to non-default, active.
ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT FALSE;
