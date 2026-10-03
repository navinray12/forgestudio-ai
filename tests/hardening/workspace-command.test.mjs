import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';

async function fixture({auditFailure=false,journalFailure=false,conflicts=0}={}) {
  let committed={journal:[],outbox:0,audit:0,changes:0}; let attempts=0; let allowed=true;
  const contexts=[];
  const prisma={ $transaction:async(run)=>{
    attempts++;if(attempts<=conflicts)throw Object.assign(new Error('serialization'),{code:'P2034'});
    const state=structuredClone(committed);let tenant;
    const tx={
      user:{findUnique:async()=>({status:'ACTIVE'})},
      auditLog:{create:async()=>{if(auditFailure)throw new Error('audit failed');state.audit++;}},
      $queryRaw:async(strings,...values)=>{
        const sql=strings.join('?');
        if(sql.includes('set_config')){tenant=values[0];contexts.push(tenant);return [];}
        assert.equal(tenant,'organization');return state.journal.filter((item)=>item.key===values[3]);
      },
      $executeRaw:async(strings,...values)=>{
        const sql=strings.join('?');
        if(sql.includes('workspace_outbox'))state.outbox++;
        if(sql.includes('workspace_command_journal')){
          if(journalFailure)throw new Error('journal failed');
          state.journal.push({key:values[3],requestHash:values[4],result:JSON.parse(values[5])});
        }
        return 1;
      },
      change:()=>state.changes++,
    };
    const result=await run(tx);committed=state;return result;
  }};
  const {workspaceCommand}=await loadTypeScript('backend/src/services/workspaces/command.ts',{'../../config/prisma.js':{prisma}});
  const input={actorId:'actor',operation:'WORKSPACE_CREATED',key:'test-key-123',payload:{name:'Engineering'},
    authorize:async()=>{if(!allowed)throw new Error('membership revoked');return {organizationId:'organization'};},
    execute:async(tx)=>{tx.change();return {resourceId:'workspace'};},
  };
  return {workspaceCommand,input,state:()=>committed,attempts:()=>attempts,contexts,revoke:()=>{allowed=false;}};
}

test('API-003: identical retry converges on one mutation, audit and outbox intent',async()=>{
  const f=await fixture();await f.workspaceCommand(f.input);await f.workspaceCommand(f.input);
  assert.equal(f.state().changes,1);assert.equal(f.state().audit,1);assert.equal(f.state().outbox,1);
  // Each transaction establishes both actor and tenant RLS context.
  assert.deepEqual(f.contexts,['actor','organization','actor','organization']);
});

test('API-003: changed payload with the same key conflicts',async()=>{
  const f=await fixture();await f.workspaceCommand(f.input);
  await assert.rejects(f.workspaceCommand({...f.input,payload:{name:'Finance'}}),{code:'IDEMPOTENCY_CONFLICT'});
  assert.equal(f.state().changes,1);
});

test('AUTH-003: revocation is checked before returning a stored result',async()=>{
  const f=await fixture();await f.workspaceCommand(f.input);f.revoke();
  await assert.rejects(f.workspaceCommand(f.input),/membership revoked/);
});

for(const failure of ['auditFailure','journalFailure'])test(`SEC-003: ${failure} prevents all transactional commit`,async()=>{
  const f=await fixture({[failure]:true});await assert.rejects(f.workspaceCommand(f.input),/failed/);
  assert.equal(f.state().changes,0);assert.equal(f.state().audit,0);assert.equal(f.state().outbox,0);
});

test('DATA-001: local serialization conflict retries without duplicate committed effects',async()=>{
  const f=await fixture({conflicts:1});await f.workspaceCommand(f.input);
  assert.equal(f.attempts(),2);assert.equal(f.state().changes,1);
});

test('REL-001: conflict retry budget is finite',async()=>{
  const f=await fixture({conflicts:5});
  await assert.rejects(f.workspaceCommand(f.input),{code:'CONCURRENT_CHANGE'});assert.equal(f.attempts(),3);
});

for(const key of ['',null,'a','x'.repeat(129),'invalid key'])test(`API-003: rejects invalid idempotency key ${typeof key}`,async()=>{
  const f=await fixture();await assert.rejects(f.workspaceCommand({...f.input,key}),{code:'IDEMPOTENCY_KEY_REQUIRED'});
  assert.equal(f.attempts(),0);
});
