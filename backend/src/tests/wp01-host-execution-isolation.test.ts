import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/prisma.js", () => ({ prisma: {} }));
vi.mock("../services/project/forgeFilesystem.service.js", () => ({
  forgeFilesystemService: {},
}));

import {
  executeInSandbox,
  getSandboxWorkspaceDir,
  isVerifiedIsolationAvailable,
  isWithinWorkspace,
  resolveWorkspacePath,
} from "../services/runtime/forgeSandbox.service.js";

const original = {
  NODE_ENV: process.env.NODE_ENV,
  FORGE_CONTAINER_RUNTIME: process.env.FORGE_CONTAINER_RUNTIME,
  FORGE_ALLOW_UNSAFE_HOST_EXECUTION: process.env.FORGE_ALLOW_UNSAFE_HOST_EXECUTION,
};

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("WP-01 host-execution isolation gate", () => {
  it.each(["docker", "gvisor", "firecracker"])(
    "does not treat FORGE_CONTAINER_RUNTIME=%s as proof of a real container",
    async (runtime) => {
      process.env.NODE_ENV = "production";
      process.env.FORGE_CONTAINER_RUNTIME = runtime;
      process.env.FORGE_ALLOW_UNSAFE_HOST_EXECUTION = "true";
      expect(isVerifiedIsolationAvailable()).toBe(false);
      await expect(executeInSandbox({
        projectId: "project-1", command: "echo",
        args: ["unsafe"],
      })).rejects.toMatchObject({ statusCode: 403, code: "ISOLATION_UNAVAILABLE" });
    },
  );

  it.each(["test", "staging", "production"])(
    "blocks host execution in NODE_ENV=%s even with development opt-in",
    async (environment) => {
      process.env.NODE_ENV = environment;
      process.env.FORGE_ALLOW_UNSAFE_HOST_EXECUTION = "true";
      await expect(executeInSandbox({
        projectId: "project-1", command: "echo",
      })).rejects.toMatchObject({ code: "ISOLATION_UNAVAILABLE" });
    },
  );

  it("blocks production execution with no opt-in", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.FORGE_ALLOW_UNSAFE_HOST_EXECUTION;
    await expect(executeInSandbox({ projectId: "project-1", command: "echo" }))
      .rejects.toMatchObject({ code: "ISOLATION_UNAVAILABLE" });
  });

  it.each(["..", "../other", "abc/../secret", "invalid.dot", ""])(
    "rejects invalid project workspace identifier %s",
    (projectId) => {
      expect(() => getSandboxWorkspaceDir(projectId)).toThrow(/Invalid sandbox project identifier/);
    },
  );

  it("rejects sibling-prefix escapes that pass a naive startsWith check", () => {
    const root = "/tmp/forgestudio_sandboxes/tenant_a";
    const escape = "/tmp/forgestudio_sandboxes/tenant_a_other/secrets";
    expect(escape.startsWith(root)).toBe(true);
    expect(isWithinWorkspace(root, escape)).toBe(false);
    expect(() => resolveWorkspacePath(root, "../tenant_a_other/secrets"))
      .toThrow(/escapes the sandbox root/);
    expect(resolveWorkspacePath(root, "src/index.ts"))
      .toBe("/tmp/forgestudio_sandboxes/tenant_a/src/index.ts");
  });

  it("rejects backslashes and Windows drive paths in stored project filenames", () => {
    const root = "/tmp/forgestudio_sandboxes/tenant_a";
    expect(() => resolveWorkspacePath(root, "C:\\\\Windows\\\\system.ini")).toThrow();
    expect(() => resolveWorkspacePath(root, "..\\\\private")).toThrow();
  });

  it("rejects path traversal before attempting any execution", async () => {
    process.env.NODE_ENV = "development";
    process.env.FORGE_ALLOW_UNSAFE_HOST_EXECUTION = "true";
    await expect(executeInSandbox({
      projectId: "project-1", command: "echo", cwd: "../../../etc",
    })).rejects.toMatchObject({ code: "SANDBOX_PATH_ESCAPE" });
  });
});
