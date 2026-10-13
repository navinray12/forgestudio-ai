/**
 * ForgeStudio Execution Blueprint v2.1 — Point 15: Workflows, Communication, Experiments and Contextual Chat
 * Section 1.2: Versioned Workflow Automation Engine
 *
 * Rules:
 * 1. Published workflow definitions are immutable. Editing creates a draft version.
 * 2. Graph validation ensures no unreachable nodes, cycles, missing exits, or invalid references.
 * 3. Bounded execution: step count, concurrency, runtime, message count, provider spend.
 * 4. Simulation engine uses synthetic recipients and a virtual clock; never mutates real leads or sends live messages.
 * 5. Fenced worker leases prevent obsolete workers from executing stale jobs.
 */

import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";

export type WorkflowStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DEPRECATED";
export type WorkflowNodeType = "TRIGGER" | "CONDITION" | "DELAY" | "BRANCH" | "ACTION" | "EXIT";
export type WorkflowActionChannel = "EMAIL" | "SMS" | "WHATSAPP" | "TELEGRAM" | "INTERNAL_TASK" | "WEBHOOK";

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  config: {
    channel?: WorkflowActionChannel;
    templateId?: string;
    delaySeconds?: number;
    conditionExpression?: string;
    branchRules?: Array<{ condition: string; targetNodeId: string }>;
    maxRetries?: number;
    timeoutSeconds?: number;
    budgetLimitUsd?: number;
    [key: string]: any;
  };
}

export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  conditionLabel?: string;
}

export interface WorkflowDefinition {
  workflowId: string;
  tenantId: string;
  version: number;
  status: WorkflowStatus;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  maxExecutionSteps: number;
  maxExecutionTimeSeconds: number;
  maxSpendLimitUsd: number;
  createdAt: string;
  publishedAt?: string;
  publishedBy?: string;
}

export interface WorkflowValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  nodeCount: number;
  edgeCount: number;
  hasCycles: boolean;
  unreachableNodes: string[];
  missingExitNodes: string[];
}

export interface WorkflowExecutionLease {
  leaseId: string;
  workflowId: string;
  workflowVersion: number;
  executionId: string;
  workerId: string;
  fencingToken: number;
  leaseExpiresAt: string;
}

export interface WorkflowSimulationStep {
  stepIndex: number;
  nodeId: string;
  nodeType: WorkflowNodeType;
  nodeName: string;
  simulatedVirtualTime: string;
  evaluationResult: any;
  actionSuppressedReason?: string;
  simulatedSpendUsd: number;
}

export interface WorkflowSimulationResult {
  simulationId: string;
  workflowId: string;
  workflowVersion: number;
  isSimulation: true;
  totalSteps: number;
  virtualDurationSeconds: number;
  totalSimulatedSpendUsd: number;
  steps: WorkflowSimulationStep[];
  syntheticRecipient: {
    id: string;
    email: string;
    phone: string;
  };
}

export class VersionedWorkflowEngine {
  private static definitions = new Map<string, WorkflowDefinition[]>(); // workflowId -> versions
  private static activeLeases = new Map<string, WorkflowExecutionLease>();

  /**
   * Creates or registers a workflow draft.
   */
  public static createWorkflowDraft(
    tenantId: string,
    workflowId: string,
    name: string,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    limits: { maxSteps?: number; maxTimeSeconds?: number; maxSpendUsd?: number } = {}
  ): WorkflowDefinition {
    const existingVersions = this.definitions.get(workflowId) || [];
    const nextVersion = existingVersions.length > 0
      ? Math.max(...existingVersions.map((v) => v.version)) + 1
      : 1;

    const draft: WorkflowDefinition = {
      workflowId,
      tenantId,
      version: nextVersion,
      status: "DRAFT",
      name,
      nodes,
      edges,
      maxExecutionSteps: limits.maxSteps ?? 50,
      maxExecutionTimeSeconds: limits.maxTimeSeconds ?? 86400,
      maxSpendLimitUsd: limits.maxSpendUsd ?? 10.0,
      createdAt: new Date().toISOString(),
    };

    const report = this.validateWorkflowGraph(draft);
    if (!report.valid) {
      throw new AppError(`Workflow validation failed: ${report.errors.join("; ")}`, 400, "INVALID_WORKFLOW_GRAPH");
    }

    existingVersions.push(draft);
    this.definitions.set(workflowId, existingVersions);
    return draft;
  }

