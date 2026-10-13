/**
 * Row-level-security transactions (blueprint §18, WP-02/WP-19).
 *
 * A tenant transaction does two things, both transaction-local so nothing survives on a pooled
 * connection: it switches to a restricted role that has no rights beyond the tables' policies
 * (SET LOCAL ROLE), and it names the tenant the caller has been authorised for
 * (set_config('app.tenant_id', …, true)). Without the role switch, policies would not apply to a
 * table owner or superuser connection at all; without the tenant, they match nothing.
 *
 * The tenant is never taken from the client. It is the owning tenant of a website or project
 * the caller has already been verified to have access to (verifyProjectAccess /
 * getForgeProjectById), read here from the database.
 */
import type { PoolClient } from "pg";
import { pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../../services/audit.service.js";

export const TENANT_RLS_ROLE = "forge_tenant_rls";
export const PLATFORM_RLS_ROLE = "forge_platform_rls";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATFORM_ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"]);

/** The part of a pg Pool these helpers use. */
export interface RlsPool {
  query: (...args: any[]) => Promise<any>;
  connect: () => Promise<PoolClient>;
}

async function inRole<T>(role: string, settings: Record<string, string>, work: (client: PoolClient) => Promise<T>, pool: RlsPool = pgPool): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Role names are constants of this module, never input.
    await client.query(`SET LOCAL ROLE ${role}`);
    for (const [name, value] of Object.entries(settings)) {
      await client.query(`SELECT set_config($1, $2, true)`, [name, value]);
    }
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

/**
 * Runs `work` as the restricted tenant role, scoped to one tenant. Refuses to start without a
 * valid tenant: there is no default and no "all tenants".
 */
export async function withTenantRls<T>(tenantId: unknown, actorId: string | null | undefined, work: (client: PoolClient) => Promise<T>, pool: RlsPool = pgPool): Promise<T> {
  if (typeof tenantId !== "string" || !UUID.test(tenantId)) {
    throw new AppError("Tenant context is required", 500, "TENANT_CONTEXT_REQUIRED");
  }
  return inRole(TENANT_RLS_ROLE, { "app.tenant_id": tenantId, "app.actor_id": actorId && UUID.test(actorId) ? actorId : "" }, work, pool);
}

/** The tenant that owns a website: its workspace, else its organization, else its owner. */
export async function websiteTenant(websiteId: string): Promise<string | null> {
  if (!UUID.test(String(websiteId))) return null;
  const { rows } = await pgPool.query(`SELECT forge_website_tenant($1::uuid) AS tenant`, [websiteId]);
  return rows[0]?.tenant ?? null;
}

/** The tenant that owns a project: its workspace, else its owner. */
export async function projectTenant(projectId: string, pool: RlsPool = pgPool): Promise<string | null> {
  if (!UUID.test(String(projectId))) return null;
  const { rows } = await pool.query(`SELECT forge_project_tenant($1::uuid) AS tenant`, [projectId]);
  return rows[0]?.tenant ?? null;
}

/** A tenant transaction for a project the caller has been authorised for. */
export async function withProjectRls<T>(projectId: string, actorId: string | null | undefined, work: (client: PoolClient) => Promise<T>, pool: RlsPool = pgPool): Promise<T> {
  const tenant = await projectTenant(projectId, pool);
  if (!tenant) throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
  return withTenantRls(tenant, actorId, work, pool);
}

/**
 * Platform administration: data that belongs to no tenant. The actor must be a platform
 * administrator, the purpose is stated, and every use is written to the audit log before the
 * work runs. The platform role has rights on the platform tables only; it cannot read tenant rows.
 */
export async function withPlatformAdminRls<T>(
  actor: { id?: string; role?: string } | null | undefined,
  purpose: string,
  work: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (!actor?.id || !UUID.test(actor.id) || !PLATFORM_ADMIN_ROLES.has(String(actor.role || "").toUpperCase())) {
    throw new AppError("Platform administrator access is required", 403, "FORBIDDEN");
  }
  if (!purpose || purpose.length > 200) throw new AppError("A purpose is required for platform administration", 500, "PURPOSE_REQUIRED");
  await recordAuditLog({ userId: actor.id, action: "platform.rls_admin_access", targetResource: purpose, details: { role: actor.role } });
  return inRole(PLATFORM_RLS_ROLE, { "app.platform_admin": "on", "app.actor_id": actor.id }, work);
}

export interface RlsPosture {
  connection: { role: string; superuser: boolean; bypassRls: boolean };
  roles: Array<{ name: string; exists: boolean; canLogin: boolean; superuser: boolean; bypassRls: boolean; inherit: boolean }>;
  tables: Array<{ table: string; owner: string; enabled: boolean; forced: boolean; policies: string[]; grants: Record<string, string[]> }>;
  /** Things that weaken the guarantee in this environment; empty when there are none. */
  warnings: string[];
  /** Rows the policies would hide from everyone: their website or project no longer resolves, or disagrees with the stored tenant. */
  orphans: Record<string, number>;
}

export const RLS_TABLES = ["forge_website_records", "forge_workflow_definitions", "forge_environment_bindings", "forge_benchmark_runs"] as const;

/** Reads the actual privileges, ownership and policies from the catalog. Nothing is assumed. */
export async function rlsPosture(): Promise<RlsPosture> {
  const { rows: [me] } = await pgPool.query(`SELECT rolname AS role, rolsuper AS superuser, rolbypassrls AS "bypassRls" FROM pg_roles WHERE rolname = current_user`);
  const { rows: found } = await pgPool.query(
    `SELECT rolname AS name, rolcanlogin AS "canLogin", rolsuper AS superuser, rolbypassrls AS "bypassRls", rolinherit AS inherit FROM pg_roles WHERE rolname = ANY($1)`,
    [[TENANT_RLS_ROLE, PLATFORM_RLS_ROLE]]
  );
  const roles = [TENANT_RLS_ROLE, PLATFORM_RLS_ROLE].map((name) => {
    const role = found.find((r: any) => r.name === name);
    return role ? { ...role, exists: true } : { name, exists: false, canLogin: false, superuser: false, bypassRls: false, inherit: false };
  });
  const { rows: tableRows } = await pgPool.query(
    `SELECT c.relname AS "table", pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
            COALESCE((SELECT array_agg(p.policyname || ':' || array_to_string(p.roles, ',') ORDER BY 1) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname), '{}') AS policies
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY($1) ORDER BY 1`,
    [[...RLS_TABLES]]
  );
  const { rows: grantRows } = await pgPool.query(
    `SELECT table_name, grantee, array_agg(privilege_type::text ORDER BY privilege_type::text) AS privileges FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = ANY($1) AND grantee = ANY($2) GROUP BY 1, 2`,
    [[...RLS_TABLES], [TENANT_RLS_ROLE, PLATFORM_RLS_ROLE, "PUBLIC"]]
  );
  const tables = tableRows.map((t: any) => ({
    ...t,
    grants: Object.fromEntries(grantRows.filter((g: any) => g.table_name === t.table).map((g: any) => [g.grantee, g.privileges])),
  }));

  const warnings: string[] = [];
  if (me.superuser || me.bypassRls) {
    warnings.push(`The application connects as '${me.role}', which ${me.superuser ? "is a superuser" : "has BYPASSRLS"}: row security is enforced only inside the tenant and platform transactions of platform/tenancy/rls.ts, and any other query bypasses every policy, including FORCE.`);
  }
  for (const role of roles) {
    if (!role.exists) warnings.push(`Role ${role.name} does not exist.`);
    else if (role.canLogin || role.superuser || role.bypassRls) warnings.push(`Role ${role.name} must not be able to log in, be a superuser or bypass row security.`);
  }
  for (const table of tables) {
    if (!table.enabled) warnings.push(`Row security is not enabled on ${table.table}.`);
    if (table.policies.length === 0) warnings.push(`${table.table} has no policy.`);
    if (table.grants.PUBLIC) warnings.push(`${table.table} is granted to PUBLIC.`);
    if (!table.forced && table.owner === me.role && !me.superuser) warnings.push(`${table.table} is owned by the application role and row security is not forced: owner-level queries are not restricted (stage 2).`);
  }
  for (const missing of RLS_TABLES.filter((name) => !tables.some((t: any) => t.table === name))) warnings.push(`Table ${missing} does not exist.`);

  const { rows: [orphans] } = await pgPool.query(
    `SELECT (SELECT count(*)::int FROM forge_website_records r WHERE forge_website_tenant(r."websiteId") IS DISTINCT FROM NULLIF(r."tenantId", '')::uuid) AS forge_website_records,
            (SELECT count(*)::int FROM forge_workflow_definitions d WHERE forge_website_tenant(d."websiteId") IS NULL) AS forge_workflow_definitions,
            (SELECT count(*)::int FROM forge_environment_bindings b WHERE forge_project_tenant(b."projectId") IS NULL) AS forge_environment_bindings`
  );
  return { connection: me, roles, tables, warnings, orphans };
}
