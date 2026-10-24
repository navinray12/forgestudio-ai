import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const h = vi.hoisted(() => ({
  verify: vi.fn(),
  getWebsite: vi.fn(),
  updateWebsite: vi.fn(),
}));
vi.mock("../config/prisma.js", () => ({
  prisma: { website: { findUnique: h.getWebsite, update: h.updateWebsite } },
}));
vi.mock("../modules/data-platform/common/project-access.js", () => ({
  verifyProjectAccess: h.verify,
}));

import {
  addDomain, listDomains, removeDomain,
  setDomainPrimary, provisionDomainSsl,
} from "../controllers/customDomain.controller.js";

const SITE = "11111111-1111-4111-8111-111111111111";
const originalWebsite = {
  id: SITE, userId: "owner", editorData: {
    customDomains: [{ domain: "existing.example.org", status: "active", isPrimary: true,
      verificationToken: "server-verified-token", verificationMethod: "TXT" }],
  },
};

function args(userId?: string, params: Record<string, string> = {}, body: Record<string, unknown> = {}) {
  const req = {
    params: { websiteId: SITE, ...params }, body,
  } as unknown as Request;
  const res = {
    locals: userId ? { user: { id: userId } } : {},
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return { req, res };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.verify.mockResolvedValue({ website: { id: SITE, userId: "owner" }, canAdminister: false });
  h.getWebsite.mockResolvedValue(originalWebsite);
  h.updateWebsite.mockResolvedValue(originalWebsite);
});

describe("WP-05 custom domain cross-tenant and admin authorization", () => {
  it("denies missing authenticated identity, without even loading a website", async () => {
    const { req, res } = args();
    await listDomains(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(h.verify).not.toHaveBeenCalled();
    expect(h.getWebsite).not.toHaveBeenCalled();
  });

  it("allows existing read-only members to list domains", async () => {
    const { req, res } = args("collaborator");
    await listDomains(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(h.verify).toHaveBeenCalledWith(SITE, "collaborator");
    expect(h.getWebsite).toHaveBeenCalledOnce();
  });

  it("does not expose another website's domains on membership denial", async () => {
    h.verify.mockRejectedValue(new Error("Forbidden"));
    const { req, res } = args("foreign");
    await listDomains(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(h.getWebsite).not.toHaveBeenCalled();
  });

  it("read-only members cannot claim, remove or change primary DNS", async () => {
    const scenarios = [
      [addDomain, { domain: "new-company.org" }, {}],
      [removeDomain, {}, { domain: "existing.example.org" }],
      [setDomainPrimary, {}, { domain: "existing.example.org" }],
      [provisionDomainSsl, {}, { domain: "existing.example.org" }],
    ] as const;
    for (const [controller, body, params] of scenarios) {
      const { req, res } = args("collaborator", params, body);
      await controller(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    }
    expect(h.updateWebsite).not.toHaveBeenCalled();
  });

  it("owner/admin can register a valid domain without changing route semantics", async () => {
    h.verify.mockResolvedValue({ website: { id: SITE, userId: "owner" }, canAdminister: true });
    const { req, res } = args("owner", {}, { domain: "mybrand.org", method: "TXT" });
    await addDomain(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(h.updateWebsite).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: SITE },
      data: { editorData: expect.objectContaining({
        customDomains: expect.arrayContaining([expect.objectContaining({ domain: "mybrand.org" })]),
      }) },
    }));
  });
});
