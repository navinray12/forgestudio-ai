import type { PoolClient } from "pg";
import { pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";

export type TenantScope = {
  organizationId: string;
  workspaceId?: string | null;
  actorId?: string | null;
  requestId?: string | null;
};

type IsolationLevel = "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validUuid(value: string, label: string) {
  if (!UUID.test(value)) throw new AppError(`${label} is invalid`, 400, "INVALID_SCOPE");
}

export async function withTenantTransaction<T>(
  scope: TenantScope,
  work: (client: PoolClient) => Promise<T>,
  isolation: IsolationLevel = "READ COMMITTED",
): Promise<T> {
  validUuid(scope.organizationId, "Organization");
  if (scope.workspaceId) validUuid(scope.workspaceId, "Workspace");
  if (scope.actorId) validUuid(scope.actorId, "Actor");

  const client = await pgPool.connect();
  try {
    await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
    await client.query(
      "SELECT set_config('app.tenant_id', $1, true), set_config('app.workspace_id', $2, true), set_config('app.actor_id', $3, true), set_config('app.request_id', $4, true)",
      [scope.organizationId, scope.workspaceId || "", scope.actorId || "", scope.requestId || ""],
    );
    const value = await work(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

export async function withServiceTransaction<T>(
  serviceRole: "dispatcher" | "worker" | "billing-webhook" | "file-scanner",
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.service_role', $1, true)", [serviceRole]);
    const value = await work(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

export async function requireOrganizationMembership(
  client: PoolClient,
  organizationId: string,
  userId: string,
  roles: readonly string[] = ["OWNER", "ADMIN", "MEMBER"],
) {
  const result = await client.query<{ role: string; ownerId: string }>(
    `SELECT m.role, o."ownerId"
       FROM organization_members m
       JOIN organizations o ON o.id = m."organizationId"
      WHERE m."organizationId" = $1::uuid AND m."userId" = $2::uuid
      LIMIT 1`,
    [organizationId, userId],
  );
  const row = result.rows[0];
  if (!row || !roles.includes(row.role) || (row.role === "OWNER" && row.ownerId !== userId)) {
    throw new AppError("Organization not found or access denied", 404, "NOT_FOUND");
  }
  return row;
}

export async function requireWorkspaceMembership(
  client: PoolClient,
  organizationId: string,
  workspaceId: string,
  userId: string,
  roles: readonly string[] = ["OWNER", "ADMIN", "MEMBER"],
) {
  const result = await client.query<{ role: string; ownerId: string }>(
    `SELECT wm.role, w."ownerId"
       FROM workspace_members wm
       JOIN workspaces w ON w.id = wm."workspaceId"
      WHERE wm."workspaceId" = $1::uuid
        AND wm."userId" = $2::uuid
        AND w."organizationId" = $3::uuid
      LIMIT 1`,
    [workspaceId, userId, organizationId],
  );
  const row = result.rows[0];
  if (!row || !roles.includes(row.role) || (row.role === "OWNER" && row.ownerId !== userId)) {
    throw new AppError("Workspace not found or access denied", 404, "NOT_FOUND");
  }
  return row;
}
