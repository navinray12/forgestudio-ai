import type { PoolClient } from "pg";
import { randomUUID } from "crypto";
import { withServiceTransaction } from "../tenancy/tenant-unit-of-work.js";

export class UnknownExternalOutcome extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly externalRef?: string,
    public readonly context: Record<string, unknown> = {},
  ) { super(message); this.name = "UnknownExternalOutcome"; }
}

export type PlatformJob = {
  id: string;
  organizationId: string | null;
  jobType: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
};

export async function appendPlatformOutbox(client: PoolClient,input:{
  organizationId?:string|null; actorId?:string|null; eventType:string; aggregateType:string; aggregateId:string;
  payload:unknown; jobType?:string|null;
}) {
  const result=await client.query<{id:string}>(`INSERT INTO platform_outbox
    (id,"organizationId","actorId","eventType","aggregateType","aggregateId",payload,"jobType")
    VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::jsonb,$8) RETURNING id`,
    [randomUUID(),input.organizationId||null,input.actorId||null,input.eventType,input.aggregateType,input.aggregateId,JSON.stringify(input.payload??{}),input.jobType||null]);
  return result.rows[0];
}

export async function dispatchOutboxBatch(limit=50):Promise<number>{
  return withServiceTransaction("dispatcher",async client=>{
    const rows=await client.query<any>(`SELECT id,"organizationId","eventType",payload,"jobType" FROM platform_outbox
      WHERE "dispatchedAt" IS NULL AND "jobType" IS NOT NULL ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT $1`,
      [Math.max(1,Math.min(200,limit))]);
    for(const row of rows.rows){
      await client.query(`INSERT INTO platform_jobs
        (id,"organizationId","outboxId","jobType",payload,status,attempts,"maxAttempts","availableAt")
        VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5::jsonb,'PENDING',0,5,NOW())
        ON CONFLICT ("outboxId") DO NOTHING`,
        [randomUUID(),row.organizationId,row.id,row.jobType,JSON.stringify(row.payload??{})]);
      await client.query(`UPDATE platform_outbox SET "dispatchedAt"=NOW() WHERE id=$1::uuid`,[row.id]);
    }
    return rows.rowCount||0;
  });
}

export async function leaseJobs(workerId:string,limit=10,leaseSeconds=60):Promise<PlatformJob[]>{
  return withServiceTransaction("worker",async client=>{
    const result=await client.query<PlatformJob>(`WITH picked AS (
      SELECT id FROM platform_jobs WHERE status IN ('PENDING','RETRYING') AND "availableAt"<=NOW()
       AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt"<NOW())
       ORDER BY "availableAt","createdAt" FOR UPDATE SKIP LOCKED LIMIT $1)
      UPDATE platform_jobs j SET status='RUNNING',attempts=j.attempts+1,"leaseOwner"=$2,
       "leaseExpiresAt"=NOW()+($3::text||' seconds')::interval,"updatedAt"=NOW()
      FROM picked WHERE j.id=picked.id
      RETURNING j.id,j."organizationId",j."jobType",j.payload,j.attempts,j."maxAttempts"`,
      [Math.max(1,Math.min(50,limit)),workerId,Math.max(10,Math.min(600,leaseSeconds))]);
    return result.rows;
  });
}

export async function completeJob(jobId:string,workerId:string){
  return withServiceTransaction("worker",async client=>{
    await client.query(`UPDATE platform_jobs SET status='SUCCEEDED',"leaseOwner"=NULL,"leaseExpiresAt"=NULL,
      "completedAt"=NOW(),"updatedAt"=NOW() WHERE id=$1::uuid AND status='RUNNING' AND "leaseOwner"=$2`,[jobId,workerId]);
  });
}

