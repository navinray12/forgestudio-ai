import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  projectFind: vi.fn(),
  dbFind: vi.fn(),
  dbCreate: vi.fn(),
  initialize: vi.fn(),
  connect: vi.fn(),
}));

vi.mock("../config/prisma.js", () => ({
  prisma: {
    forgeProject: { findUnique: h.projectFind },
    forgeDatabase: { findFirst: h.dbFind, create: h.dbCreate },
  },
  pgPool: { connect: h.connect },
}));
vi.mock("../modules/data-platform/database/connectionManager.js", () => ({
  customerConnectionManager: { initializeCustomerSchema: h.initialize },
}));
vi.mock("../modules/data-platform/security/encryption.js", () => ({
  encryptCredential: vi.fn(() => "encrypted-credential"),
}));

import { forgeDatabaseService } from "../modules/data-platform/database/forgeDatabase.service.js";

const originalEnv = process.env.NODE_ENV;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.NODE_ENV = "test";
  h.dbFind.mockResolvedValue(null);
  h.projectFind.mockResolvedValue({ id: "project-a" });
  h.initialize.mockResolvedValue(undefined);
});
afterEach(() => {
  if (originalEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv;
});

describe("WP-02 legacy shared-schema read and production boundaries", () => {
  it("does not create a database as a side effect of GET", async () => {
    await expect(forgeDatabaseService.getDatabase("project-a", "development"))
      .rejects.toMatchObject({ code: "DATABASE_NOT_PROVISIONED", statusCode: 404 });
    expect(h.projectFind).not.toHaveBeenCalled();
    expect(h.initialize).not.toHaveBeenCalled();
    expect(h.dbCreate).not.toHaveBeenCalled();
  });

  it("returns only the explicitly provisioned environment", async () => {
    const record = { id: "db-a", projectId: "project-a", environment: "development" };
    h.dbFind.mockResolvedValue(record);
    await expect(forgeDatabaseService.getDatabase("project-a", "development"))
      .resolves.toEqual(record);
    expect(h.dbFind).toHaveBeenCalledWith({
      where: { projectId: "project-a", environment: "development" },
    });
  });

  it("refuses legacy schema provisioning in production before touching a control-plane database", async () => {
    process.env.NODE_ENV = "production";
    await expect(forgeDatabaseService.provisionDatabase("project-a", "development"))
      .rejects.toMatchObject({ code: "LEGACY_DATABASE_ISOLATION_REQUIRED", statusCode: 503 });
    expect(h.projectFind).not.toHaveBeenCalled();
    expect(h.initialize).not.toHaveBeenCalled();
  });
});
