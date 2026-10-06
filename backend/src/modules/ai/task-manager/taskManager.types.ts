/**
 * ForgeStudio Module 42: Agent Task / Run Manager Types
 */

export type TaskStatus =
  | "QUEUED"
  | "PLANNING"
  | "AWAITING_APPROVAL"
  | "READY"
  | "RUNNING"
  | "PAUSED"
  | "CANCELLING"
  | "CANCELLED"
  | "FAILED"
  | "RETRYING"
  | "COMPLETED"
  | "PARTIALLY_COMPLETED"
  | "BLOCKED"
  | "ESCALATED";

export type RunStatus =
  | "QUEUED"
  | "RUNNING"
  | "PAUSED"
  | "CANCELLING"
  | "CANCELLED"
  | "FAILED"
  | "COMPLETED";

export type StepStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED"
  | "BLOCKED"
  | "WAITING"
  | "RETRYING"
  | "CANCELLED";

export type AgentEventType =
  | "AGENT_STARTED"
  | "CONTEXT_ASSEMBLED"
  | "MEMORY_RETRIEVED"
  | "PLAN_GENERATED"
  | "PLAN_APPROVED"
  | "PLAN_REJECTED"
  | "FILE_INSPECTED"
  | "TOOL_EXECUTED"
  | "COMMAND_EXECUTED"
  | "BUILD_STARTED"
  | "BUILD_PASSED"
  | "BUILD_FAILED"
  | "TEST_STARTED"
  | "TEST_PASSED"
  | "TEST_FAILED"
  | "FILE_CHANGED"
  | "CHECKPOINT_CREATED"
  | "APPROVAL_REQUESTED"
  | "AGENT_HANDOFF"
  | "STEP_STARTED"
  | "STEP_COMPLETED"
  | "STEP_FAILED"
  | "RUN_PAUSED"
  | "RUN_RESUMED"
  | "RUN_CANCELLED"
  | "RUN_FAILED"
  | "RUN_COMPLETED";

export interface TaskEntity {
  id: string;
  projectId: string;
  userId?: string | null;
  title: string;
  objective: string;
  status: TaskStatus;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  planId?: string | null;
  activeRunId?: string | null;
  contextSummary?: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface RunEntity {
  id: string;
  taskId: string;
  projectId: string;
  attemptNumber: number;
  status: RunStatus;
  currentStepId?: string | null;
  orchestrationPlan: Record<string, any>;
  checkpointHash?: string | null;
  totalDurationMs: number;
  tokenUsage: Record<string, any>;
  costEstimateUsd: number;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunStepEntity {
  id: string;
  runId: string;
  stepKey: string;
  agentId: string;
  title: string;
  orderIndex: number;
  dependencies: string[];
  status: StepStatus;
  inputPayload: Record<string, any>;
  outputPayload?: Record<string, any>;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  durationMs: number;
  createdAt: string;
}

export interface AgentEventEntity {
  id: string;
  projectId: string;
  taskId?: string | null;
  runId?: string | null;
  stepId?: string | null;
  agentId?: string | null;
  eventType: AgentEventType;
  payload: Record<string, any>;
  correlationId?: string | null;
  createdAt: string;
}

export interface ArtifactEntity {
  id: string;
  projectId: string;
  taskId?: string | null;
  runId?: string | null;
  stepId?: string | null;
  type: string;
  name: string;
  data: Record<string, any>;
  createdAt: string;
}