export async function failJob(job:PlatformJob,workerId:string,error:unknown){
  const message=error instanceof Error?error.message:String(error);
  return withServiceTransaction("worker",async client=>{
    const row=await client.query<{attempts:number;maxAttempts:number;organizationId:string|null}>(`SELECT attempts,"maxAttempts","organizationId"
      FROM platform_jobs WHERE id=$1::uuid FOR UPDATE`,[job.id]);
    const current=row.rows[0]; if(!current)return;
    if(error instanceof UnknownExternalOutcome){
      await client.query(`INSERT INTO platform_reconciliation_cases
        (id,"organizationId","jobId",provider,"externalRef",reason,context,status)
        VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::jsonb,'OPEN')`,
        [randomUUID(),current.organizationId,job.id,error.provider,error.externalRef||null,message.slice(0,2000),JSON.stringify(error.context||{})]);
      await client.query(`UPDATE platform_jobs SET status='FAILED',"lastError"=$2,"leaseOwner"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=NOW()
        WHERE id=$1::uuid AND "leaseOwner"=$3`,[job.id,`RECONCILIATION_REQUIRED: ${message}`.slice(0,4000),workerId]);
      return;
    }
    if(current.attempts>=current.maxAttempts){
      await client.query(`INSERT INTO platform_dead_letters (id,"organizationId","jobId","jobType",payload,error,attempts)
        SELECT $1::uuid,"organizationId",id,"jobType",payload,$2,attempts FROM platform_jobs WHERE id=$3::uuid
        ON CONFLICT ("jobId") DO NOTHING`,[randomUUID(),message.slice(0,4000),job.id]);
      await client.query(`UPDATE platform_jobs SET status='DEAD_LETTERED',"lastError"=$2,"leaseOwner"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=NOW()
        WHERE id=$1::uuid AND "leaseOwner"=$3`,[job.id,message.slice(0,4000),workerId]);
      return;
    }
    const delay=Math.min(900,2**Math.max(1,current.attempts));
    await client.query(`UPDATE platform_jobs SET status='RETRYING',"lastError"=$2,
      "availableAt"=NOW()+($3::text||' seconds')::interval,"leaseOwner"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=NOW()
      WHERE id=$1::uuid AND "leaseOwner"=$4`,[job.id,message.slice(0,4000),delay,workerId]);
  });
}

export async function listDeadLetters(limit=100){
  return withServiceTransaction("platform-control",async client=>{
    const rows=await client.query(`SELECT id,"organizationId","jobId","jobType",error,attempts,"createdAt","replayedAt"
      FROM platform_dead_letters ORDER BY "createdAt" DESC LIMIT $1`,[Math.max(1,Math.min(200,limit))]);
    return rows.rows;
  });
}

export async function replayDeadLetter(deadLetterId:string,actorId:string){
  return withServiceTransaction("platform-control",async client=>{
    const row=await client.query<any>(`SELECT d.*,j.status FROM platform_dead_letters d JOIN platform_jobs j ON j.id=d."jobId"
      WHERE d.id=$1::uuid FOR UPDATE OF d,j`,[deadLetterId]);
    const dead=row.rows[0];
    if(!dead) throw new Error("Dead letter not found");
    if(dead.replayedAt) throw new Error("Dead letter has already been replayed");
    if(dead.status!=="DEAD_LETTERED") throw new Error("Job is not dead-lettered");
    await client.query(`UPDATE platform_jobs SET status='RETRYING',attempts=0,"lastError"=NULL,"availableAt"=NOW(),
      "leaseOwner"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=NOW() WHERE id=$1::uuid`,[dead.jobId]);
    await client.query(`UPDATE platform_dead_letters SET "replayedAt"=NOW() WHERE id=$1::uuid`,[deadLetterId]);
    await client.query(`INSERT INTO audit_logs (id,"userId",action,"targetResource",details,"createdAt")
      VALUES ($1::uuid,$2::uuid,'PLATFORM_DEAD_LETTER_REPLAYED',$3,$4::jsonb,NOW())`,
      [randomUUID(),actorId,`dead-letter:${deadLetterId}`,JSON.stringify({jobId:dead.jobId})]);
    return {deadLetterId,jobId:dead.jobId,status:"RETRYING"};
  });
}

export async function listReconciliationCases(limit=100){
  return withServiceTransaction("platform-control",async client=>{
    const rows=await client.query(`SELECT id,"organizationId","jobId",provider,"externalRef",reason,context,status,"createdAt","resolvedAt"
      FROM platform_reconciliation_cases ORDER BY "createdAt" DESC LIMIT $1`,[Math.max(1,Math.min(200,limit))]);
    return rows.rows;
  });
}

export async function resolveReconciliationCase(id:string,actorId:string,note:string,outcome:"RESOLVED"|"ABANDONED"){
  const text=String(note||"").trim();
  if(text.length<8||text.length>2000) throw new Error("A reconciliation note is required");
  return withServiceTransaction("platform-control",async client=>{
    const row=await client.query<any>(`UPDATE platform_reconciliation_cases SET status=$3,"resolvedBy"=$2::uuid,
      "resolutionNote"=$4,"resolvedAt"=NOW() WHERE id=$1::uuid AND status='OPEN' RETURNING id,status,"jobId",provider`,
      [id,actorId,outcome,text]);
    if(!row.rows[0]) throw new Error("Reconciliation case not found or already resolved");
    await client.query(`INSERT INTO audit_logs (id,"userId",action,"targetResource",details,"createdAt")
      VALUES ($1::uuid,$2::uuid,'PLATFORM_RECONCILIATION_RESOLVED',$3,$4::jsonb,NOW())`,
      [randomUUID(),actorId,`reconciliation:${id}`,JSON.stringify({outcome,jobId:row.rows[0].jobId,provider:row.rows[0].provider})]);
    return row.rows[0];
  });
}
