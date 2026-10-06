/**
 * ForgeStudio Module 24: Model Context Protocol (MCP) Types
 * Standard contracts for MCP client, server, tool inspection, and trust tiers.
 */

export type McpTransport = "HTTP" | "SSE" | "STDIO";
export type McpTrustLevel = "UNTRUSTED" | "VERIFIED" | "TRUSTED";

export interface McpToolSchema {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>; // JSON Schema
}

export interface McpServerRecord {
  id: string;
  name: string;
  type: string;
  transport: McpTransport;
  endpoint: string;
  trustLevel: McpTrustLevel;
  capabilities: string[];
  tools: McpToolSchema[];
  isEnabled: boolean;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  lastHealthCheck?: Date;
}

export interface McpInvocationResult {
  isError: boolean;
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
}
