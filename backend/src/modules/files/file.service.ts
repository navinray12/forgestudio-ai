import crypto from "node:crypto";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { withTenantTransaction, requireOrganizationMembership, requireWorkspaceMembership } from "../../platform/tenancy/tenant-unit-of-work.js";
import { appendPlatformOutbox } from "../../platform/reliability/postgres-queue.js";
import { deleteS3Object, getS3Object, presignS3, putS3Object } from "../../platform/storage/s3-sigv4.js";
import { reserveUsage, settleUsageReservation } from "../billing/billing.service.js";
import type { PlatformJob } from "../../platform/reliability/postgres-queue.js";

const maxUpload=()=>Math.max(1024,Math.min(500*1024*1024,Number(process.env.FILE_UPLOAD_MAX_BYTES||50*1024*1024)));

function safeName(value:unknown){
  if(typeof value!=="string"||!value.trim()) throw new AppError("File name is required",400,"INVALID_FILE_NAME");
  const name=path.basename(value.trim()).replace(/[^A-Za-z0-9._-]/g,"_").slice(0,180);
  if(!name||name==="."||name==="..") throw new AppError("File name is invalid",400,"INVALID_FILE_NAME");
  return name;
}
function detectMime(buffer:Buffer):string {
  if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return "image/png";
  if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff) return "image/jpeg";
  if(buffer.length>=6&&(buffer.subarray(0,6).toString("ascii")==="GIF87a"||buffer.subarray(0,6).toString("ascii")==="GIF89a")) return "image/gif";
  if(buffer.length>=12&&buffer.subarray(0,4).toString("ascii")==="RIFF"&&buffer.subarray(8,12).toString("ascii")==="WEBP") return "image/webp";
  if(buffer.length>=5&&buffer.subarray(0,5).toString("ascii")==="%PDF-") return "application/pdf";
  return "application/octet-stream";
}

async function scopeAccess(input:{organizationId:string;workspaceId?:string|null;websiteId?:string|null;actorId:string}){
  const client=await pgPool.connect();
  try {
    await requireOrganizationMembership(client,input.organizationId,input.actorId);
    if(input.workspaceId) await requireWorkspaceMembership(client,input.organizationId,input.workspaceId,input.actorId);
    if(input.websiteId){
      const row=await client.query(`SELECT id,"organizationId","workspaceId" FROM websites WHERE id=$1::uuid AND "organizationId"=$2::uuid`,[input.websiteId,input.organizationId]);
      if(!row.rows[0]||(input.workspaceId&&row.rows[0].workspaceId!==input.workspaceId)) throw new AppError("Website not found or access denied",404,"NOT_FOUND");
    }
  } finally { client.release(); }
}

export async function authorizeFileUpload(input:{organizationId:string;workspaceId?:string|null;websiteId?:string|null;actorId:string;originalName:string;mimeType?:string;sizeBytes:number}){
  await scopeAccess(input);
  if(!Number.isSafeInteger(input.sizeBytes)||input.sizeBytes<=0||input.sizeBytes>maxUpload()) throw new AppError("File size is outside the allowed range",413,"FILE_TOO_LARGE");
  const bucket=process.env.FORGE_S3_BUCKET;
  if(!bucket) throw new AppError("S3 storage is not configured",503,"STORAGE_NOT_CONFIGURED");
  let reservationId:string|null=null;
  if(process.env.FORGE_ENFORCE_STORAGE_QUOTA==="true"){
    const reservation=await reserveUsage({organizationId:input.organizationId,actorId:input.actorId,resource:"storage.bytes",amount:input.sizeBytes,key:`upload-${randomUUID()}`});
    reservationId=String(reservation.id);
  }
  const id=randomUUID();
  const name=safeName(input.originalName);
  const workspacePart=input.workspaceId||"organization";
  const key=`quarantine/${input.organizationId}/${workspacePart}/${id}/${name}`;
  await withTenantTransaction({organizationId:input.organizationId,workspaceId:input.workspaceId,actorId:input.actorId},async(client)=>{
    await client.query(`INSERT INTO file_objects
      (id,"organizationId","workspaceId","websiteId","ownerId",provider,bucket,"objectKey","originalName","declaredMimeType","sizeBytes",state,"scanStatus","scanDetail")
      VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,'s3',$6,$7,$8,$9,$10,'AUTHORIZED','PENDING',$11)`,
      [id,input.organizationId,input.workspaceId||null,input.websiteId||null,input.actorId,bucket,key,name,input.mimeType||null,input.sizeBytes,reservationId?`usage-reservation:${reservationId}`:null]);
  });
  const uploadUrl=await presignS3({method:"PUT",bucket,key,expiresSeconds:300});
  return {id,uploadUrl,method:"PUT",expiresInSeconds:300,maxBytes:maxUpload()};
}

