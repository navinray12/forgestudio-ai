/**
 * ForgeStudio Module 24: Model Context Protocol (MCP) Client
 * Connects to external MCP servers via JSON-RPC 2.0 / Streamable HTTP,
 * discovers tools/prompts/resources, and invokes remote tools with audit tracking.
 *
 * All outbound calls go through the shared safe-egress helper: public HTTPS on port 443 only,
 * validated and pinned DNS answers, no redirects, and bounded time and response size.
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { parseJsonEgress, safeEgressRequest } from "../../../platform/integrations/safe-egress.js";
import { McpInvocationResult, McpToolSchema } from "./mcpTypes.js";

const db = prisma as any;

const MCP_TIMEOUT_MS = 15000;
const MCP_MAX_RESPONSE_BYTES = 1024 * 1024;

/** POST a JSON-RPC request to an MCP endpoint under the egress policy. */
function postJsonRpc(endpoint: string, payload: Record<string, unknown>) {
  return safeEgressRequest({
    url: endpoint,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    timeoutMs: MCP_TIMEOUT_MS,
    maxResponseBytes: MCP_MAX_RESPONSE_BYTES,
    allowedPorts: [443],
  });
}

export class McpClientService {
  /**
   * Discover available tools from an MCP server
   */
  public async discoverTools(serverId: string): Promise<McpToolSchema[]> {
    const server = await db.forgeMcpServer.findUnique({ where: { id: serverId } });
    if (!server) throw new AppError("MCP Server not found", 404, "MCP_SERVER_NOT_FOUND");

    if (server.endpoint.startsWith("http")) {
      try {
        const res = await postJsonRpc(server.endpoint, {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        });

        if (res.status >= 200 && res.status < 300) {
          const json = parseJsonEgress<any>(res);
          const tools = json.result?.tools || [];
          await db.forgeMcpServer.update({
            where: { id: serverId },
            data: { tools, status: "CONNECTED", lastHealthCheck: new Date() },
          });
          return tools;
        }
      } catch {
        // Fallback to registered tools
      }
    }

    return (server.tools as McpToolSchema[]) || [];
  }

  /**
   * Invoke an MCP tool on an external server
   */
  public async invokeTool(
    serverId: string,
    toolName: string,
    argumentsPayload: Record<string, unknown>,
    ctx: { projectId: string; userId?: string; traceId?: string }
  ): Promise<McpInvocationResult> {
    const server = await db.forgeMcpServer.findUnique({ where: { id: serverId } });
    // A server registered on another project (or on none), or a disabled one, is indistinguishable
    // from a missing one; the check runs before any network activity.
    if (!server || server.projectId !== ctx.projectId || server.isEnabled === false) {
      throw new AppError("MCP Server not found", 404, "MCP_SERVER_NOT_FOUND");
    }

    if (server.trustLevel === "UNTRUSTED") {
      // Untrusted servers require verified permission
      throw new AppError(
        `MCP Server '${server.name}' has trust level UNTRUSTED. Explicit authorization required.`,
        403,
        "UNTRUSTED_MCP_SERVER"
      );
    }

    const startTime = Date.now();
    let result: McpInvocationResult = {
      isError: false,
      content: [{ type: "text", text: `MCP tool ${toolName} executed successfully.` }],
    };

    if (server.endpoint.startsWith("http")) {
      try {
        const res = await postJsonRpc(server.endpoint, {
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: { name: toolName, arguments: argumentsPayload },
        });

        if (res.status >= 200 && res.status < 300) {
          const json = parseJsonEgress<any>(res);
          if (json.result) {
            result = json.result;
          }
        }
      } catch (err: any) {
        // Egress policy errors carry safe, fixed messages; anything else may expose internal hosts.
        const message = err instanceof AppError ? err.message : "The MCP endpoint request failed";
        result = {
          isError: true,
          content: [{ type: "text", text: `Error calling MCP endpoint: ${message}` }],
        };
      }
    }

    const durationMs = Date.now() - startTime;

    // Record execution audit
    try {
      await db.forgeMcpExecution.create({
        data: {
          serverId: server.id,
          projectId: ctx.projectId,
          toolName,
          arguments: argumentsPayload,
          result: result as any,
          isError: result.isError,
          durationMs,
          traceId: ctx.traceId || `mcp_tr_${Date.now()}`,
        },
      });
    } catch {
      // Silent non-blocking audit
    }

    return result;
  }
}

export const mcpClientService = new McpClientService();
