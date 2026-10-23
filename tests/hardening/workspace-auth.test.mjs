import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

const apiPath = 'frontend/src/features/workspaces/workspace-api.ts';

test('workspace requests use cookies even with an obsolete bearer token in storage', async () => {
  const requests = [];
  const api = await loadTypeScript(apiPath, {}, {
    localStorage: { getItem() { throw new Error('Legacy storage must not be read'); } },
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    },
  });
  await api.workspaceRequest('https://api.example', '/');
  await api.workspaceRequest('https://api.example', '/id/invitations', {
    method: 'POST', payload: { userId: 'recipient', role: 'MEMBER' }, key: 'retry-key', etag: '"id:1"',
  });
  for (const request of requests) {
    assert.equal(request.credentials, 'include');
    assert.equal(Object.keys(request.headers).some(name => name.toLowerCase() === 'authorization'), false);
  }
  assert.equal(requests[1].headers['Idempotency-Key'], 'retry-key');
  assert.equal(requests[1].headers['If-Match'], '"id:1"');
  assert.equal(requests[1].headers['X-Forge-Intent'], 'workspace-command');
  assert.equal(JSON.parse(requests[1].body).role, 'MEMBER');
});

for (const invalidJson of [false, true]) test(`401 has a consistent session error (invalid JSON: ${invalidJson})`, async () => {
  const api = await loadTypeScript(apiPath, {}, {
    fetch: async () => ({ ok: false, status: 401, json: async () => {
      if (invalidJson) throw new SyntaxError();
      return { message: 'Invalid or expired session' };
    } }),
  });
  await assert.rejects(api.workspaceRequest('', ''), error =>
    error instanceof api.WorkspaceRequestError && error.status === 401 &&
    error.code === 'SESSION_EXPIRED' && error.message.includes('Sign in again'));
});

test('permission and network failures are not treated as expired sessions', async () => {
  const networkError = new Error('Offline');
  for (const status of [403, 409, 500, null]) {
    const api = await loadTypeScript(apiPath, {}, { fetch: async () => {
      if (status === null) throw networkError;
      return { ok: false, status, json: async () => ({ error: { code: 'ORIGINAL', message: 'Original failure' } }) };
    } });
    await assert.rejects(api.workspaceRequest('', ''), error => status === null ? error === networkError :
      error.status === status && error.code === 'ORIGINAL' && error.message === 'Original failure');
  }
});

