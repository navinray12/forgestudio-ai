import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { loadTypeScript } from './load-typescript.mjs';

async function fixture(environment = 'development') {
  const writes = [], logs = [];
  const { LocalOtpDelivery } = await loadTypeScript('backend/src/adapters/identity/local-otp-delivery.ts', {
    'node:fs/promises': { writeFile: async (...args) => writes.push(args) },
  }, { process: { env: { NODE_ENV: environment, FORGE_AUTH_MODE: 'local' }, platform: process.platform },
    console: { warn: (...args) => logs.push(args) } });
  return { LocalOtpDelivery, writes, logs };
}
const input = { email: 'local@example.test', code: '654321', purpose: 'LOGIN' };
const file = path.join(tmpdir(), 'forge-test-otp.json');

test('explicit local delivery writes a private file and forwards the same code to email', async () => {
  const f = await fixture(); let delivered;
  await new f.LocalOtpDelivery(file, { sendCode: async value => { delivered = value; } }).sendCode(input);
  assert.equal(f.writes[0][0], file); assert.equal(f.writes[0][2].mode, 0o600);
  assert.deepEqual(JSON.parse(JSON.stringify(delivered)), input); assert.equal(JSON.parse(f.writes[0][1]).code, input.code); assert.equal(f.logs.length, 0);
});
test('email failure does not prevent explicitly configured local delivery and never logs the code or provider error', async () => {
  const f = await fixture();
  await new f.LocalOtpDelivery(file, { sendCode: async () => { throw new Error('private SMTP credentials'); } }).sendCode(input);
  assert.equal(f.writes.length, 1); assert.equal(f.logs.length, 1);
  assert.ok(!JSON.stringify(f.logs).includes(input.code)); assert.ok(!JSON.stringify(f.logs).includes('private SMTP'));
});
test('local delivery is forbidden in production and outside the temporary directory', async () => {
  const production = await fixture('production'); assert.throws(() => new production.LocalOtpDelivery(file));
  const f = await fixture(); assert.throws(() => new f.LocalOtpDelivery(path.resolve('forge-test-otp.json')));
});
