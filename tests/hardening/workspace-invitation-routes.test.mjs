import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

async function fixture() {
  const handlers = new Map(); const calls = [];
  const router = { use() {}, get() {}, patch() {}, post(path, handler) { handlers.set(path, handler); } };
  const spy = name => async (...args) => { calls.push({ name, args }); return { resourceId: 'workspace' }; };
  await loadTypeScript('backend/src/routes/workspace-lifecycle.routes.ts', {
    express: { Router: () => router },
    '../middlewares/auth.middleware.js': { requireAuth() {} },
    '../middlewares/privileged-mutation.js': { requirePrivilegedMutation() {} },
    '../services/workspaces/lifecycle.service.js': {},
    '../services/workspaces/invitation.service.js': Object.fromEntries(['inviteWorkspaceMemberByEmail','inviteWorkspaceMember',
      'acceptWorkspaceInvitation','resolveWorkspaceInvitation'].map(name => [name,spy(name)])),
  });
  async function request(route, body, intent = true) {
    let error; let status = 200; let result;
    const id = '12dba7c1-c4a9-4809-87b0-55497c69d10e';
    await handlers.get(route)({ body, params: { id, invitationId: id }, get: name =>
      name === 'X-Forge-Intent' ? intent ? 'workspace-command' : undefined : 'test-key-123' },
    { locals: { user: { id: 'actor' } }, setHeader() {}, status(value) { status=value; return this; }, json(value) { result=value; } },
    failure => { error=failure; });
    return { error,status,result };
  }
  return { calls, request };
}
test('email and legacy invitation requests dispatch to the correct authorized service', async () => {
  const f=await fixture();
  assert.equal((await f.request('/:id/invitations',{email:' New@Example.Test ',role:'MEMBER'})).status,201);
  assert.equal(f.calls[0].name,'inviteWorkspaceMemberByEmail'); assert.equal(f.calls[0].args[2],'new@example.test');
  await f.request('/:id/invitations',{userId:'12dba7c1-c4a9-4809-87b0-55497c69d10e',role:'MEMBER'});
  assert.equal(f.calls[1].name,'inviteWorkspaceMember');
});
test('mixed recipient identities, invalid email, elevated roles and missing intent fail closed', async () => {
  const f=await fixture();
  for (const body of [{email:'bad',role:'MEMBER'}, {email:'new@example.test',role:'OWNER'},
    {email:'new@example.test',role:'MEMBER',userId:'12dba7c1-c4a9-4809-87b0-55497c69d10e'}])
    assert.equal((await f.request('/:id/invitations',body)).error.code,'VALIDATION_ERROR');
  assert.equal((await f.request('/:id/invitations',{email:'new@example.test',role:'MEMBER'},false)).error.code,'REQUEST_INTENT_REQUIRED');
  assert.equal(f.calls.length,0);
});
test('resolve and acceptance receive the proof in JSON; legacy empty acceptance remains valid', async () => {
  const f=await fixture(); const token='a'.repeat(43);
  assert.equal((await f.request('/invitations/:invitationId/resolve',{token})).error,undefined);
  assert.equal(f.calls[0].name,'resolveWorkspaceInvitation'); assert.equal(f.calls[0].args[2],token);
  await f.request('/:id/invitations/:invitationId/accept',{token}); assert.equal(f.calls[1].args[4],token);
  await f.request('/:id/invitations/:invitationId/accept',{}); assert.equal(f.calls[2].args[4],undefined);
  assert.equal((await f.request('/:id/invitations/:invitationId/accept',{token:'bad'})).error.code,'VALIDATION_ERROR');
});
