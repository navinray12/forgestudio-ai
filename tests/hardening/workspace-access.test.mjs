import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';
const access = await loadTypeScript('backend/src/services/workspaces/access.ts');
function fixture({ workspaceRole='MEMBER', orgRole='MEMBER', orgMember=true, workspaceMember=true, owner='owner', actor='actor' }={}) {
  return { actor, tx: {
    workspace: { findUnique: async()=>({id:'workspace',organizationId:'organization',ownerId:owner}) },
    workspaceMember: { findUnique: async()=>workspaceMember ? {role:workspaceRole} : null },
    organization: { findUnique: async()=>({id:'organization',ownerId:orgRole==='OWNER'?actor:'org-owner'}) },
    organizationMember: { findUnique: async()=>orgMember ? {role:orgRole} : null },
    user: { findUnique: async()=>({id:actor,status:'ACTIVE'}) },
  } };
}

test('TEN-001: organization membership cannot replace private-workspace membership',async()=>{
  const f=fixture({orgRole:'OWNER',workspaceMember:false});
  await assert.rejects(access.requireWorkspace(f.tx,'workspace',f.actor),{code:'NOT_FOUND'});
});

test('TEN-001: stale workspace membership cannot survive removal from organization',async()=>{
  const f=fixture({orgMember:false});
  await assert.rejects(access.requireWorkspace(f.tx,'workspace',f.actor),{code:'NOT_FOUND'});
});

test('AUTH-002: organization owner role must not overwrite the actual workspace role',async()=>{
  const f=fixture({orgRole:'OWNER',workspaceRole:'MEMBER'});
  const context=await access.requireWorkspace(f.tx,'workspace',f.actor);
  assert.equal(context.membership.role,'MEMBER');
  assert.equal(context.organizationMembership.role,'OWNER');
  await assert.rejects(access.requireWorkspace(f.tx,'workspace',f.actor,true),{code:'FORBIDDEN'});
});

test('AUTH-002: a forged OWNER membership inconsistent with ownership is denied',async()=>{
  const f=fixture({workspaceRole:'OWNER'});
  await assert.rejects(access.requireWorkspace(f.tx,'workspace',f.actor),{code:'NOT_FOUND'});
});

test('TEN-001: legacy unowned workspace requires migration rather than guessing a tenant',async()=>{
  const f=fixture();f.tx.workspace.findUnique=async()=>({id:'workspace',organizationId:null,ownerId:'owner'});
  await assert.rejects(access.requireWorkspace(f.tx,'workspace',f.actor),{code:'WORKSPACE_MIGRATION_REQUIRED'});
});

for(const role of ['ADMIN','OWNER']) test(`AUTH-002: legitimate workspace ${role} can manage its scope`,async()=>{
  const f=fixture({workspaceRole:role,owner:role==='OWNER'?'actor':'owner'});
  assert.equal((await access.requireWorkspace(f.tx,'workspace',f.actor,true)).membership.role,role);
});

for(const role of ['OWNER','SUPER_ADMIN','__proto__','',null]) test(`AUTH-002: cannot submit privileged/invalid member role ${role}`,()=>{
  assert.throws(()=>access.memberRole(role),{code:'INVALID_ROLE'});
});

for(const value of ['',null,{},'x'.repeat(101)]) test(`API-002: reject invalid workspace name ${typeof value}`,()=>{
  assert.throws(()=>access.boundedName(value),{code:'INVALID_NAME'});
});

test('API-002: names are normalized without accepting arbitrary object input',()=>{
  assert.equal(access.boundedName('  Engineering  '),'Engineering');
});

test('AUTH-003: inactive actor cannot execute a workspace command',async()=>{
  const f=fixture();f.tx.user.findUnique=async()=>({status:'SUSPENDED'});
  await assert.rejects(access.requireActiveActor(f.tx,'actor'),{code:'ACCOUNT_INACTIVE'});
});
