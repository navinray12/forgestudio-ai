import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { pgPool } from "../config/prisma.js";
import { withTenantTransaction } from "../platform/tenancy/tenant-unit-of-work.js";
import {
  UnknownExternalOutcome, appendPlatformOutbox, dispatchOutboxBatch, failJob, leaseJobs,
  listDeadLetters, listReconciliationCases, replayDeadLetter, resolveReconciliationCase,
} from "../platform/reliability/postgres-queue.js";

const id=()=>crypto.randomUUID();

async function fixture(){
  const user=id(),org=id();
  await pgPool.query(`INSERT INTO users (id,email,"fullName","authEpoch","emailVerified","phoneVerified",status,role,"createdAt","updatedAt")
    VALUES ($1::uuid,$2,'Queue Operator',1,true,false,'ACTIVE','PLATFORM_ADMIN',NOW(),NOW())`,[user,`queue-${user}@example.test`]);
  await pgPool.query(`INSERT INTO organizations (id,name,slug,"ownerId","createdAt","updatedAt") VALUES ($1::uuid,'Queue Org',$2,$3::uuid,NOW(),NOW())`,[org,`queue-${org}`,user]);
  await pgPool.query(`INSERT INTO organization_members (id,"organizationId","userId",role,"createdAt","updatedAt")
    VALUES ($1::uuid,$2::uuid,$3::uuid,'OWNER',NOW(),NOW())`,[id(),org,user]);
  return {user,org};
}
async function enqueue(org:string,user:string,type:string){
  await withTenantTransaction({organizationId:org,actorId:user},async client=>{
    await appendPlatformOutbox(client,{organizationId:org,actorId:user,eventType:"TEST_JOB",aggregateType:"organization",aggregateId:org,payload:{type},jobType:type});
  });
  await dispatchOutboxBatch(10);
  const jobs=await leaseJobs("durable-test-worker",10,30);
  const job=jobs.find(j=>j.jobType===type);
  assert.ok(job); return job!;
}

test("unknown external outcome becomes reconciliation-required instead of blind retry",async()=>{
  const f=await fixture();
  const job=await enqueue(f.org,f.user,"fixture.unknown-outcome");
  await failJob(job,"durable-test-worker",new UnknownExternalOutcome("fixture-provider","provider timed out after accepting bytes","provider-ref-1",{operation:"publish"}));
  const cases=await listReconciliationCases();
  const item=cases.find((x:any)=>x.jobId===job.id);
  assert.ok(item); assert.equal(item.status,"OPEN"); assert.equal(item.provider,"fixture-provider");
  const resolved=await resolveReconciliationCase(item.id,f.user,"Provider status was verified manually as completed","RESOLVED");
  assert.equal(resolved.status,"RESOLVED");
});

test("terminal retries move to DLQ and explicit replay reuses durable job identity",async()=>{
  const f=await fixture();
  const job=await enqueue(f.org,f.user,"fixture.dead-letter");
  await pgPool.query(`UPDATE platform_jobs SET "maxAttempts"=1 WHERE id=$1::uuid`,[job.id]);
  await failJob({...job,maxAttempts:1},"durable-test-worker",new Error("terminal fixture failure"));
  const dead=await listDeadLetters();
  const item=dead.find((x:any)=>x.jobId===job.id);
  assert.ok(item); assert.equal(item.replayedAt,null);
  const replay=await replayDeadLetter(item.id,f.user);
  assert.equal(replay.jobId,job.id); assert.equal(replay.status,"RETRYING");
  await assert.rejects(()=>replayDeadLetter(item.id,f.user),/already been replayed/i);
});
