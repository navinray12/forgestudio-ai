-- Additive: databases created by the runtime setup have STAGING but not PREVIEW, Prisma-created
-- databases the reverse. Both labels are made valid; no stored value is renamed.
ALTER TYPE "DatabaseEnvironment" ADD VALUE IF NOT EXISTS 'PREVIEW';
ALTER TYPE "DatabaseEnvironment" ADD VALUE IF NOT EXISTS 'STAGING';
