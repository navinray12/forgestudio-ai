import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

async function fixture({ role = 'ADMIN', overrides = [], lookupFailure = false, auditFailure = false } = {}) {
  const calls = { committed: [], pending: [], lookups: [], rollbacks: 0 };
  const tx = {
    website: { findUnique: async () => ({ userId: 'owner' }) },
    websiteCollaborator: { findUnique: async () => ({ userId: 'target' }) },
    granularPermission: {
      upsert: async (input) => { calls.pending.push('permission'); return input.create; },
      deleteMany: async () => { calls.pending.push('delete'); return { count: 1 }; },
    },
    auditLog: { create: async () => { if (auditFailure) throw new Error('audit unavailable'); calls.pending.push('audit'); } },
  };
  const prisma = {
    granularPermission: { findMany: async (input) => {
      calls.lookups.push(input);
      if (lookupFailure) throw new Error('permission store unavailable');
      return overrides.map(entry => ({resourceId: "*", ...entry})).filter((entry) => input.where.capability.in.includes(entry.capability));
    } },
    $transaction: async (operation) => {
      try { const result = await operation(tx); calls.committed.push(...calls.pending); return result; }
      catch (error) { calls.rollbacks++; throw error; }
      finally { calls.pending = []; }
    },
  };
  const service = await loadTypeScript('backend/src/services/permission.service.ts', {
    '../config/prisma.js': { prisma },
    './website.service.js': { getWebsiteById: async () => ({ userId: 'owner', userPermission: role }) },
  });
  return { service, calls, tx };
}

for (const role of ['ADMIN', 'OWNER', 'PROJECT_OWNER', 'DESIGNER']) {
  test(`AUTH-002: ${role} fails closed when overrides cannot be read`, async () => {
    const f = await fixture({ role, lookupFailure: true });
    assert.equal(await f.service.canUserAccessResource('actor', 'site', '*', 'VIEW'), false);
  });
}

test('AUTH-002: wildcard deny wins over a resource allow', async () => {
  const f = await fixture({ overrides: [
    { capability: 'PUBLISH', resourceId: '*', effect: 'DENY' },
    { capability: 'PUBLISH', resourceId: 'page', effect: 'ALLOW' },
  ] });
  assert.equal(await f.service.canUserAccessResource('actor', 'site', 'page', 'PUBLISH'), false);
});

for (const capability of ['EDIT_CONTENT', 'EDIT_DESIGN']) {
  test(`AUTH-002: generic EDIT denial also blocks ${capability}`, async () => {
    const f = await fixture({ overrides: [{ capability: 'EDIT', effect: 'DENY' }] });
    assert.equal(await f.service.canUserAccessResource('actor', 'site', 'page', capability), false);
  });
}

test('AUTH-002: content-editor role does not gain design editing via generic EDIT alias', async () => {
  const f = await fixture({ role: 'CONTENT_EDITOR' });
  assert.equal(await f.service.canUserAccessResource('actor', 'site', '*', 'EDIT_DESIGN'), false);
  assert.equal(await f.service.canUserAccessResource('actor', 'site', '*', 'EDIT_CONTENT'), true);
});

test('AUTH-002: unknown capability is denied for owners', async () => {
  const f = await fixture({ role: 'OWNER' });
  assert.equal(await f.service.canUserAccessResource('actor', 'site', '*', 'ROOT_SHELL'), false);
  assert.equal(f.calls.lookups.length, 0);
});

test('AUTH-002: known explicit grant remains usable', async () => {
  const f = await fixture({ role: 'VIEWER', overrides: [{ capability: 'COMMENT', effect: 'ALLOW' }] });
  assert.equal(await f.service.canUserAccessResource('actor', 'site', '*', 'COMMENT'), true);
});

test('AUTH-002: permission middleware refuses absent website scope', async () => {
  const f = await fixture(); let error;
  await f.service.authorizeCapability('VIEW')({ params: {}, query: {} }, { locals: { user: { id: 'actor' } } }, (e) => { error = e; });
  assert.equal(error.code, 'WEBSITE_SCOPE_REQUIRED');
});

for (const effect of ['ALLOW', 'DENY', 'INHERIT']) {
  test(`SEC-003: ${effect} and audit commit in one transaction`, async () => {
    const f = await fixture();
    const result = await f.service.setGranularPermission('site', 'actor', 'target', '*', 'VIEW', effect);
    assert.equal(result.success, true);
    assert.deepEqual(f.calls.committed, [effect === 'INHERIT' ? 'delete' : 'permission', 'audit']);
  });
  test(`SEC-003: audit failure rolls back ${effect}`, async () => {
    const f = await fixture({ auditFailure: true });
    await assert.rejects(f.service.setGranularPermission('site', 'actor', 'target', '*', 'VIEW', effect), /audit unavailable/);
    assert.equal(f.calls.rollbacks, 1); assert.equal(f.calls.committed.length, 0);
  });
}

test('AUTH-002: caller cannot grant beyond its own capability', async () => {
  const f = await fixture({ overrides: [{ capability: 'PUBLISH', effect: 'DENY' }] });
  await assert.rejects(f.service.setGranularPermission('site', 'actor', 'target', '*', 'PUBLISH', 'ALLOW'), { code: 'FORBIDDEN' });
  assert.equal(f.calls.committed.length, 0);
});

test('AUTH-002: owner restriction and unregistered grants are rejected', async () => {
  const f = await fixture();
  await assert.rejects(f.service.setGranularPermission('site', 'actor', 'owner', '*', 'VIEW', 'DENY'), { code: 'FORBIDDEN' });
  await assert.rejects(f.service.setGranularPermission('site', 'actor', 'target', '*', 'ROOT_SHELL', 'ALLOW'), { code: 'BAD_REQUEST' });
});
