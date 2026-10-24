import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { Readable } from "node:stream";

const h = vi.hoisted(() => ({
  findBackup: vi.fn(),
  getObjectStream: vi.fn(),
  getTenantPool: vi.fn(),
  connect: vi.fn(),
  query: vi.fn(),
  release: vi.fn(),
}));

vi.mock("../config/prisma.js", () => ({
  prisma: { projectDatabaseBackup: { findUnique: h.findBackup } },
}));
vi.mock("../modules/data-platform/storage/s3-client.js", () => ({
  getObjectStream: h.getObjectStream,
  ensureBucketExists: vi.fn(),
  putObject: vi.fn(),
}));
vi.mock("../modules/data-platform/common/pool-manager.js", () => ({
  TenantPoolManager: { getTenantPool: h.getTenantPool },
}));
vi.mock("../modules/data-platform/common/crypto.utils.js", () => ({
  decryptCredential: vi.fn(),
}));

import {
  restoreBackup,
  verifyBackupIntegrity,
} from "../modules/data-platform/database/database-backup.service.js";

const site = "11111111-1111-4111-8111-111111111111";
const sql = "-- PostgreSQL database dump\nCREATE TABLE backup_restore_test(id integer);\n";
const zipped = zlib.gzipSync(Buffer.from(sql));
const digest = crypto.createHash("sha256").update(zipped).digest("hex");

const backup = {
  id: "backup-1",
  storageKey: `backups/${site}/snapshot.sql.gz`,
  checksumSha256: digest,
  sizeBytes: BigInt(zipped.length),
  database: {
    websiteId: site,
    environment: "PRODUCTION",
    status: "READY",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.findBackup.mockResolvedValue(backup);
  h.getObjectStream.mockImplementation(async () => ({
    stream: Readable.from([zipped]),
  }));
  h.query.mockResolvedValue({});
  h.connect.mockResolvedValue({ query: h.query, release: h.release });
  h.getTenantPool.mockResolvedValue({ connect: h.connect });
});

describe("WP-02 restore integrity and tenant isolation", () => {
  it("accepts only the exact backup checksum and byte length", () => {
    expect(() => verifyBackupIntegrity(zipped, digest, zipped.length)).not.toThrow();
    expect(() => verifyBackupIntegrity(zipped, digest, zipped.length + 1))
      .toThrow(/metadata does not match/);
    expect(() => verifyBackupIntegrity(zipped, "bad", zipped.length)).toThrow();
  });

  it("rejects tampered S3 bytes before opening a tenant connection", async () => {
    h.getObjectStream.mockImplementation(async () => ({
      stream: Readable.from([Buffer.concat([zipped, Buffer.from("tamper")])]),
    }));
    await expect(restoreBackup("backup-1"))
      .rejects.toMatchObject({ code: "BACKUP_INTEGRITY_FAILED", statusCode: 409 });
    expect(h.getTenantPool).not.toHaveBeenCalled();
    expect(h.query).not.toHaveBeenCalled();
  });

  it("rejects forged backup metadata that points to another tenant", async () => {
    h.findBackup.mockResolvedValue({
      ...backup,
      storageKey: "backups/another-site/foreign.sql.gz",
    });
    await expect(restoreBackup("backup-1"))
      .rejects.toMatchObject({ code: "BACKUP_TENANT_MISMATCH" });
    expect(h.getObjectStream).not.toHaveBeenCalled();
    expect(h.getTenantPool).not.toHaveBeenCalled();
  });

  it("rejects a backup record when its target database is no longer READY", async () => {
    h.findBackup.mockResolvedValue({ ...backup, database: { ...backup.database, status: "FAILED" } });
    await expect(restoreBackup("backup-1"))
      .rejects.toMatchObject({ code: "BACKUP_TENANT_MISMATCH" });
    expect(h.getTenantPool).not.toHaveBeenCalled();
  });

  it("rejects an archive that is not a PostgreSQL SQL dump", async () => {
    const fake = zlib.gzipSync("DROP DATABASE control_plane;");
    h.findBackup.mockResolvedValue({
      ...backup,
      checksumSha256: crypto.createHash("sha256").update(fake).digest("hex"),
      sizeBytes: BigInt(fake.length),
    });
    h.getObjectStream.mockResolvedValue({ stream: Readable.from([fake]) });
    await expect(restoreBackup("backup-1"))
      .rejects.toMatchObject({ code: "BACKUP_ARCHIVE_INVALID" });
    expect(h.getTenantPool).not.toHaveBeenCalled();
  });

  it("executes a verified restore in one tenant-scoped transaction", async () => {
    await restoreBackup("backup-1");
    expect(h.getTenantPool).toHaveBeenCalledExactlyOnceWith(site, "PRODUCTION");
    expect(h.query.mock.calls.map((args) => args[0])).toEqual([
      "BEGIN;", sql, "COMMIT;",
    ]);
    expect(h.release).toHaveBeenCalledOnce();
  });

  it("rolls back failed SQL restore and releases tenant connection", async () => {
    h.query.mockImplementation(async (query) => {
      if (query === sql) throw new Error("invalid SQL");
    });
    await expect(restoreBackup("backup-1"))
      .rejects.toMatchObject({ code: "RESTORE_FAILED" });
    expect(h.query.mock.calls.map((args) => args[0])).toEqual([
      "BEGIN;", sql, "ROLLBACK;",
    ]);
    expect(h.release).toHaveBeenCalledOnce();
  });
});
