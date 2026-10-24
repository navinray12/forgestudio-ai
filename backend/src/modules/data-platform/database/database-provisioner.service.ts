import pg from "pg";
import { prisma, pgPool } from "../../../config/prisma.js";
import { encryptCredential, generateSecurePassword } from "../common/crypto.utils.js";
import { TenantPoolManager } from "../common/pool-manager.js";
import { AppError } from "../../../utils/app-error.js";
import type { DatabaseEnvironment, ProjectDatabase } from "../../../generated/prisma/client.js";

/**
 * Validates and ensures an identifier is a safe PostgreSQL token (max 63 chars, alphanumeric + underscore).
 */
export function sanitizeIdentifier(identifier: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new AppError(
      `Invalid PostgreSQL identifier "${identifier}". Only alphanumeric characters and underscores are allowed.`,
      400,
      "INVALID_IDENTIFIER"
    );
  }
  return identifier.slice(0, 63);
}

/**
 * Computes deterministic, isolated database and user names for a project and environment.
 */
export function getDatabaseIdentifiers(
  projectId: string,
  environment: DatabaseEnvironment = "PRODUCTION"
): { dbName: string; dbUser: string } {
  const cleanId = projectId.replace(/-/g, "_").slice(0, 36);
  const suffix = environment === "PRODUCTION" ? "" : `_${environment.toLowerCase().slice(0, 4)}`;
  const dbName = sanitizeIdentifier(`db_${cleanId}${suffix}`.slice(0, 63));
  const dbUser = sanitizeIdentifier(`usr_${cleanId}${suffix}`.slice(0, 63));
  return { dbName, dbUser };
}

/**
 * Extracts the administrative connection configuration from DATABASE_URL.
 */
export function getAdminDatabaseConfig(): {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
} {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new AppError("DATABASE_URL is not configured", 500, "CONFIG_ERROR");
  }

  const parsed = new URL(connectionString);
  return {
    host: parsed.hostname || "localhost",
    port: parseInt(parsed.port || "5432", 10),
    user: decodeURIComponent(parsed.username || "postgres"),
    password: decodeURIComponent(parsed.password || ""),
    database: parsed.pathname ? parsed.pathname.replace(/^\//, "") : "postgres",
  };
}

/**
 * Provisions a dedicated, isolated PostgreSQL tenant database, role, and schema extensions.
 */
