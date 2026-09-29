import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

async function load(environment = {}) {
  const calls = { pools: [], queries: 0, accountWrites: 0, clients: 0 };
  class Pool { constructor(options) { calls.pools.push(options); } }
  class PrismaPg { constructor(pool) { this.pool = pool; } }
  class PrismaClient {
    constructor() { calls.clients++; }
    $executeRawUnsafe() { calls.queries++; throw new Error('No import-time queries allowed'); }
    user = { upsert() { calls.accountWrites++; throw new Error('No import-time account writes allowed'); } };
  }
  const module = await loadTypeScript('backend/src/config/prisma.ts', {
    'dotenv/config': {}, 'pg': { default: { Pool } },
    '../generated/prisma/client.js': { PrismaClient }, '@prisma/adapter-pg': { PrismaPg },
  }, { process: { env: { DATABASE_URL: 'postgresql://test:unused@localhost/test', ...environment } } });
  return { calls, module };
}

test('L-11: database import cannot repair migration history or reset privileged accounts', async () => {
  const { calls } = await load();
  assert.equal(calls.queries, 0); assert.equal(calls.accountWrites, 0);
  assert.equal(calls.clients, 1);
});

test('DATA-002: default pool and timeout budgets are bounded', async () => {
  const { calls } = await load();
  assert.equal(calls.pools[0].max, 5);
  assert.equal(calls.pools[0].connectionTimeoutMillis, 2000);
  assert.equal(calls.pools[0].statement_timeout, 5000);
  assert.equal(calls.pools[0].idle_in_transaction_session_timeout, 10000);
});

for (const value of ['0', '-1', 'Infinity', '1000', '1.5', '', '2garbage']) {
  test(`DATA-002: invalid pool size ${JSON.stringify(value)} is rejected`, async () => {
    await assert.rejects(load({ DATABASE_POOL_MAX: value }), /DATABASE_POOL_MAX/);
  });
}

test('L-04: missing connection configuration fails without creating a fake database', async () => {
  await assert.rejects(load({ DATABASE_URL: '' }), /DATABASE_URL/);
});
