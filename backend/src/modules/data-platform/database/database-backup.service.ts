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
  let bytes = 0;
  for await (const chunk of stream) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += part.length;
    if (bytes > MAX_BACKUP_COMPRESSED_BYTES) {
      throw new AppError("Stored backup exceeds the safe restore size", 413, "BACKUP_TOO_LARGE");
    }
    chunks.push(part);
  }
  return Buffer.concat(chunks);
}

const MAX_BACKUP_COMPRESSED_BYTES = 256 * 1024 * 1024; // bounded in-memory backup/restore
const MAX_BACKUP_SQL_BYTES = 512 * 1024 * 1024;

/** Compare the S3 payload to the control-plane checksum BEFORE any restore SQL. */
export function verifyBackupIntegrity(
  data: Buffer,
  expectedSha256: string,
  expectedSizeBytes: bigint | number | string
): void {
  const declaredSize = BigInt(expectedSizeBytes);
  if (data.length === 0 || data.length > MAX_BACKUP_COMPRESSED_BYTES ||
      BigInt(data.length) !== declaredSize || !/^[0-9a-f]{64}$/i.test(expectedSha256)) {
    throw new AppError("Stored backup metadata does not match payload", 409, "BACKUP_INTEGRITY_FAILED");
  }
  const actual = crypto.createHash("sha256").update(data).digest();
  const expected = Buffer.from(expectedSha256, "hex");
  if (!crypto.timingSafeEqual(actual, expected)) {
    throw new AppError("Stored backup checksum mismatch", 409, "BACKUP_INTEGRITY_FAILED");
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

      let bytes = 0;
      let oversized = false;
      proc.stdout.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_BACKUP_SQL_BYTES) {
          oversized = true;
          proc.kill();
          return;
        }
        chunks.push(chunk);
      });
      proc.stderr.on("data", (chunk: Buffer) => {
        if (errChunks.length < 8) errChunks.push(chunk.subarray(0, 1024));
      });

      proc.on("error", (err) => reject(err));
      proc.on("close", (code) => {
        if (oversized) {
          reject(new AppError("Tenant backup exceeds bounded backup size", 413, "BACKUP_TOO_LARGE"));
        } else if (code === 0 && bytes > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          // Do not leak database error output (which may contain tenant values).
          reject(new AppError("PostgreSQL pg_dump failed", 503, "BACKUP_DUMP_FAILED"));
        }
      });
    });

    const rawDump = await rawDumpPromise;
    compressedBuffer = zlib.gzipSync(rawDump);
  } catch {
    // A hand-built dump omits database constraints, RLS, triggers and indexes.
    // Missing/failed pg_dump must NEVER become a reported successful backup.
    throw new AppError("Verified PostgreSQL backup unavailable; pg_dump is required", 503, "BACKUP_DUMP_FAILED");
  }
  if (compressedBuffer.length > MAX_BACKUP_COMPRESSED_BYTES) {
    throw new AppError("Tenant backup exceeds the supported size", 413, "BACKUP_TOO_LARGE");
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

  // Never use an object key that points outside this tenant's backup prefix.
  if (backup.database.status !== "READY" ||
      !backup.storageKey.startsWith(`backups/${backup.database.websiteId}/`) ||
      !backup.storageKey.endsWith(".sql.gz")) {
    throw new AppError("Backup tenant association is invalid", 409, "BACKUP_TENANT_MISMATCH");
  }

  // 1. Download a bounded snapshot, then verify checksum and DB-record size.
  const { stream } = await getObjectStream(BACKUP_BUCKET, backup.storageKey);
  const compressedBuffer = await streamToBuffer(stream);
  verifyBackupIntegrity(compressedBuffer, backup.checksumSha256, backup.sizeBytes);

  // 2. Decompress only after integrity verification. Never run unverified SQL.
  let sqlScript: string;
  try {
    sqlScript = zlib.gunzipSync(compressedBuffer, {
      maxOutputLength: MAX_BACKUP_SQL_BYTES,
    }).toString("utf8");
    if (!sqlScript.startsWith("--") || !sqlScript.includes("PostgreSQL database dump")) {
      throw new Error("Unknown backup format");
    }
  } catch {
    throw new AppError("Backup archive is invalid or exceeds restore limits", 409, "BACKUP_ARCHIVE_INVALID");
  }

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
