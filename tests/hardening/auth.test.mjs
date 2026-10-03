import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadTypeScript } from './load-typescript.mjs';

async function fixture(overrides = {}) {
  const calls = { reads: [], writes: [], next: [] };
  const session = {
    id: 'session-1', authEpoch: 1, authMethod: 'local', audience: 'TENANT', authTime: new Date(), revokedAt: null, expiresAt: new Date(Date.now() + 600_000),
    lastUsedAt: new Date(), user: { id: 'user-1', status: 'ACTIVE', role: 'USER', authEpoch: 1 },
    ...overrides,
  };
  const prisma = { session: {
    findUnique: async (input) => { calls.reads.push(input); return session; },
    updateMany: async (input) => { calls.writes.push(input); return { count: 1 }; },
  } };
  const auth = await loadTypeScript('backend/src/middlewares/auth.middleware.ts', {
    '../config/prisma.js': { prisma }, '../config/auth.js': { AUTH_COOKIE_NAME: 'forge_session' },
  });
  const req = { cookies: { forge_session: 'opaque-token' }, headers: {} };
  const res = { locals: {}, statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const next = (error) => calls.next.push(error);
  return { auth, prisma, req, res, calls, next };
}

test('AUTH-001: validates current session without an activity write on every request', async () => {
  const f = await fixture();
  await f.auth.requireAuth(f.req, f.res, f.next);
  assert.equal(f.calls.next.length, 1);
  assert.equal(f.calls.next[0], undefined);
  assert.equal(f.calls.writes.length, 0);
  assert.equal(f.calls.reads[0].where.tokenHash, createHash('sha256').update('opaque-token').digest('hex'));
  assert.equal(f.res.locals.user.id, 'user-1');
});

test('AUTH-001: supports existing bearer-session clients', async () => {
  const f = await fixture(); f.req.cookies = {}; f.req.headers.authorization = 'Bearer opaque-token';
  await f.auth.requireAuth(f.req, f.res, f.next);
  assert.equal(f.calls.next[0], undefined); assert.equal(f.calls.reads.length, 1);
});

for (const token of [undefined, {}, ['token'], '', 'x'.repeat(4097)]) {
  test(`AUTH-001: rejects invalid token shape/size (${typeof token}, ${String(token).length})`, async () => {
    const f = await fixture(); f.req.cookies.forge_session = token;
    await f.auth.requireAuth(f.req, f.res, f.next);
    assert.equal(f.res.statusCode, 401); assert.equal(f.calls.reads.length, 0);
  });
}

for (const status of ['SUSPENDED', 'DELETED', 'UNKNOWN']) {
  test(`AUTH-003: blocks ${status} accounts even with an unexpired session`, async () => {
    const f = await fixture({ user: { id: 'user-1', status } });
    await f.auth.requireAuth(f.req, f.res, f.next);
    assert.equal(f.res.statusCode, 403); assert.equal(f.calls.next.length, 0);
    assert.equal(f.calls.writes.length, 0);
  });
}

for (const state of [{ revokedAt: new Date() }, { expiresAt: new Date(0) }]) {
  test(`AUTH-003: rejects ${Object.keys(state)[0]}`, async () => {
    const f = await fixture(state); await f.auth.requireAuth(f.req, f.res, f.next);
    assert.equal(f.res.statusCode, 401); assert.equal(f.calls.next.length, 0);
  });
}

test('AUTH-001: unknown sessions are rejected', async () => {
  const f = await fixture(); f.prisma.session.findUnique = async () => null;
  await f.auth.requireAuth(f.req, f.res, f.next); assert.equal(f.res.statusCode, 401);
});

test('L-11: schema lookup failure propagates without DDL or a permissive retry', async () => {
  const f = await fixture(); const failure = Object.assign(new Error('schema mismatch'), { code: 'P2022' });
  let attempts = 0; f.prisma.session.findUnique = async () => { attempts++; throw failure; };
  await f.auth.requireAuth(f.req, f.res, f.next);
  assert.equal(attempts, 1); assert.equal(f.calls.next[0], failure);
  assert.equal(f.res.locals.user, undefined);
});

test('AUTH-003: stale activity gets one conditional update, without refreshing expiry', async () => {
  const f = await fixture({ lastUsedAt: new Date(0) });
  await f.auth.requireAuth(f.req, f.res, f.next);
  assert.equal(f.calls.writes.length, 1);
  assert.equal(f.calls.writes[0].where.revokedAt, null);
  assert.equal(f.calls.writes[0].where.OR.length, 2);
  assert.deepEqual(Object.keys(f.calls.writes[0].data), ['lastUsedAt']);
});

test('AUTH-002: role middleware requires authenticated server context', async () => {
  const f = await fixture(); f.req.body = { user: { role: 'SUPER_ADMIN' } };
  f.auth.requireRole('SUPER_ADMIN')(f.req, f.res, f.next);
  assert.equal(f.res.statusCode, 401);
});

test('AUTH-002: authenticated user cannot pass an administrator guard', async () => {
  const f = await fixture(); f.res.locals.user = { role: 'USER' };
  f.auth.requireRole(['ADMIN', 'SUPER_ADMIN'])(f.req, f.res, f.next);
  assert.equal(f.res.statusCode, 403);
});
