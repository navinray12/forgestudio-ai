import { createHash, randomUUID } from "crypto";
import { AppError } from "../../utils/app-error.js";
import { withTenantTransaction } from "../../platform/tenancy/context.js";
import { presignS3, objectStorageConfigured } from "./s3-storage.js";
import { scanWithClamAv } from "./clamav.js";
import { pgPool } from "../../config/prisma.js";

const MAX_UPLOAD_BYTES = Number(process.env.FILE_UPLOAD_MAX_BYTES || 25 * 1024 * 1024);
const allowedTypes = new Set([
  "image/jpeg","image/png","image/gif","image/webp","image/svg+xml",
  "application/pdf","text/plain","application/zip",
]);

function cleanName(value:unknown):string {
  if(typeof value!=="string" || value.length<1 || value.length>500) throw new AppError("Invalid file name",400,"INVALID_FILE_NAME");
  return value.replace(/[\\/\0\r\n]/g,"_").replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,200);
}
function hash(value:unknown):string {
  if(typeof value!=="string" || !/^[a-f0-9]{64}$/i.test(value)) throw new AppError("A SHA-256 digest is required",400,"INVALID_FILE_DIGEST");
  return value.toLowerCase();
}
function size(value:unknown):number {
  const n=Number(value); if(!Number.isSafeInteger(n)||n<1||n>MAX_UPLOAD_BYTES) throw new AppError("File size is outside the allowed range",413,"FILE_TOO_LARGE"); return n;
}
function contentType(value:unknown):string {
  if(typeof value!=="string" || !allowedTypes.has(value.toLowerCase())) throw new AppError("File type is not permitted",415,"FILE_TYPE_NOT_ALLOWED");
  return value.toLowerCase();
}

async function requireWorkspaceMembership(client:any,organizationId:string,workspaceId:string|undefined,actorId:string) {
  const org=await client.query(`SELECT 1 FROM organization_members WHERE "organizationId"=$1::uuid AND "userId"=$2::uuid`,[organizationId,actorId]);
  if(!org.rowCount) throw new AppError("Organization access denied",404,"NOT_FOUND");
  if(workspaceId){
    const ws=await client.query(`SELECT 1 FROM workspace_members m JOIN workspaces w ON w.id=m."workspaceId"
      WHERE m."workspaceId"=$1::uuid AND m."userId"=$2::uuid AND w."organizationId"=$3::uuid`,[workspaceId,actorId,organizationId]);
    if(!ws.rowCount) throw new AppError("Workspace access denied",404,"NOT_FOUND");
  }
}

export async function authorizeFileUpload(input:{
  organizationId:string;workspaceId?:string;websiteId?:string;actorId:string;
  originalName:unknown;contentType:unknown;sizeBytes:unknown;sha256:unknown;
}) {
  if(!objectStorageConfigured()) throw new AppError("Production object storage is not configured",503,"OBJECT_STORAGE_UNAVAILABLE");
  const originalName=cleanName(input.originalName), mime=contentType(input.contentType), bytes=size(input.sizeBytes), digest=hash(input.sha256);
  const id=randomUUID();
  const key=["quarantine",input.organizationId,input.workspaceId||"organization",id,originalName].join("/");
  return withTenantTransaction({organizationId:input.organizationId,workspaceId:input.workspaceId,actorId:input.actorId},async client=>{
    await requireWorkspaceMembership(client,input.organizationId,input.workspaceId,input.actorId);
    if(input.websiteId){
      const site=await client.query(`SELECT 1 FROM websites WHERE id=$1::uuid AND "organizationId"=$2::uuid AND ($3::uuid IS NULL OR "workspaceId"=$3::uuid)`,
        [input.websiteId,input.organizationId,input.workspaceId??null]);
      if(!site.rowCount) throw new AppError("Website not found in this scope",404,"NOT_FOUND");
    }
    await client.query(`INSERT INTO file_objects(id,"organizationId","workspaceId","websiteId","createdBy","objectKey","originalName","contentType","sizeBytes",sha256,state)
      VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,$7,$8,$9,$10,'UPLOAD_PENDING')`,
      [id,input.organizationId,input.workspaceId??null,input.websiteId??null,input.actorId,key,originalName,mime,bytes,digest]);
    const upload=presignS3({method:"PUT",key,expiresSeconds:300,signedHeaders:{"x-amz-meta-sha256":digest}});
    return {fileId:id,uploadUrl:upload.url,requiredHeaders:{...upload.headers,"Content-Type":mime},"expiresIn":300};
  });
}

