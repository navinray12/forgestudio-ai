/**
 * ForgeStudio Module 41: Multi-Agent Orchestrator Types
 */

import { ContextSnapshot } from "../context/context.types.js";

export type AgentRole =
  | "PLANNER"
  | "ARCHITECTURE"
  | "CODING"
  | "TESTING"
  | "REVIEW"
  | "SYNTHESIS";

export interface AgentDescriptor {
  id: string;
  name: string;
  version: string;
  role: AgentRole;
  capabilities: string[];
  requiredContextProfile: string;
  allowedTools: string[];
  timeoutMs: number;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
}

export interface AgentInputPayload {
  taskId: string;
  runId: string;
  stepId: string;
  projectId: string;
  objective: string;
  targetFiles?: string[];
  context: ContextSnapshot;
  previousResults?: Record<string, any>;
  artifacts?: Array<{ type: string; name: string; data: any }>;
}

export interface AgentOutputPayload {
  status: "COMPLETED" | "FAILED" | "ESCALATED";
  summary: string;
  decisions: string[];
  filesChanged: string[];
  artifacts: Array<{ type: string; name: string; data: any }>;
  diagnostics?: string[];
  recommendations?: string[];
  errorMessage?: string;
}

export interface DagNode {
  id: string;
  agentRole: AgentRole;
  title: string;
  description?: string;
  dependencies: string[];
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";
  input?: AgentInputPayload;
  output?: AgentOutputPayload;
}

export interface AgentHandoffEntity {
  id: string;
  runId: string;
  fromAgent: string;
  toAgent: string;
  objective: string;
  contextSummary: Record<string, any>;
  previousResult: Record<string, any>;
  artifactsPassed: any[];
  status: string;
  createdAt: string;
}
