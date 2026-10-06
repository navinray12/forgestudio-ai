/**
 * ForgeStudio Module 37: AI Context Engine Types
 */

export type ContextSourceType =
  | "file"
  | "symbol"
  | "manifest"
  | "git"
  | "database"
  | "api"
  | "build"
  | "runtime"
  | "terminal"
  | "tool_result"
  | "architecture"
  | "memory"
  | "task"
  | "visual_builder";

export type ContextProfile =
  | "CodingAgentContext"
  | "PlanningAgentContext"
  | "ArchitectureAgentContext"
  | "TestingAgentContext"
  | "ReviewAgentContext"
  | "DatabaseAgentContext"
  | "DeploymentAgentContext"
  | "DEFAULT";

export interface ContextRequest {
  projectId: string;
  workspaceId?: string;
  agentId?: string;
  taskId?: string;
  runId?: string;
  userId?: string;
  objective?: string;
  query?: string;
  files?: string[];
  symbols?: string[];
  route?: string;
  component?: string;
  contextProfile?: ContextProfile;
  tokenBudget?: number;
  priority?: "LOW" | "NORMAL" | "HIGH";
  freshnessRequirementSec?: number;
  allowedSources?: ContextSourceType[];
  excludeSources?: ContextSourceType[];
}

export interface ContextItem {
  id: string;
  source: ContextSourceType;
  sourceId: string;
  title: string;
  content: string;
  relevanceScore: number;
  estimatedTokens: number;
  freshnessTimestamp: string;
  hash: string;
  isCritical?: boolean;
  isRedacted?: boolean;
  metadata?: Record<string, any>;
}

export interface ContextExplainability {
  selectedCount: number;
  droppedCount: number;
  scores: Record<string, number>;
  rationale: string[];
  redactedPatterns: string[];
}

export interface ContextSnapshot {
  id: string;
  projectId: string;
  taskId?: string;
  runId?: string;
  agentId?: string;
  profile: ContextProfile;
  tokenBudget: number;
  tokensUsed: number;
  sources: ContextSourceType[];
  items: ContextItem[];
  redactedCount: number;
  explainability: ContextExplainability;
  createdAt: string;
}

export interface IContextProvider {
  name: ContextSourceType;
  collect(req: ContextRequest): Promise<ContextItem[]>;
}
