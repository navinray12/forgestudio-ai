import type { PoolClient } from "pg";
import { randomUUID } from "crypto";
import { withServiceTransaction } from "../tenancy/tenant-unit-of-work.js";

export type PlatformJob = {
  id: string;
  organizationId: string | null;
  jobType: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
};

export async function appendPlatformOutbox(
  client: PoolClient,
  input: {
    organizationId?: string | null;
    actorId?: string | null;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: unknown;
    jobType?: string | null;
  },
) {
  const result = await client.query<{ id: string }>(
    `INSERT INTO platform_outbox
       (id, "organizationId", "actorId", "eventType", "aggregateType", "aggregateId", payload, "jobType")
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::jsonb,$8)
     RETURNING id`,
    [
      randomUUID(),
      input.organizationId || null,
      input.actorId || null,
      input.eventType,
      input.aggregateType,
      input.aggregateId,
      JSON.stringify(input.payload ?? {}),
      input.jobType || null,
    ],
  );
  return result.rows[0];
}

export async function dispatchOutboxBatch(limit = 50): Promise<number> {
  return withServiceTransaction("dispatcher", async (client) => {
    const rows = await client.query<{
      id: string; organizationId: string | null; eventType: string; payload: unknown; jobType: string | null;
    }>(
      `SELECT id, "organizationId", "eventType", payload, "jobType"
         FROM platform_outbox
        WHERE "dispatchedAt" IS NULL AND "jobType" IS NOT NULL
        ORDER BY "createdAt"
        FOR UPDATE SKIP LOCKED
        LIMIT $1`,
      [Math.max(1, Math.min(200, limit))],
    );
    for (const row of rows.rows) {
      await client.query(
        `INSERT INTO platform_jobs
           (id, "organizationId", "outboxId", "jobType", payload, status, attempts, "maxAttempts", "availableAt")
         VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5::jsonb,'PENDING',0,5,NOW())
         ON CONFLICT ("outboxId") DO NOTHING`,
        [randomUUID(), row.organizationId, row.id, row.jobType, JSON.stringify(row.payload ?? {})],
      );
      await client.query(`UPDATE platform_outbox SET "dispatchedAt"=NOW() WHERE id=$1::uuid`, [row.id]);
    }
    return rows.rowCount || 0;
  });
}

export async function leaseJobs(workerId: string, limit = 10, leaseSeconds = 60): Promise<PlatformJob[]> {
  return withServiceTransaction("worker", async (client) => {
    const result = await client.query<PlatformJob>(
      `WITH picked AS (
         SELECT id FROM platform_jobs
          WHERE status IN ('PENDING','RETRYING')
            AND "availableAt" <= NOW()
            AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" < NOW())
          ORDER BY "availableAt", "createdAt"
          FOR UPDATE SKIP LOCKED
          LIMIT $1
       )
       UPDATE platform_jobs j
          SET status='RUNNING',
              attempts=j.attempts+1,
              "leaseOwner"=$2,
              "leaseExpiresAt"=NOW()+($3::text || ' seconds')::interval,
              "updatedAt"=NOW()
         FROM picked
        WHERE j.id=picked.id
      RETURNING j.id, j."organizationId", j."jobType", j.payload, j.attempts, j."maxAttempts"`,
      [Math.max(1, Math.min(50, limit)), workerId, Math.max(10, Math.min(600, leaseSeconds))],
    );
    return result.rows;
  });
}

export async function completeJob(jobId: string, workerId: string) {
  return withServiceTransaction("worker", async (client) => {
    await client.query(
      `UPDATE platform_jobs
          SET status='SUCCEEDED',"leaseOwner"=NULL,"leaseExpiresAt"=NULL,"completedAt"=NOW(),"updatedAt"=NOW()
        WHERE id=$1::uuid AND status='RUNNING' AND "leaseOwner"=$2`,
      [jobId, workerId],
    );
  });
}

export async function failJob(job: PlatformJob, workerId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return withServiceTransaction("worker", async (client) => {
    const row = await client.query<{ attempts: number; maxAttempts: number }>(
      `SELECT attempts, "maxAttempts" FROM platform_jobs WHERE id=$1::uuid FOR UPDATE`,
      [job.id],
    );
    const current = row.rows[0];
    if (!current) return;
    if (current.attempts >= current.maxAttempts) {
      await client.query(
        `INSERT INTO platform_dead_letters
           (id,"organizationId","jobId","jobType",payload,error,attempts)
         SELECT $1::uuid,"organizationId",id,"jobType",payload,$2,attempts
           FROM platform_jobs WHERE id=$3::uuid
         ON CONFLICT ("jobId") DO NOTHING`,
        [randomUUID(), message.slice(0, 4000), job.id],
      );
      await client.query(
        `UPDATE platform_jobs SET status='DEAD_LETTERED',"lastError"=$2,"leaseOwner"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=NOW()
          WHERE id=$1::uuid AND "leaseOwner"=$3`,
        [job.id, message.slice(0, 4000), workerId],
      );
      return;
    }
    const delaySeconds = Math.min(900, 2 ** Math.max(1, current.attempts));
    await client.query(
      `UPDATE platform_jobs
          SET status='RETRYING',"lastError"=$2,"availableAt"=NOW()+($3::text || ' seconds')::interval,
              "leaseOwner"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=NOW()
        WHERE id=$1::uuid AND "leaseOwner"=$4`,
      [job.id, message.slice(0, 4000), delaySeconds, workerId],
    );
  });
}
