import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';

// Explicit local repair only. Production uses the reviewed migration pipeline.
const target = new URL(process.env.DATABASE_URL || '');
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) throw Error('This repair only supports a local development database');
const name = '20261023180000_repair_organization_billing_foundations';
const sql = readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8');
const checksum = createHash('sha256').update(sql).digest('hex');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const client = await pool.connect();
try {
  await client.query(sql.replace(/COMMIT;\s*$/, ''));
  await client.query("SELECT pg_advisory_xact_lock(hashtext('forgestudio:local-billing-repair'))");
  const history = await client.query('SELECT checksum FROM _prisma_migrations WHERE migration_name=$1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL', [name]);
  if (history.rows.length && history.rows[0].checksum !== checksum) throw Error('Applied migration checksum does not match');
  if (!history.rows.length) await client.query('INSERT INTO _prisma_migrations (id,checksum,migration_name,started_at,finished_at,applied_steps_count) VALUES ($1,$2,$3,now(),now(),1)', [randomUUID(), checksum, name]);
  await client.query('COMMIT');
  console.log('Local billing schema repaired; no subscriptions, invoices, customers or credentials were created.');
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