export async function provisionDatabase(
  projectId: string,
  environment: DatabaseEnvironment = "PRODUCTION"
): Promise<ProjectDatabase> {
  const adminConfig = getAdminDatabaseConfig();
  const { dbName, dbUser } = getDatabaseIdentifiers(projectId, environment);

  // 1. Check existing record in Prisma
  let existing = await prisma.projectDatabase.findUnique({
    where: {
      websiteId_environment: {
        websiteId: projectId,
        environment,
      },
    },
  });

  if (existing && existing.status === "READY") {
    return existing;
  }

  const rawPassword = generateSecurePassword(32);
  const encryptedPassword = encryptCredential(rawPassword);

  if (!existing) {
    existing = await prisma.projectDatabase.create({
      data: {
        websiteId: projectId,
        environment,
        status: "PROVISIONING",
        dbName,
        dbUser,
        encryptedPassword,
        host: adminConfig.host,
        port: adminConfig.port,
      },
    });
  } else {
    existing = await prisma.projectDatabase.update({
      where: { id: existing.id },
      data: {
        status: "PROVISIONING",
        encryptedPassword,
        host: adminConfig.host,
        port: adminConfig.port,
        dbName,
        dbUser,
      },
    });
  }

  const adminClient = await pgPool.connect();

  try {
    try {
      // 2. Ensure role exists and update its password
      const roleCheck = await adminClient.query(
        `SELECT 1 FROM pg_roles WHERE rolname = $1`,
        [dbUser]
      );

      // Escape single quotes in password for DDL statement
      const safePassword = rawPassword.replace(/'/g, "''");

      if (roleCheck.rowCount === 0) {
        await adminClient.query(
          `CREATE ROLE "${dbUser}" WITH LOGIN PASSWORD '${safePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE;`
        );
      } else {
        await adminClient.query(
          `ALTER ROLE "${dbUser}" WITH LOGIN PASSWORD '${safePassword}';`
        );
      }

      // 3. Ensure database exists with tenant owner
      const dbCheck = await adminClient.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [dbName]
      );

      if (dbCheck.rowCount === 0) {
        await adminClient.query(
          `CREATE DATABASE "${dbName}" OWNER "${dbUser}" ENCODING 'UTF8';`
        );
      } else {
        await adminClient.query(
          `ALTER DATABASE "${dbName}" OWNER TO "${dbUser}";`
        );
      }

      // 4. Secure database permissions
      await adminClient.query(`REVOKE ALL ON DATABASE "${dbName}" FROM PUBLIC;`);
      await adminClient.query(`GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${dbUser}";`);
    } catch {
      // Never put tenant data in the SaaS control-plane database using an
      // administrator account. A failed dedicated database is NOT provisioned.
      await prisma.projectDatabase.update({
        where: { id: existing.id },
        data: { status: "FAILED" },
      }).catch(() => undefined);
      throw new AppError(
        "Dedicated tenant database provisioning failed; administrator database fallback is forbidden",
        503,
        "TENANT_DATABASE_ISOLATION_UNAVAILABLE"
      );
    }
  } finally {
    adminClient.release();
  }

  // 5. Connect to tenant database if dedicated to install standard extensions
  const tenantAdminPool = new pg.Pool({
    ...adminConfig,
    database: dbName,
    max: 2,
    connectionTimeoutMillis: 5000,
  });

  try {
    const tenantClient = await tenantAdminPool.connect();
    try {
      await tenantClient.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
      await tenantClient.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
      await tenantClient.query(`GRANT ALL ON SCHEMA public TO "${dbUser}";`);
      await tenantClient.query(`GRANT USAGE ON SCHEMA public TO "${dbUser}";`);
      await tenantClient.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${dbUser}";`
      );
      await tenantClient.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${dbUser}";`
      );
    } finally {
      tenantClient.release();
    }
  } catch {
    await prisma.projectDatabase.update({
      where: { id: existing.id },
      data: { status: "FAILED" },
    }).catch(() => undefined);
    throw new AppError("Dedicated tenant database initialization failed", 503, "TENANT_DATABASE_SETUP_FAILED");
  } finally {
    await tenantAdminPool.end().catch(() => undefined);
  }
  // 6. Update database status to READY in Prisma
  const finalEncryptedPassword = encryptedPassword;
  const readyRecord = await prisma.projectDatabase.update({
    where: { id: existing.id },
    data: {
      status: "READY",
      encryptedPassword: finalEncryptedPassword,
      host: adminConfig.host,
      port: adminConfig.port,
      dbName,
      dbUser,
    },
  });

  return readyRecord;
}

/**
 * Deprovisions a tenant database, dropping the database and role safely.
 */
export async function deprovisionDatabase(
  projectId: string,
  environment: DatabaseEnvironment = "PRODUCTION"
): Promise<void> {
  const { dbName, dbUser } = getDatabaseIdentifiers(projectId, environment);

  // 1. Drain and close any cached pool
  await TenantPoolManager.closeTenantPool(projectId, environment);

  const adminClient = await pgPool.connect();

  try {
    // 2. Terminate active connections on tenant database
    await adminClient.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid();`,
      [dbName]
    );

    // 3. Drop tenant database
    await adminClient.query(`DROP DATABASE IF EXISTS "${dbName}";`);

    // 4. Drop tenant role
    await adminClient.query(`DROP ROLE IF EXISTS "${dbUser}";`);
  } finally {
    adminClient.release();
  }

  // 5. Update or remove Prisma record
  await prisma.projectDatabase.updateMany({
    where: {
      websiteId: projectId,
      environment,
    },
    data: {
      status: "SUSPENDED",
    },
  });
}
