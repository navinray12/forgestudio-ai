import { randomUUID } from "crypto";
import { pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";

export type OutboxEnvelope = {
  id: string;
  organizationId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  attempts: number;
};

export async function appendOutboxEvent(input: {
  organizationId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
}): Promise<string> {
  const id = randomUUID();
  await pgPool.query(
    "INSERT INTO durable_outbox (id,\"organizationId\",\"eventType\",\"aggregateType\",\"aggregateId\",payload) VALUES($1::uuid,$2::uuid,$3,$4,$5,$6::jsonb)",
    [id,input.organizationId,input.eventType,input.aggregateType,input.aggregateId,JSON.stringify(input.payload ?? {})],
  );
  return id;
}

export async function leaseOutboxBatch(limit = 25, leaseSeconds = 30): Promise<OutboxEnvelope[]> {
  const bounded = Math.max(1, Math.min(100, limit));
  const token = randomUUID();
  const sql =
    "WITH picked AS (" +
    " SELECT id FROM durable_outbox" +
    " WHERE status IN ('PENDING','FAILED') AND \"availableAt\" <= now()" +
    " AND (\"lockedUntil\" IS NULL OR \"lockedUntil\" < now())" +
    " ORDER BY \"createdAt\" FOR UPDATE SKIP LOCKED LIMIT $1" +
    ") UPDATE durable_outbox o" +
    " SET status='DISPATCHING',\"lockToken\"=$2::uuid,\"lockedUntil\"=now()+($3::text||' seconds')::interval,attempts=o.attempts+1" +
    " FROM picked WHERE o.id=picked.id" +
    " RETURNING o.id,o.\"organizationId\",o.\"eventType\",o.\"aggregateType\",o.\"aggregateId\",o.payload,o.attempts";
  const result = await pgPool.query(sql,[bounded,token,String(Math.max(5,Math.min(300,leaseSeconds)))]);
  return result.rows;
}

export async function markOutboxDispatched(id: string): Promise<void> {
  await pgPool.query(
    "UPDATE durable_outbox SET status='DISPATCHED',\"dispatchedAt\"=now(),\"lockedUntil\"=NULL,\"lockToken\"=NULL,\"lastError\"=NULL WHERE id=$1::uuid",
    [id],
  );
}

export async function markOutboxFailed(id: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await pgPool.query(
    "UPDATE durable_outbox SET status='FAILED',\"lastError\"=$2,\"lockedUntil\"=NULL,\"lockToken\"=NULL,\"availableAt\"=now()+(least(attempts,8)::text||' seconds')::interval WHERE id=$1::uuid",
    [id,message.slice(0,2000)],
  );
}

export async function consumeExactlyOnce<T>(input: {
  consumer: string;
  event: OutboxEnvelope;
  handle: () => Promise<T>;
}): Promise<{ duplicate: boolean; result?: T }> {
  if (!/^[a-z0-9._:-]{2,100}$/i.test(input.consumer)) {
    throw new AppError("Invalid consumer identity",400,"INVALID_CONSUMER");
  }
  const client=await pgPool.connect();
  try{
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id',$1,true)",[input.event.organizationId]);
    const inserted=await client.query(
      "INSERT INTO consumer_inbox(consumer,\"eventId\",\"organizationId\") VALUES($1,$2::uuid,$3::uuid) ON CONFLICT DO NOTHING RETURNING \"eventId\"",
      [input.consumer,input.event.id,input.event.organizationId],
    );
    if(!inserted.rowCount){await client.query("ROLLBACK");return{duplicate:true};}
    const result=await input.handle();
    await client.query("COMMIT");
    return{duplicate:false,result};
  }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}
  finally{client.release();}
}
