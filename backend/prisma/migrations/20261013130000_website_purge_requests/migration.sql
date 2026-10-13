-- Approved website purge (blueprint §10). Additive only.
-- Deliberately no foreign key to websites: the request must outlive the website it purges.
CREATE TABLE IF NOT EXISTS website_purge_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "websiteId" UUID NOT NULL,
  manifest JSONB NOT NULL,
  "manifestHash" CHAR(64) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  "requestedById" UUID NOT NULL,
  "approvedById" UUID,
  "approvedAt" TIMESTAMPTZ,
  "executedById" UUID,
  "executedAt" TIMESTAMPTZ,
  "singleOwnerException" BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING_APPROVAL'
    CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'EXECUTING', 'EXECUTED', 'EXPIRED')),
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_website_purge_requests_website ON website_purge_requests ("websiteId", status);
