-- Form delivery credentials are managed exclusively by authenticated website owners.
-- The editor document may describe a form, but cannot authorize production delivery.
CREATE TABLE IF NOT EXISTS form_delivery_policies (
  "websiteId" UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  "formId" VARCHAR(256) NOT NULL,
  "encryptedActions" TEXT NOT NULL,
  "updatedBy" UUID NOT NULL REFERENCES users(id),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("websiteId", "formId")
);
CREATE INDEX IF NOT EXISTS form_delivery_policies_updatedAt_idx
  ON form_delivery_policies ("updatedAt");
REVOKE ALL ON form_delivery_policies FROM PUBLIC;
