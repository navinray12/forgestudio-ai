-- Additive: store the label fields the Custom Post Types UI already collects.
ALTER TABLE "custom_post_types" ADD COLUMN IF NOT EXISTS "singular" TEXT;
ALTER TABLE "custom_post_types" ADD COLUMN IF NOT EXISTS "plural" TEXT;
ALTER TABLE "custom_post_types" ADD COLUMN IF NOT EXISTS "hasArchive" BOOLEAN NOT NULL DEFAULT false;
