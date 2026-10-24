import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  find: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  listTables: vi.fn(),
}));

vi.mock("../config/prisma.js", () => ({
  prisma: { forgeApiConfig: { findFirst: h.find, findMany: h.findMany, create: h.create } },
}));
vi.mock("../modules/data-platform/database/forgeDatabase.service.js", () => ({
  forgeDatabaseService: { listTables: h.listTables },
}));
vi.mock("../modules/data-platform/studio/databaseStudio.service.js", () => ({
  databaseStudioService: {},
}));

import { dataApiService } from "../modules/data-platform/api-layer/dataApi.service.js";

beforeEach(() => {
  vi.clearAllMocks();
  h.find.mockResolvedValue(null);
  h.findMany.mockResolvedValue([]);
  h.listTables.mockResolvedValue([{ name: "sensitive_orders" }]);
  h.create.mockImplementation(async ({ data }) => ({ id: "api_config_1", ...data }));
});

describe("WP-02 legacy generated API must fail closed", () => {
  it("does not expose an unconfigured table", async () => {
    await expect(dataApiService.validateAccess("db_id", "sensitive_orders", "GET"))
      .rejects.toMatchObject({ statusCode: 403, code: "API_OPERATION_FORBIDDEN" });
  });

  it("auto-created configs are private by default", async () => {
    const rows = await dataApiService.getApiConfigs("db_id", "project_a");
    expect(rows).toMatchObject([{ tableName: "sensitive_orders", isExposed: false, requireAuth: true }]);
    expect(h.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      databaseId: "db_id", projectId: "project_a", isExposed: false,
    }) });
  });

  it("denies operations not explicitly granted to an exposed table", async () => {
    h.find.mockResolvedValue({ isExposed: true, allowedOperations: ["GET"] });
    await expect(dataApiService.validateAccess("db_id", "sensitive_orders", "DELETE"))
      .rejects.toMatchObject({ statusCode: 403, code: "API_OPERATION_FORBIDDEN" });
    await expect(dataApiService.validateAccess("db_id", "sensitive_orders", "GET"))
      .resolves.toBeUndefined();
  });

  it("rejects malformed allowed-operation lists", async () => {
    h.find.mockResolvedValue({ isExposed: true, allowedOperations: null });
    await expect(dataApiService.validateAccess("db_id", "sensitive_orders", "GET"))
      .rejects.toMatchObject({ code: "API_OPERATION_FORBIDDEN" });
  });
});
