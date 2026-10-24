import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

const h = vi.hoisted(() => ({
  findDB: vi.fn(),
  spawn: vi.fn(),
  ensureBucketExists: vi.fn(),
  putObject: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("node:child_process", () => ({ spawn: h.spawn }));
vi.mock("../config/prisma.js", () => ({
  prisma: {
    projectDatabase: { findUnique: h.findDB },
    $transaction: h.transaction,
  },
}));
vi.mock("../modules/data-platform/storage/s3-client.js", () => ({
  ensureBucketExists: h.ensureBucketExists,
  putObject: h.putObject,
  getObjectStream: vi.fn(),
}));
vi.mock("../modules/data-platform/common/crypto.utils.js", () => ({
  decryptCredential: vi.fn(() => "test-db-password"),
}));
vi.mock("../modules/data-platform/common/pool-manager.js", () => ({
  TenantPoolManager: { getTenantPool: vi.fn() },
}));

import { createBackup } from "../modules/data-platform/database/database-backup.service.js";

const id = "11111111-1111-4111-8111-111111111111";
const database = {
  id: "db-record-1", websiteId: id, environment: "PRODUCTION",
  status: "READY", encryptedPassword: "encrypted",
  host: "127.0.0.1", port: 5432,
  dbUser: "tenant_user", dbName: "tenant_db",
};

beforeEach(() => {
  vi.clearAllMocks();
  h.findDB.mockResolvedValue(database);
  h.ensureBucketExists.mockResolvedValue(undefined);
});

describe("WP-02 backup generation must fail closed", () => {
  it("rejects a missing pg_dump without creating a false backup", async () => {
    h.spawn.mockImplementation(() => {
      const process = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter; stderr: EventEmitter; kill: ReturnType<typeof vi.fn>;
      };
      process.stdout = new EventEmitter();
      process.stderr = new EventEmitter();
      process.kill = vi.fn();
      queueMicrotask(() => process.emit("error", new Error("ENOENT")));
      return process;
    });
    await expect(createBackup(id, "PRODUCTION"))
      .rejects.toMatchObject({ statusCode: 503, code: "BACKUP_DUMP_FAILED" });
    expect(h.putObject).not.toHaveBeenCalled();
    expect(h.transaction).not.toHaveBeenCalled();
  });

  it("rejects nonzero pg_dump status without publishing a recovery point", async () => {
    h.spawn.mockImplementation(() => {
      const process = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter; stderr: EventEmitter; kill: ReturnType<typeof vi.fn>;
      };
      process.stdout = new EventEmitter();
      process.stderr = new EventEmitter();
      process.kill = vi.fn();
      queueMicrotask(() => process.emit("close", 1));
      return process;
    });
    await expect(createBackup(id, "PRODUCTION"))
      .rejects.toMatchObject({ code: "BACKUP_DUMP_FAILED" });
    expect(h.putObject).not.toHaveBeenCalled();
  });

  it("rejects backups from tenants without a READY database", async () => {
    h.findDB.mockResolvedValue({ ...database, status: "FAILED" });
    await expect(createBackup(id, "PRODUCTION"))
      .rejects.toMatchObject({ code: "DATABASE_NOT_READY" });
    expect(h.spawn).not.toHaveBeenCalled();
  });
});
