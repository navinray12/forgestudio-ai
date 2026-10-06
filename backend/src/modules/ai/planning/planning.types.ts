/**
 * ForgeStudio Module 39: AI Planning Agent Types
 */

export type PlanStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "EXECUTING"
  | "COMPLETED"
  | "SUPERSEDED";

export type PlanRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface PlanStepItem {
  id: string;
  order: number;
  title: string;
  description: string;
  agentRole: "PLANNER" | "ARCHITECTURE" | "CODING" | "TESTING" | "REVIEW" | "SYNTHESIS";
  action: "create" | "modify" | "delete" | "test" | "build" | "verify" | "analyze";
  targetFiles: string[];
  dependencies: string[]; // step IDs that must finish first
  estimatedDurationMs?: number;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";
}

export interface PlanEntity {
  id: string;
  projectId: string;
  taskId?: string | null;
  title: string;
  objective: string;
  assumptions: string[];
  constraints: string[];
  currentState: string;
  targetState: string;
  architectureNotes?: string;
  affectedFiles: Array<{ path: string; changeType: "create" | "modify" | "delete" | "inspect" }>;
  dependencies: string[];
  steps: PlanStepItem[];
  testStrategy: {
    unitTests: string[];
    integrationTests: string[];
    manualVerificationSteps: string[];
  };
  rollbackPlan: string;
  riskLevel: PlanRiskLevel;
  status: PlanStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratePlanRequest {
  projectId: string;
  taskId?: string;
  userId?: string;
  objective: string;
  targetFiles?: string[];
  constraints?: string[];
}
