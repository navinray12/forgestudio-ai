/**
 * ForgeStudio Module 41: Directed Acyclic Graph (DAG) Execution Engine
 */

import { DagNode } from "./orchestrator.types.js";

export class DagEngine {
  /**
   * Determine which nodes are currently ready to execute
   */
  public static getReadyNodes(nodes: DagNode[]): DagNode[] {
    const completedNodeIds = new Set(
      nodes.filter((n) => n.status === "COMPLETED").map((n) => n.id)
    );

    return nodes.filter((node) => {
      if (node.status !== "PENDING") return false;

      // All dependencies must be COMPLETED
      const allDepsMet = node.dependencies.every((depId) => completedNodeIds.has(depId));
      return allDepsMet;
    });
  }

  /**
   * Check if any node has failed or blocked execution
   */
  public static hasFailure(nodes: DagNode[]): boolean {
    return nodes.some((n) => n.status === "FAILED");
  }

  /**
   * Check if the entire graph has finished successfully
   */
  public static isComplete(nodes: DagNode[]): boolean {
    return nodes.every((n) => n.status === "COMPLETED" || n.status === "SKIPPED");
  }

  /**
   * Check if execution is deadlocked (nodes pending but none ready)
   */
  public static isDeadlocked(nodes: DagNode[]): boolean {
    const hasPending = nodes.some((n) => n.status === "PENDING" || n.status === "RUNNING");
    if (!hasPending) return false;

    const running = nodes.some((n) => n.status === "RUNNING");
    if (running) return false;

    const ready = this.getReadyNodes(nodes);
    return ready.length === 0;
  }
}
