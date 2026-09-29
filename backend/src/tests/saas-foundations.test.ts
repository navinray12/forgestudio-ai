import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma, pgPool } from "../config/prisma.js";
import { createOrganizationCheckout, reserveOrganizationUsage, getOrganizationBillingSummary } from "../services/billing/billing.service.js";
import { verifyStripeWebhook } from "../services/billing/stripe.adapter.js";
import { createPlatformChange, approvePlatformChange, applyPlatformChange } from "../services/control/control.service.js";
import { appendOutboxEvent, leaseOutboxBatch, markOutboxDispatched } from "../platform/execution/durable-outbox.js";
import { validateEgressUrl } from "../utils/safe-egress.js";
import { authorizeFileUpload } from "../services/files/file.service.js";

const database=new URL(process.env.DATABASE_URL||"invalid:");
if(process.env.FORGE_DISPOSABLE_TEST_DB!=="1"||!["127.0.0.1","localhost"].includes(database.hostname)||database.pathname!=="/forge_saas_foundations"){
  throw new Error("SaaS foundation tests require disposable local forge_saas_foundations");
}

test("SaaS production foundations",async t=>{
  t.after(async()=>{await prisma.$disconnect();await pgPool.end();});
  await pgPool.query(readFileSync("prisma/migrations/20260929013000_saas_production_foundations/migration.sql","utf8"));

  const owner=await prisma.user.create({data:{email:`owner-${randomUUID()}@example.test`,fullName:"Owner",status:"ACTIVE",role:"SUPER_ADMIN"}});
  const approver=await prisma.user.create({data:{email:`approver-${randomUUID()}@example.test`,fullName:"Approver",status:"ACTIVE",role:"PLATFORM_ADMIN"}});
  const member=await prisma.user.create({data:{email:`member-${randomUUID()}@example.test`,fullName:"Member",status:"ACTIVE"}});
  const outsider=await prisma.user.create({data:{email:`outsider-${randomUUID()}@example.test`,fullName:"Outsider",status:"ACTIVE"}});
  const org=await prisma.organization.create({data:{name:"Acme",slug:"acme-"+randomUUID(),ownerId:owner.id}});
  await prisma.organizationMember.createMany({data:[
    {organizationId:org.id,userId:owner.id,role:"OWNER"},
    {organizationId:org.id,userId:member.id,role:"MEMBER"},
  ]});
  const engineering=await prisma.workspace.create({data:{name:"Engineering",slug:"eng-"+randomUUID(),ownerId:owner.id,organizationId:org.id}});
  const finance=await prisma.workspace.create({data:{name:"Finance",slug:"fin-"+randomUUID(),ownerId:owner.id,organizationId:org.id}});
  await prisma.workspaceMember.createMany({data:[
    {workspaceId:engineering.id,userId:owner.id,role:"OWNER"},
    {workspaceId:engineering.id,userId:member.id,role:"MEMBER"},
    {workspaceId:finance.id,userId:owner.id,role:"OWNER"},
  ]});
  const site=await prisma.website.create({data:{userId:owner.id,organizationId:org.id,workspaceId:engineering.id,name:"Site",slug:"site-"+randomUUID()}});

  await t.test("forced RLS protects sibling workspaces and websites under non-owner role",async()=>{
    const role="forge_rls_"+randomUUID().replaceAll("-","");
    await pgPool.query(`CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOBYPASSRLS;
      GRANT SELECT ON organizations,organization_members,workspaces,workspace_members,websites TO "${role}"`);
    const client=await pgPool.connect();
    try{
      await client.query(`BEGIN;SET LOCAL ROLE "${role}"`);
      await client.query("SELECT set_config('app.actor_id',$1,true)",[member.id]);
      await client.query("SELECT set_config('app.tenant_id',$1,true)",[org.id]);
      const workspaces=await client.query("SELECT id FROM workspaces ORDER BY id");
      assert.deepEqual(workspaces.rows.map(r=>r.id),[engineering.id]);
      const websites=await client.query("SELECT id FROM websites");
      assert.deepEqual(websites.rows.map(r=>r.id),[site.id]);
      await client.query("SELECT set_config('app.actor_id',$1,true)",[outsider.id]);
      assert.equal((await client.query("SELECT id FROM websites")).rowCount,0);
      assert.equal((await client.query("SELECT id FROM workspaces")).rowCount,0);
      await client.query("ROLLBACK");
    }finally{
      client.release();
      await pgPool.query(`REVOKE ALL PRIVILEGES ON organizations,organization_members,workspaces,workspace_members,websites FROM "${role}";DROP ROLE "${role}"`);
    }
    const flags=await pgPool.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname IN ('organizations','organization_members','workspaces','workspace_members','websites')");
    assert.equal(flags.rows.length,5);assert.ok(flags.rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
  });

  await t.test("free organization subscription is explicit and strict quota reservations serialize",async()=>{
    const plan=await prisma.subscriptionPlan.create({data:{name:"Free org",slug:"free-org-"+randomUUID(),price:0,currency:"USD",billingInterval:"monthly",websiteLimit:1,storageLimitMb:100,aiCreditLimit:10,features:{seatLimit:2}}});
    const first=await createOrganizationCheckout({organizationId:org.id,actorId:owner.id,planSlug:plan.slug,idempotencyKey:"checkout-free-0001"});
    assert.equal(first.status,"COMPLETED");
    const summary=await getOrganizationBillingSummary(org.id,owner.id);
    assert.equal(summary.subscription.planSlug,plan.slug);
    const results=await Promise.allSettled([
      reserveOrganizationUsage({organizationId:org.id,actorId:owner.id,metric:"websites",amount:1,idempotencyKey:"quota-web-0001"}),
      reserveOrganizationUsage({organizationId:org.id,actorId:owner.id,metric:"websites",amount:1,idempotencyKey:"quota-web-0002"}),
    ]);
    assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
    const rejected=results.find(x=>x.status==="rejected") as PromiseRejectedResult;
    assert.equal((rejected.reason as any).code,"QUOTA_EXCEEDED");
  });

  await t.test("Stripe exact-byte signature rejects tampering",()=>{
    process.env.STRIPE_WEBHOOK_SECRET="whsec_fixture";
    const body=Buffer.from(JSON.stringify({id:"evt_1",type:"checkout.session.completed",data:{object:{metadata:{organizationId:org.id}}}}));
    const timestamp=Math.floor(Date.now()/1000);
    const signature=createHmac("sha256",process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.`).update(body).digest("hex");
    assert.equal(verifyStripeWebhook(body,`t=${timestamp},v1=${signature}`).id,"evt_1");
    assert.throws(()=>verifyStripeWebhook(Buffer.concat([body,Buffer.from(" ")]),`t=${timestamp},v1=${signature}`),{code:"INVALID_WEBHOOK_SIGNATURE"});
  });

  await t.test("outbox leasing is durable and unique per leased row",async()=>{
    const id=await appendOutboxEvent({organizationId:org.id,eventType:"fixture.created",aggregateType:"fixture",aggregateId:"x",payload:{x:1}});
    const batch=await leaseOutboxBatch(10,30);
    assert.ok(batch.some(x=>x.id===id));
    assert.ok(!(await leaseOutboxBatch(10,30)).some(x=>x.id===id));
    await markOutboxDispatched(id);
    const row=(await pgPool.query("SELECT status FROM durable_outbox WHERE id=$1::uuid",[id])).rows[0];
    assert.equal(row.status,"DISPATCHED");
  });

  await t.test("control plane enforces locked controls and requester/approver separation",async()=>{
    await assert.rejects(createPlatformChange({actorId:owner.id,capabilityId:"authentication",desiredState:"DISABLED",reason:"fixture locked control"}),{code:"LOCKED_CAPABILITY"});
    const change=await createPlatformChange({actorId:owner.id,capabilityId:"billing",desiredState:"DISABLED",reason:"fixture safe runtime change"});
    await assert.rejects(approvePlatformChange({actorId:owner.id,changeId:change.id,planDigest:change.planDigest}),{code:"SEPARATION_OF_DUTIES"});
    await approvePlatformChange({actorId:approver.id,changeId:change.id,planDigest:change.planDigest});
    const applied=await applyPlatformChange({actorId:approver.id,changeId:change.id,planDigest:change.planDigest});
    assert.equal(applied.status,"COMPLETED");
  });

  await t.test("egress and object storage fail safely",async()=>{
    const old=process.env.NODE_ENV;process.env.NODE_ENV="production";
    try{
      await assert.rejects(validateEgressUrl("http://127.0.0.1/private"),{code:"EGRESS_URL_INVALID"});
      await assert.rejects(validateEgressUrl("https://127.0.0.1/private"),{code:"EGRESS_DESTINATION_BLOCKED"});
    }finally{process.env.NODE_ENV=old;}
    delete process.env.S3_BUCKET;
    await assert.rejects(authorizeFileUpload({organizationId:org.id,workspaceId:engineering.id,websiteId:site.id,actorId:owner.id,
      originalName:"safe.txt",contentType:"text/plain",sizeBytes:12,sha256:"a".repeat(64)}),{code:"OBJECT_STORAGE_UNAVAILABLE"});
  });
});
