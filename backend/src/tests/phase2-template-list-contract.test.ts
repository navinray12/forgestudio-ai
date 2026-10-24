import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  executeRawUnsafe: vi.fn().mockResolvedValue(0),
}));

vi.mock("../config/prisma.js", () => ({
  prisma: {
    $queryRaw: db.queryRaw,
    $executeRawUnsafe: db.executeRawUnsafe,
  },
}));

import { getUserTemplates } from "../services/template.service.js";

beforeEach(() => {
  db.queryRaw.mockReset();
});

describe("template listing database contract", () => {
  it("returns an empty list when the authenticated user has no templates", async () => {
    db.queryRaw.mockResolvedValue([]);
    await expect(getUserTemplates("00000000-0000-0000-0000-000000000001"))
      .resolves.toEqual([]);
  });

  it("returns existing user templates without fabricating local records", async () => {
    const template = { id: "template-1", userId: "owner-1", name: "Header" };
    db.queryRaw.mockResolvedValue([template]);
    await expect(getUserTemplates("00000000-0000-0000-0000-000000000001"))
      .resolves.toEqual([template]);
  });

  it("reports a database failure rather than an incorrect empty library", async () => {
    const logs = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      db.queryRaw.mockRejectedValue(new Error("database connection unavailable"));
      await expect(getUserTemplates("00000000-0000-0000-0000-000000000001"))
        .rejects.toThrow("Unable to load templates");
    } finally {
      logs.mockRestore();
    }
  });
});
