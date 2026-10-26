-- Reconciled migration stub: 20260916000000_draft_mutation_receipts
-- Ensures draft mutation idempotency receipts exist safely.
CREATE TABLE IF NOT EXISTS "draft_mutation_receipts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "websiteId" UUID NOT NULL REFERENCES "websites"("id") ON DELETE CASCADE,
  "clientMutationId" VARCHAR(128) NOT NULL,
  "documentVersion" INTEGER NOT NULL,
  "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("websiteId", "clientMutationId")
);
CREATE INDEX IF NOT EXISTS "idx_draft_mutations_site_mutation" ON "draft_mutation_receipts"("websiteId", "clientMutationId");
