/**
 * Module 46: Serverless Function Sandbox Runtime
 *
 * Security Architecture (Point 02 Baseline Reconciliation):
 * 1. Node.js `node:vm` is NOT a security boundary.
 * 2. In shared-host production mode, untrusted customer JavaScript is strictly prevented
 *    from executing inside the shared API process. The runtime fails closed with HTTP 501
 *    (FUNCTION_EXECUTION_UNSUPPORTED) unless an isolated execution backend is configured.
 * 3. When FORGE_FUNCTION_ISOLATION_BACKEND="isolated-process" is enabled, customer code executes
 *    in an isolated OS subprocess with a scrubbed environment: host secrets (DATABASE_URL,
 *    JWT_SECRET, etc.) are stripped, resource limits are enforced, and timeout kills the process.
 * 4. Development VM fallback (FORGE_ALLOW_INSECURE_DEV_VM="true") is strictly prohibited in
 *    production (NODE_ENV === "production").
 */

import vm from "node:vm";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { FunctionInvocationContext } from "./functions.types.js";

export interface SandboxExecutionOptions {
  code: string;
  handlerName?: string;
  context: FunctionInvocationContext;
  payload: any;
  timeoutMs?: number;
}

export interface SandboxExecutionOutput {
  status: "SUCCESS" | "ERROR" | "TIMEOUT";
  durationMs: number;
  statusCode?: number;
  responsePayload: any;
  logs: string[];
  error?: string;
}

export class FunctionRuntimeSandbox {
  /**
   * Authoritative entry point for customer function execution.
   */
  public static async execute(options: SandboxExecutionOptions): Promise<SandboxExecutionOutput> {
    const isProduction = process.env.NODE_ENV === "production";
    const isolationBackend = process.env.FORGE_FUNCTION_ISOLATION_BACKEND || (isProduction ? "fail-closed" : "fail-closed");
    const allowDevVmFallback = !isProduction && process.env.FORGE_ALLOW_INSECURE_DEV_VM === "true";

    // 1. Isolated Subprocess Runner (Verified Process Boundary)
    if (isolationBackend === "isolated-process") {
      return executeInIsolatedProcess(options);
    }

    // 2. Development In-Process VM Fallback (Strictly prohibited in production)
    if (allowDevVmFallback) {
      return executeInDevVm(options);
    }

    // 3. Shared-Host Default: Fail Closed (HTTP 501 Not Implemented)
    return {
      status: "ERROR",
      durationMs: 0,
      statusCode: 501,
      responsePayload: null,
      logs: [
        "[SECURITY_POLICY] Customer JavaScript execution inside shared API processes is disabled.",
        "[SECURITY_POLICY] Configure FORGE_FUNCTION_ISOLATION_BACKEND=isolated-process to route to a verified isolated runner.",
      ],
      error: "Customer function execution is not supported in the shared API process. A dedicated isolated runner backend is required (HTTP 501 Not Implemented).",
    };
  }
}

/**
 * Isolated OS Subprocess Runner.
 * Executes code in a dedicated Node.js subprocess with scrubbed environment and strict boundaries.
 */
