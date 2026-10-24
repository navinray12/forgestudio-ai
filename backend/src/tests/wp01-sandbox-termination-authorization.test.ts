import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

const h = vi.hoisted(() => ({
  getProject: vi.fn(),
  getProcess: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("../services/project/forgeProject.service.js", () => ({
  getForgeProjectById: h.getProject,
}));
vi.mock("../services/runtime/forgeSandbox.service.js", () => ({
  forgeSandboxService: { getSandboxProcess: h.getProcess, terminateSandboxProcess: h.stop },
}));

import { stopSandboxProcessHandler } from "../controllers/project/sandbox.controller.js";

const invoke = async (projectId: string, processId: unknown) => {
  const req = { params: { id: projectId }, body: { processId } } as unknown as Request;
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { locals: { user: { id: "owner", role: "USER" } }, json, status } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  await stopSandboxProcessHandler(req, res, next);
  return { status, json, next };
};

beforeEach(() => {
  vi.clearAllMocks();
  h.getProject.mockResolvedValue({ id: "project-a" });
  h.stop.mockResolvedValue({ success: true, processId: "process-1" });
});

describe("WP-01 sandbox process termination authorization", () => {
  it("refuses stopping a process owned by a different project", async () => {
    h.getProcess.mockReturnValue({ id: "process-1", projectId: "project-b" });
    const { status, json, next } = await invoke("project-a", "process-1");
    expect(h.getProject).toHaveBeenCalledOnce();
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      error: { code: "PROCESS_NOT_FOUND", message: "Process not found" },
    }));
    expect(h.stop).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("refuses unknown or malformed process IDs", async () => {
    h.getProcess.mockReturnValue(null);
    const { status } = await invoke("project-a", "unknown");
    expect(status).toHaveBeenCalledWith(404);
    expect(h.stop).not.toHaveBeenCalled();
    const malformed = await invoke("project-a", { id: "process-1" });
    expect(malformed.status).toHaveBeenCalledWith(404);
  });

  it("stops a process only within the authenticated project's scope", async () => {
    h.getProcess.mockReturnValue({ id: "process-1", projectId: "project-a" });
    const { json, next } = await invoke("project-a", "process-1");
    expect(h.stop).toHaveBeenCalledExactlyOnceWith("process-1");
    expect(json).toHaveBeenCalledWith({ success: true, processId: "process-1" });
    expect(next).not.toHaveBeenCalled();
  });
});
