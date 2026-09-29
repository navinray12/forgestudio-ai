import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { pgPool } from "../config/prisma.js";
import { authorizeFileUpload } from "../modules/files/file.service.js";
import { presignS3 } from "../platform/storage/s3-sigv4.js";
import { resolveSafeDestination } from "../platform/integrations/safe-egress.js";
import { registerConnectorCredential } from "../platform/integrations/connector-credentials.js";
import { resolveSecretReference } from "../platform/secrets/secret-provider.js";

const id=()=>crypto.randomUUID();

async function fixture(){
  const user=id(),org=id(),workspace=id(),website=id();
  await pgPool.query(`INSERT INTO users (id,email,"fullName","authEpoch","emailVerified","phoneVerified",status,role,"createdAt","updatedAt")
    VALUES ($1::uuid,$2,'Storage Owner',1,true,false,'ACTIVE','USER',NOW(),NOW())`,[user,`storage-${user}@example.test`]);
  await pgPool.query(`INSERT INTO organizations (id,name,slug,"ownerId","createdAt","updatedAt")
    VALUES ($1::uuid,'Storage Org',$2,$3::uuid,NOW(),NOW())`,[org,`storage-${org}`,user]);
  await pgPool.query(`INSERT INTO organization_members (id,"organizationId","userId",role,"createdAt","updatedAt")
    VALUES ($1::uuid,$2::uuid,$3::uuid,'OWNER',NOW(),NOW())`,[id(),org,user]);
  await pgPool.query(`INSERT INTO workspaces (id,"organizationId",name,slug,"ownerId","lifecycleStatus",version,"createdAt","updatedAt")
    VALUES ($1::uuid,$2::uuid,'Storage Workspace',$3,$4::uuid,'ACTIVE',1,NOW(),NOW())`,[workspace,org,`storage-ws-${workspace}`,user]);
  await pgPool.query(`INSERT INTO workspace_members (id,"workspaceId","userId",role,"createdAt","updatedAt")
    VALUES ($1::uuid,$2::uuid,$3::uuid,'OWNER',NOW(),NOW())`,[id(),workspace,user]);
  await pgPool.query(`INSERT INTO websites (id,"userId",name,slug,status,"editorData","documentVersion","performanceSettings","createdAt","updatedAt","workspaceId","organizationId","approvalWorkflowEnabled")
    VALUES ($1::uuid,$2::uuid,'Storage Site',$3,'DRAFT','{}'::jsonb,1,'{}'::jsonb,NOW(),NOW(),$4::uuid,$5::uuid,false)`,
    [website,user,`storage-site-${website}`,workspace,org]);
  return {user,org,workspace,website};
}

test("S3 presigner uses scoped signed URL without exposing secret",async()=>{
  process.env.AWS_REGION="ap-south-1";
  process.env.AWS_ACCESS_KEY_ID="AKIAEXAMPLEFIXTURE";
  process.env.AWS_SECRET_ACCESS_KEY="fixture-secret-not-production";
  const url=await presignS3({method:"PUT",bucket:"forge-test-bucket",key:"quarantine/org/file.txt",expiresSeconds:300,now:new Date("2026-09-29T00:00:00Z")});
  assert.match(url,/X-Amz-Algorithm=AWS4-HMAC-SHA256/);
  assert.match(url,/X-Amz-Signature=/);
  assert.ok(!url.includes("fixture-secret-not-production"));
});

test("egress resolver blocks local and private destinations before connection",async()=>{
  await assert.rejects(()=>resolveSafeDestination("https://127.0.0.1/hook"),/Private destinations/i);
  await assert.rejects(()=>resolveSafeDestination("http://example.com/hook"),/must use HTTPS/i);
});

test("authorized upload creates tenant-scoped quarantine object",async()=>{
  const f=await fixture();
  process.env.AWS_REGION="ap-south-1";
  process.env.AWS_ACCESS_KEY_ID="AKIAEXAMPLEFIXTURE";
  process.env.AWS_SECRET_ACCESS_KEY="fixture-secret-not-production";
  process.env.FORGE_S3_BUCKET="forge-test-bucket";
  process.env.FORGE_ENFORCE_STORAGE_QUOTA="false";
  const file=await authorizeFileUpload({organizationId:f.org,workspaceId:f.workspace,websiteId:f.website,actorId:f.user,originalName:"sample.png",mimeType:"image/png",sizeBytes:1024});
  assert.match(file.uploadUrl,/^https:\/\/forge-test-bucket\.s3\.ap-south-1\.amazonaws\.com\//);
  const row=await pgPool.query(`SELECT "organizationId","workspaceId","websiteId",state,"objectKey" FROM file_objects WHERE id=$1::uuid`,[file.id]);
  assert.equal(row.rows[0].organizationId,f.org);
  assert.equal(row.rows[0].workspaceId,f.workspace);
  assert.equal(row.rows[0].websiteId,f.website);
  assert.equal(row.rows[0].state,"AUTHORIZED");
  assert.match(row.rows[0].objectKey,/^quarantine\//);
});

test("connector credential persistence stores reference metadata, not secret material",async()=>{
  const f=await fixture();
  const result=await registerConnectorCredential({organizationId:f.org,workspaceId:f.workspace,websiteId:f.website,actorId:f.user,provider:"sftp",secretRef:"secretsmanager:forge/sftp/fixture",scopes:["publish"],metadata:{hostKeySha256:"a".repeat(64)}});
  assert.equal(result.provider,"sftp");
  const row=await pgPool.query(`SELECT "secretRef",scopes,metadata,status FROM connector_credentials WHERE id=$1::uuid`,[result.id]);
  assert.equal(row.rows[0].secretRef,"secretsmanager:forge/sftp/fixture");
  assert.deepEqual(row.rows[0].scopes,["publish"]);
  assert.equal(row.rows[0].metadata.hostKeySha256,"a".repeat(64));
  assert.equal(row.rows[0].status,"ACTIVE");
});


test("development env secret references resolve without exposing a production fallback",async()=>{
  const previous=process.env.FORGE_TEST_CONNECTOR_SECRET;
  process.env.FORGE_TEST_CONNECTOR_SECRET=JSON.stringify({password:"fixture-password"});
  try {
    assert.equal(await resolveSecretReference("env:FORGE_TEST_CONNECTOR_SECRET"),JSON.stringify({password:"fixture-password"}));
  } finally {
    if(previous===undefined) delete process.env.FORGE_TEST_CONNECTOR_SECRET; else process.env.FORGE_TEST_CONNECTOR_SECRET=previous;
  }
});
