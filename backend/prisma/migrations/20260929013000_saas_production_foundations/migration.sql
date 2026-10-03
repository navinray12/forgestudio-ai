-- Forge SaaS production foundations.
-- Additive only: billing, durable execution, file governance, integration secret references,
-- control-plane state and the first forced-RLS legacy ownership boundary.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Deterministic ownership backfill. Ambiguous legacy rows remain visible through the
-- preflight view and must be resolved before relying on tenant-enforced application roles.
UPDATE workspaces w
SET "organizationId" = candidate.id
FROM (
  SELECT o."ownerId", (array_agg(o.id ORDER BY o.id::text))[1] AS id
  FROM organizations o
  GROUP BY o."ownerId"
  HAVING count(*) = 1
) candidate
WHERE w."organizationId" IS NULL AND candidate."ownerId" = w."ownerId";

UPDATE websites s
SET "organizationId" = w."organizationId"
FROM workspaces w
WHERE s."organizationId" IS NULL AND s."workspaceId" = w.id AND w."organizationId" IS NOT NULL;

UPDATE websites s
SET "organizationId" = candidate.id
FROM (
  SELECT o."ownerId", (array_agg(o.id ORDER BY o.id::text))[1] AS id
  FROM organizations o
  GROUP BY o."ownerId"
  HAVING count(*) = 1
) candidate
WHERE s."organizationId" IS NULL AND candidate."ownerId" = s."userId";

CREATE OR REPLACE VIEW forge_tenant_backfill_issues AS
SELECT 'workspace'::text AS resource_type, id AS resource_id, "ownerId" AS actor_id
FROM workspaces WHERE "organizationId" IS NULL
UNION ALL
SELECT 'website'::text, id, "userId"
FROM websites WHERE "organizationId" IS NULL;

CREATE OR REPLACE FUNCTION forge_actor_uuid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.actor_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION forge_tenant_uuid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION forge_actor_has_org_access(scope uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT scope IS NOT NULL AND (
    EXISTS (SELECT 1 FROM organizations o WHERE o.id = scope AND o."ownerId" = forge_actor_uuid())
    OR EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m."organizationId" = scope AND m."userId" = forge_actor_uuid()
    )
  )
$$;

CREATE OR REPLACE FUNCTION forge_actor_owns_workspace(scope uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = scope AND w."ownerId" = forge_actor_uuid())
$$;

CREATE OR REPLACE FUNCTION forge_actor_has_workspace_access(scope uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspaces w
    JOIN workspace_members m ON m."workspaceId" = w.id
    WHERE w.id = scope
      AND m."userId" = forge_actor_uuid()
      AND forge_actor_has_org_access(w."organizationId")
  )
$$;

CREATE OR REPLACE FUNCTION forge_actor_can_website(scope uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM websites s
    WHERE s.id = scope AND (
      (s."organizationId" IS NULL AND s."userId" = forge_actor_uuid())
      OR
      (s."organizationId" IS NOT NULL
        AND forge_actor_has_org_access(s."organizationId")
        AND (s."workspaceId" IS NULL OR forge_actor_has_workspace_access(s."workspaceId")))
    )
  )
$$;

-- Top-level ownership boundaries. Policies accept the explicit tenant context or a
-- current actor membership; application authorization still decides the action.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forge_organizations_scope ON organizations;
CREATE POLICY forge_organizations_scope ON organizations
  USING (id = forge_tenant_uuid() OR "ownerId" = forge_actor_uuid() OR forge_actor_has_org_access(id))
  WITH CHECK (id = forge_tenant_uuid() OR "ownerId" = forge_actor_uuid() OR forge_actor_has_org_access(id));

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forge_organization_members_scope ON organization_members;
CREATE POLICY forge_organization_members_scope ON organization_members
  USING ("organizationId" = forge_tenant_uuid() OR "userId" = forge_actor_uuid() OR forge_actor_has_org_access("organizationId"))
  WITH CHECK ("organizationId" = forge_tenant_uuid() OR forge_actor_has_org_access("organizationId"));

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forge_workspaces_scope ON workspaces;
CREATE POLICY forge_workspaces_scope ON workspaces
  USING ("ownerId" = forge_actor_uuid() OR forge_actor_has_workspace_access(id))
  WITH CHECK ("ownerId" = forge_actor_uuid() OR forge_actor_has_org_access("organizationId"));

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forge_workspace_members_scope ON workspace_members;
CREATE POLICY forge_workspace_members_scope ON workspace_members
  USING (forge_actor_has_workspace_access("workspaceId") OR forge_actor_owns_workspace("workspaceId"))
  WITH CHECK (forge_actor_has_workspace_access("workspaceId") OR forge_actor_owns_workspace("workspaceId"));

ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forge_workspace_invitations_scope ON workspace_invitations;
CREATE POLICY forge_workspace_invitations_scope ON workspace_invitations
  USING ("organizationId" = forge_tenant_uuid() OR "recipientUserId" = forge_actor_uuid() OR forge_actor_has_org_access("organizationId"))
  WITH CHECK ("organizationId" = forge_tenant_uuid() OR forge_actor_has_org_access("organizationId"));

