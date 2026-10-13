-- Additive: recoverable trash for CMS entries and approved purge requests (blueprint §10).
ALTER TABLE "custom_entries" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "custom_entries" ADD COLUMN IF NOT EXISTS "deletedById" UUID;
ALTER TABLE "custom_entries" ADD COLUMN IF NOT EXISTS "deleteReason" TEXT;

CREATE TABLE IF NOT EXISTS "content_purge_requests" (
  "id" UUID NOT NULL,
  "websiteId" UUID NOT NULL,
  "manifest" JSONB NOT NULL,
  "manifestHash" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "requestedById" UUID NOT NULL,
  "approvedById" UUID,
  "approvedAt" TIMESTAMP(3),
  "singleOwnerException" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "executedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "content_purge_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "content_purge_requests_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "content_purge_requests_websiteId_status_idx" ON "content_purge_requests"("websiteId", "status");
