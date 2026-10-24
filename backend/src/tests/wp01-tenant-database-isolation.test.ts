import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  find: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  connect: vi.fn(),
  adminQuery: vi.fn(),
  release: vi.fn(),
}));

vi.mock("../config/prisma.js", () => ({
  prisma: {
    projectDatabase: { findUnique: h.find, create: h.create, update: h.update },
  },
  pgPool: { connect: h.connect },
}));
vi.mock("../modules/data-platform/common/crypto.utils.js", () => ({
  encryptCredential: () => "encrypted-test-secret",
  generateSecurePassword: () => "a-unique-test-secret",
}));
vi.mock("../modules/data-platform/common/pool-manager.js", () => ({
  TenantPoolManager: { closeTenantPool: vi.fn() },
}));

import { provisionDatabase } from "../modules/data-platform/database/database-provisioner.service.js";

const originalUrl = process.env.DATABASE_URL;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL = "postgresql://platform_admin:secret@127.0.0.1:5432/forge_control";
  h.find.mockResolvedValue(null);
  h.create.mockResolvedValue({ id: "database-record", status: "PROVISIONING" });
  h.update.mockImplementation(async ({ data }) => ({ id: "database-record", ...data }));
  h.adminQuery.mockRejectedValue(new Error("CREATE ROLE permission denied"));
  h.release.mockReturnValue(undefined);
  h.connect.mockResolvedValue({ query: h.adminQuery, release: h.release });
});

afterEach(() => {
  if (originalUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalUrl;
});

describe("WP-01 dedicated database isolation", () => {
  it("fails closed if the cluster cannot create a tenant role", async () => {
    await expect(provisionDatabase("12345678-1234-1234-1234-123456789abc"))
      .rejects.toMatchObject({
        code: "TENANT_DATABASE_ISOLATION_UNAVAILABLE",
        statusCode: 503,
      });
    expect(h.update).toHaveBeenCalledWith({
      where: { id: "database-record" }, data: { status: "FAILED" },
    });
    expect(h.update.mock.calls.some((args) => args[0].data.status === "READY")).toBe(false);
    expect(h.release).toHaveBeenCalledOnce();
  });

  it("never returns control-plane credentials when dedicated provisioning fails", async () => {
    await expect(provisionDatabase("12345678-1234-1234-1234-123456789abc"))
      .rejects.toThrow(/fallback is forbidden/);
    const updates = h.update.mock.calls.map(([args]) => args.data);
    expect(updates).not.toContainEqual(expect.objectContaining({
      dbName: "forge_control", dbUser: "platform_admin",
    }));
  });
});
