import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/prisma.js", () => ({
  prisma: {},
  pgPool: {},
}));
vi.mock("../modules/data-platform/common/crypto.utils.js", () => ({
  decryptCredential: vi.fn(),
}));

import { assertDedicatedTenantDatabase } from "../modules/data-platform/common/pool-manager.js";

const original = process.env.DATABASE_URL;

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
});

describe("WP-01 legacy tenant pool record isolation", () => {
  it("rejects an apparently READY record using the platform database", () => {
    process.env.DATABASE_URL = "postgresql://control_admin:password@localhost:5432/forge_control";
    expect(() => assertDedicatedTenantDatabase({
      dbName: "forge_control", dbUser: "tenant_role",
    })).toThrow(/not been isolated/);
  });

  it("rejects reuse of the platform administrator identity with a different database", () => {
    process.env.DATABASE_URL = "postgresql://control_admin:password@localhost:5432/forge_control";
    expect(() => assertDedicatedTenantDatabase({
      dbName: "db_some_tenant", dbUser: "control_admin",
    })).toThrow(/not been isolated/);
  });

  it("accepts correctly named dedicated tenant databases and roles", () => {
    process.env.DATABASE_URL = "postgresql://control_admin:password@localhost:5432/forge_control";
    expect(() => assertDedicatedTenantDatabase({
      dbName: "db_12345678_1234_1234_1234_123456789abc",
      dbUser: "usr_12345678_1234_1234_1234_123456789abc",
    })).not.toThrow();
  });

  it("fails closed if the platform database identity cannot be determined", () => {
    delete process.env.DATABASE_URL;
    expect(() => assertDedicatedTenantDatabase({
      dbName: "db_tenant", dbUser: "usr_tenant",
    })).toThrow(/configuration is missing/);
  });
});
