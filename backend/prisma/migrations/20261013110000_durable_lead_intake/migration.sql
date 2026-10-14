-- Durable lead intake (blueprint §12). Additive only.
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "websiteId" UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  "formId" VARCHAR(255) NOT NULL,
  "formName" VARCHAR(255) NOT NULL DEFAULT 'Contact Form',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS "formName" VARCHAR(255) DEFAULT 'Contact Form';
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(200);
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS "requestHash" CHAR(64);
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS "leadId" UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_form_submissions_idempotency
  ON form_submissions ("websiteId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;

CREATE TABLE IF NOT EXISTS forge_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "websiteId" UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  "submissionId" UUID REFERENCES form_submissions(id) ON DELETE SET NULL,
  provenance VARCHAR(30) NOT NULL DEFAULT 'WEBSITE_FORM',
  "formId" VARCHAR(255),
  "displayName" VARCHAR(255),
  email VARCHAR(320),
  phone VARCHAR(64),
  stage VARCHAR(20) NOT NULL DEFAULT 'NEW' CHECK (stage IN ('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST', 'SPAM')),
  "assignedToId" UUID REFERENCES users(id) ON DELETE SET NULL,
  "qualificationEvidence" TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "stageChangedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_forge_leads_website ON forge_leads ("websiteId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_forge_leads_website_stage ON forge_leads ("websiteId", stage);

CREATE TABLE IF NOT EXISTS forge_lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "leadId" UUID NOT NULL REFERENCES forge_leads(id) ON DELETE CASCADE,
  "websiteId" UUID NOT NULL,
  "actorId" UUID,
  type VARCHAR(30) NOT NULL,
  "fromStage" VARCHAR(20),
  "toStage" VARCHAR(20),
  note TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_forge_lead_events_lead ON forge_lead_events ("leadId", "createdAt");
