/**
 * ForgeStudio Module 23: AI Tool Execution Contract
 * Typed tool definitions, risk levels, permissions, and validation schemas.
 */

export type ToolRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ToolCategory =
  | "filesystem"
  | "code"
  | "terminal"
  | "build"
  | "git"
  | "database"
  | "preview"
  | "deployment"
  | "browser"
  | "mcp";

export type ToolPermissionScope =
  | "tool.files.read"
  | "tool.files.write"
  | "tool.files.delete"
  | "tool.code.analyze"
  | "tool.terminal.read"
  | "tool.terminal.execute"
  | "tool.build.run"
  | "tool.git.read"
  | "tool.git.write"
  | "tool.git.push"
  | "tool.db.read"
  | "tool.db.write"
  | "tool.preview.control"
  | "tool.deploy.preview"
  | "tool.deploy.production"
  | "tool.browser.execute"
  | "tool.mcp.invoke";

export interface ToolDefinition<TParams = any, TResult = any> {
  id: string;
  name: string;
  description: string;
  version: string;
  category: ToolCategory;
  riskLevel: ToolRiskLevel;
  requiredScope: ToolPermissionScope;
  requiresApproval: boolean;
  timeoutMs: number;
  parametersSchema: Record<string, unknown>; // JSON Schema
  execute: (params: TParams, context: ToolExecutionContext) => Promise<TResult>;
}

export interface ToolExecutionContext {
  projectId: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  approved?: boolean;
}

export interface ToolExecutionRecord {
  id: string;
  projectId: string;
  userId?: string;
  sessionId?: string;
  toolName: string;
  category: ToolCategory;
  riskLevel: ToolRiskLevel;
  status: "REQUESTED" | "APPROVAL_REQUIRED" | "APPROVED" | "EXECUTING" | "COMPLETED" | "FAILED" | "DENIED" | "CANCELLED";
  parameters: any;
  result?: any;
  errorMessage?: string;
  approvedBy?: string;
  executionDurationMs?: number;
  traceId?: string;
  createdAt: Date;
  completedAt?: Date;
}
