import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  siteFind: vi.fn(),
  projectFind: vi.fn(),
  projectCreate: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("../config/prisma.js", () => ({
  prisma: {
    website: { findUnique: h.siteFind },
    forgeProject: { findUnique: h.projectFind, create: h.projectCreate },
  },
  pgPool: {},
}));
vi.mock("../services/audit.service.js", () => ({ recordAuditLog: h.audit }));
vi.mock("../services/compiler/pageRegistry.js", () => ({
  buildSyncBaseline: vi.fn(),
  toProjectFramework: vi.fn(),
}));

import { createForgeProject } from "../services/project/forgeProject.service.js";

const ownerId = "00000000-0000-4000-8000-000000000001";
const foreign = "00000000-0000-4000-8000-000000000002";
const websiteId = "00000000-0000-4000-8000-000000000003";
const workspaceId = "00000000-0000-4000-8000-000000000004";

beforeEach(() => {
  vi.clearAllMocks();
  h.projectFind.mockResolvedValue(null);
  h.siteFind.mockResolvedValue({ id: websiteId, userId: ownerId, workspaceId, organizationId: null });
  h.projectCreate.mockImplementation(async ({ data }) => ({ id: "project-new", ...data }));
  h.audit.mockResolvedValue(undefined);
});

describe("WP-01 ForgeProject associated website boundary", () => {
  it("denies foreign website even when its identifier exists", async () => {
    h.siteFind.mockResolvedValue({ id: websiteId, userId: foreign, workspaceId });
    await expect(createForgeProject({ name: "Project", ownerId, websiteId, workspaceId }))
      .rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
    expect(h.projectCreate).not.toHaveBeenCalled();
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("denies mismatched workspace association", async () => {
    await expect(createForgeProject({
      name: "Project", ownerId, websiteId,
      workspaceId: "00000000-0000-4000-8000-000000000005",
    })).rejects.toMatchObject({ statusCode: 404 });
    expect(h.projectCreate).not.toHaveBeenCalled();
  });

  it("permits correctly owned website and workspace", async () => {
    const result = await createForgeProject({ name: "Project", ownerId, websiteId, workspaceId });
    expect(result.websiteId).toBe(websiteId);
    expect(h.projectCreate).toHaveBeenCalledOnce();
    expect(h.audit).toHaveBeenCalledOnce();
  });

  it("returns the same not-found response for missing and foreign sites", async () => {
    h.siteFind.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: websiteId, userId: foreign });
    for (let i = 0; i < 2; i++) {
      await expect(createForgeProject({ name: "Project", ownerId, websiteId }))
        .rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
    }
  });
});