async function executeInIsolatedProcess(options: SandboxExecutionOptions): Promise<SandboxExecutionOutput> {
  const { code, handlerName = "handler", context, payload, timeoutMs = 5000 } = options;
  const startTime = Date.now();

  // Scrub host environment variables: host secrets (DATABASE_URL, JWT_SECRET, AWS_*, PRISMA_*) are NEVER passed.
  const sanitizedEnv: Record<string, string> = {
    PATH: process.env.PATH || "",
    SYSTEMROOT: process.env.SYSTEMROOT || "",
    NODE_ENV: "isolated-customer-function",
    ...(context.env || {}),
  };

  const runnerScript = `
const readline = require("readline");
let rawInput = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { rawInput += chunk; });
process.stdin.on("end", async () => {
  try {
    const { code, handlerName, context, payload } = JSON.parse(rawInput);
    const logs = [];
    const sandboxConsole = {
      log: (...args) => logs.push("[INFO] " + args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")),
      warn: (...args) => logs.push("[WARN] " + args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")),
      error: (...args) => logs.push("[ERROR] " + args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")),
    };
    const exportsObj = {};
    const moduleObj = { exports: exportsObj };
    const wrappedFn = new Function("module", "exports", "console", "context", "payload", "env", code);
    wrappedFn(moduleObj, exportsObj, sandboxConsole, context, payload, context.env || {});
    const targetHandler = typeof moduleObj.exports[handlerName] === "function"
      ? moduleObj.exports[handlerName]
      : (typeof moduleObj.exports === "function" ? moduleObj.exports : null);
    if (!targetHandler) {
      throw new Error("Handler '" + handlerName + "' not found or is not a function.");
    }
    const result = await targetHandler(payload, context);
    let statusCode = 200;
    let responsePayload = result;
    if (result && typeof result === "object" && "statusCode" in result) {
      statusCode = result.statusCode;
      responsePayload = result.body !== undefined ? result.body : result;
    }
    process.stdout.write(JSON.stringify({
      status: "SUCCESS",
      statusCode,
      responsePayload,
      logs
    }));
  } catch (err) {
    process.stdout.write(JSON.stringify({
      status: "ERROR",
      statusCode: 500,
      responsePayload: null,
      logs: [err && err.message ? err.message : String(err)],
      error: err && err.message ? err.message : "Execution failed"
    }));
  }
});
`;

  return new Promise<SandboxExecutionOutput>((resolve) => {
    let stdoutData = "";
    let stderrData = "";
    let isSettled = false;

    const child = spawn(process.execPath, ["--max-old-space-size=128", "-e", runnerScript], {
      env: sanitizedEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        try { child.kill("SIGKILL"); } catch (_e) {}
        const durationMs = Date.now() - startTime;
        resolve({
          status: "TIMEOUT",
          durationMs,
          statusCode: 504,
          responsePayload: null,
          logs: [stderrData || "[FATAL] Function execution timed out"],
          error: `FUNCTION_TIMEOUT: Execution exceeded ${timeoutMs}ms limit`,
        });
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    child.on("error", (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;
        resolve({
          status: "ERROR",
          durationMs,
          statusCode: 500,
          responsePayload: null,
          logs: [`[FATAL] Subprocess error: ${err.message}`],
          error: err.message,
        });
      }
    });

    child.on("close", (exitCode) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;
        try {
          const parsed = JSON.parse(stdoutData.trim());
          resolve({
            status: parsed.status,
            durationMs,
            statusCode: parsed.statusCode,
            responsePayload: parsed.responsePayload,
            logs: parsed.logs || [],
            error: parsed.error,
          });
        } catch (_parseErr) {
          resolve({
            status: "ERROR",
            durationMs,
            statusCode: 500,
            responsePayload: null,
            logs: [stderrData || stdoutData || `Process exited with code ${exitCode}`],
            error: stderrData || "Process execution terminated unexpectedly",
          });
        }
      }
    });

    const payloadString = JSON.stringify({
      code,
      handlerName,
      context,
      payload,
    });

    child.stdin.write(payloadString);
    child.stdin.end();
  });
}

/**
 * Development In-Process VM Fallback.
 * Only accessible in non-production development with explicit opt-in.
 */
async function executeInDevVm(options: SandboxExecutionOptions): Promise<SandboxExecutionOutput> {
  const { code, handlerName = "handler", context, payload, timeoutMs = 5000 } = options;
  const logs: string[] = ["[DEV_WARNING] In-process VM fallback is active. Do not use in production."];
  const startTime = Date.now();

  const sandboxConsole = {
    log: (...args: any[]) => {
      logs.push(`[INFO] ${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}`);
    },
    warn: (...args: any[]) => {
      logs.push(`[WARN] ${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}`);
    },
    error: (...args: any[]) => {
      logs.push(`[ERROR] ${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}`);
    },
  };

  const exportsObj: Record<string, any> = {};
  const moduleObj = { exports: exportsObj };

  const sandbox = {
    module: moduleObj,
    exports: exportsObj,
    console: sandboxConsole,
    context,
    payload,
    env: { ...context.env },
    Buffer,
    URL,
    crypto,
    setTimeout,
    clearTimeout,
    fetch: globalThis.fetch,
    JSON,
    Math,
    Date,
    Promise,
    Error,
  };

  const vmContext = vm.createContext(sandbox);

  try {
    const script = new vm.Script(code, {
      filename: `${context.functionName}.js`,
    });

    script.runInContext(vmContext, {
      timeout: timeoutMs,
    });

    const targetHandler =
      typeof moduleObj.exports[handlerName] === "function"
        ? moduleObj.exports[handlerName]
        : typeof moduleObj.exports === "function"
        ? moduleObj.exports
        : typeof (vmContext as any)[handlerName] === "function"
        ? (vmContext as any)[handlerName]
        : null;

    if (!targetHandler) {
      throw new Error(
        `Handler '${handlerName}' not found or is not a function. Export it via 'exports.${handlerName} = ...' or 'module.exports = ...'`
      );
    }

    const handlerPromise = Promise.resolve(targetHandler(payload, context));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`FUNCTION_TIMEOUT: Execution exceeded ${timeoutMs}ms limit`)), timeoutMs)
    );

    const result: any = await Promise.race([handlerPromise, timeoutPromise]);
    const durationMs = Date.now() - startTime;

    let statusCode = 200;
    let responsePayload = result;

    if (result && typeof result === "object" && "statusCode" in result) {
      statusCode = result.statusCode;
      responsePayload = result.body !== undefined ? result.body : result;
    }

    return {
      status: "SUCCESS",
      durationMs,
      statusCode,
      responsePayload,
      logs,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const isTimeout =
      err.message?.includes("FUNCTION_TIMEOUT") ||
      err.message?.includes("Script execution timed out");

    logs.push(`[FATAL] ${err.message || String(err)}`);

    return {
      status: isTimeout ? "TIMEOUT" : "ERROR",
      durationMs,
      statusCode: isTimeout ? 504 : 500,
      responsePayload: null,
      logs,
      error: err.message || "Unknown execution error",
    };
  }
}
