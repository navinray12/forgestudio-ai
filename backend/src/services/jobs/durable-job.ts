import { randomUUID } from "crypto";
import { pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";

export async function enqueueDurableJob(input:{
  organizationId:string;
  type:string;
  payload:unknown;
  idempotencyKey:string;
  runAt?:Date;
  maxAttempts?:number;
}) {
  if(!/^[A-Z0-9._:-]{2,100}$/i.test(input.type)) throw new AppError("Invalid job type",400,"INVALID_JOB_TYPE");
  if(!/^[A-Za-z0-9._:-]{8,128}$/.test(input.idempotencyKey)) throw new AppError("Invalid job idempotency key",400,"INVALID_IDEMPOTENCY_KEY");
  const id=randomUUID();
  const result=await pgPool.query(
    `INSERT INTO background_jobs
      (id,type,payload,status,attempts,"maxAttempts","runAt","organizationId","idempotencyKey","createdAt","updatedAt")
     VALUES($1::uuid,$2,$3::jsonb,'QUEUED',0,$4,$5,$6::uuid,$7,now(),now())
     ON CONFLICT("organizationId",type,"idempotencyKey") WHERE "idempotencyKey" IS NOT NULL
     DO UPDATE SET "updatedAt"=background_jobs."updatedAt"
     RETURNING *`,
    [id,input.type,JSON.stringify(input.payload??{}),Math.max(1,Math.min(20,input.maxAttempts??5)),input.runAt??new Date(),input.organizationId,input.idempotencyKey],
  );
  return result.rows[0];
}

export async function replayDeadLetter(input:{deadLetterId:string;actorId:string;organizationId:string}) {
  const client=await pgPool.connect();
  try{
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.actor_id',$1,true)",[input.actorId]);
    await client.query("SELECT set_config('app.tenant_id',$1,true)",[input.organizationId]);
    const found=await client.query(`SELECT * FROM job_dead_letters WHERE id=$1::uuid AND "organizationId"=$2::uuid FOR UPDATE`,[input.deadLetterId,input.organizationId]);
    const row=found.rows[0]; if(!row) throw new AppError("Dead letter not found",404,"NOT_FOUND");
    if(row.replayedAt){await client.query("COMMIT");return {alreadyReplayed:true};}
    const jobId=randomUUID();
    await client.query(`INSERT INTO background_jobs(id,type,payload,status,attempts,"maxAttempts","runAt","organizationId","idempotencyKey","createdAt","updatedAt")
      VALUES($1::uuid,$2,$3::jsonb,'QUEUED',0,5,now(),$4::uuid,$5,now(),now())`,
      [jobId,row.jobType,JSON.stringify(row.payload),input.organizationId,"replay:"+row.id]);
    await client.query(`UPDATE job_dead_letters SET "replayedAt"=now() WHERE id=$1::uuid`,[row.id]);
    await client.query("COMMIT");
    return {jobId,alreadyReplayed:false};
  }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}finally{client.release();}
}
