import type { PoolClient } from "pg";
import { pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";

export interface TenantExecutionContext {
  actorId: string;
  organizationId: string;
  workspaceId?: string | null;
}

function uuid(value: string, label: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError(`${label} is invalid`, 400, "INVALID_SCOPE");
  }
  return value;
}

/**
 * Trusted PostgreSQL transaction boundary for tenant-owned raw SQL.
 * Context is transaction-local and therefore cannot leak to the next pool borrower.
 */
export async function withTenantTransaction<T>(
  context: TenantExecutionContext,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const actorId = uuid(context.actorId, "actorId");
  const organizationId = uuid(context.organizationId, "organizationId");
  const workspaceId = context.workspaceId ? uuid(context.workspaceId, "workspaceId") : "";
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '5000ms'");
    await client.query("SET LOCAL lock_timeout = '2000ms'");
    await client.query("SELECT set_config('app.actor_id',$1,true)", [actorId]);
    await client.query("SELECT set_config('app.tenant_id',$1,true)", [organizationId]);
    await client.query("SELECT set_config('app.workspace_id',$1,true)", [workspaceId]);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function requireOrganizationManagerSql(
  client: PoolClient,
  organizationId: string,
  actorId: string,
): Promise<{ role: string; ownerId: string }> {
  const result = await client.query<{ role: string; ownerId: string }>(
    `SELECT m.role, o."ownerId"
       FROM organization_members m
       JOIN organizations o ON o.id=m."organizationId"
      WHERE m."organizationId"=$1::uuid AND m."userId"=$2::uuid
      LIMIT 1`,
    [organizationId, actorId],
  );
  const row = result.rows[0];
  if (!row || !["OWNER", "ADMIN"].includes(row.role) || (row.role === "OWNER" && row.ownerId !== actorId)) {
    throw new AppError("Organization not found or management access denied", 404, "NOT_FOUND");
  }
  return row;
}

export async function requireOrganizationMemberSql(
  client: PoolClient,
  organizationId: string,
  actorId: string,
): Promise<{ role: string; ownerId: string }> {
  const result = await client.query<{ role: string; ownerId: string }>(
    `SELECT m.role, o."ownerId"
       FROM organization_members m
       JOIN organizations o ON o.id=m."organizationId"
      WHERE m."organizationId"=$1::uuid AND m."userId"=$2::uuid
      LIMIT 1`,
    [organizationId, actorId],
  );
  const row = result.rows[0];
  if (!row || !["OWNER", "ADMIN", "MEMBER"].includes(row.role) ||
      (row.role === "OWNER" && row.ownerId !== actorId)) {
    throw new AppError("Organization not found or access denied", 404, "NOT_FOUND");
  }
  return row;
}
