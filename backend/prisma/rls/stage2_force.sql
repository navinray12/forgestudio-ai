-- Tenant row-level security, stage 2: FORCE (blueprint §18, WP-02/WP-19).
--
-- NOT applied automatically and deliberately not under prisma/migrations. Apply it per table,
-- by hand, when every owner-level path to that table has been converted to platform/tenancy/rls.ts
-- (see docs/architecture/18_SECURITY_PRIVACY_AUDIT_ABUSE_RESISTANCE.md, "Row-level security rollout").
--
-- Effect: the table owner is subject to the policies as well, so an owner-level query without a
-- tenant transaction sees no rows and cannot write. It has no effect on a superuser or a role with
-- BYPASSRLS; the application must not connect as one. Reverse with rollback_stage2.sql.
--
-- Safe today (all application paths use the restricted role; website and project deletion reach
-- these tables only through foreign-key cascades, which PostgreSQL exempts from row security):
ALTER TABLE forge_website_records FORCE ROW LEVEL SECURITY;
ALTER TABLE forge_workflow_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE forge_environment_bindings FORCE ROW LEVEL SECURITY;
ALTER TABLE forge_benchmark_runs FORCE ROW LEVEL SECURITY;
