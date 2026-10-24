import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import dotenv from '../../backend/node_modules/dotenv/lib/main.js';
import pg from '../../backend/node_modules/pg/lib/index.js';

test('billing repair restores missing relations idempotently with FORCE RLS and no commercial records', { skip: process.env.RUN_BILLING_DB_TESTS !== '1' }, async () => {
  dotenv.config({ path: 'backend/.env', quiet: true });
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  const schema = `billing_repair_${randomUUID().replaceAll('-', '')}`;
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET LOCAL search_path TO ${schema}`);
    await client.query('CREATE TABLE users(id uuid PRIMARY KEY); CREATE TABLE organizations(id uuid PRIMARY KEY)');
    await client.query('SAVEPOINT missing_schema');
    await assert.rejects(client.query('SELECT id FROM organization_billing_accounts'), { code: '42P01' });
    await client.query('ROLLBACK TO SAVEPOINT missing_schema');
    const source = readFileSync('backend/prisma/migrations/20261023180000_repair_organization_billing_foundations/migration.sql', 'utf8');
    const sql = source.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '');
    await client.query(sql); await client.query(sql);
    const tables = ['organization_billing_accounts', 'organization_subscriptions_v2', 'organization_seat_assignments', 'billing_checkout_intents', 'organization_invoices', 'usage_reservations'];
    for (const table of tables) {
      assert.equal((await client.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count, 0);
      const row = (await client.query('SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2', [schema, table])).rows[0];
      assert.equal(row.relrowsecurity, true); assert.equal(row.relforcerowsecurity, true);
    }
    await client.query('SELECT id,provider,status,"providerCustomerId","updatedAt" FROM organization_billing_accounts');
    await client.query('SELECT id,"planKey",status,"seatLimit",quotas,"currentPeriodStart","currentPeriodEnd","updatedAt" FROM organization_subscriptions_v2');
    await client.query('SELECT id,"providerInvoiceId",amount,currency,status,"issuedAt" FROM organization_invoices ORDER BY "issuedAt" DESC,id DESC');
  } finally { await client.query('ROLLBACK'); client.release(); await pool.end(); }
});
