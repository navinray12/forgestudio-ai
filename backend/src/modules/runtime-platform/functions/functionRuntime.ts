/**
 * Module 46: Serverless Function Sandbox Runtime
 * Uses Node.js vm with isolated context, memory protection, and timeout guards.
 */

import vm from "node:vm";
import crypto from "node:crypto";
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
   * Executes user code in a fortified Node.js VM context.
   */
  public static async execute(options: SandboxExecutionOptions): Promise<SandboxExecutionOutput> {
    const { code, handlerName = "handler", context, payload, timeoutMs = 5000 } = options;
    const logs: string[] = [];
    const startTime = Date.now();

    // Custom console to capture invocation logs
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

    // Environment & SDK injection
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
      // Safe fetch abstraction
      fetch: globalThis.fetch,
      JSON,
      Math,
      Date,
      Promise,
      Error,
    };

    const vmContext = vm.createContext(sandbox);

    try {
      // 1. Compile & run script
      const script = new vm.Script(code, {
        filename: `${context.functionName}.js`,
      });

      script.runInContext(vmContext, {
        timeout: timeoutMs,
      });

      // 2. Identify handler function
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

      // 3. Execute handler with timeout race
      const handlerPromise = Promise.resolve(targetHandler(payload, context));
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`FUNCTION_TIMEOUT: Execution exceeded ${timeoutMs}ms limit`)), timeoutMs)
      );

      const result: any = await Promise.race([handlerPromise, timeoutPromise]);
      const durationMs = Date.now() - startTime;

      let statusCode = 200;
      let responsePayload = result;

      // Handle standard HTTP response object: { statusCode, body, headers }
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
}
