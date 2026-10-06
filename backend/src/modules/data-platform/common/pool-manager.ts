import pg from "pg";
import { prisma } from "../../../config/prisma.js";
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

  // 1. Fetch tenant database record from Prisma
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(projectId)) {
    throw new AppError(
      `Tenant database not found for project ${projectId} (${environment})`,
      404,
      "DATABASE_NOT_FOUND"
    );
  }

  const dbRecord = await prisma.projectDatabase.findUnique({
    where: {
      websiteId_environment: {
        websiteId: projectId,
        environment,
      },
    },
  });

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

  // Test connection immediately
  try {
    const client = await pool.connect();
    client.release();
  } catch (err: any) {
    await pool.end().catch(() => undefined);
    throw new AppError(
      `Failed to connect to tenant database: ${err.message}`,
      503,
      "DATABASE_CONNECTION_FAILED"
    );
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
