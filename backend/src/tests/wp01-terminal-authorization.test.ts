import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../utils/app-error.js";

const h = vi.hoisted(() => ({
  executeInSandbox: vi.fn(),
  getProject: vi.fn(),
  sessionFind: vi.fn(),
  sessionUpdate: vi.fn(),
}));

vi.mock("../config/prisma.js", () => ({
  prisma: { forgeTerminalSession: { findUnique: h.sessionFind, update: h.sessionUpdate } },
}));
vi.mock("../services/project/forgeProject.service.js", () => ({
  getForgeProjectById: h.getProject,
}));
vi.mock("../services/runtime/forgeSandbox.service.js", () => ({
  forgeSandboxService: { executeInSandbox: h.executeInSandbox },
}));
vi.mock("../services/project/forgeManifest.service.js", () => ({
  forgeManifestService: {},
}));

import { executeTerminalCommand } from "../services/terminal/forgeTerminal.service.js";

let sessionCounter = 0;
const freshSession = () => `session_${++sessionCounter}`;

const terminal = {
  id: "session_2", projectId: "project_b", name: "Restricted", cwd: "/",
  status: "ACTIVE", history: [], lastActivityAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  h.sessionFind.mockResolvedValue(terminal);
  h.sessionUpdate.mockResolvedValue({});
  h.getProject.mockResolvedValue({ id: "project_b" });
  h.executeInSandbox.mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "", durationMs: 1 });
});
afterEach(() => vi.restoreAllMocks());

describe("WP-01 terminal project authorization", () => {
  it("rejects requests without an authenticated identity before reading a session", async () => {
    await expect(executeTerminalCommand(freshSession(), "ls")).rejects.toMatchObject({
      statusCode: 401, code: "UNAUTHORIZED",
    });
    expect(h.sessionFind).not.toHaveBeenCalled();
    expect(h.executeInSandbox).not.toHaveBeenCalled();
  });

  it("rejects commands against another user's session before executing code", async () => {
    h.getProject.mockRejectedValue(new AppError("Forbidden", 403, "FORBIDDEN"));
    await expect(executeTerminalCommand(freshSession(), "echo secret", { userId: "intruder" }))
      .rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(h.getProject).toHaveBeenCalledWith("project_b", { id: "intruder", role: undefined });
    expect(h.executeInSandbox).not.toHaveBeenCalled();
    expect(h.sessionUpdate).not.toHaveBeenCalled();
  });

  it("does not leak success for an empty command on a foreign project", async () => {
    h.getProject.mockRejectedValue(new AppError("Forbidden", 403, "FORBIDDEN"));
    await expect(executeTerminalCommand(freshSession(), "", { userId: "intruder" }))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects execution on closed sessions", async () => {
    h.sessionFind.mockResolvedValue({ ...terminal, status: "CLOSED" });
    await expect(executeTerminalCommand(freshSession(), "ls", { userId: "owner" }))
      .rejects.toMatchObject({ statusCode: 409, code: "TERMINAL_CLOSED" });
    expect(h.executeInSandbox).not.toHaveBeenCalled();
  });

  it("delegates authorized execution to the existing sandbox with a scoped principal", async () => {
    const result = await executeTerminalCommand(freshSession(), "npm test", {
      userId: "owner", userRole: "USER",
    });
    expect(result.exitCode).toBe(0);
    expect(h.getProject).toHaveBeenCalledWith("project_b", { id: "owner", role: "USER" });
    expect(h.executeInSandbox).toHaveBeenCalledWith(expect.objectContaining({
      projectId: "project_b", command: "npm test", userId: "owner",
    }));
  });

  it("requires a string command before touching the sandbox", async () => {
    await expect(executeTerminalCommand(freshSession(), null as unknown as string, { userId: "owner" }))
      .rejects.toMatchObject({ statusCode: 400, code: "INVALID_COMMAND" });
    expect(h.executeInSandbox).not.toHaveBeenCalled();
  });
});
