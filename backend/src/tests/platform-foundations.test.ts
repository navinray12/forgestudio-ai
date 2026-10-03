import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import pg from "pg";
import { pgPool } from "../config/prisma.js";
import { processStripeWebhook, reserveUsage } from "../modules/billing/billing.service.js";
import { appendPlatformOutbox, dispatchOutboxBatch, leaseJobs } from "../platform/reliability/postgres-queue.js";
import { withTenantTransaction } from "../platform/tenancy/tenant-unit-of-work.js";
import { capabilityRegistry, validateCapabilityRegistry } from "../platform/control/capability-registry.js";

const uuid = () => crypto.randomUUID();

async function fixture() {
  const user1=uuid(), user2=uuid(), org1=uuid(), org2=uuid();
  await pgPool.query(`INSERT INTO users (id,email,"fullName","authEpoch","emailVerified","phoneVerified",status,role,"createdAt","updatedAt") VALUES
    ($1::uuid,$2,'Owner One',1,true,false,'ACTIVE','USER',NOW(),NOW()),
    ($3::uuid,$4,'Owner Two',1,true,false,'ACTIVE','USER',NOW(),NOW())`, [user1,`one-${user1}@example.test`,user2,`two-${user2}@example.test`]);
  await pgPool.query(`INSERT INTO organizations (id,name,slug,"ownerId","createdAt","updatedAt") VALUES
    ($1::uuid,'Org One',$2,$3::uuid,NOW(),NOW()),($4::uuid,'Org Two',$5,$6::uuid,NOW(),NOW())`,
    [org1,`org-${org1}`,user1,org2,`org-${org2}`,user2]);
  await pgPool.query(`INSERT INTO organization_members (id,"organizationId","userId",role,"createdAt","updatedAt") VALUES
    ($1::uuid,$2::uuid,$3::uuid,'OWNER',NOW(),NOW()),($4::uuid,$5::uuid,$6::uuid,'OWNER',NOW(),NOW())`,
    [uuid(),org1,user1,uuid(),org2,user2]);
  return {user1,user2,org1,org2};
}

test("capability registry is internally valid and locked controls cannot be switchable", () => {
  assert.equal(validateCapabilityRegistry(), true);
  assert.ok(capabilityRegistry.some((c)=>c.id==="authentication"&&c.changeClass==="L"&&c.criticality==="LOCKED"));
  assert.ok(capabilityRegistry.some((c)=>c.id==="tenant-isolation"&&c.changeClass==="L"));
});

test("forced RLS isolates organization billing rows for a non-owner role", async () => {
  const f=await fixture();
  await pgPool.query(`INSERT INTO organization_billing_accounts (id,"organizationId",provider,status) VALUES
    ($1::uuid,$2::uuid,'stripe','ACTIVE'),($3::uuid,$4::uuid,'stripe','ACTIVE')`,[uuid(),f.org1,uuid(),f.org2]);
  await pgPool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='forge_rls_test') THEN CREATE ROLE forge_rls_test NOLOGIN; END IF; END $$`);
  await pgPool.query(`GRANT USAGE ON SCHEMA public TO forge_rls_test; GRANT SELECT ON organization_billing_accounts TO forge_rls_test`);
  const client=await pgPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE forge_rls_test");
    await client.query("SELECT set_config('app.tenant_id',$1,true)",[f.org1]);
    const rows=await client.query(`SELECT "organizationId" FROM organization_billing_accounts`);
    assert.deepEqual(rows.rows.map((r)=>r.organizationId),[f.org1]);
    await client.query("ROLLBACK");
  } finally { client.release(); }
});

test("verified Stripe event is idempotent and creates organization subscription", async () => {
  const f=await fixture();
  process.env.STRIPE_WEBHOOK_SECRET="whsec_fixture";
  process.env.FORGE_PLAN_CATALOG_JSON=JSON.stringify({pro:{seatLimit:3,quotas:{"storage.bytes":1000}}});
  const event={id:`evt_${uuid()}`,type:"checkout.session.completed",created:Math.floor(Date.now()/1000),data:{object:{
    customer:"cus_fixture",subscription:"sub_fixture",metadata:{organizationId:f.org1,planKey:"pro"}
  }}};
  const raw=Buffer.from(JSON.stringify(event));
  const ts=Math.floor(Date.now()/1000);
  const sig=crypto.createHmac("sha256",process.env.STRIPE_WEBHOOK_SECRET).update(`${ts}.`).update(raw).digest("hex");
  const header=`t=${ts},v1=${sig}`;
  const first=await processStripeWebhook(raw,header);
  const second=await processStripeWebhook(raw,header);
  assert.equal(first.duplicate,false);
  assert.equal(second.duplicate,true);
  const sub=await withTenantTransaction({organizationId:f.org1},async(c)=>c.query(`SELECT "planKey",status,"seatLimit" FROM organization_subscriptions_v2 WHERE "organizationId"=$1::uuid`,[f.org1]));
  assert.equal(sub.rows[0].planKey,"pro");
  assert.equal(sub.rows[0].status,"ACTIVE");
  assert.equal(sub.rows[0].seatLimit,3);
});

test("usage reservation enforces strict quota and idempotency", async () => {
  const f=await fixture();
  process.env.FORGE_PLAN_CATALOG_JSON=JSON.stringify({pro:{seatLimit:1,quotas:{"storage.bytes":10}}});
  await withTenantTransaction({organizationId:f.org1},async(c)=>{
    await c.query(`INSERT INTO organization_subscriptions_v2 (id,"organizationId","planKey",provider,status,"seatLimit",quotas)
      VALUES ($1::uuid,$2::uuid,'pro','stripe','ACTIVE',1,$3::jsonb)`,[uuid(),f.org1,JSON.stringify({"storage.bytes":10})]);
  });
  const one=await reserveUsage({organizationId:f.org1,actorId:f.user1,resource:"storage.bytes",amount:8,key:"quota-key-0001"});
  const replay=await reserveUsage({organizationId:f.org1,actorId:f.user1,resource:"storage.bytes",amount:8,key:"quota-key-0001"});
  assert.equal(replay.id,one.id);
  await assert.rejects(()=>reserveUsage({organizationId:f.org1,actorId:f.user1,resource:"storage.bytes",amount:3,key:"quota-key-0002"}),/quota exceeded/i);
});

test("outbox dispatch and job lease are durable and duplicate resistant", async () => {
  const f=await fixture();
  await withTenantTransaction({organizationId:f.org1,actorId:f.user1},async(c)=>{
    await appendPlatformOutbox(c,{organizationId:f.org1,actorId:f.user1,eventType:"TEST_EVENT",aggregateType:"organization",aggregateId:f.org1,payload:{ok:true},jobType:"fixture.job"});
  });
  assert.equal(await dispatchOutboxBatch(10),1);
  assert.equal(await dispatchOutboxBatch(10),0);
  const jobs=await leaseJobs("fixture-worker",10,30);
  assert.equal(jobs.length,1);
  assert.equal(jobs[0].jobType,"fixture.job");
  assert.equal(jobs[0].organizationId,f.org1);
});
