import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

async function fixture({ status = 'ACTIVE', apiKey = false, failure = false, revoked = false } = {}) {
  const calls = []; const user = { id: 'user', status, authEpoch: 1 };
  const session = { id: 'session', user, authEpoch: 1, authMethod: 'local', audience: 'TENANT', authTime: new Date(), expiresAt: new Date(Date.now()+60000), revokedAt: null, lastUsedAt: new Date() };
  const prisma = { session: { findUnique: async () => { if(failure) throw new Error('private database detail'); return session; } } };
  const service = await loadTypeScript('backend/src/middlewares/api-v1.auth.ts', {
    '../config/prisma.js': { prisma }, '../config/auth.js': { AUTH_COOKIE_NAME: 'forge_session' },
    '../services/apiKey.service.js': { verifyApiKey: async () => revoked ? {error:'REVOKED'} : apiKey ? {user,apiKey:{scopes:['websites:read']}} : null },
  });
  const req = { cookies: { forge_session: 'cookie' }, headers: {} };
  const res = { locals: {} }; const next = (error) => calls.push(error);
  return { service, req, res, next, calls, prisma };
}

for (const status of ['SUSPENDED','DELETED']) for (const apiKey of [false,true]) {
  test(`AUTH-003: API ${apiKey?'key':'session'} blocks ${status}`, async () => {
    const f=await fixture({status,apiKey}); f.req.headers.authorization='Bearer token';
    await f.service.authenticateApiV1(f.req,f.res,f.next);
    assert.equal(f.calls[0].code,'ACCOUNT_INACTIVE'); assert.equal(f.res.locals.user,undefined);
  });
}

test('AUTH-003: revoked key cannot fall back to an unrelated valid cookie', async () => {
  const f=await fixture({revoked:true}); f.req.headers.authorization='Bearer revoked';
  await f.service.authenticateApiV1(f.req,f.res,f.next);
  assert.equal(f.calls[0].code,'UNAUTHORIZED');
});

test('AUTH-001: public API and browser session use the same validation', async () => {
  const f=await fixture(); await f.service.authenticateApiV1(f.req,f.res,f.next);
  assert.equal(f.calls[0],undefined); assert.equal(f.res.locals.authType,'SESSION');
});

test('SEC-002: database failure propagates to central serializer without authenticating', async () => {
  const f=await fixture({failure:true}); await f.service.authenticateApiV1(f.req,f.res,f.next);
  assert.match(f.calls[0].message,/private database detail/); assert.equal(f.res.locals.user,undefined);
});

for (const header of ['Basic abc','Bearer ','Bearer '+'x'.repeat(4097)]) {
  test(`AUTH-001: reject malformed authorization (${header.length} chars)`,async()=>{
    const f=await fixture(); f.req.headers.authorization=header;
    await f.service.authenticateApiV1(f.req,f.res,f.next); assert.equal(f.calls[0].code,'UNAUTHORIZED');
  });
}

test('AUTH-002: scope middleware alone cannot authorize an absent principal',async()=>{
  const f=await fixture(); f.service.requireApiV1Scope('websites:write')(f.req,f.res,f.next);
  assert.equal(f.calls[0].code,'UNAUTHORIZED');
});

test('AUTH-002: read-only API key cannot perform a write',async()=>{
  const f=await fixture({apiKey:true}); f.req.headers.authorization='Bearer key';
  await f.service.authenticateApiV1(f.req,f.res,f.next);
  f.service.requireApiV1Scope('websites:write')(f.req,f.res,f.next);
  assert.equal(f.calls[1].code,'FORBIDDEN');
});

test('AUTH-002: previously exposed analytics action is registered without arbitrary grants',async()=>{
  const service=await loadTypeScript('backend/src/services/permissions/capabilities.ts');
  assert.equal(service.roleGrants('OWNER','EDIT_ANALYTICS'),true);
  assert.equal(service.roleGrants('VIEWER','EDIT_ANALYTICS'),false);
  assert.equal(service.roleGrants('OWNER','ROOT_SHELL'),false);
});
