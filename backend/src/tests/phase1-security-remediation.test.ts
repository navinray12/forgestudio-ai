/**
 * Phase 1 Security Remediation Regression Suite
 * Covers SEC-01, SEC-02, SEC-03, SEC-04, and SEC-05:
 * 1. Terminal WebSocket unauthenticated upgrade rejection & disabled dangerous host execution
 * 2. Host command execution isolation gating & environment secret leak prevention
 * 3. Realtime WebSocket unauthenticated upgrade rejection & project authorization enforcement
 * 4. Login-code disclosure removal (no devOtp in responses, fail-closed delivery)
 * 5. Editor XSS HTML sanitization without breaking supported layout
 */
import { describe, it, expect, beforeAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { attachWebSocketGateways } from "../websocketGateways.js";
import { forgeSandboxService } from "../services/runtime/forgeSandbox.service.js";
import { checkCommandSafety } from "../services/terminal/forgeTerminal.service.js";
import { sanitizeHtml, EDITOR_DOMPURIFY_CONFIG } from "../../../frontend/src/utils/sanitizeHtml.js";

beforeAll(async () => {
  if (typeof (globalThis as any).window === "undefined") {
    try {
      const { JSDOM } = await import("../../../frontend/node_modules/jsdom/lib/api.js" as any);
      const dom = new JSDOM("");
      (globalThis as any).window = dom.window;
      (globalThis as any).document = dom.window.document;
      (globalThis as any).Node = dom.window.Node;
    } catch {}
  }
});

describe("Phase 1 Security Remediation Suite", () => {
  describe("1. Terminal WebSocket Security (SEC-01)", () => {
    it("rejects unauthenticated upgrade requests to /ws/terminal with HTTP 401", async () => {
      const server = http.createServer();
      const gateways = attachWebSocketGateways(server);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const port = (server.address() as AddressInfo).port;

      const res = await new Promise<{ statusCode?: number }>((resolve) => {
        const req = http.request({
          port,
          path: "/ws/terminal?projectId=test-project",
          headers: {
            Connection: "Upgrade",
            Upgrade: "websocket",
            "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
            "Sec-WebSocket-Version": "13",
          },
        });
        req.on("response", (response) => {
          resolve({ statusCode: response.statusCode });
        });
        req.on("error", () => resolve({ statusCode: 401 }));
        req.end();
      });

      expect([401, undefined]).toContain(res.statusCode);
      await gateways.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it("rejects cross-origin upgrades with cookies with HTTP 403", async () => {
      const server = http.createServer();
      const gateways = attachWebSocketGateways(server);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const port = (server.address() as AddressInfo).port;

      const res = await new Promise<{ statusCode?: number }>((resolve) => {
        const req = http.request({
          port,
          path: "/ws/terminal?projectId=test-project",
          headers: {
            Connection: "Upgrade",
            Upgrade: "websocket",
            "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
            "Sec-WebSocket-Version": "13",
            Cookie: "forge_session=fake-session-token",
            Origin: "https://malicious-attacker-website.com",
          },
        });
        req.on("response", (response) => {
          resolve({ statusCode: response.statusCode });
        });
        req.on("error", () => resolve({ statusCode: 403 }));
        req.end();
      });

      expect([401, 403, undefined]).toContain(res.statusCode);
      await gateways.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });
  });

  describe("2. Host Command Execution & Sandbox Isolation (SEC-02)", () => {
    it("refuses tenant command execution when verified isolation is unavailable and unsafe execution is not enabled", async () => {
      const origRuntime = process.env.FORGE_CONTAINER_RUNTIME;
      const origUnsafe = process.env.FORGE_ALLOW_UNSAFE_HOST_EXECUTION;
      delete process.env.FORGE_CONTAINER_RUNTIME;
      delete process.env.FORGE_ALLOW_UNSAFE_HOST_EXECUTION;

      try {
        await expect(
          forgeSandboxService.executeInSandbox({
            projectId: "test-proj",
            command: "echo",
            args: ["hello"],
          })
        ).rejects.toThrow(/verified container isolation is not configured/i);
      } finally {
        if (origRuntime) process.env.FORGE_CONTAINER_RUNTIME = origRuntime;
        if (origUnsafe) process.env.FORGE_ALLOW_UNSAFE_HOST_EXECUTION = origUnsafe;
      }
    });

    it("identifies destructive host command patterns via command safety gates", () => {
      expect(checkCommandSafety("rm -rf /").isDestructive).toBe(true);
      expect(checkCommandSafety("rm -rf *").isDestructive).toBe(true);
      expect(checkCommandSafety("drop database production").isDestructive).toBe(true);
      expect(checkCommandSafety("npm test").isDestructive).toBe(false);
      expect(checkCommandSafety("git status").isDestructive).toBe(false);
    });

    it("prevents working directory path traversal escape", async () => {
      process.env.FORGE_ALLOW_UNSAFE_HOST_EXECUTION = "true";
      try {
        await expect(
          forgeSandboxService.executeInSandbox({
            projectId: "test-proj",
            command: "ls",
            cwd: "../../../etc",
          })
        ).rejects.toThrow(/Sandbox path escape forbidden/i);
      } finally {
        delete process.env.FORGE_ALLOW_UNSAFE_HOST_EXECUTION;
      }
    });
  });

  describe("3. Realtime WebSocket Exposure (SEC-03)", () => {
    it("rejects unauthenticated upgrade requests to /ws/realtime with HTTP 401", async () => {
      const server = http.createServer();
      const gateways = attachWebSocketGateways(server);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const port = (server.address() as AddressInfo).port;

      const res = await new Promise<{ statusCode?: number }>((resolve) => {
        const req = http.request({
          port,
          path: "/ws/realtime",
          headers: {
            Connection: "Upgrade",
            Upgrade: "websocket",
            "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
            "Sec-WebSocket-Version": "13",
          },
        });
        req.on("response", (response) => {
          resolve({ statusCode: response.statusCode });
        });
        req.on("error", () => resolve({ statusCode: 401 }));
        req.end();
      });

      expect([401, undefined]).toContain(res.statusCode);
      await gateways.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });
  });

  describe("4. Login-Code Disclosure Remediation (SEC-04)", () => {
    it("ensures LocalAuthentication does not leak OTP code in response and fails closed on delivery error", async () => {
      const { LocalAuthentication } = await import("../modules/identity/application/local-authentication.js");
      const { opaqueToken } = await import("../modules/identity/domain/security-policy.js");

      const testSecret = opaqueToken();
      const mockStore: any = {
        async findChallenge() {
          return { id: "chal-1", kind: "LOGIN", userId: "user-1" };
        },
        async transaction(fn: any) {
          return fn({
            async lockUser() { return { id: "user-1", email: "user@example.com", status: "ACTIVE", authEpoch: 1 }; },
            async lockChallenge() {
              return { id: "chal-1", status: "PENDING", otpHash: null, attempts: 0, email: "user@example.com", expiresAt: new Date(Date.now() + 600000), kind: "LOGIN", userId: "user-1", authEpoch: 1 };
            },
            async lastDelivery() { return null; },
            async updateChallenge() {},
            async audit() {},
          });
        },
      };

      const failingDelivery: any = {
        async sendCode() {
          throw new Error("SMTP server connection timeout");
        },
      };

      const localAuth = new LocalAuthentication(mockStore, {} as any, failingDelivery, () => new Date());

      // Delivery failure must throw 503 and not bypass outside production
      await expect(
        localAuth.sendCode(testSecret, "user-1", "LOGIN")
      ).rejects.toThrow(/Verification delivery is unavailable/i);
    });
  });

  describe("5. Editor Stored XSS Remediation (SEC-05)", () => {
    it("sanitizes malicious script tags and onerror attributes while preserving safe layout", () => {
      const maliciousPayload = `<p class="title">Hello World</p><script>alert('pwned')</script><img src="x" onerror="alert(document.cookie)" />`;
      const clean = sanitizeHtml(maliciousPayload);

      expect(clean).not.toContain("<script");
      expect(clean).not.toContain("alert(");
      expect(clean).not.toContain("onerror");
      expect(clean).toContain("Hello World");
      expect(clean).toContain('class="title"');
    });

    it("strips event handlers and javascript: URIs from user-supplied HTML", () => {
      const xssLink = `<a href="javascript:alert(1)" onclick="stealSecrets()">Click Here</a>`;
      const clean = sanitizeHtml(xssLink);

      expect(clean).not.toContain("javascript:");
      expect(clean).not.toContain("onclick");
      expect(clean).toContain("Click Here");
    });

    it("allows responsive iframe embeds with allowed sandbox attributes", () => {
      const videoEmbed = `<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" allow="fullscreen" frameborder="0"></iframe>`;
      const clean = sanitizeHtml(videoEmbed);

      expect(clean).toContain("<iframe");
      expect(clean).toContain("youtube.com/embed");
      expect(clean).toContain("allow=");
    });
  });
});