  /**
   * Publishes a workflow version. Immutable once published.
   */
  /** Tenant that owns a workflow, or null when it does not exist. */
  public static getWorkflowTenant(workflowId: string): string | null {
    return this.definitions.get(workflowId)?.[0]?.tenantId ?? null;
  }

  public static publishWorkflowVersion(workflowId: string, version: number, publishedBy: string): WorkflowDefinition {
    const versions = this.definitions.get(workflowId);
    if (!versions) {
      throw new AppError(`Workflow ${workflowId} not found`, 404, "WORKFLOW_NOT_FOUND");
    }

    const target = versions.find((v) => v.version === version);
    if (!target) {
      throw new AppError(`Workflow version ${version} not found`, 404, "VERSION_NOT_FOUND");
    }

    if (target.status === "PUBLISHED") {
      return target; // idempotent
    }

    const report = this.validateWorkflowGraph(target);
    if (!report.valid) {
      throw new AppError(`Cannot publish invalid workflow: ${report.errors.join("; ")}`, 400, "CANNOT_PUBLISH_INVALID");
    }

    // Deprecate previous published versions
    versions.forEach((v) => {
      if (v.version !== version && v.status === "PUBLISHED") {
        v.status = "DEPRECATED";
      }
    });

    target.status = "PUBLISHED";
    target.publishedAt = new Date().toISOString();
    target.publishedBy = publishedBy;

    return target;
  }

