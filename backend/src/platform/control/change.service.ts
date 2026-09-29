import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import { pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { getCapability, validateCapabilityRegistry } from "./capability-registry.js";

function digest(value:unknown){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
const allowedStates=new Set(["ENABLED","DISABLED","DEGRADED"]);

export async function createRuntimeChange(input:{actorId:string;capabilityId:string;desiredState:string;reason:string}){
  validateCapabilityRegistry();
  const capability=getCapability(input.capabilityId);
  if(!capability) throw new AppError("Capability not found",404,"CAPABILITY_NOT_FOUND");
  if(capability.changeClass==="L"||capability.criticality==="LOCKED") throw new AppError("Locked capabilities cannot be switched",403,"CAPABILITY_LOCKED");
  if(capability.changeClass!=="A") throw new AppError("This capability requires a governed infrastructure/provider migration executor",409,"ORCHESTRATOR_REQUIRED");
  if(!allowedStates.has(input.desiredState)) throw new AppError("Desired state is invalid",400,"INVALID_DESIRED_STATE");
  const reason=String(input.reason||"").trim();
  if(reason.length<8||reason.length>1000) throw new AppError("A meaningful change reason is required",400,"CHANGE_REASON_REQUIRED");
  const current=await pgPool.query(`SELECT "desiredState",version FROM platform_capabilities WHERE id=$1`,[capability.id]);
  const oldState=current.rows[0]?.desiredState||capability.desiredState;
  const id=randomUUID();
  const plan={capabilityId:capability.id,class:"A",oldState,desiredState:input.desiredState,dependencies:capability.dependencies,offBehaviour:capability.offBehaviour};
  const planDigest=digest(plan);
  const client=await pgPool.connect();
  try{
    await client.query("BEGIN");
    await client.query(`INSERT INTO platform_change_requests (id,class,scope,"oldState","desiredState",status,reason,"planDigest",requester)
      VALUES ($1::uuid,'A',$2::jsonb,$3::jsonb,$4::jsonb,'AWAITING_APPROVAL',$5,$6,$7::uuid)`,
      [id,JSON.stringify({capabilityId:capability.id}),JSON.stringify({state:oldState}),JSON.stringify({state:input.desiredState}),reason,planDigest,input.actorId]);
    await client.query(`INSERT INTO audit_logs (id,"userId",action,"targetResource",details,"createdAt")
      VALUES ($1::uuid,$2::uuid,'PLATFORM_CHANGE_REQUESTED',$3,$4::jsonb,NOW())`,
      [randomUUID(),input.actorId,`platform-change:${id}`,JSON.stringify({capabilityId:capability.id,desiredState:input.desiredState,planDigest})]);
    await client.query("COMMIT");
  }catch(error){try{await client.query("ROLLBACK");}catch{}throw error;}finally{client.release();}
  return {id,status:"AWAITING_APPROVAL",plan,planDigest};
}

export async function approveRuntimeChange(input:{actorId:string;changeId:string;planDigest:string}){
  const client=await pgPool.connect();
  try{
    await client.query("BEGIN");
    const row=await client.query<any>(`SELECT * FROM platform_change_requests WHERE id=$1::uuid FOR UPDATE`,[input.changeId]);
    const change=row.rows[0];
    if(!change) throw new AppError("Change not found",404,"CHANGE_NOT_FOUND");
    if(change.requester===input.actorId) throw new AppError("Requester cannot approve their own production change",403,"SEPARATION_OF_DUTIES");
    if(change.status!=="AWAITING_APPROVAL") throw new AppError("Change is not awaiting approval",409,"CHANGE_STATE_CONFLICT");
    if(change.planDigest!==input.planDigest) throw new AppError("Approved plan digest does not match",409,"PLAN_DIGEST_MISMATCH");
    await client.query(`UPDATE platform_change_requests SET status='APPROVED',approver=$2::uuid,"approvedAt"=NOW(),"updatedAt"=NOW() WHERE id=$1::uuid`,[input.changeId,input.actorId]);
    await client.query(`INSERT INTO audit_logs (id,"userId",action,"targetResource",details,"createdAt")
      VALUES ($1::uuid,$2::uuid,'PLATFORM_CHANGE_APPROVED',$3,$4::jsonb,NOW())`,
      [randomUUID(),input.actorId,`platform-change:${input.changeId}`,JSON.stringify({planDigest:change.planDigest})]);
    await client.query("COMMIT");
    return {id:input.changeId,status:"APPROVED",planDigest:change.planDigest};
  }catch(error){try{await client.query("ROLLBACK");}catch{}throw error;}finally{client.release();}
}

export async function applyRuntimeChange(input:{actorId:string;changeId:string;expectedDigest:string}){
  const client=await pgPool.connect();
  try{
    await client.query("BEGIN");
    const row=await client.query<any>(`SELECT * FROM platform_change_requests WHERE id=$1::uuid FOR UPDATE`,[input.changeId]);
    const change=row.rows[0];
    if(!change) throw new AppError("Change not found",404,"CHANGE_NOT_FOUND");
    if(change.status!=="APPROVED") throw new AppError("Change is not approved",409,"CHANGE_STATE_CONFLICT");
    if(change.planDigest!==input.expectedDigest) throw new AppError("Plan digest changed after approval",409,"PLAN_DIGEST_MISMATCH");
    const capabilityId=String(change.scope?.capabilityId||"");
    const definition=getCapability(capabilityId);
    if(!definition||definition.changeClass!=="A") throw new AppError("Runtime executor only accepts Class A changes",409,"ORCHESTRATOR_REQUIRED");
    const state=String(change.desiredState?.state||"");
    if(!allowedStates.has(state)) throw new AppError("Approved desired state is invalid",409,"CHANGE_STATE_INVALID");

    for(const dependency of definition.dependencies){
      const dep=getCapability(dependency);
      const persisted=await client.query(`SELECT "observedState" FROM platform_capabilities WHERE id=$1`,[dependency]);
      const observed=persisted.rows[0]?.observedState||dep?.desiredState||"UNVERIFIED";
      if(observed==="DISABLED"||observed==="FAILED") throw new AppError(`Dependency ${dependency} is not ready`,409,"DEPENDENCY_BLOCKED");
    }

    await client.query(`INSERT INTO platform_capabilities (id,owner,criticality,"changeClass","minTier",provider,"desiredState","observedState",config,version)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7,'{}'::jsonb,1)
      ON CONFLICT (id) DO UPDATE SET "desiredState"=$7,"observedState"=$7,version=platform_capabilities.version+1,"updatedAt"=NOW()`,
      [definition.id,definition.owner,definition.criticality,definition.changeClass,definition.minTier,definition.provider,state]);
    const snapshotBody={capabilityId:definition.id,state,changeId:change.id};
    const snapshotDigest=digest(snapshotBody);
    await client.query(`INSERT INTO platform_config_snapshots (environment,digest,body,"createdBy","activatedAt") VALUES ($1,$2,$3::jsonb,$4::uuid,NOW()) ON CONFLICT (digest) DO NOTHING`,
      [process.env.NODE_ENV||"development",snapshotDigest,JSON.stringify(snapshotBody),input.actorId]);
    await client.query(`UPDATE platform_change_requests SET status='COMPLETED',"updatedAt"=NOW() WHERE id=$1::uuid`,[input.changeId]);
    await client.query(`INSERT INTO audit_logs (id,"userId",action,"targetResource",details,"createdAt")
      VALUES ($1::uuid,$2::uuid,'PLATFORM_CHANGE_APPLIED',$3,$4::jsonb,NOW())`,
      [randomUUID(),input.actorId,`platform-change:${input.changeId}`,JSON.stringify({capabilityId:definition.id,state,snapshotDigest,planDigest:change.planDigest})]);
    await client.query("COMMIT");
    return {id:change.id,status:"COMPLETED",capabilityId:definition.id,state,snapshotDigest};
  }catch(error){try{await client.query("ROLLBACK");}catch{}throw error;}finally{client.release();}
}

export async function listChanges(){
  const rows=await pgPool.query(`SELECT id,class,scope,"oldState","desiredState",status,reason,"planDigest",requester,approver,"requestedAt","approvedAt","updatedAt"
    FROM platform_change_requests ORDER BY "requestedAt" DESC LIMIT 100`);
  return rows.rows;
}
