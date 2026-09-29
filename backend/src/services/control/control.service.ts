import { createHash, randomUUID } from "crypto";
import { pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";

const locked=new Set(["authentication","authorization","tenant-isolation","durable-storage"]);

function digest(value:unknown):string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function desired(value:unknown):string {
  if(typeof value!=="string"||!/^[A-Z][A-Z0-9_-]{1,29}$/.test(value)) throw new AppError("Invalid desired state",400,"INVALID_DESIRED_STATE");
  return value;
}
export async function controlOverview(){
  const [caps,changes,backfill]=await Promise.all([
    pgPool.query(`SELECT id,owner,criticality,"changeClass","minTier","desiredState","actualState",provider,dependencies,"offBehavior",version,"updatedAt"
      FROM platform_capabilities ORDER BY criticality,id`),
    pgPool.query(`SELECT id,"capabilityId","desiredState",status,"requestedBy","approvedBy","planDigest","createdAt","approvedAt","appliedAt",version
      FROM platform_changes ORDER BY "createdAt" DESC LIMIT 100`),
    pgPool.query(`SELECT resource_type,count(*)::int AS count FROM forge_tenant_backfill_issues GROUP BY resource_type ORDER BY resource_type`),
  ]);
  return {capabilities:caps.rows,recentChanges:changes.rows,tenantBackfillIssues:backfill.rows};
}
export async function createPlatformChange(input:{actorId:string;capabilityId:string;desiredState:unknown;reason:unknown}){
  const target=desired(input.desiredState);
  if(typeof input.reason!=="string"||input.reason.trim().length<8||input.reason.length>1000) throw new AppError("A meaningful reason is required",400,"CHANGE_REASON_REQUIRED");
  const client=await pgPool.connect();
  try{
    await client.query("BEGIN");
    const cap=(await client.query(`SELECT * FROM platform_capabilities WHERE id=$1 FOR UPDATE`,[input.capabilityId])).rows[0];
    if(!cap) throw new AppError("Capability not found",404,"CAPABILITY_NOT_FOUND");
    if(cap.criticality==="LOCKED"||locked.has(cap.id)) throw new AppError("Locked capability cannot be disabled or changed through runtime controls",403,"LOCKED_CAPABILITY");
    if(target==="ENABLED"){
      const dependencies=Array.isArray(cap.dependencies)?cap.dependencies:[];
      if(dependencies.length){
        const healthy=await client.query(`SELECT id,"actualState" FROM platform_capabilities WHERE id=ANY($1::text[])`,[dependencies]);
        const bad=dependencies.filter((id:string)=>!healthy.rows.some((row:any)=>row.id===id&&row.actualState==="ENABLED"));
        if(bad.length) throw new AppError("Required capability dependencies are not healthy: "+bad.join(", "),409,"CAPABILITY_DEPENDENCY_BLOCKED");
      }
    } else {
      const dependent=await client.query(`SELECT id FROM platform_capabilities WHERE "desiredState"='ENABLED' AND dependencies ? $1 LIMIT 1`,[cap.id]);
      if(dependent.rows[0]) throw new AppError("Enabled capability depends on this capability: "+dependent.rows[0].id,409,"CAPABILITY_DEPENDENCY_BLOCKED");
    }
    const plan={capabilityId:cap.id,changeClass:cap.changeClass,from:cap.desiredState,to:target,version:cap.version,dependencies:cap.dependencies};
    const planDigest=digest(plan); const id=randomUUID();
    await client.query(`INSERT INTO platform_changes(id,"capabilityId","requestedBy","desiredState",reason,"planDigest",status,version)
      VALUES($1::uuid,$2,$3::uuid,$4,$5,$6,'AWAITING_APPROVAL',1)`,
      [id,cap.id,input.actorId,target,input.reason.trim(),planDigest]);
    await client.query(`INSERT INTO platform_audit_events("actorId",action,resource,details)
      VALUES($1::uuid,'PLATFORM_CHANGE_REQUESTED',$2,$3::jsonb)`,
      [input.actorId,"capability:"+cap.id,JSON.stringify({changeId:id,planDigest,desiredState:target})]);
    await client.query("COMMIT");
    return {id,plan,planDigest,status:"AWAITING_APPROVAL"};
  }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}finally{client.release();}
}
export async function approvePlatformChange(input:{actorId:string;changeId:string;planDigest:string}){
  const client=await pgPool.connect();
  try{
    await client.query("BEGIN");
    const change=(await client.query(`SELECT * FROM platform_changes WHERE id=$1::uuid FOR UPDATE`,[input.changeId])).rows[0];
    if(!change) throw new AppError("Change not found",404,"CHANGE_NOT_FOUND");
    if(change.requestedBy===input.actorId) throw new AppError("Requester cannot approve their own production change",403,"SEPARATION_OF_DUTIES");
    if(change.planDigest!==input.planDigest) throw new AppError("Approved plan digest does not match",409,"PLAN_DIGEST_MISMATCH");
    if(change.status!=="AWAITING_APPROVAL") throw new AppError("Change is not awaiting approval",409,"INVALID_CHANGE_STATE");
    await client.query(`UPDATE platform_changes SET "approvedBy"=$1::uuid,status='APPROVED',"approvedAt"=now(),version=version+1 WHERE id=$2::uuid`,[input.actorId,input.changeId]);
    await client.query(`INSERT INTO platform_audit_events("actorId",action,resource,details)
      VALUES($1::uuid,'PLATFORM_CHANGE_APPROVED',$2,$3::jsonb)`,[input.actorId,"change:"+input.changeId,JSON.stringify({planDigest:input.planDigest})]);
    await client.query("COMMIT"); return {status:"APPROVED"};
  }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}finally{client.release();}
}
export async function applyPlatformChange(input:{actorId:string;changeId:string;planDigest:string}){
  const client=await pgPool.connect();
  try{
    await client.query("BEGIN");
    const change=(await client.query(`SELECT c.*,p."changeClass",p.criticality,p.version AS "capabilityVersion"
      FROM platform_changes c JOIN platform_capabilities p ON p.id=c."capabilityId"
      WHERE c.id=$1::uuid FOR UPDATE OF c,p`,[input.changeId])).rows[0];
    if(!change) throw new AppError("Change not found",404,"CHANGE_NOT_FOUND");
    if(change.planDigest!==input.planDigest) throw new AppError("Plan digest mismatch",409,"PLAN_DIGEST_MISMATCH");
    if(change.status!=="APPROVED") throw new AppError("Change is not approved",409,"INVALID_CHANGE_STATE");
    if(!["A","E"].includes(change.changeClass)) {
      throw new AppError("This change class requires the deployment/IaC migration executor",409,"GOVERNED_EXECUTOR_REQUIRED");
    }
    if(change.criticality==="LOCKED") throw new AppError("Locked capability cannot be changed",403,"LOCKED_CAPABILITY");
    const current=(await client.query(`SELECT id,"desiredState","actualState",provider,version FROM platform_capabilities WHERE id=$1 FOR UPDATE`,[change.capabilityId])).rows[0];
    const body={capabilityId:current.id,desiredState:change.desiredState,previousState:current.desiredState,provider:current.provider,capabilityVersion:current.version+1};
    const snapshotDigest=digest(body);
    const snapshot=(await client.query(`INSERT INTO platform_config_snapshots(digest,body,"createdBy",active)
      VALUES($1,$2::jsonb,$3::uuid,true) RETURNING version`,[snapshotDigest,JSON.stringify(body),input.actorId])).rows[0];
    await client.query(`UPDATE platform_config_snapshots SET active=false WHERE version<>$1 AND active=true`,[snapshot.version]);
    await client.query(`UPDATE platform_capabilities SET "desiredState"=$1,"actualState"=$1,version=version+1,"updatedAt"=now() WHERE id=$2`,
      [change.desiredState,change.capabilityId]);
    await client.query(`UPDATE platform_changes SET status='COMPLETED',"appliedAt"=now(),version=version+1 WHERE id=$1::uuid`,[input.changeId]);
    await client.query(`INSERT INTO platform_audit_events("actorId",action,resource,details)
      VALUES($1::uuid,'PLATFORM_CHANGE_APPLIED',$2,$3::jsonb)`,
      [input.actorId,"change:"+input.changeId,JSON.stringify({planDigest:input.planDigest,snapshotVersion:snapshot.version,snapshotDigest})]);
    await client.query("COMMIT");
    return {status:"COMPLETED",snapshotVersion:snapshot.version,snapshotDigest};
  }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}finally{client.release();}
}
