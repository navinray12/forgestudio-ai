import { spawn } from "node:child_process";
import zlib from "node:zlib";
import crypto from "node:crypto";
import type { Readable } from "node:stream";
import {
  putObject,
  ensureBucketExists,
  getObjectStream,
} from "../storage/s3-client.js";
import { prisma } from "../../../config/prisma.js";
import { decryptCredential } from "../common/crypto.utils.js";
import { TenantPoolManager } from "../common/pool-manager.js";
import { AppError } from "../../../utils/app-error.js";
import type {
  DatabaseEnvironment,
  ProjectDatabaseBackup,
} from "../../../generated/prisma/client.js";

const BACKUP_BUCKET = "internal-backups";

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Fallback SQL generator if pg_dump CLI is not present in the runtime environment.
 */
async function generateLogicalSqlDump(
  projectId: string,
  environment: DatabaseEnvironment
): Promise<string> {
  const pool = await TenantPoolManager.getTenantPool(projectId, environment);
  const client = await pool.connect();

  try {
    let sql = `-- ForgeStudio Logical Backup for project ${projectId}\n`;
    sql += `-- Generated at ${new Date().toISOString()}\n\n`;

    // Query all user tables in public schema
    const tablesRes = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name;`
    );

    for (const { table_name } of tablesRes.rows) {
      sql += `-- Table: ${table_name}\n`;
      sql += `DROP TABLE IF EXISTS "${table_name}" CASCADE;\n`;

      // Get columns
      const colsRes = await client.query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }>(
        `SELECT column_name, data_type, is_nullable, column_default 
         FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = $1 
         ORDER BY ordinal_position;`,
        [table_name]
      );

      const colDefs = colsRes.rows.map((col) => {
        let def = `"${col.column_name}" ${col.data_type.toUpperCase()}`;
        if (col.column_default) def += ` DEFAULT ${col.column_default}`;
        if (col.is_nullable === "NO") def += ` NOT NULL`;
        return def;
      });

      sql += `CREATE TABLE "${table_name}" (\n  ${colDefs.join(",\n  ")}\n);\n`;

      // Dump row data
      const dataRes = await client.query(`SELECT * FROM "${table_name}";`);
      for (const row of dataRes.rows) {
        const columns = Object.keys(row).map((c) => `"${c}"`).join(", ");
        const values = Object.values(row)
          .map((v) => {
            if (v === null) return "NULL";
            if (typeof v === "number" || typeof v === "boolean") return String(v);
            if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
            return `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(", ");

        if (columns.length > 0) {
          sql += `INSERT INTO "${table_name}" (${columns}) VALUES (${values});\n`;
        }
      }
      sql += "\n";
    }

    return sql;
  } finally {
    client.release();
  }
}

/**
 * Creates an automated compressed snapshot backup of the tenant PostgreSQL database.
 */
export async function createBackup(
  projectId: string,
  environment: DatabaseEnvironment = "PRODUCTION"
): Promise<ProjectDatabaseBackup> {
  // 1. Fetch database configuration
  const dbRecord = await prisma.projectDatabase.findUnique({
    where: {
      websiteId_environment: {
        websiteId: projectId,
        environment,
      },
    },
  });

  if (!dbRecord || dbRecord.status !== "READY") {
    throw new AppError(
      "Cannot backup database: Database is not ready or not found",
      400,
      "DATABASE_NOT_READY"
    );
  }

  const password = decryptCredential(dbRecord.encryptedPassword);

  // 2. Ensure backup storage bucket exists on S3/MinIO
  await ensureBucketExists(BACKUP_BUCKET);

  let compressedBuffer: Buffer;

  // Try standard pg_dump first
  try {
    const rawDumpPromise = new Promise<Buffer>((resolve, reject) => {
      const proc = spawn(
        "pg_dump",
        [
          "-h", dbRecord.host,
          "-p", String(dbRecord.port),
          "-U", dbRecord.dbUser,
          "-d", dbRecord.dbName,
          "--clean",
          "--if-exists",
          "--no-owner",
          "--no-privileges",
        ],
        {
          env: {
            ...process.env,
            PGPASSWORD: password,
          },
        }
      );

      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      proc.stdout.on("data", (chunk) => chunks.push(chunk));
      proc.stderr.on("data", (chunk) => errChunks.push(chunk));

      proc.on("error", (err) => reject(err));
      proc.on("close", (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`pg_dump failed (code ${code}): ${Buffer.concat(errChunks).toString()}`));
        }
      });
    });

    const rawDump = await rawDumpPromise;
    compressedBuffer = zlib.gzipSync(rawDump);
  } catch (err: any) {
    // If pg_dump CLI is missing (e.g. minimal Node container or Windows dev), use resilient fallback
    console.warn(`[BackupService] pg_dump CLI unavailable or failed (${err.message}), utilizing logical SQL generator fallback.`);
    const sqlScript = await generateLogicalSqlDump(projectId, environment);
    compressedBuffer = zlib.gzipSync(Buffer.from(sqlScript, "utf8"));
  }

  // 3. Compute checksum & file metadata
  const checksumSha256 = crypto
    .createHash("sha256")
    .update(compressedBuffer)
    .digest("hex");

  const timestamp = Date.now();
  const backupName = `backup-${dbRecord.dbName}-${timestamp}`;
  const storageKey = `backups/${projectId}/${timestamp}-${dbRecord.dbName}.sql.gz`;

  // 4. Upload compressed snapshot to S3
  await putObject(
    BACKUP_BUCKET,
    storageKey,
    compressedBuffer,
    "application/gzip"
  );

  // 5. Record backup in Prisma transaction
  const [backupRecord] = await prisma.$transaction([
    prisma.projectDatabaseBackup.create({
      data: {
        databaseId: dbRecord.id,
        backupName,
        storageKey,
        sizeBytes: BigInt(compressedBuffer.length),
        checksumSha256,
      },
    }),
    prisma.projectDatabase.update({
      where: { id: dbRecord.id },
      data: {
        lastBackupAt: new Date(),
      },
    }),
  ]);

  return backupRecord;
}

/**
 * Lists all historical snapshots for a given project.
 */
export async function listBackups(
  projectId: string
): Promise<ProjectDatabaseBackup[]> {
  return await prisma.projectDatabaseBackup.findMany({
    where: {
      database: {
        websiteId: projectId,
      },
    },
    orderBy: {
      completedAt: "desc",
    },
  });
}

/**
 * Restores a tenant database from a stored snapshot.
 */
export async function restoreBackup(backupId: string): Promise<void> {
  const backup = await prisma.projectDatabaseBackup.findUnique({
    where: { id: backupId },
    include: { database: true },
  });

  if (!backup) {
    throw new AppError("Backup record not found", 404, "BACKUP_NOT_FOUND");
  }

  // 1. Fetch compressed backup from S3
  const { stream } = await getObjectStream(BACKUP_BUCKET, backup.storageKey);
  const compressedBuffer = await streamToBuffer(stream);

  // 2. Decompress GZIP payload
  const sqlScript = zlib.gunzipSync(compressedBuffer).toString("utf8");

  // 3. Connect to tenant database and execute restore script
  const pool = await TenantPoolManager.getTenantPool(
    backup.database.websiteId,
    backup.database.environment
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN;");
    await client.query(sqlScript);
    await client.query("COMMIT;");
  } catch (err: any) {
    await client.query("ROLLBACK;").catch(() => undefined);
    throw new AppError(
      `Database restore failed: ${err.message}`,
      500,
      "RESTORE_FAILED"
    );
  } finally {
    client.release();
  }
}
