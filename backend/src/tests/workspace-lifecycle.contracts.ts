import type {TestContext} from "node:test";
import assert from "node:assert/strict";
import {randomUUID,createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import express from "express";
import cookieParser from "cookie-parser";
import {prisma,pgPool} from "../config/prisma.js";
import * as workspaces from "../services/workspaces/workspace-api.service.js";
import * as lifecycle from "../services/workspaces/lifecycle.service.js";
import * as invites from "../services/workspaces/invitation.service.js";
import workspaceRouter from "../routes/tenant-workspace.routes.js";
import {errorMiddleware} from "../middlewares/error.middleware.js";

export async function runWorkspaceLifecycleContracts(t:TestContext) {
 // Only the parent suite's explicitly guarded disposable database reaches here.
 // Replace the schema-only fixture additions with the actual migration and triggers.
 await pgPool.query('DROP TABLE IF EXISTS workspace_invitations; ALTER TABLE workspaces DROP COLUMN "lifecycleStatus", DROP COLUMN version, DROP COLUMN "archivedAt"');
 await pgPool.query(readFileSync("prisma/migrations/20260928122000_workspace_lifecycle/migration.sql","utf8"));
 const createUser=(name:string)=>prisma.user.create({data:{fullName:name,email:`${randomUUID()}@example.test`,emailVerified:true,status:"ACTIVE"}});
 const owner=await createUser("Lifecycle owner"), recipient=await createUser("Invited recipient"), stranger=await createUser("Other recipient");
 const created=await workspaces.createTenantWorkspace(owner.id,{name:"Lifecycle"},"lifecycle-create-1");
 const workspaceId=created.resourceId,organizationId=created.workspace.organizationId!;
 await prisma.organizationMember.createMany({data:[{organizationId,userId:recipient.id,role:"MEMBER"},{organizationId,userId:stranger.id,role:"MEMBER"}]});
 const current=()=>prisma.workspace.findUniqueOrThrow({where:{id:workspaceId}});

 await t.test("workspace settings normalize and stale ETags never overwrite",async()=>{
  const first=await lifecycle.updateWorkspaceSettings(owner.id,workspaceId,{name:"Renamed",settings:{locale:"en-in",timeZone:"UTC"}},1,"lifecycle-settings-1");
  assert.equal(first.workspace.version,2);assert.equal(first.workspace.name,"Renamed");
  const replay=await lifecycle.updateWorkspaceSettings(owner.id,workspaceId,{name:"Renamed",settings:{locale:"en-in",timeZone:"UTC"}},1,"lifecycle-settings-1");assert.deepEqual(first,replay);
  await assert.rejects(lifecycle.updateWorkspaceSettings(owner.id,workspaceId,{name:"Stale"},1,"lifecycle-settings-2"),{code:"VERSION_CONFLICT"});
  assert.equal((await current()).name,"Renamed");
 });
 await t.test("recipient-bound invite cannot be accepted by another organization member",async()=>{
  const result=await invites.inviteWorkspaceMember(owner.id,workspaceId,recipient.id,"MEMBER","lifecycle-invite-1");
  assert.equal(result.delivery,"IN_APP");assert.equal("token" in result.invitation,false);
  await assert.rejects(invites.acceptWorkspaceInvitation(stranger.id,workspaceId,result.invitation.id,"lifecycle-stolen-1"),{code:"NOT_FOUND"});
  const inbox=await invites.listWorkspaceInvitationInbox(recipient.id);assert.equal(inbox.invitations[0]?.id,result.invitation.id);
  const accepted=await Promise.all([invites.acceptWorkspaceInvitation(recipient.id,workspaceId,result.invitation.id,"lifecycle-accept-1"),invites.acceptWorkspaceInvitation(recipient.id,workspaceId,result.invitation.id,"lifecycle-accept-1")]);
  assert.deepEqual(accepted[0],accepted[1]);assert.equal(await prisma.workspaceMember.count({where:{workspaceId,userId:recipient.id}}),1);
 });
 await t.test("expired, renewed and revoked invitations follow their states",async()=>{
  const result=await invites.inviteWorkspaceMember(owner.id,workspaceId,stranger.id,"MEMBER","lifecycle-invite-2");
  await prisma.workspaceInvitation.update({where:{id:result.invitation.id},data:{expiresAt:new Date(0)}});
  await assert.rejects(invites.acceptWorkspaceInvitation(stranger.id,workspaceId,result.invitation.id,"lifecycle-expired-1"),{code:"INVITATION_UNAVAILABLE"});
  const renewed=await invites.updateWorkspaceInvitation(owner.id,workspaceId,result.invitation.id,"RENEW",1,"lifecycle-renew-1");assert.equal(renewed.invitation.version,2);
  await invites.updateWorkspaceInvitation(owner.id,workspaceId,result.invitation.id,"REVOKE",2,"lifecycle-revoke-1");
  await assert.rejects(invites.acceptWorkspaceInvitation(stranger.id,workspaceId,result.invitation.id,"lifecycle-revoked-1"),{code:"INVITATION_UNAVAILABLE"});
 });
 await t.test("unverified identity and administrator role escalation are rejected",async()=>{
  await prisma.user.update({where:{id:stranger.id},data:{emailVerified:false}});
  await assert.rejects(invites.inviteWorkspaceMember(owner.id,workspaceId,stranger.id,"MEMBER","lifecycle-unverified-1"),{code:"VERIFIED_IDENTITY_REQUIRED"});
  await prisma.user.update({where:{id:stranger.id},data:{emailVerified:true}});
  await assert.rejects(lifecycle.changeWorkspaceMemberRole(recipient.id,workspaceId,stranger.id,"ADMIN",(await current()).version,"lifecycle-escalation-1"),{code:"FORBIDDEN"});
 });
 await t.test("ownership transfer is atomic, replayable and retains exactly one owner",async()=>{
  const version=(await current()).version;
  const first=await lifecycle.transferWorkspaceOwnership(owner.id,workspaceId,recipient.id,version,"lifecycle-transfer-1");
  const again=await lifecycle.transferWorkspaceOwnership(owner.id,workspaceId,recipient.id,version,"lifecycle-transfer-1");assert.deepEqual(first,again);
  assert.equal((await current()).ownerId,recipient.id);assert.equal(await prisma.workspaceMember.count({where:{workspaceId,role:"OWNER"}}),1);
  await assert.rejects(prisma.workspaceMember.delete({where:{workspaceId_userId:{workspaceId,userId:recipient.id}}}));
  assert.ok(await prisma.workspaceMember.findUnique({where:{workspaceId_userId:{workspaceId,userId:recipient.id}}}));
 });
 await t.test("archived workspace retains reads and rejects website/child writes",async()=>{
  const website=await prisma.website.create({data:{userId:owner.id,organizationId,workspaceId,name:"Retained",slug:`retained-${randomUUID()}`}});
  await lifecycle.changeWorkspaceLifecycle(recipient.id,workspaceId,"ARCHIVED",(await current()).version,"Archive fixture","lifecycle-archive-1");
  assert.equal((await workspaces.readTenantWorkspace(recipient.id,workspaceId)).lifecycleStatus,"ARCHIVED");
  await assert.rejects(workspaces.createTenantWorkspaceWebsite(recipient.id,workspaceId,"No write","lifecycle-deny-write-1"),{code:"WORKSPACE_READ_ONLY"});
  await assert.rejects(prisma.website.update({where:{id:website.id},data:{name:"Bypass"}}));
  await assert.rejects(prisma.websiteRevision.create({data:{websiteId:website.id,version:1,data:{},revisionType:"MANUAL"}}));
  await lifecycle.changeWorkspaceLifecycle(recipient.id,workspaceId,"ACTIVE",(await current()).version,"Restore fixture","lifecycle-restore-1");
  await prisma.website.update({where:{id:website.id},data:{name:"Restored"}});
  assert.equal((await prisma.website.findUniqueOrThrow({where:{id:website.id}})).name,"Restored");
 });
 await t.test("pending deployment prevents archive",async()=>{
  const site=await prisma.website.findFirstOrThrow({where:{workspaceId}});
  const deployment=await prisma.deployment.create({data:{websiteId:site.id,version:1,status:"QUEUED"}});
  await assert.rejects(lifecycle.changeWorkspaceLifecycle(recipient.id,workspaceId,"ARCHIVED",(await current()).version,"Must drain","lifecycle-busy-1"),{code:"WORKSPACE_BUSY"});
  await prisma.deployment.delete({where:{id:deployment.id}});
 });
 await t.test("workspace child ownership mismatch rejected by database",async()=>{
  await assert.rejects(prisma.website.create({data:{userId:owner.id,organizationId:null,workspaceId,name:"Wrong tenant",slug:`wrong-${randomUUID()}`}}));
 });
 await t.test("lifecycle HTTP replacements require exact scoped If-Match",async()=>{
  const token=randomUUID();await prisma.session.create({data:{ authEpoch: 1, authMethod: "local", authTime: new Date(), audience: "TENANT",userId:recipient.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+60000)}});
  const app=express();app.use(express.json(),cookieParser());app.use("/api/v1/tenant-workspaces",workspaceRouter);app.use(errorMiddleware);
  const server=app.listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));const address=server.address();assert.ok(address&&typeof address!=="string");
  const base=`http://127.0.0.1:${address.port}/api/v1/tenant-workspaces`;
  try{
   const headers={Cookie:`forge_session=${token}`,"Content-Type":"application/json","X-Forge-Intent":"workspace-command","Idempotency-Key":"lifecycle-http-1"};
   const detail=await fetch(`${base}/${workspaceId}`,{headers});assert.equal(detail.status,200);const etag=detail.headers.get("etag");assert.ok(etag);
   assert.equal((await fetch(`${base}/${workspaceId}/settings`,{method:"PATCH",headers,body:JSON.stringify({name:"HTTP change"})})).status,428);
   assert.equal((await fetch(`${base}/${workspaceId}/settings`,{method:"PATCH",headers:{...headers,"If-Match":etag},body:JSON.stringify({name:"HTTP change"})})).status,200);
   assert.equal((await fetch(`${base}/${workspaceId}/settings`,{method:"PATCH",headers:{...headers,"If-Match":etag,"Idempotency-Key":"lifecycle-http-2"},body:JSON.stringify({name:"Stale"})})).status,412);
  }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
 });
}
