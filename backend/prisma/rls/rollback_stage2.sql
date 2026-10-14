-- Reverses stage2_force.sql: the table owner is exempt from the policies again. No data changes.
ALTER TABLE forge_website_records NO FORCE ROW LEVEL SECURITY;
ALTER TABLE forge_workflow_definitions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE forge_environment_bindings NO FORCE ROW LEVEL SECURITY;
ALTER TABLE forge_benchmark_runs NO FORCE ROW LEVEL SECURITY;