ALTER TABLE websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE websites FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forge_websites_scope ON websites;
CREATE POLICY forge_websites_scope ON websites
  USING (forge_actor_can_website(id))
  WITH CHECK (
    ("organizationId" IS NULL AND "userId" = forge_actor_uuid())
    OR
    ("organizationId" IS NOT NULL AND forge_actor_has_org_access("organizationId")
      AND ("workspaceId" IS NULL OR forge_actor_has_workspace_access("workspaceId")))
  );

CREATE TABLE organization_billing_accounts (
  "organizationId" uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE RESTRICT,
  provider varchar(40) NOT NULL,
  "providerCustomerId" varchar(255),
  currency varchar(10) NOT NULL DEFAULT 'USD',
  status varchar(30) NOT NULL DEFAULT 'ACTIVE',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, "providerCustomerId")
);

CREATE TABLE organization_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE RESTRICT,
  "planId" uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  provider varchar(40),
  "providerSubscriptionId" varchar(255),
  status varchar(30) NOT NULL DEFAULT 'PENDING',
  "seatLimit" integer NOT NULL DEFAULT 5 CHECK ("seatLimit" > 0),
  "currentPeriodStart" timestamptz,
  "currentPeriodEnd" timestamptz,
  "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, "providerSubscriptionId")
);

CREATE TABLE billing_checkout_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  "actorId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  "planId" uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  provider varchar(40) NOT NULL,
  "providerSessionId" varchar(255),
  "checkoutUrl" text,
  "idempotencyKey" varchar(128) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'PENDING',
  "expiresAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("organizationId","actorId","idempotencyKey"),
  UNIQUE(provider,"providerSessionId")
);

CREATE TABLE billing_event_inbox (
  provider varchar(40) NOT NULL,
  "eventId" varchar(255) NOT NULL,
  "eventType" varchar(120) NOT NULL,
  "payloadDigest" char(64) NOT NULL,
  "receivedAt" timestamptz NOT NULL DEFAULT now(),
  "processedAt" timestamptz,
  "lastError" text,
  PRIMARY KEY(provider,"eventId")
);

CREATE TABLE organization_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  provider varchar(40) NOT NULL,
  "providerInvoiceId" varchar(255) NOT NULL,
  amount bigint NOT NULL CHECK (amount >= 0),
  currency varchar(10) NOT NULL,
  status varchar(30) NOT NULL,
  "periodStart" timestamptz,
  "periodEnd" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,"providerInvoiceId")
);

CREATE TABLE usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  metric varchar(80) NOT NULL,
  quantity bigint NOT NULL CHECK (quantity >= 0),
  "idempotencyKey" varchar(128) NOT NULL,
  "reservationId" uuid,
  "occurredAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("organizationId",metric,"idempotencyKey")
);

CREATE TABLE quota_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  metric varchar(80) NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  state varchar(20) NOT NULL DEFAULT 'RESERVED' CHECK (state IN ('RESERVED','CONSUMED','RELEASED','EXPIRED')),
  "idempotencyKey" varchar(128) NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("organizationId",metric,"idempotencyKey")
);

CREATE TABLE durable_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  "eventType" varchar(120) NOT NULL,
  "aggregateType" varchar(80) NOT NULL,
  "aggregateId" varchar(160) NOT NULL,
  payload jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DISPATCHING','DISPATCHED','FAILED')),
  attempts integer NOT NULL DEFAULT 0,
  "availableAt" timestamptz NOT NULL DEFAULT now(),
  "lockedUntil" timestamptz,
  "lockToken" uuid,
  "lastError" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "dispatchedAt" timestamptz
);
CREATE INDEX durable_outbox_pending_idx ON durable_outbox(status,"availableAt") WHERE status IN ('PENDING','FAILED');

CREATE TABLE consumer_inbox (
  consumer varchar(100) NOT NULL,
  "eventId" uuid NOT NULL,
  "organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  "processedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(consumer,"eventId")
);

ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS "organizationId" uuid REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS "idempotencyKey" varchar(128);
ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS "lockedUntil" timestamptz;
ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS "lockToken" uuid;
CREATE UNIQUE INDEX IF NOT EXISTS background_jobs_org_type_idempotency
  ON background_jobs("organizationId",type,"idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;

CREATE TABLE job_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid REFERENCES organizations(id) ON DELETE RESTRICT,
  "jobId" uuid,
  "jobType" varchar(100) NOT NULL,
  payload jsonb NOT NULL,
  attempts integer NOT NULL,
  reason text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "replayedAt" timestamptz
);

