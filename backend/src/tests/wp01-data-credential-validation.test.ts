import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";

const h = vi.hoisted(() => ({
  find: vi.fn(),
  update: vi.fn(),
  session: vi.fn(),
  access: vi.fn(),
}));

vi.mock("../config/prisma.js", () => ({
  prisma: { projectApiKey: { findFirst: h.find, update: h.update } },
}));
vi.mock("../services/session-authentication.js", () => ({
  authenticateSession: h.session,
}));
vi.mock("../modules/data-platform/common/project-access.js", () => ({
  verifyProjectAccess: h.access,
}));

import {
  assertDataScope,
  injectRlsClaims,
  resolveAuthClaims,
} from "../modules/data-platform/data-layer/rls-claim-injector.js";

const req = (headers: Record<string, string>) => ({ headers } as unknown as Request);
const SEC_KEY = "fg_sec_aSecureRandomKey12345";
const ANON_KEY = "fg_anon_aPublicRandomKey12345";
const projectId = "project-uuid";
const record = {
  id: "key-1", keyType: "SERVICE_ROLE", scopes: ["data:read", "data:write"],
  revokedAt: null, expiresAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.find.mockResolvedValue(null);
  h.update.mockResolvedValue({});
  h.session.mockResolvedValue(null);
  h.access.mockResolvedValue({ canAdminister: true });
});

describe("WP-01 public data API credential validation", () => {
  it("does not authorize a plausible-looking forged service API key", async () => {
    await expect(resolveAuthClaims(req({ apikey: SEC_KEY }), projectId))
      .rejects.toMatchObject({ statusCode: 401, code: "INVALID_API_KEY" });
    const filter = h.find.mock.calls[0][0].where;
    expect(filter).toEqual({
      tokenHash: crypto.createHash("sha256").update(SEC_KEY).digest("hex"),
      database: { websiteId: projectId },
    });
  });

  it("fails closed when the API key database is offline", async () => {
    h.find.mockRejectedValue(new Error("database unavailable"));
    await expect(resolveAuthClaims(req({ apikey: SEC_KEY }), projectId))
      .rejects.toMatchObject({ statusCode: 503, code: "API_KEY_VALIDATION_UNAVAILABLE" });
  });

  it("rejects revoked and expired registered keys", async () => {
    h.find.mockResolvedValueOnce({ ...record, revokedAt: new Date() });
    await expect(resolveAuthClaims(req({ apikey: SEC_KEY }), projectId))
      .rejects.toMatchObject({ code: "REVOKED_API_KEY" });
    h.find.mockResolvedValueOnce({ ...record, expiresAt: new Date("2000-01-01") });
    await expect(resolveAuthClaims(req({ apikey: SEC_KEY }), projectId))
      .rejects.toMatchObject({ code: "EXPIRED_API_KEY" });
  });

  it("rejects credentials whose prefix conflicts with their stored privileges", async () => {
    h.find.mockResolvedValueOnce({ ...record, keyType: "ANON" });
    await expect(resolveAuthClaims(req({ apikey: SEC_KEY }), projectId))
      .rejects.toMatchObject({ code: "INVALID_API_KEY" });
    h.find.mockResolvedValueOnce(record);
    await expect(resolveAuthClaims(req({ apikey: ANON_KEY }), projectId))
      .rejects.toMatchObject({ code: "INVALID_API_KEY" });
  });

  it("grants service role only to a verified stored service key", async () => {
    h.find.mockResolvedValue(record);
    const claims = await resolveAuthClaims(req({ apikey: SEC_KEY }), projectId);
    expect(claims).toMatchObject({ isServiceRole: true, role: "service_role", apiKeyId: "key-1" });
    expect(h.update).toHaveBeenCalledWith({
      where: { id: "key-1" }, data: { lastUsedAt: expect.any(Date) },
    });
  });

  it("does not promote a verified anonymous key to a service role", async () => {
    h.find.mockResolvedValue({ ...record, keyType: "ANON" });
    const claims = await resolveAuthClaims(req({ apikey: ANON_KEY }), projectId);
    expect(claims).toMatchObject({ isServiceRole: false, role: "anon" });
  });

  it("rejects unsigned JWT payloads and does not trust embedded role claims", async () => {
    const forged = ["e30", Buffer.from(JSON.stringify({ sub: "intruder", role: "service_role" })).toString("base64url"), "x"].join(".");
    await expect(resolveAuthClaims(req({ authorization: `Bearer ${forged}` }), projectId))
      .rejects.toMatchObject({ statusCode: 401, code: "INVALID_SESSION" });
    expect(h.session).toHaveBeenCalledWith(forged);
  });

  it("never promotes a platform ADMIN session into a database service role", async () => {
    h.session.mockResolvedValue({ user: { id: "owner", role: "ADMIN", email: "owner@example.test" } });
    const claims = await resolveAuthClaims(req({ authorization: "Bearer real-session" }), projectId);
    expect(claims).toMatchObject({
      sub: "owner", role: "authenticated", email: "owner@example.test", isServiceRole: false,
    });
  });

  it("rejects missing credentials rather than handing unverified callers an SQL identity", async () => {
    await expect(resolveAuthClaims(req({}), projectId))
      .rejects.toMatchObject({ statusCode: 401, code: "PROJECT_AUTH_REQUIRED" });
    await expect(resolveAuthClaims(req({ authorization: "Basic abc" }), projectId))
      .rejects.toMatchObject({ code: "INVALID_AUTHORIZATION" });
  });

  it("denies a valid session access to another website's database", async () => {
    h.session.mockResolvedValue({ user: { id: "other-user", role: "USER" } });
    h.access.mockRejectedValue(new Error("Project not found or access denied"));
    await expect(resolveAuthClaims(req({ authorization: "Bearer valid-but-foreign" }), projectId))
      .rejects.toThrow("Project not found or access denied");
    expect(h.access).toHaveBeenCalledWith(projectId, "other-user");
  });

  it("restricts keys to scopes recorded on the server", () => {
    expect(() => assertDataScope({
      apiKeyId: "key-1", scopes: ["data:read"], isServiceRole: false,
    }, "data:write")).toThrow(/does not permit/);
    expect(() => assertDataScope({
      apiKeyId: "key-1", scopes: ["data:read"], isServiceRole: false,
    }, "data:read")).not.toThrow();
    expect(() => assertDataScope({
      apiKeyId: "key-2", scopes: null, isServiceRole: true,
    }, "data:write")).toThrow(/does not permit/);
  });

  it("does not set rls.bypass for an untrusted service_role string", async () => {
    const query = vi.fn().mockResolvedValue({});
    await injectRlsClaims({ query } as never, { role: "service_role", sub: "attacker" });
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][1][1]).toBe("anon");
    expect(query.mock.calls.map((args) => args[0]).join(" ")).not.toContain("rls.bypass");
  });
});
