import { pgPool } from "../config/prisma.js";

/** Legacy db-push fixtures replay individual SQL migrations; a fully migrated
 * fixture already has their indexes/triggers and must not destructively replay.
 * The calling suite must enforce its disposable-database guard first. */
export async function fixtureHasMigration(name: string): Promise<boolean> {
  const ledger = await pgPool.query("SELECT to_regclass('public._prisma_migrations') AS ledger");
  if (!ledger.rows[0]?.ledger) return false;
  const found = await pgPool.query('SELECT 1 FROM _prisma_migrations WHERE migration_name=$1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL', [name]);
  return found.rowCount === 1;
}