export async function completeFileUpload(input:{organizationId:string;actorId:string;fileId:string}){
  await scopeAccess({organizationId:input.organizationId,actorId:input.actorId});
  const row=await withTenantTransaction({organizationId:input.organizationId,actorId:input.actorId},async(client)=>{
    const result=await client.query<any>(`SELECT * FROM file_objects WHERE id=$1::uuid AND "organizationId"=$2::uuid FOR UPDATE`,[input.fileId,input.organizationId]);
    const file=result.rows[0]; if(!file) throw new AppError("File not found",404,"FILE_NOT_FOUND");
    if(file.state!=="AUTHORIZED"&&file.state!=="UPLOADED") throw new AppError("File cannot be completed in its current state",409,"FILE_STATE_CONFLICT");
    await client.query(`UPDATE file_objects SET state='UPLOADED',"updatedAt"=NOW() WHERE id=$1::uuid`,[input.fileId]);
    await appendPlatformOutbox(client,{organizationId:input.organizationId,actorId:input.actorId,eventType:"FILE_UPLOADED",aggregateType:"file",aggregateId:input.fileId,payload:{fileId:input.fileId,organizationId:input.organizationId},jobType:"file.scan"});
    return file;
  });
  return {id:row.id,state:"UPLOADED",scanStatus:"PENDING"};
}

async function malwareScan(bytes:Buffer):Promise<{clean:boolean;detail:string}>{
  if(process.env.NODE_ENV==="test"&&process.env.FORGE_TEST_SCANNER_ALLOW==="true") return {clean:true,detail:"test-scanner-clean"};
  const endpoint=process.env.FILE_SCANNER_URL;
  if(!endpoint) return {clean:false,detail:"scanner-not-configured"};
  const parsed=new URL(endpoint);
  if(parsed.protocol!=="https:"&&process.env.NODE_ENV==="production") return {clean:false,detail:"scanner-requires-https"};
  const response=await fetch(parsed,{method:"POST",headers:{"Content-Type":"application/octet-stream","Content-Length":String(bytes.length)},body:new Uint8Array(bytes),signal:AbortSignal.timeout(30000),redirect:"error"});
  if(!response.ok) return {clean:false,detail:`scanner-http-${response.status}`};
  const result=await response.json() as Record<string,unknown>;
  return {clean:result.clean===true,detail:String(result.detail|| (result.clean===true?"clean":"rejected")).slice(0,900)};
}

export async function handleFileScanJob(job:PlatformJob){
  const payload=job.payload as {fileId?:string;organizationId?:string};
  if(!payload?.fileId||!job.organizationId||payload.organizationId!==job.organizationId) throw new Error("Invalid file scan job scope");
  const file=await withTenantTransaction({organizationId:job.organizationId},async(client)=>{
    const result=await client.query<any>(`SELECT * FROM file_objects WHERE id=$1::uuid AND "organizationId"=$2::uuid FOR UPDATE`,[payload.fileId,job.organizationId]);
    const row=result.rows[0]; if(!row) throw new Error("File record not found");
    if(row.state==="APPROVED"||row.state==="REJECTED") return row;
    await client.query(`UPDATE file_objects SET state='SCANNING',"updatedAt"=NOW() WHERE id=$1::uuid`,[row.id]);
    return row;
  });
  if(file.state==="APPROVED"||file.state==="REJECTED") return;
  const bytes=await getS3Object(file.bucket,file.objectKey,maxUpload());
  const digest=crypto.createHash("sha256").update(bytes).digest("hex");
  const mime=detectMime(bytes);
  const scan=await malwareScan(bytes);
  if(!scan.clean){
    await withTenantTransaction({organizationId:job.organizationId},async(client)=>{
      await client.query(`UPDATE file_objects SET state='REJECTED',"scanStatus"=$2,"scanDetail"=$3,sha256=$4,"detectedMimeType"=$5,"updatedAt"=NOW() WHERE id=$1::uuid`,
        [file.id,scan.detail==="scanner-not-configured"?"ERROR":"INFECTED",scan.detail,digest,mime]);
    });
    throw new Error(`File scan rejected: ${scan.detail}`);
  }
  const approvedKey=file.objectKey.replace(/^quarantine\//,"approved/");
  await putS3Object(file.bucket,approvedKey,bytes,mime);
  await deleteS3Object(file.bucket,file.objectKey);
  await withTenantTransaction({organizationId:job.organizationId},async(client)=>{
    await client.query(`UPDATE file_objects SET "objectKey"=$2,state='APPROVED',"scanStatus"='CLEAN',"scanDetail"=$3,sha256=$4,"detectedMimeType"=$5,"sizeBytes"=$6,"approvedAt"=NOW(),"updatedAt"=NOW() WHERE id=$1::uuid`,
      [file.id,approvedKey,scan.detail,digest,mime,bytes.length]);
  });
}

export async function authorizeFileDownload(input:{organizationId:string;actorId:string;fileId:string}){
  await scopeAccess({organizationId:input.organizationId,actorId:input.actorId});
  return withTenantTransaction({organizationId:input.organizationId,actorId:input.actorId},async(client)=>{
    const result=await client.query<any>(`SELECT id,bucket,"objectKey","originalName","detectedMimeType",state,"workspaceId" FROM file_objects WHERE id=$1::uuid AND "organizationId"=$2::uuid`,[input.fileId,input.organizationId]);
    const file=result.rows[0]; if(!file) throw new AppError("File not found",404,"FILE_NOT_FOUND");
    if(file.workspaceId) await requireWorkspaceMembership(client,input.organizationId,file.workspaceId,input.actorId);
    if(file.state!=="APPROVED") throw new AppError("File is not available for download",409,"FILE_NOT_APPROVED");
    const downloadUrl=await presignS3({method:"GET",bucket:file.bucket,key:file.objectKey,expiresSeconds:120});
    return {id:file.id,downloadUrl,expiresInSeconds:120,fileName:file.originalName,mimeType:file.detectedMimeType};
  });
}
