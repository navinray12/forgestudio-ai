-- Reverses migration 20261013170000_tenant_rls_stage1. No data changes.
-- Run rollback_stage2.sql first if stage 2 was applied. The application code that switches to the
-- restricted roles (platform/tenancy/rls.ts) must be reverted before the roles are dropped;
-- until then leave the last block commented out.
DROP POLICY IF EXISTS forge_website_records_tenant ON forge_website_records;
DROP POLICY IF EXISTS forge_workflow_definitions_tenant ON forge_workflow_definitions;
DROP POLICY IF EXISTS forge_environment_bindings_tenant ON forge_environment_bindings;
DROP POLICY IF EXISTS forge_benchmark_runs_platform ON forge_benchmark_runs;
ALTER TABLE forge_website_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE forge_workflow_definitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE forge_environment_bindings DISABLE ROW LEVEL SECURITY;
ALTER TABLE forge_benchmark_runs DISABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  ALTER FUNCTION forge_workspace_child_admission() SECURITY INVOKER RESET search_path;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- REVOKE ALL ON forge_website_records, forge_workflow_definitions, forge_environment_bindings FROM forge_tenant_rls;
-- REVOKE ALL ON forge_benchmark_runs FROM forge_platform_rls;
-- DROP FUNCTION IF EXISTS forge_website_tenant(uuid), forge_project_tenant(uuid), forge_current_tenant();
-- REVOKE USAGE ON SCHEMA public FROM forge_tenant_rls, forge_platform_rls;
-- DROP ROLE IF EXISTS forge_tenant_rls;
-- DROP ROLE IF EXISTS forge_platform_rls;
