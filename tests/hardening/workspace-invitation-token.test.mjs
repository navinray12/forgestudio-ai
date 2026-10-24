import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

async function fixture(key = 'ab'.repeat(32)) {
  return loadTypeScript('backend/src/services/workspaces/invitation-token.ts', {}, {
    process: { env: { NODE_ENV: 'test', FRONTEND_URL: 'https://forge.example', WORKSPACE_INVITATION_TOKEN_KEY: key } },
  });
}
test('invitation secrets are domain-separated, versioned, hash-verifiable and kept in URL fragments', async () => {
  const api = await fixture();
  const token = api.invitationToken('invitation', 1);
  assert.match(token, /^[\w-]{43}$/);
  assert.equal(api.matchesInvitationToken(token, api.invitationTokenHash(token)), true);
  assert.equal(api.matchesInvitationToken(api.invitationToken('invitation', 2), api.invitationTokenHash(token)), false);
  assert.notEqual(token, api.invitationToken('different-invitation', 1));
  const link = new URL(api.invitationLink('invitation', token));
  assert.equal(link.search, '');
  assert.equal(link.hash, '#token=' + token);
  assert.equal(link.origin, 'https://forge.example');
  assert.equal(api.matchesInvitationToken(null, null), false);
  assert.equal(api.matchesInvitationToken('x'.repeat(4096), api.invitationTokenHash(token)), false);
});
test('missing signing configuration fails closed', async () => {
  const api = await fixture('');
  assert.throws(() => api.invitationToken('invitation', 1), { code: 'INVITATION_DELIVERY_UNAVAILABLE' });
});
test('emails normalize case and whitespace, and malformed addresses fail', async () => {
  const api = await fixture();
  assert.equal(api.invitationEmail('  Recipient@Example.Test '), 'recipient@example.test');
  for (const value of ['bad', '', null, 'a@example.test\r\nBcc:someone@example.test'])
    assert.throws(() => api.invitationEmail(value), { code: 'INVALID_EMAIL' });
});
