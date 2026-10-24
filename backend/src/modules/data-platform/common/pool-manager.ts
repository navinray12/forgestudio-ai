import pg from "pg";
import { prisma, pgPool } from "../../../config/prisma.js";
import { decryptCredential } from "./crypto.utils.js";
import { AppError } from "../../../utils/app-error.js";
import type { DatabaseEnvironment } from "../../../generated/prisma/client.js";

interface CachedTenantPool {
  pool: pg.Pool;
  lastAccessedAt: number;
  projectId: string;
  environment: DatabaseEnvironment;
}

const MAX_ACTIVE_POOLS = 50;
const poolCache = new Map<string, CachedTenantPool>();

let dataTablesEnsured = false;
/**
 * Runtime is read-only with respect to catalog DDL. Versioned Prisma migrations
 * are the single schema authority; no request may bootstrap tables with an
 * administrator connection or swallow an unsuccessful initialization.
 */
export async function ensureDataPlatformTables(): Promise<void> {
  if (dataTablesEnsured) return;
  let result;
  try {
    result = await pgPool.query<{
      project_databases: string | null;
      project_api_keys: string | null;
      storage_buckets: string | null;
      storage_objects: string | null;
      database_migration_records: string | null;
    }>(`SELECT to_regclass('public.project_databases')::text AS project_databases,
               to_regclass('public.project_api_keys')::text AS project_api_keys,
               to_regclass('public.storage_buckets')::text AS storage_buckets,
               to_regclass('public.storage_objects')::text AS storage_objects,
               to_regclass('public.database_migration_records')::text AS database_migration_records`);
  } catch {
    throw new AppError("Data platform migration verification unavailable", 503, "DATA_PLATFORM_CATALOG_UNAVAILABLE");
  }
  const row = result.rows[0];
  if (!row || Object.values(row).some((value) => !value)) {
    throw new AppError(
      "Data platform migrations are missing; run prisma migrate deploy before serving requests",
      503,
      "DATA_PLATFORM_MIGRATION_REQUIRED"
    );
  }
  dataTablesEnsured = true;
}

/**
 * Reject records left by the historical admin-database fallback.
 * A READY flag is not proof of tenant database isolation.
 */
