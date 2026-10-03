BEGIN;
SET LOCAL lock_timeout='5s';

CREATE TABLE IF NOT EXISTS platform_reconciliation_cases (
  id UUID PRIMARY KEY,
  "organizationId" UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  "jobId" UUID REFERENCES platform_jobs(id) ON DELETE RESTRICT,
  provider VARCHAR(100) NOT NULL,
  "externalRef" VARCHAR(500),
  reason VARCHAR(2000) NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','ABANDONED')),
  "resolvedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
  "resolutionNote" VARCHAR(2000),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS platform_reconciliation_open_idx ON platform_reconciliation_cases (status,"createdAt");
CREATE INDEX IF NOT EXISTS platform_reconciliation_tenant_idx ON platform_reconciliation_cases ("organizationId","createdAt");

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['platform_outbox','platform_jobs','platform_dead_letters','platform_reconciliation_cases'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS forge_job_boundary ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS forge_reconciliation_boundary ON %I', t);
    EXECUTE format(
      'CREATE POLICY forge_job_boundary ON %I USING (
        current_setting(''app.service_role'',true) IN (''dispatcher'',''worker'',''billing-webhook'',''file-scanner'',''platform-control'')
        OR "organizationId" = nullif(current_setting(''app.tenant_id'',true),'''')::uuid
      ) WITH CHECK (
        current_setting(''app.service_role'',true) IN (''dispatcher'',''worker'',''billing-webhook'',''file-scanner'',''platform-control'')
        OR "organizationId" = nullif(current_setting(''app.tenant_id'',true),'''')::uuid
      )', t
    );
  END LOOP;
END $$;

COMMIT;
