import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadTypeScript } from './load-typescript.mjs';

const id = '94457617-4d53-4637-8b21-108d82246f2a';
const actorId = 'e58d8a53-f557-4e20-8617-1f79c6644186';
const workspaceId = '4bbdb207-2bbe-484f-ab50-efc014d47265';
const token = 'a'.repeat(43);
const storageKey = 'forge.workspace.pending-invitation';
async function fixture(hash = '#token=' + token, blocked = false) {
  const values = new Map();
  const location = { pathname: '/workspace-invitations/' + id, search: '', hash };
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value), removeItem: key => values.delete(key) };
  const window = { location, history: { state: null, replaceState(_state,_title,url) {
    const parsed=new URL(url,'https://forge.example'); Object.assign(location,{pathname:parsed.pathname,search:parsed.search,hash:parsed.hash});
  } } };
  Object.defineProperty(window,'sessionStorage',{get() { if (blocked) throw new Error('Storage unavailable'); return storage; }});
  const api=await loadTypeScript('frontend/src/features/workspaces/invitation-context.ts',{}, {window,URLSearchParams,crypto:{randomUUID}});
  return {api,window,values};
}
test('capture removes the fragment and retains only tab-scoped invitation context',async()=>{
  const f=await fixture(); const pending=f.api.captureInvitation(id);
  assert.equal(f.window.location.hash,''); assert.equal(pending.token,token); assert.equal(f.api.readPendingInvitation().id,id);
  assert.equal(f.api.invitationReturnFromDashboard(),null);
});
test('login/signup carry only an ID, preserve the secret, and resume through either authentication flow',async()=>{
  const f=await fixture(); const pending=f.api.captureInvitation(id);
  const login=f.api.beginInvitationAuthentication(pending,'login');
  assert.equal(login,'/login?workspaceInvite='+id); assert.equal(login.includes(token),false);
  assert.equal(f.api.invitationAuthLink('signup','?workspaceInvite='+id),'/signup?workspaceInvite='+id);
  assert.equal(f.api.invitationReturnFromAuth('?workspaceInvite='+id),'/workspace-invitations/'+id);
  assert.equal(f.api.invitationReturnFromDashboard(),null);
  assert.equal(f.api.markInvitationManagedAuthentication('?workspaceInvite='+id),true);
  assert.equal(f.api.invitationReturnFromDashboard(),'/workspace-invitations/'+id);
  const resumed=f.api.captureInvitation(id); assert.equal(resumed.token,token);
  assert.equal(f.api.invitationReturnFromDashboard(),null);
});
test('ordinary login and untrusted return parameters retain their existing destinations',async()=>{
  const f=await fixture(); const pending=f.api.captureInvitation(id);
  assert.equal(f.api.invitationReturnFromAuth('?workspaceInvite='+id),null);
  f.api.beginInvitationAuthentication(pending,'login');
  for(const search of ['', '?returnTo=https://attacker.example', '?workspaceInvite=//attacker.example', '?workspaceInvite='+randomUUID(), '?workspaceInvite='+id+'&workspaceInvite='+id])
    assert.equal(f.api.invitationReturnFromAuth(search),null);
  assert.equal(f.api.invitationAuthLink('signup',''),'/signup');
});
test('cancelled managed authentication cannot divert an unrelated later dashboard visit',async()=>{
  const f=await fixture();const pending=f.api.captureInvitation(id);f.api.beginInvitationAuthentication(pending,'login');
  assert.equal(f.api.markInvitationManagedAuthentication('?workspaceInvite='+id),true);
  f.api.cancelInvitationManagedAuthentication();assert.equal(f.api.invitationReturnFromDashboard(),null);
  assert.equal(f.api.readPendingInvitation().token,token);
});
test('malformed or duplicate fragment proofs never fall back to a previously saved secret',async()=>{
  for(const hash of ['#token=bad','#token='+token+'&token='+token,'#token='+token+'&other=1']){
    const f=await fixture(); f.api.captureInvitation(id);f.window.location.hash=hash;
    assert.equal(f.api.captureInvitation(id),null);assert.equal(f.window.location.hash,'');assert.equal(f.api.readPendingInvitation(),null);
  }
});
test('missing or malformed invitation IDs cannot create navigation destinations',async()=>{
  const f=await fixture();assert.equal(f.api.captureInvitation('//attacker.example'),null);assert.equal(f.window.location.hash,'');
  assert.equal(f.api.captureInvitation(id),null);
});
test('acceptance retries persist one key across reloads and remain bound to their actor and workspace',async()=>{
  const f=await fixture();const first=f.api.acceptanceAttempt(f.api.captureInvitation(id),actorId,workspaceId);
  const resumed=f.api.captureInvitation(id);const retry=f.api.acceptanceAttempt(resumed,actorId,workspaceId);
  assert.equal(first.attempt.key,retry.attempt.key);
  assert.notEqual(f.api.acceptanceAttempt(resumed,randomUUID(),workspaceId).attempt.key,first.attempt.key);
  assert.notEqual(f.api.acceptanceAttempt(resumed,actorId,randomUUID()).attempt.key,first.attempt.key);
});
test('expired and invalid saved contexts are discarded without navigating or exposing their secret',async()=>{
  for(const savedAt of [Date.now()-61*60_000,Date.now()+60_000]){
    const f=await fixture('');f.values.set(storageKey,JSON.stringify({id,token,savedAt,awaitingAuth:true}));
    assert.equal(f.api.readPendingInvitation(),null);assert.equal(f.values.has(storageKey),false);
    assert.equal(f.api.invitationReturnFromDashboard(),null);
  }
});
test('blocked session storage fails authentication handoff explicitly while retaining the current in-memory proof',async()=>{
  const f=await fixture('#token='+token,true);const pending=f.api.captureInvitation(id);
  assert.equal(f.api.captureInvitation(id).token,token); // React StrictMode initializes twice.
  assert.equal(pending.token,token);assert.equal(f.api.beginInvitationAuthentication(pending,'login'),null);
});
test('successful cleanup removes only the matching invitation and preserves unrelated browser state',async()=>{
  const f=await fixture();f.api.captureInvitation(id);f.values.set('business-draft','keep');
  f.api.clearPendingInvitation(randomUUID());assert.equal(f.api.readPendingInvitation().id,id);
  f.api.clearPendingInvitation(id);assert.equal(f.api.readPendingInvitation(),null);assert.equal(f.values.get('business-draft'),'keep');
});