export function assertDedicatedTenantDatabase(record: { dbName: string; dbUser: string }): void {
  const adminConnection = process.env.DATABASE_URL;
  if (!adminConnection) {
    throw new AppError("Platform database configuration is missing", 503, "TENANT_DATABASE_ISOLATION_UNAVAILABLE");
  }
  const controlPlane = new URL(adminConnection);
  const controlPlaneDatabase = decodeURIComponent(controlPlane.pathname.replace(/^\//, ""));
  const controlPlaneUser = decodeURIComponent(controlPlane.username);
  if (!record.dbName || !record.dbUser ||
      record.dbName === controlPlaneDatabase ||
      record.dbUser === controlPlaneUser) {
    throw new AppError(
      "Tenant database has not been isolated from the platform database",
      503,
      "TENANT_DATABASE_ISOLATION_UNAVAILABLE"
    );
  }
}

function cacheKey(projectId: string, environment: DatabaseEnvironment): string {
  return `${projectId}:${environment}`;
}

/**
 * Prunes the least recently used idle connection pool if cache size exceeds limit.
 */
async function pruneLruPools(): Promise<void> {
  if (poolCache.size < MAX_ACTIVE_POOLS) {
    return;
  }

  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, entry] of poolCache.entries()) {
    if (entry.lastAccessedAt < oldestTime) {
      oldestTime = entry.lastAccessedAt;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    const entry = poolCache.get(oldestKey);
    poolCache.delete(oldestKey);
    if (entry) {
      try {
        await entry.pool.end();
      } catch (err) {
        console.warn(`[PoolManager] Error terminating pruned pool for ${oldestKey}:`, err);
      }
    }
  }
}

/**
 * Retrieves or lazily creates a hardened, scale-to-zero pg.Pool for a tenant database.
 */
export async function getTenantPool(
  projectId: string,
  environment: DatabaseEnvironment = "PRODUCTION"
): Promise<pg.Pool> {
  const key = cacheKey(projectId, environment);
  const now = Date.now();

  const cached = poolCache.get(key);
  if (cached) {
    cached.lastAccessedAt = now;
    return cached.pool;
  }

  // Ensure tables exist before querying Prisma
  await ensureDataPlatformTables();

  // 1. Fetch tenant database record from Prisma
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(projectId)) {
    throw new AppError(
      `Tenant database not found for project ${projectId} (${environment})`,
      404,
      "DATABASE_NOT_FOUND"
    );
  }

  let dbRecord = await prisma.projectDatabase.findUnique({
    where: {
      websiteId_environment: {
        websiteId: projectId,
        environment,
      },
    },
  });

  // Check if projectId is a forgeProject id that links to a website
  if (!dbRecord) {
    try {
      const forgeProj = await (prisma as any).forgeProject?.findUnique?.({ where: { id: projectId } });
      if (forgeProj?.websiteId) {
        dbRecord = await prisma.projectDatabase.findUnique({
          where: {
            websiteId_environment: {
              websiteId: forgeProj.websiteId,
              environment,
            },
          },
        });
      }
    } catch {}
  }

  // Auto-provision tenant database on demand if missing
  if (!dbRecord) {
    try {
      const { provisionDatabase } = await import("../database/database-provisioner.service.js");
      dbRecord = await provisionDatabase(projectId, environment);
    } catch (provErr: any) {
      console.warn(`[PoolManager] Auto-provision on demand failed for ${projectId}:`, provErr?.message);
    }
  }

  if (!dbRecord) {
    throw new AppError(
      `Tenant database not found for project ${projectId} (${environment})`,
      404,
      "DATABASE_NOT_FOUND"
    );
  }

  if (dbRecord.status !== "READY") {
    throw new AppError(
      `Tenant database is not ready (status: ${dbRecord.status})`,
      409,
      "DATABASE_NOT_READY"
    );
  }

  assertDedicatedTenantDatabase(dbRecord);

  // 2. Decrypt database password
  const password = decryptCredential(dbRecord.encryptedPassword);

  // 3. Ensure we have room in pool cache
  await pruneLruPools();

  // 4. Create new scoped connection pool
  const pool = new pg.Pool({
    host: dbRecord.host,
    port: dbRecord.port,
    database: dbRecord.dbName,
    user: dbRecord.dbUser,
    password,
    min: 0, // Scale to zero when idle
    max: dbRecord.connectionPoolMax || 5, // Protect Postgres max_connections
    idleTimeoutMillis: dbRecord.connectionPoolIdleMs || 10000, // 10s idle client harvest
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000, // 10s query timeout limit
  });

  // Handle background client errors to prevent unhandled rejections
  pool.on("error", (err) => {
    console.error(`[PoolManager] Background error on tenant pool ${key}:`, err.message);
  });

  // An encrypted credential and READY row do not establish role isolation.
  // Verify the ACTUAL PostgreSQL principal and database before caching this pool.
  try {
    const client = await pool.connect();
    try {
      const verified = await client.query<{
        database_name: string;
        role_name: string;
        is_superuser: boolean;
        bypass_rls: boolean;
        can_create_db: boolean;
        can_create_role: boolean;
        database_owner: string;
      }>(`SELECT current_database() AS database_name, current_user AS role_name,
              r.rolsuper AS is_superuser, r.rolbypassrls AS bypass_rls,
              r.rolcreatedb AS can_create_db, r.rolcreaterole AS can_create_role,
              pg_get_userbyid(d.datdba) AS database_owner
           FROM pg_roles r JOIN pg_database d ON d.datname = current_database()
          WHERE r.rolname = current_user`);
      const role = verified.rows[0];
      if (!role || role.database_name !== dbRecord.dbName ||
          role.role_name !== dbRecord.dbUser || role.database_owner !== dbRecord.dbUser ||
          role.is_superuser || role.bypass_rls || role.can_create_db || role.can_create_role) {
        throw new AppError(
          "Tenant database connection has an unsafe principal or ownership",
          503,
          "TENANT_DATABASE_ISOLATION_UNAVAILABLE"
        );
      }
    } finally {
      client.release();
    }
  } catch (err: any) {
    await pool.end().catch(() => undefined);
    if (err instanceof AppError && err.code === "TENANT_DATABASE_ISOLATION_UNAVAILABLE") throw err;
    throw new AppError("Tenant database connection validation failed", 503, "DATABASE_CONNECTION_FAILED");
  }

  poolCache.set(key, {
    pool,
    lastAccessedAt: now,
    projectId,
    environment,
  });

  return pool;
}

/**
 * Closes and removes an active tenant connection pool from the cache.
 */
export async function closeTenantPool(
  projectId: string,
  environment: DatabaseEnvironment = "PRODUCTION"
): Promise<void> {
  const key = cacheKey(projectId, environment);
  const entry = poolCache.get(key);

  if (entry) {
    poolCache.delete(key);
    try {
      await entry.pool.end();
    } catch (err) {
      console.warn(`[PoolManager] Error draining pool for ${key}:`, err);
    }
  }
}

/**
 * Returns global connection telemetry for monitoring.
 */
export function getGlobalTelemetry(): {
  activePoolCount: number;
  keys: string[];
} {
  return {
    activePoolCount: poolCache.size,
    keys: Array.from(poolCache.keys()),
  };
}

export const TenantPoolManager = {
  getTenantPool,
  closeTenantPool,
  getGlobalTelemetry,
};
