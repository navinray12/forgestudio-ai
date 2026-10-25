/**
 * ForgeStudio Module 24: MCP Server Registry & Scaffolding Service
 * Handles MCP server lifecycle, trust levels, health monitoring,
 * and custom developer MCP server scaffolding.
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { randomUUID } from "node:crypto";
import { resolveSafeDestination, safeEgressRequest } from "../../../platform/integrations/safe-egress.js";
import { withServiceTransaction } from "../../../platform/tenancy/tenant-unit-of-work.js";
import { McpServerRecord, McpTransport, McpTrustLevel } from "./mcpTypes.js";

const db = prisma as any;

export class McpRegistryService {
  /**
   * Register or connect an external MCP server
   */
  public async registerServer(params: {
    name: string;
    endpoint: string;
    transport?: McpTransport;
    trustLevel?: McpTrustLevel;
    projectId?: string;
    userId?: string;
    authConfig?: Record<string, string>;
  }): Promise<McpServerRecord> {
    if (!params.name || !params.endpoint) {
      throw new AppError("Server name and endpoint are required", 400, "INVALID_MCP_CONFIG");
    }
    // Endpoints that would be dialled must satisfy the egress policy up front. Every request is
    // validated again when it is made, so this is a usability check, not the security boundary.
    if (params.endpoint.startsWith("http")) {
      await resolveSafeDestination(params.endpoint, { allowedPorts: [443] });
    }

    const created = await db.forgeMcpServer.create({
      data: {
        name: params.name,
        endpoint: params.endpoint,
        transport: params.transport || "HTTP",
        // New servers always start UNTRUSTED; a client cannot choose its own trust level.
        trustLevel: "UNTRUSTED",
        projectId: params.projectId || null,
        userId: params.userId || null,
        status: "CONNECTED",
        capabilities: ["tools", "resources"],
        tools: [
          {
            name: `${params.name}_query`,
            description: `Query operations for ${params.name}`,
            inputSchema: { type: "object", properties: { query: { type: "string" } } },
          },
        ],
      },
    });

    return created;
  }

  /**
   * List all registered MCP servers for project or tenant
   */
  public async listServers(projectId?: string): Promise<McpServerRecord[]> {
    return await db.forgeMcpServer.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
      },
    });
  }

  /**
   * Update server trust level
   */
  public async updateTrustLevel(serverId: string, trustLevel: McpTrustLevel): Promise<void> {
    await db.forgeMcpServer.update({
      where: { id: serverId },
      data: { trustLevel, updatedAt: new Date() },
    });
  }

  /**
   * Approve a registered server for invocation: UNTRUSTED -> VERIFIED only.
   * The caller must already be an authorized platform administrator with recent re-authentication;
   * this method enforces the server, project, separation-of-duties and egress checks.
   *
   * Runs as one transaction: the server row is locked, the transition is applied only if the row is
   * still UNTRUSTED, and the audit entry is written before COMMIT. Any failure rolls back both.
   */
  public async approveServer(input: { serverId: string; actorId: string }): Promise<{
    id: string; name: string; projectId: string; trustLevel: "VERIFIED";
  }> {
    const notFound = () => new AppError("MCP Server not found", 404, "MCP_SERVER_NOT_FOUND");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.serverId)) throw notFound();

    return withServiceTransaction("platform-control", async (client) => {
      const { rows } = await client.query(
        `SELECT id, name, "projectId", "userId", endpoint, "trustLevel", "isEnabled"
           FROM forge_mcp_servers WHERE id = $1::uuid FOR UPDATE`,
        [input.serverId]
      );
      const server = rows[0];
      if (!server) throw notFound();
      if (server.isEnabled === false) throw new AppError("MCP Server is disabled", 409, "MCP_SERVER_DISABLED");
      if (server.trustLevel === "VERIFIED" || server.trustLevel === "TRUSTED") {
        throw new AppError("MCP Server is already approved", 409, "MCP_SERVER_ALREADY_APPROVED");
      }
      if (server.trustLevel !== "UNTRUSTED") {
        throw new AppError("Only UNTRUSTED servers can be approved", 409, "MCP_TRUST_TRANSITION_INVALID");
      }
      if (!server.projectId) throw new AppError("MCP Server is not attached to a project", 409, "MCP_SERVER_PROJECT_REQUIRED");

      const project = (await client.query(
        `SELECT "ownerId", "deletedAt" FROM forge_projects WHERE id = $1::uuid`,
        [server.projectId]
      )).rows[0];
      if (!project || project.deletedAt) throw new AppError("Project not found", 404, "NOT_FOUND");
      if (server.userId === input.actorId || project.ownerId === input.actorId) {
        throw new AppError("The registering user or project owner cannot approve this server", 403, "SEPARATION_OF_DUTIES");
      }
      if (server.endpoint.startsWith("http")) {
        await resolveSafeDestination(server.endpoint, { allowedPorts: [443] });
      }

      // Conditional transition: exactly one approval can move the row out of UNTRUSTED.
      const updated = await client.query(
        `UPDATE forge_mcp_servers SET "trustLevel" = 'VERIFIED', "updatedAt" = NOW()
          WHERE id = $1::uuid AND "trustLevel" = 'UNTRUSTED'`,
        [server.id]
      );
      if (updated.rowCount !== 1) throw new AppError("MCP Server is already approved", 409, "MCP_SERVER_ALREADY_APPROVED");

      await client.query(
        `INSERT INTO audit_logs (id, "userId", action, "targetResource", details, "createdAt")
         VALUES ($1::uuid, $2::uuid, 'MCP_SERVER_APPROVED', $3, $4::jsonb, NOW())`,
        [randomUUID(), input.actorId, `mcp-server:${server.id}`,
          JSON.stringify({ projectId: server.projectId, endpoint: server.endpoint, from: "UNTRUSTED", to: "VERIFIED" })]
      );

      return { id: server.id, name: server.name, projectId: server.projectId, trustLevel: "VERIFIED" as const };
    });
  }

  /**
   * Health check for registered MCP servers
   */
  public async checkHealth(serverId: string): Promise<{ available: boolean; latencyMs: number }> {
    const server = await db.forgeMcpServer.findUnique({ where: { id: serverId } });
    if (!server) throw new AppError("Server not found", 404, "MCP_SERVER_NOT_FOUND");

    const startTime = Date.now();
    let available = true;
    if (server.endpoint.startsWith("http")) {
      try {
        const res = await safeEgressRequest({
          url: server.endpoint, method: "HEAD", timeoutMs: 3000, maxResponseBytes: 1024, allowedPorts: [443],
        });
        const ok = res.status >= 200 && res.status < 300;
        available = ok || res.status === 405 || res.status === 404; // Server responded
      } catch {
        available = false; // Blocked by egress policy, redirected, timed out or unreachable
      }
    }
    const latencyMs = Date.now() - startTime;

    await db.forgeMcpServer.update({
      where: { id: serverId },
      data: { lastHealthCheck: new Date(), status: available ? "CONNECTED" : "ERROR" },
    });

    return { available, latencyMs };
  }

  /**
   * Generate secure TypeScript scaffolding for developers creating custom MCP servers
   */
  public generateServerScaffolding(serverName: string): {
    packageJson: string;
    serverTs: string;
    readmeMd: string;
  } {
    const packageJson = JSON.stringify(
      {
        name: `@forge-mcp/${serverName.toLowerCase().replace(/\s+/g, "-")}`,
        version: "1.0.0",
        type: "module",
        scripts: { build: "tsc", start: "node dist/server.js" },
        dependencies: {
          "@modelcontextprotocol/sdk": "1.31.0",
          express: "^5.2.1",
          zod: "^4.4.3",
        },
        devDependencies: { typescript: "^5.0.0", "@types/node": "^20.0.0" },
      },
      null,
      2
    );

    const serverTs = `/**
 * Custom Model Context Protocol (MCP) Server for ForgeStudio: ${serverName}
 */
import express from "express";

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const { jsonrpc, id, method, params } = req.body;

  if (method === "initialize") {
    return res.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: "${serverName}", version: "1.0.0" }
      }
    });
  }

  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "example_tool",
            description: "An example tool exposed via ${serverName}",
            inputSchema: { type: "object", properties: { input: { type: "string" } }, required: ["input"] }
          }
        ]
      }
    });
  }

  if (method === "tools/call") {
    return res.json({
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: \`Received \${params?.arguments?.input}\` }],
        isError: false
      }
    });
  }

  res.status(404).json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(\`MCP Server '${serverName}' listening on port \${PORT}\`));
`;

    const readmeMd = `# ${serverName} MCP Server
Custom Model Context Protocol Server for ForgeStudio.

## Quickstart
1. \`npm install\`
2. \`npm start\` (listens on plain HTTP, port 8080 by default, for local development only)
3. Publish the server behind a public HTTPS endpoint on port 443.
4. Register that HTTPS URL inside ForgeStudio MCP settings.

## Connection requirements
ForgeStudio only connects to remote MCP servers that are:
- reachable at a public \`https://\` URL on port 443 (no plain HTTP, custom ports or embedded credentials);
- resolvable only to public addresses (localhost, private, link-local and cloud metadata addresses are refused, including via DNS);
- served without redirects, answering within the request timeout and response-size limits;
- approved: newly registered servers start UNTRUSTED and cannot be invoked until a platform administrator approves them.

A server running on \`localhost\` or a private network cannot be registered directly, and there is no development-mode exception.
`;

    return { packageJson, serverTs, readmeMd };
  }
}

export const mcpRegistryService = new McpRegistryService();