export async function completeFileUpload(input:{organizationId:string;actorId:string;fileId:string}) {
  return withTenantTransaction({organizationId:input.organizationId,actorId:input.actorId},async client=>{
    await requireWorkspaceMembership(client,input.organizationId,undefined,input.actorId);
    const found=await client.query(`SELECT * FROM file_objects WHERE id=$1::uuid AND "organizationId"=$2::uuid FOR UPDATE`,[input.fileId,input.organizationId]);
    const file=found.rows[0]; if(!file) throw new AppError("File not found",404,"NOT_FOUND");
    if(file.state!=="UPLOAD_PENDING") return {fileId:file.id,state:file.state};
    const head=presignS3({method:"HEAD",key:file.objectKey,expiresSeconds:60});
    const response=await fetch(head.url,{method:"HEAD",signal:AbortSignal.timeout(5000)});
    if(!response.ok) throw new AppError("Uploaded object cannot be verified",409,"UPLOAD_NOT_FOUND");
    const length=Number(response.headers.get("content-length"));
    const uploadedDigest=(response.headers.get("x-amz-meta-sha256")||"").toLowerCase();
    if(length!==Number(file.sizeBytes) || uploadedDigest!==String(file.sha256).toLowerCase()) {
      await client.query(`UPDATE file_objects SET state='REJECTED',"scanVerdict"='UPLOAD_METADATA_MISMATCH',"updatedAt"=now(),version=version+1 WHERE id=$1::uuid`,[file.id]);
      throw new AppError("Uploaded object metadata does not match the authorization",409,"UPLOAD_MISMATCH");
    }
    await client.query(`UPDATE file_objects SET state='QUARANTINED',"updatedAt"=now(),version=version+1 WHERE id=$1::uuid`,[file.id]);
    // Queue acceptance is part of the same database transaction as the
    // quarantine transition. A success response therefore never loses its job.
    await client.query(`INSERT INTO background_jobs
      (id,type,payload,status,attempts,"maxAttempts","runAt","organizationId","idempotencyKey","createdAt","updatedAt")
      VALUES($1::uuid,'FILE_SCAN',$2::jsonb,'QUEUED',0,5,now(),$3::uuid,$4,now(),now())
      ON CONFLICT("organizationId",type,"idempotencyKey") WHERE "idempotencyKey" IS NOT NULL DO NOTHING`,
      [randomUUID(),JSON.stringify({fileId:file.id,organizationId:input.organizationId}),input.organizationId,"file-scan:"+file.id]);
    return {fileId:file.id,state:"QUARANTINED"};
  });
}

export async function scanFileObject(fileId:string, organizationId:string) {
  const client=await pgPool.connect();
  let row:any;
  try{
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id',$1,true)",[organizationId]);
    row=(await client.query(`SELECT * FROM file_objects WHERE id=$1::uuid AND "organizationId"=$2::uuid FOR UPDATE`,[fileId,organizationId])).rows[0];
    if(!row) throw new AppError("File not found",404,"NOT_FOUND");
    const locked=row;
    if(!locked || locked.state==="APPROVED" || locked.state==="REJECTED"){await client.query("COMMIT");return locked;}
    await client.query(`UPDATE file_objects SET state='SCANNING',"updatedAt"=now(),version=version+1 WHERE id=$1::uuid`,[fileId]);
    await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}finally{client.release();}

  const signed=presignS3({method:"GET",key:row.objectKey,expiresSeconds:120});
  const response=await fetch(signed.url,{signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw new AppError("Quarantined object could not be read",503,"OBJECT_STORAGE_UNAVAILABLE");
  const array=await response.arrayBuffer();
  const buffer=Buffer.from(array);
  if(buffer.length!==Number(row.sizeBytes)) throw new AppError("Quarantined object size changed",409,"FILE_INTEGRITY_FAILED");
  const digest=createHash("sha256").update(buffer).digest("hex");
  if(digest!==String(row.sha256).toLowerCase()) throw new AppError("Quarantined object digest changed",409,"FILE_INTEGRITY_FAILED");
  const verdict=await scanWithClamAv(buffer);
  await withTenantTransaction({organizationId:row.organizationId,actorId:row.createdBy},async client=>{
    await client.query(`INSERT INTO file_scan_results(id,"fileId",engine,verdict,detail,sha256)
      VALUES($1::uuid,$2::uuid,'clamav',$3,$4,$5)`,[randomUUID(),fileId,verdict.clean?"CLEAN":"MALICIOUS",verdict.detail.slice(0,1000),digest]);
    await client.query(`UPDATE file_objects SET state=$2,"scanVerdict"=$3,"updatedAt"=now(),version=version+1 WHERE id=$1::uuid`,
      [fileId,verdict.clean?"APPROVED":"REJECTED",verdict.clean?"CLEAN":"MALICIOUS"]);
  });
  return {fileId,state:verdict.clean?"APPROVED":"REJECTED",verdict:verdict.detail};
}

export async function authorizeFileDownload(input:{organizationId:string;actorId:string;fileId:string}) {
  return withTenantTransaction({organizationId:input.organizationId,actorId:input.actorId},async client=>{
    await requireWorkspaceMembership(client,input.organizationId,undefined,input.actorId);
    const file=(await client.query(`SELECT * FROM file_objects WHERE id=$1::uuid AND "organizationId"=$2::uuid`,[input.fileId,input.organizationId])).rows[0];
    if(!file) throw new AppError("File not found",404,"NOT_FOUND");
    if(file.workspaceId) await requireWorkspaceMembership(client,input.organizationId,file.workspaceId,input.actorId);
    if(file.state!=="APPROVED") throw new AppError("File is not approved for download",409,"FILE_NOT_APPROVED");
    const signed=presignS3({method:"GET",key:file.objectKey,expiresSeconds:60});
    return {downloadUrl:signed.url,expiresIn:60,contentType:file.contentType,originalName:file.originalName};
  });
}