CREATE TABLE file_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  "workspaceId" uuid REFERENCES workspaces(id) ON DELETE RESTRICT,
  "websiteId" uuid REFERENCES websites(id) ON DELETE RESTRICT,
  "createdBy" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  "objectKey" varchar(1000) NOT NULL UNIQUE,
  "originalName" varchar(500) NOT NULL,
  "contentType" varchar(150) NOT NULL,
  "sizeBytes" bigint NOT NULL CHECK ("sizeBytes" >= 0),
  sha256 char(64) NOT NULL,
  state varchar(30) NOT NULL DEFAULT 'UPLOAD_PENDING'
    CHECK (state IN ('UPLOAD_PENDING','QUARANTINED','SCANNING','APPROVED','REJECTED','DELETED')),
  "scanVerdict" varchar(80),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX file_objects_scope_idx ON file_objects("organizationId","workspaceId","websiteId");

CREATE TABLE file_scan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "fileId" uuid NOT NULL REFERENCES file_objects(id) ON DELETE CASCADE,
  engine varchar(80) NOT NULL,
  verdict varchar(30) NOT NULL,
  detail varchar(1000),
  sha256 char(64) NOT NULL,
  "scannedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE integration_secret_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  "workspaceId" uuid REFERENCES workspaces(id) ON DELETE RESTRICT,
  provider varchar(80) NOT NULL,
  "connectionKey" varchar(160) NOT NULL,
  "secretRef" varchar(500) NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(30) NOT NULL DEFAULT 'ACTIVE',
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("organizationId",provider,"connectionKey")
);

CREATE TABLE platform_capabilities (
  id varchar(120) PRIMARY KEY,
  owner varchar(120) NOT NULL,
  criticality varchar(20) NOT NULL CHECK (criticality IN ('LOCKED','REQUIRED','OPTIONAL')),
  "changeClass" varchar(1) NOT NULL CHECK ("changeClass" IN ('A','B','C','D','E','L')),
  "minTier" varchar(5) NOT NULL DEFAULT 'T0',
  "desiredState" varchar(30) NOT NULL,
  "actualState" varchar(30) NOT NULL,
  provider varchar(100),
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  "offBehavior" jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "capabilityId" varchar(120) NOT NULL REFERENCES platform_capabilities(id) ON DELETE RESTRICT,
  "requestedBy" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  "approvedBy" uuid REFERENCES users(id) ON DELETE RESTRICT,
  "desiredState" varchar(30) NOT NULL,
  reason varchar(1000) NOT NULL,
  "planDigest" char(64) NOT NULL,
  status varchar(40) NOT NULL DEFAULT 'AWAITING_APPROVAL',
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "approvedAt" timestamptz,
  "appliedAt" timestamptz
);

CREATE TABLE platform_config_snapshots (
  version bigserial PRIMARY KEY,
  digest char(64) NOT NULL UNIQUE,
  body jsonb NOT NULL,
  "createdBy" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT false
);

CREATE TABLE platform_audit_events (
  id bigserial PRIMARY KEY,
  "actorId" uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(120) NOT NULL,
  resource varchar(200) NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform_capabilities(id,owner,criticality,"changeClass","desiredState","actualState",provider,dependencies,"offBehavior")
VALUES
 ('authentication','platform-security','LOCKED','L','ENABLED','ENABLED','oidc','[]','{}'),
 ('authorization','platform-security','LOCKED','L','ENABLED','ENABLED','application-rbac','["authentication"]','{}'),
 ('tenant-isolation','platform-security','LOCKED','L','ENABLED','ENABLED','postgres-rls','["authorization"]','{}'),
 ('durable-storage','platform-data','LOCKED','L','ENABLED','ENABLED','postgres','[]','{}'),
 ('billing','platform-commerce','OPTIONAL','A','ENABLED','DEGRADED','stripe','["durable-storage"]','{"disabled":"read-only"}'),
 ('durable-execution','platform-runtime','REQUIRED','B','ENABLED','ENABLED','postgres-jobs','["durable-storage"]','{"degraded":"reject-new-admission"}'),
 ('object-storage','platform-files','REQUIRED','B','ENABLED','DEGRADED','s3','["durable-execution"]','{"disabled":"reject-new-uploads"}'),
 ('integrations','platform-integrations','OPTIONAL','A','ENABLED','ENABLED','governed-egress','["durable-execution"]','{"disabled":"pause-new-side-effects"}')
ON CONFLICT(id) DO NOTHING;

-- New tenant-owned platform tables are FORCE RLS from day one.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organization_billing_accounts','organization_subscriptions','billing_checkout_intents',
    'organization_invoices','usage_events','quota_reservations','durable_outbox',
    'consumer_inbox','file_objects','integration_secret_refs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS forge_tenant_scope ON %I', t);
    EXECUTE format(
      'CREATE POLICY forge_tenant_scope ON %I USING ("organizationId" = forge_tenant_uuid() OR forge_actor_has_org_access("organizationId")) WITH CHECK ("organizationId" = forge_tenant_uuid() OR forge_actor_has_org_access("organizationId"))',
      t
    );
  END LOOP;
END $$;

COMMIT;
