import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import express from "express";
import cookieParser from "cookie-parser";
import { prisma, pgPool } from "../config/prisma.js";
import { createTenantWorkspace, addTenantWorkspaceMember, createTenantWorkspaceWebsite } from "../services/workspaces/workspace-api.service.js";
import { assignDefaultFreePlan } from "../services/subscription.service.js";
import { saveWebsiteDocument } from "../services/websites/save-document.js";
import { documentETag } from "../services/websites/document-policy.js";
import { getPublicWebsiteById, updateWebsiteEditorData } from "../services/website.service.js";
import { getWebsiteByIdHandler, updateWebsiteHandler } from "../controllers/website.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";
import { fixtureHasMigration } from "./migration-fixture.js";

export async function runDocumentContracts(t: TestContext) {
  if (!await fixtureHasMigration("20260928140000_document_concurrency")) {
    await pgPool.query('ALTER TABLE websites DROP COLUMN "documentVersion", DROP COLUMN "performanceSettings"');
    await pgPool.query(readFileSync('prisma/migrations/20260928140000_document_concurrency/migration.sql','utf8'));
  }
  const owner = await prisma.user.create({data:{fullName:'Document owner',email:`doc-owner-${randomUUID()}@example.test`,status:'ACTIVE',emailVerified:true}});
  const editor = await prisma.user.create({data:{fullName:'Document editor',email:`doc-editor-${randomUUID()}@example.test`,status:'ACTIVE',emailVerified:true}});
  const outsider = await prisma.user.create({data:{fullName:'Other tenant',email:`doc-outsider-${randomUUID()}@example.test`,status:'ACTIVE',emailVerified:true}});
  await assignDefaultFreePlan(owner.id);
  const {workspace} = await createTenantWorkspace(owner.id,{name:'Document contracts'},'document-workspace-create');
  await prisma.organizationMember.create({data:{organizationId:workspace.organizationId!,userId:editor.id,role:'MEMBER'}});
  await addTenantWorkspaceMember(owner.id,workspace.id,editor.id,'MEMBER','document-member-add');
  const created=await createTenantWorkspaceWebsite(owner.id,workspace.id,'Document fixture','document-website-create');
  const websiteId=created.resourceId;
  await prisma.websiteCollaborator.create({data:{websiteId,userId:editor.id,permission:'DESIGNER'}});
  const current=()=>prisma.website.findUniqueOrThrow({where:{id:websiteId}});
  const key=()=>`doc-${randomUUID()}`;
  const draft=(text:string)=>({version:1,elements:[{id:'title',type:'heading',content:{text}}]});
  const save=async(text:string, actorId=owner.id)=>{const site=await current();return saveWebsiteDocument(websiteId,actorId,{editorData:draft(text)},{key:key(),expectedVersion:site.documentVersion});};

  await t.test('document concurrent saves cannot silently overwrite each other',async()=>{
    const expectedVersion=(await current()).documentVersion;
    const outcomes=await Promise.allSettled(['A','B'].map(text=>saveWebsiteDocument(websiteId,owner.id,{editorData:draft(text)},{key:key(),expectedVersion})));
    assert.equal(outcomes.filter(result=>result.status==='fulfilled').length,1);
    const failed=outcomes.find(result=>result.status==='rejected') as PromiseRejectedResult;
    assert.equal(failed.reason.code,'DOCUMENT_VERSION_CONFLICT');assert.equal((await current()).documentVersion,expectedVersion+1);
  });
  await t.test('document replay returns the original minimal acknowledgement once',async()=>{
    const expectedVersion=(await current()).documentVersion;const commandKey=key();const payload={editorData:draft('Replay')};
    const first=await saveWebsiteDocument(websiteId,owner.id,payload,{key:commandKey,expectedVersion});
    const repeated=await saveWebsiteDocument(websiteId,owner.id,payload,{key:commandKey,expectedVersion});
    assert.deepEqual(first,repeated);assert.equal((await current()).documentVersion,expectedVersion+1);
    assert.equal((await pgPool.query('SELECT count(*)::int AS n FROM workspace_command_journal WHERE "idempotencyKey"=$1',[commandKey])).rows[0].n,1);
    assert.ok(!('editorData' in first));
    await assert.rejects(saveWebsiteDocument(websiteId,owner.id,{editorData:draft('Different')},{key:commandKey,expectedVersion}),{code:'IDEMPOTENCY_CONFLICT'});
  });
  await t.test('document write cannot publish through status or forged snapshot',async()=>{
    const expectedVersion=(await current()).documentVersion;
    await assert.rejects(saveWebsiteDocument(websiteId,owner.id,{status:'PUBLISHED'},{key:key(),expectedVersion}),{code:'PUBLISH_COMMAND_REQUIRED'});
    await assert.rejects(saveWebsiteDocument(websiteId,owner.id,{editorData:{...draft('Fake'),publishing:{status:'PUBLISHED'}}},{key:key(),expectedVersion}),{code:'PUBLISH_COMMAND_REQUIRED'});
    assert.equal((await current()).status,'DRAFT');assert.equal((await current()).documentVersion,expectedVersion);
    await assert.rejects(updateWebsiteEditorData(websiteId,owner.id,draft('Old API')),{code:'DOCUMENT_PRECONDITION_REQUIRED'});
  });
  await t.test('document mutation rechecks explicit deny inside its transaction',async()=>{
    await prisma.granularPermission.create({data:{websiteId,userId:editor.id,resourceId:'*',capability:'EDIT',effect:'DENY'}});
    await assert.rejects(save('Denied',editor.id),{code:'DOCUMENT_EDIT_FORBIDDEN'});
    await prisma.granularPermission.deleteMany({where:{websiteId,userId:editor.id}});
  });
  await t.test('content role edits text but cannot create pages or alter design',async()=>{
    await save('Baseline');
    await prisma.websiteCollaborator.update({where:{websiteId_userId:{websiteId,userId:editor.id}},data:{permission:'CONTENT_EDITOR'}});
    await save('Content revised',editor.id);
    const expectedVersion=(await current()).documentVersion;
    await assert.rejects(saveWebsiteDocument(websiteId,editor.id,{editorData:{...draft('Content revised'),pages:[{id:'forged',elements:[]}]}},{key:key(),expectedVersion}),{code:'DOCUMENT_EDIT_FORBIDDEN'});
    await prisma.websiteCollaborator.update({where:{websiteId_userId:{websiteId,userId:editor.id}},data:{permission:'DESIGNER'}});
  });
  await t.test('protected elements reject unauthorized removal without false acknowledgement',async()=>{
    const expectedVersion=(await current()).documentVersion;
    await saveWebsiteDocument(websiteId,owner.id,{editorData:{elements:[{id:'locked',type:'heading',isProtected:true,content:{text:'Locked'}}]}},{key:key(),expectedVersion});
    await assert.rejects(save('Attempted deletion',editor.id),{code:'PROTECTED_COMPONENT'});
    assert.equal(((await current()).editorData as any).elements[0].id,'locked');
    await save('Unlocked by owner');
  });
  await t.test('legacy direct writers advance the same optimistic document version',async()=>{
    const before=await current();
    await pgPool.query('UPDATE websites SET "editorData"=$1::jsonb WHERE id=$2',[JSON.stringify(draft('External change')),websiteId]);
    assert.equal((await current()).documentVersion,before.documentVersion+1);
    await assert.rejects(saveWebsiteDocument(websiteId,owner.id,{editorData:draft('Stale')},{key:key(),expectedVersion:before.documentVersion}),{code:'DOCUMENT_VERSION_CONFLICT'});
  });
  await t.test('public reads never fall back to working drafts or JSON publication status',async()=>{
    const original=await current();
    await pgPool.query('UPDATE websites SET "editorData"=$1::jsonb WHERE id=$2',[JSON.stringify({...draft('Private'),publishing:{status:'PUBLISHED'}}),websiteId]);
    await assert.rejects(getPublicWebsiteById(websiteId),{code:'NOT_FOUND'});
    await pgPool.query("UPDATE websites SET status='PUBLISHED' WHERE id=$1",[websiteId]);
    await assert.rejects(getPublicWebsiteById(websiteId),{code:'NOT_FOUND'});
    await pgPool.query('UPDATE websites SET "editorData"=$1::jsonb,status=$2 WHERE id=$3',[JSON.stringify(original.editorData),original.status,websiteId]);
  });
  await t.test('document acknowledgement fails atomically when mandatory audit fails',async()=>{
    const before=await current();const commandKey=key();
    await pgPool.query(`CREATE FUNCTION forge_document_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='WEBSITE_DOCUMENT_SAVED' THEN RAISE EXCEPTION 'fixture audit rejection'; END IF; RETURN NEW; END $$; CREATE TRIGGER forge_document_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION forge_document_audit_failure()`);
    try {await assert.rejects(saveWebsiteDocument(websiteId,owner.id,{editorData:draft('Cannot commit')},{key:commandKey,expectedVersion:before.documentVersion}));}
    finally {await pgPool.query('DROP TRIGGER forge_document_audit_failure ON audit_logs; DROP FUNCTION forge_document_audit_failure()');}
    const after=await current();assert.equal(after.documentVersion,before.documentVersion);assert.deepEqual(after.editorData,before.editorData);
    assert.equal((await pgPool.query('SELECT count(*)::int AS n FROM workspace_command_journal WHERE "idempotencyKey"=$1',[commandKey])).rows[0].n,0);
  });
  await t.test('document HTTP contract enforces explicit intent, ETag, idempotency and strict input',async()=>{
    const token=randomUUID();await prisma.session.create({data:{ authEpoch: 1, authMethod: "local", authTime: new Date(), audience: "TENANT",userId:owner.id,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+60000)}});
    const app=express();app.use(express.json({limit:'4mb'}),cookieParser(),requireAuth);
    app.get('/api/websites/:id',getWebsiteByIdHandler);app.put('/api/websites/:id',updateWebsiteHandler);app.use(errorMiddleware);
    const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();assert.ok(address && typeof address!=='string');
    const url=`http://127.0.0.1:${address.port}/api/websites/${websiteId}`;
    const headers={Cookie:`forge_session=${token}`,'Content-Type':'application/json','Idempotency-Key':key(),'X-Forge-Intent':'document-command'};
    try {
      const loaded=await fetch(url,{headers});assert.equal(loaded.status,200);const etag=loaded.headers.get('etag')!;assert.equal(etag,documentETag(websiteId,(await current()).documentVersion));
      assert.equal((await fetch(url,{method:'PUT',headers,body:JSON.stringify({editorData:draft('No version')})})).status,428);
      assert.equal((await fetch(url,{method:'PUT',headers:{...headers,'If-Match':etag,'X-Forge-Intent':''},body:JSON.stringify({editorData:draft('No intent')})})).status,403);
      assert.equal((await fetch(url,{method:'PUT',headers:{...headers,'If-Match':etag},body:JSON.stringify({ownerId:outsider.id})})).status,422);
      const body=JSON.stringify({editorData:draft('HTTP saved')});const saved=await fetch(url,{method:'PUT',headers:{...headers,'If-Match':etag},body});assert.equal(saved.status,200);const result=await saved.json() as any;
      assert.equal(saved.headers.get('etag'),documentETag(websiteId,result.website.documentVersion));
      const replay=await fetch(url,{method:'PUT',headers:{...headers,'If-Match':etag},body});assert.equal(replay.status,200);assert.deepEqual(await replay.json(),{...result});
    } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
  });
  await t.test('revoked membership cannot replay a previously committed document acknowledgement',async()=>{
    const version=(await current()).documentVersion;const commandKey=key();const patch={editorData:draft('Before revoke')};
    await saveWebsiteDocument(websiteId,editor.id,patch,{key:commandKey,expectedVersion:version});
    await prisma.workspaceMember.delete({where:{workspaceId_userId:{workspaceId:workspace.id,userId:editor.id}}});
    await assert.rejects(saveWebsiteDocument(websiteId,editor.id,patch,{key:commandKey,expectedVersion:version}),{code:'WEBSITE_NOT_FOUND'});
    await assert.rejects(save('Other tenant',outsider.id),{code:'WEBSITE_NOT_FOUND'});
  });
}
