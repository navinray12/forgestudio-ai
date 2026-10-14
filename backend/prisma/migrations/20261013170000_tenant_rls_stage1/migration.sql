-- Tenant row-level security, stage 1 (blueprint §18, WP-02/WP-19). Additive and reversible
-- (prisma/rls/rollback_stage1.sql). It changes nothing for the table owner or a superuser:
-- policies apply to the restricted roles below, which the application switches to inside a
-- transaction (platform/tenancy/rls.ts). Stage 2 (prisma/rls/stage2_force.sql) is applied
-- separately, once every owner-level path to a table has been converted.

-- Restricted roles. They cannot log in, own nothing and hold only the grants listed here.
DO $$ BEGIN
  CREATE ROLE forge_tenant_rls NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE forge_platform_rls NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- The application role must be able to switch to them (a superuser can anyway).
DO $$ BEGIN
  EXECUTE format('GRANT forge_tenant_rls, forge_platform_rls TO %I', current_user);
EXCEPTION WHEN OTHERS THEN NULL; END $$;
GRANT USAGE ON SCHEMA public TO forge_tenant_rls, forge_platform_rls;

-- The tenant authorised for the current transaction. Unset or empty means none; a value that is
-- not a UUID is an error, so the statement fails rather than matching anything.
CREATE OR REPLACE FUNCTION forge_current_tenant() RETURNS uuid
  LANGUAGE sql STABLE
  AS $fn$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $fn$;

-- Ownership differs per table family. A website belongs to its workspace, else its organization,
-- else its owner; a project to its workspace, else its owner. These run with the owner's rights
-- so the restricted role needs no access to websites or forge_projects themselves.
CREATE OR REPLACE FUNCTION forge_website_tenant(site uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $fn$ SELECT COALESCE(w."workspaceId", w."organizationId", w."userId") FROM websites w WHERE w.id = site $fn$;
CREATE OR REPLACE FUNCTION forge_project_tenant(project uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $fn$ SELECT COALESCE(p."workspaceId", p."ownerId") FROM forge_projects p WHERE p.id = project AND p."deletedAt" IS NULL $fn$;
REVOKE ALL ON FUNCTION forge_website_tenant(uuid), forge_project_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION forge_current_tenant(), forge_website_tenant(uuid), forge_project_tenant(uuid) TO forge_tenant_rls;

-- forge_website_records: owned through its website. A row may only be written with the tenant
-- of the transaction in its own "tenantId" column.
ALTER TABLE forge_website_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forge_website_records_tenant ON forge_website_records;
CREATE POLICY forge_website_records_tenant ON forge_website_records FOR ALL TO forge_tenant_rls
  USING (forge_website_tenant("websiteId") = forge_current_tenant())
  WITH CHECK (forge_website_tenant("websiteId") = forge_current_tenant() AND "tenantId" = forge_current_tenant()::text);
GRANT SELECT, INSERT, UPDATE ON forge_website_records TO forge_tenant_rls;

-- forge_workflow_definitions: owned through its website; it has no tenant column of its own.
ALTER TABLE forge_workflow_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forge_workflow_definitions_tenant ON forge_workflow_definitions;
CREATE POLICY forge_workflow_definitions_tenant ON forge_workflow_definitions FOR ALL TO forge_tenant_rls
  USING (forge_website_tenant("websiteId") = forge_current_tenant())
  WITH CHECK (forge_website_tenant("websiteId") = forge_current_tenant());
GRANT SELECT, INSERT, UPDATE ON forge_workflow_definitions TO forge_tenant_rls;

-- forge_environment_bindings: owned through its project.
ALTER TABLE forge_environment_bindings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forge_environment_bindings_tenant ON forge_environment_bindings;
CREATE POLICY forge_environment_bindings_tenant ON forge_environment_bindings FOR ALL TO forge_tenant_rls
  USING (forge_project_tenant("projectId") = forge_current_tenant())
  WITH CHECK (forge_project_tenant("projectId") = forge_current_tenant());
GRANT SELECT, INSERT, UPDATE ON forge_environment_bindings TO forge_tenant_rls;

-- forge_benchmark_runs: platform data with no tenant. Only the platform role, and only in a
-- transaction explicitly marked as platform administration. The tenant role has no grant on it.
ALTER TABLE forge_benchmark_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forge_benchmark_runs_platform ON forge_benchmark_runs;
CREATE POLICY forge_benchmark_runs_platform ON forge_benchmark_runs FOR ALL TO forge_platform_rls
  USING (current_setting('app.platform_admin', true) = 'on')
  WITH CHECK (current_setting('app.platform_admin', true) = 'on');
GRANT SELECT, INSERT ON forge_benchmark_runs TO forge_platform_rls;

-- The workspace lifecycle trigger on website-owned tables checks that the website's workspace is
-- not archived. It reads websites and workspaces, which the restricted roles cannot (and must
-- not) read, so it runs with its owner's rights. Its logic does not depend on the caller.
DO $$ BEGIN
  ALTER FUNCTION forge_workspace_child_admission() SECURITY DEFINER SET search_path = public, pg_temp;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
