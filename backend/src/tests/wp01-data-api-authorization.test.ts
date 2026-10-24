import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

const h = vi.hoisted(() => ({
  verify: vi.fn(),
  modify: vi.fn(),
  realtime: vi.fn(),
  sdk: vi.fn(),
}));

vi.mock("../modules/data-platform/common/project-access.js", () => ({
  resolveExplicitEnvironment: () => "PRODUCTION",
  verifyProjectAccess: h.verify,
  assertCanModify: h.modify,
}));
vi.mock("../modules/data-platform/data-layer/realtime.service.js", () => ({
  enableTableRealtime: h.realtime,
}));
vi.mock("../modules/data-platform/data-layer/sdk-generator.service.js", () => ({
  generateProjectTypeScriptSdk: h.sdk,
}));
vi.mock("../modules/data-platform/data-layer/query-compiler.js", () => ({
  compileSelect: vi.fn(), compileInsert: vi.fn(), compileUpdate: vi.fn(),
  compileDelete: vi.fn(), validateIdentifier: vi.fn(),
}));
vi.mock("../modules/data-platform/data-layer/rls-claim-injector.js", () => ({
  injectRlsClaims: vi.fn(), resolveAuthClaims: vi.fn(),
}));
vi.mock("../modules/data-platform/common/pool-manager.js", () => ({
  TenantPoolManager: {},
}));

import {
  enableRealtimeHandler,
  getSdkTypeScriptHandler,
} from "../modules/data-platform/data-layer/data.controller.js";

beforeEach(() => {
  vi.clearAllMocks();
  h.verify.mockResolvedValue({ website: { id: "site-a", userId: "owner" }, canAdminister: true });
  h.sdk.mockResolvedValue("export type Tables = {};");
});

async function invoke(handler: typeof enableRealtimeHandler, authenticated = true) {
  const req = {
    params: { projectId: "site-a", table: "orders" }, query: { environment: "PRODUCTION" },
    body: {},
  } as unknown as Request;
  const send = vi.fn();
  const json = vi.fn();
  const setHeader = vi.fn();
  const status = vi.fn().mockReturnValue({ json, send, setHeader });
  const res = {
    locals: authenticated ? { user: { id: "owner", role: "USER" } } : {},
    json, send, status, setHeader,
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  await handler(req, res, next);
  return { status, json, send, next };
}

describe("WP-01 privileged data-plane endpoints", () => {
  it("rejects anonymous realtime trigger mutation", async () => {
    const { next } = await invoke(enableRealtimeHandler, false);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401, code: "UNAUTHORIZED" }));
    expect(h.realtime).not.toHaveBeenCalled();
  });

  it("rejects cross-tenant realtime trigger mutation", async () => {
    h.verify.mockRejectedValue(new Error("tenant forbidden"));
    const { next } = await invoke(enableRealtimeHandler);
    expect(next).toHaveBeenCalledOnce();
    expect(h.realtime).not.toHaveBeenCalled();
  });

  it("blocks unauthorized production writes using existing access policy", async () => {
    h.modify.mockImplementation(() => { throw new Error("production writes denied"); });
    const { next } = await invoke(enableRealtimeHandler);
    expect(next).toHaveBeenCalledOnce();
    expect(h.realtime).not.toHaveBeenCalled();
  });

  it("allows an authorized administrator to enable realtime triggers", async () => {
    const { next, status } = await invoke(enableRealtimeHandler);
    expect(next).not.toHaveBeenCalled();
    expect(h.verify).toHaveBeenCalledWith("site-a", "owner");
    expect(h.modify).toHaveBeenCalledWith("PRODUCTION", expect.anything(), "enable realtime triggers");
    expect(h.realtime).toHaveBeenCalledWith("site-a", "orders", "PRODUCTION");
    expect(status).toHaveBeenCalledWith(200);
  });

  it("rejects anonymous SDK schema discovery", async () => {
    const { next } = await invoke(getSdkTypeScriptHandler, false);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(h.sdk).not.toHaveBeenCalled();
  });

  it("rejects foreign-project SDK discovery", async () => {
    h.verify.mockRejectedValue(new Error("not a member"));
    const { next } = await invoke(getSdkTypeScriptHandler);
    expect(next).toHaveBeenCalledOnce();
    expect(h.sdk).not.toHaveBeenCalled();
  });

  it("allows a project member to download the generated SDK", async () => {
    const { next, send, status } = await invoke(getSdkTypeScriptHandler);
    expect(next).not.toHaveBeenCalled();
    expect(h.verify).toHaveBeenCalledWith("site-a", "owner");
    expect(h.sdk).toHaveBeenCalledWith("site-a", "PRODUCTION");
    expect(status).toHaveBeenCalledWith(200);
    expect(send).toHaveBeenCalledWith("export type Tables = {};");
  });
});
