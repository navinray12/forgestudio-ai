import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

async function fixture(environment, fail) {
  const logs = [], audit = [], sessions = [];
  const user = { id: 'actor', email: 'test@example.test', status: 'ACTIVE', authEpoch: 1, emailVerified: false };
  const row = { id: 'challenge', userId: user.id, email: user.email, kind: 'LOGIN', authEpoch: 1,
    status: 'PENDING', otpHash: null, attempts: 0, expiresAt: new Date(Date.now() + 600000), lastSentAt: null };
  const tx = { lockUser: async () => user, lockChallenge: async () => row, lastDelivery: async () => null,
    updateChallenge: async (_id, patch) => Object.assign(row, patch), audit: async (_id, action) => audit.push(action),
    markEmailVerified: async () => ({ ...user, emailVerified: true }), createSession: async value => sessions.push(value) };
  const store = { findChallenge: async () => row, transaction: async work => work(tx) };
  let delivered;
  const delivery = { sendCode: async value => { if (fail) throw new Error('private provider credentials'); delivered = value.code; } };
  const { LocalAuthentication } = await loadTypeScript('backend/src/modules/identity/application/local-authentication.ts', {}, {
    process: { env: { NODE_ENV: environment } }, console: { log: (...args) => logs.push(args), warn: (...args) => logs.push(args), error: (...args) => logs.push(args) },
  });
  return { service: new LocalAuthentication(store, {}, delivery), row, audit, sessions, logs, code: () => delivered };
}

for (const environment of ['development', 'test', 'production']) test(`failed OTP delivery fails closed in ${environment} without claiming success or leaking codes`, async () => {
  const f = await fixture(environment, true);
  await assert.rejects(f.service.sendCode('a'.repeat(43), 'actor', 'LOGIN'), error =>
    error.code === 'IDENTITY_DELIVERY_UNAVAILABLE' && error.statusCode === 503 && !error.message.includes('private'));
  assert.equal(f.row.status, 'FAILED'); assert.equal(f.row.otpHash, null);
  assert.deepEqual(f.audit, ['IDENTITY_DELIVERY_FAILED']); assert.equal(f.logs.length, 0);
  await assert.rejects(f.service.finish('a'.repeat(43), 'actor', 'LOGIN', '123456'));
  assert.equal(f.sessions.length, 0);
});

test('successful delivery still allows the delivered OTP to verify email and create a cookie-session result', async () => {
  const f = await fixture('development', false);
  await f.service.sendCode('a'.repeat(43), 'actor', 'LOGIN');
  assert.equal(f.row.status, 'READY'); assert.match(f.code(), /^\d{6}$/);
  const result = await f.service.finish('a'.repeat(43), 'actor', 'LOGIN', f.code());
  assert.equal(result.user.emailVerified, true); assert.equal(f.row.status, 'CONSUMED');
  assert.equal(f.sessions.length, 1); assert.equal(f.logs.length, 0);
});
