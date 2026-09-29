import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { prisma, pgPool } from "../config/prisma.js";
import { issuePlatformSession, authenticatePlatformSession } from "../services/platform-session-authentication.js";
import { applyRuntimeChange, approveRuntimeChange, createRuntimeChange } from "../platform/control/change.service.js";

const id=()=>crypto.randomUUID();

async function platformUser(role:"PLATFORM_ADMIN"|"SUPER_ADMIN"){
  const user=await prisma.user.create({data:{email:`platform-${id()}@example.test`,fullName:"Platform Operator",role,status:"ACTIVE",emailVerified:true,authEpoch:1}});
  const authTime=new Date();
  const session:any={id:id(),user,authMethod:"oidc",audience:"TENANT",assurance:"phishing-resistant",authTime,mfaVerifiedAt:authTime};
  return {user,session};
}

test("platform session is a separate audience and requires strong recent OIDC",async()=>{
  const operator=await platformUser("PLATFORM_ADMIN");
  const issued=await issuePlatformSession(operator.session);
  const current=await authenticatePlatformSession(issued.token);
  assert.equal(current?.audience,"PLATFORM");
  assert.equal(current?.user.id,operator.user.id);
  await assert.rejects(()=>issuePlatformSession({...operator.session,assurance:"mfa"}),/phishing-resistant/i);
});

test("locked capabilities cannot create switches",async()=>{
  const operator=await platformUser("PLATFORM_ADMIN");
  await assert.rejects(()=>createRuntimeChange({actorId:operator.user.id,capabilityId:"authentication",desiredState:"DISABLED",reason:"fixture locked change"}),/Locked capabilities/i);
});

test("Class A runtime change enforces digest and separation of duties",async()=>{
  const requester=await platformUser("PLATFORM_ADMIN");
  const approver=await platformUser("PLATFORM_ADMIN");
  const created=await createRuntimeChange({actorId:requester.user.id,capabilityId:"billing",desiredState:"DISABLED",reason:"Qualification fixture safely disables new checkout"});
  assert.equal(created.status,"AWAITING_APPROVAL");
  await assert.rejects(()=>approveRuntimeChange({actorId:requester.user.id,changeId:created.id,planDigest:created.planDigest}),/cannot approve their own/i);
  await assert.rejects(()=>approveRuntimeChange({actorId:approver.user.id,changeId:created.id,planDigest:"0".repeat(64)}),/digest/i);
  const approved=await approveRuntimeChange({actorId:approver.user.id,changeId:created.id,planDigest:created.planDigest});
  assert.equal(approved.status,"APPROVED");
  const applied=await applyRuntimeChange({actorId:approver.user.id,changeId:created.id,expectedDigest:created.planDigest});
  assert.equal(applied.status,"COMPLETED");
  const row=await pgPool.query(`SELECT "desiredState","observedState" FROM platform_capabilities WHERE id='billing'`);
  assert.equal(row.rows[0].desiredState,"DISABLED");
  assert.equal(row.rows[0].observedState,"DISABLED");
  const audits=await prisma.auditLog.findMany({where:{targetResource:`platform-change:${created.id}`}});
  assert.equal(audits.length,3);
});

test("non-runtime provider migrations remain blocked without a real executor",async()=>{
  const operator=await platformUser("PLATFORM_ADMIN");
  await assert.rejects(()=>createRuntimeChange({actorId:operator.user.id,capabilityId:"object-storage",desiredState:"DISABLED",reason:"Attempt provider migration without executor"}),/governed infrastructure\/provider migration executor/i);
});