  /**
   * Validates workflow graph structure for cycles, unreachable nodes, and missing exits.
   */
  public static validateWorkflowGraph(def: WorkflowDefinition): WorkflowValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];
    const nodeMap = new Map<string, WorkflowNode>();
    def.nodes.forEach((n) => nodeMap.set(n.id, n));

    const triggerNodes = def.nodes.filter((n) => n.type === "TRIGGER");
    const exitNodes = def.nodes.filter((n) => n.type === "EXIT");

    if (triggerNodes.length === 0) {
      errors.push("Workflow must contain at least one TRIGGER node");
    }
    if (triggerNodes.length > 1) {
      warnings.push("Multiple trigger nodes detected");
    }
    if (exitNodes.length === 0) {
      errors.push("Workflow must contain at least one EXIT node");
    }

    // Validate edges reference valid nodes
    const adjacency = new Map<string, string[]>();
    def.nodes.forEach((n) => adjacency.set(n.id, []));

    def.edges.forEach((edge) => {
      if (!nodeMap.has(edge.sourceNodeId)) {
        errors.push(`Edge ${edge.id} references invalid sourceNodeId ${edge.sourceNodeId}`);
      }
      if (!nodeMap.has(edge.targetNodeId)) {
        errors.push(`Edge ${edge.id} references invalid targetNodeId ${edge.targetNodeId}`);
      }
      if (nodeMap.has(edge.sourceNodeId) && nodeMap.has(edge.targetNodeId)) {
        adjacency.get(edge.sourceNodeId)!.push(edge.targetNodeId);
      }
    });

    // Detect unreachable nodes from triggers
    const visited = new Set<string>();
    const queue = triggerNodes.map((t) => t.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (!visited.has(current)) {
        visited.add(current);
        const neighbors = adjacency.get(current) || [];
        neighbors.forEach((nbr) => {
          if (!visited.has(nbr)) queue.push(nbr);
        });
      }
    }

    const unreachableNodes = def.nodes.filter((n) => !visited.has(n.id)).map((n) => n.id);
    if (unreachableNodes.length > 0) {
      errors.push(`Unreachable nodes detected: ${unreachableNodes.join(", ")}`);
    }

    // Cycle detection via DFS
    const hasCycles = this.detectCycles(def.nodes, adjacency);
    if (hasCycles) {
      errors.push("Cycles detected in workflow graph; loops must be bounded or decomposed");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      nodeCount: def.nodes.length,
      edgeCount: def.edges.length,
      hasCycles,
      unreachableNodes,
      missingExitNodes: exitNodes.length === 0 ? ["MISSING_EXIT"] : [],
    };
  }

  private static detectCycles(nodes: WorkflowNode[], adjacency: Map<string, string[]>): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = adjacency.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true;
      }
    }
    return false;
  }

  /**
   * Acquire a worker lease with monotonic fencing token.
   */
  public static acquireWorkerLease(workflowId: string, version: number, executionId: string, workerId: string): WorkflowExecutionLease {
    const existing = this.activeLeases.get(executionId);
    const fencingToken = existing ? existing.fencingToken + 1 : 1;

    const lease: WorkflowExecutionLease = {
      leaseId: `lease_${crypto.randomUUID()}`,
      workflowId,
      workflowVersion: version,
      executionId,
      workerId,
      fencingToken,
      leaseExpiresAt: new Date(Date.now() + 60000).toISOString(), // 60s lease
    };

    this.activeLeases.set(executionId, lease);
    return lease;
  }

  /**
   * Validates that the executing worker has a valid, unfenced lease.
   */
  public static validateWorkerLease(executionId: string, workerId: string, expectedFencingToken: number): boolean {
    const lease = this.activeLeases.get(executionId);
    if (!lease) return false;
    if (lease.workerId !== workerId) return false;
    if (lease.fencingToken !== expectedFencingToken) return false;
    if (new Date(lease.leaseExpiresAt).getTime() < Date.now()) return false;
    return true;
  }

  /**
   * Runs a complete simulation using synthetic recipients and a virtual clock.
   * Guaranteed never to emit real external messages or charge live budgets.
   */
  public static runSimulation(
    workflowId: string,
    version: number,
    initialContext: Record<string, any> = {}
  ): WorkflowSimulationResult {
    const versions = this.definitions.get(workflowId);
    const def = versions?.find((v) => v.version === version);
    if (!def) {
      throw new AppError(`Workflow ${workflowId} version ${version} not found for simulation`, 404, "WORKFLOW_NOT_FOUND");
    }

    const simulationId = `sim_${crypto.randomUUID()}`;
    const syntheticRecipient = {
      id: "synthetic_lead_001",
      email: "synthetic-lead@forgestudio.simulation.local",
      phone: "+15550009999",
    };

    let virtualClock = Date.now();
    let currentStep = 0;
    let totalSpend = 0.0;
    const steps: WorkflowSimulationStep[] = [];

    // Traverse starting at trigger
    let currentNode = def.nodes.find((n) => n.type === "TRIGGER");
    const nodeMap = new Map(def.nodes.map((n) => [n.id, n]));
    const adjacency = new Map<string, string[]>();
    def.nodes.forEach((n) => adjacency.set(n.id, []));
    def.edges.forEach((e) => adjacency.get(e.sourceNodeId)?.push(e.targetNodeId));

    while (currentNode && currentStep < def.maxExecutionSteps) {
      currentStep++;
      let simulatedStepSpend = 0.0;

      if (currentNode.type === "DELAY") {
        const delaySec = currentNode.config.delaySeconds ?? 60;
        virtualClock += delaySec * 1000;
      } else if (currentNode.type === "ACTION") {
        simulatedStepSpend = currentNode.config.budgetLimitUsd ?? 0.01;
        totalSpend += simulatedStepSpend;
      }

      steps.push({
        stepIndex: currentStep,
        nodeId: currentNode.id,
        nodeType: currentNode.type,
        nodeName: currentNode.name,
        simulatedVirtualTime: new Date(virtualClock).toISOString(),
        evaluationResult: { simulatedPass: true, contextSnapshot: { ...initialContext } },
        simulatedSpendUsd: simulatedStepSpend,
      });

      if (currentNode.type === "EXIT") {
        break;
      }

      const nextNodeIds = adjacency.get(currentNode.id) || [];
      if (nextNodeIds.length === 0) break;
      currentNode = nodeMap.get(nextNodeIds[0]);
    }

    return {
      simulationId,
      workflowId,
      workflowVersion: version,
      isSimulation: true,
      totalSteps: steps.length,
      virtualDurationSeconds: Math.floor((virtualClock - Date.now()) / 1000),
      totalSimulatedSpendUsd: Number(totalSpend.toFixed(4)),
      steps,
      syntheticRecipient,
    };
  }
}
