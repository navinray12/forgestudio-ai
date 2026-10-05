/**
 * ForgeStudio Module 24: Native Forge MCP Server
 * Exposes ForgeStudio platform capabilities (filesystem, build, preview, Git)
 * via standard JSON-RPC 2.0 Model Context Protocol.
 */

import { forgeFilesystemService } from "../../../services/project/forgeFilesystem.service.js";
import { forgeGitService } from "../../../services/git/forgeGit.service.js";
import { runProjectBuild } from "../../../services/build/forgeBuild.service.js";
import { forgePreviewService } from "../../../services/preview/forgePreview.service.js";

export class ForgeMcpServerService {
  /**
   * Handle incoming MCP JSON-RPC 2.0 request
   */
  public async handleJsonRpc(
    payload: { jsonrpc: string; id: string | number; method: string; params?: any },
    projectId: string
  ): Promise<{ jsonrpc: string; id: string | number; result?: any; error?: any }> {
    const { id, method, params = {} } = payload;

    switch (method) {
      case "initialize": {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: { listChanged: true },
              resources: { subscribe: true },
            },
            serverInfo: {
              name: "ForgeStudio Platform MCP Server",
              version: "2.4.0",
            },
          },
        };
      }

      case "tools/list": {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: [
              {
                name: "forge_read_file",
                description: "Read project source file from ForgeStudio persistent filesystem",
                inputSchema: {
                  type: "object",
                  properties: { filePath: { type: "string" } },
                  required: ["filePath"],
                },
              },
              {
                name: "forge_write_file",
                description: "Write or update source file in ForgeStudio persistent filesystem",
                inputSchema: {
                  type: "object",
                  properties: {
                    filePath: { type: "string" },
                    content: { type: "string" },
                  },
                  required: ["filePath", "content"],
                },
              },
              {
                name: "forge_build",
                description: "Trigger production compilation pipeline and generate build artifacts",
                inputSchema: {
                  type: "object",
                  properties: { environment: { type: "string", default: "preview" } },
                },
              },
              {
                name: "forge_git_status",
                description: "Get repository version-control status",
                inputSchema: { type: "object", properties: {} },
              },
              {
                name: "forge_get_preview_url",
                description: "Get running preview environment URL",
                inputSchema: { type: "object", properties: {} },
              },
            ],
          },
        };
      }

      case "tools/call": {
        const { name, arguments: args = {} } = params;
        try {
          let outputText = "";

          if (name === "forge_read_file") {
            const f = await forgeFilesystemService.readFile(projectId, args.filePath);
            outputText = f.content || "";
          } else if (name === "forge_write_file") {
            const f = await forgeFilesystemService.writeFile(projectId, args.filePath, args.content);
            outputText = `Successfully wrote ${f.sizeBytes} bytes to ${f.path}`;
          } else if (name === "forge_build") {
            const b = await runProjectBuild({ projectId, buildMode: args.environment === "production" ? "production" : "development" });
            outputText = JSON.stringify(b);
          } else if (name === "forge_git_status") {
            const s = await forgeGitService.getStatus(projectId);
            outputText = JSON.stringify(s);
          } else if (name === "forge_get_preview_url") {
            const p = await forgePreviewService.getOrCreatePreview(projectId);
            outputText = p.previewUrl;
          } else {
            return {
              jsonrpc: "2.0",
              id,
              error: { code: -32601, message: `Tool '${name}' not found` },
            };
          }

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: outputText }],
              isError: false,
            },
          };
        } catch (err: any) {
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: `Error: ${err.message}` }],
              isError: true,
            },
          };
        }
      }

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method '${method}' not supported` },
        };
    }
  }
}

export const forgeMcpServerService = new ForgeMcpServerService();
