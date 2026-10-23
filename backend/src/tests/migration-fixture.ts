import { pgPool } from "../config/prisma.js";
import { readFile } from "node:fs/promises";

/** Legacy db-push fixtures replay individual SQL migrations; a fully migrated
 * fixture already has their indexes/triggers and must not destructively replay.
 * The calling suite must enforce its disposable-database guard first. */
export async function fixtureHasMigration(name: string): Promise<boolean> {
  const ledger = await pgPool.query("SELECT to_regclass('public._prisma_migrations') AS ledger");
  if (!ledger.rows[0]?.ledger) return false;
  const found = await pgPool.query('SELECT 1 FROM _prisma_migrations WHERE migration_name=$1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL', [name]);
  return found.rowCount === 1;
}

/** Called only after a guarded legacy fixture recreates invitations/outbox. */
export async function applyWorkspaceEmailFixtureMigration(): Promise<void> {
  const url = new URL(process.env.DATABASE_URL ?? "invalid:");
  if (process.env.FORGE_DISPOSABLE_TEST_DB !== "1" || !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !["/forge_hardening", "/forge_browser"].includes(url.pathname)) throw new Error("Disposable workspace fixture required");
  const name = "20261022100000_workspace_email_invitations";
  if (await fixtureHasMigration(name)) return;
  // Legacy db-push fixtures do not replay the production foundations migration.
  await pgPool.query(`CREATE OR REPLACE FUNCTION forge_actor_uuid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('app.actor_id',true),'')::uuid $$`);
  await pgPool.query(await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
}
