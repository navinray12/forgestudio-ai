/**
 * ForgeStudio Module 38: Memory Conflict Detection Service
 * Detects when proposed agent tasks or plans violate active project rules.
 */

import { prisma } from "../../../config/prisma.js";
import { projectMemoryService } from "./projectMemory.service.js";
import { ConflictReport, MemoryConflictEntity } from "./memory.types.js";

const db = prisma as any;

export class MemoryConflictService {
  /**
   * Scan active project memories for potential rule conflicts
   */
  public async detectConflicts(params: {
    projectId: string;
    targetFiles: string[];
    objective: string;
    taskId?: string;
    runId?: string;
  }): Promise<ConflictReport> {
    const { projectId, targetFiles, objective, taskId, runId } = params;

    const activeMemories = await projectMemoryService.listMemories(projectId, {
      status: "ACTIVE",
    });

    const conflicts: MemoryConflictEntity[] = [];
    let hasBlocking = false;
    let hasApprovalRequired = false;

    const lowerObj = objective.toLowerCase();

    for (const mem of activeMemories) {
      // 1. Direct file collision on protected rules
      const protectedRuleTypes = [
        "DO_NOT_BREAK_RULE",
        "PROTECTED_BEHAVIOR",
        "SECURITY_RULE",
        "DATABASE_CONSTRAINT",
        "INTEGRATION_CONSTRAINT",
      ];

      const isProtectedType = protectedRuleTypes.includes(mem.type);
      const fileMatch = mem.relatedFiles?.find((rf) =>
        targetFiles.some((tf) => tf.includes(rf) || rf.includes(tf))
      );

      // 2. Keyword / semantic collision
      const titleKeywords = mem.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const matchesObjective = titleKeywords.some((kw) => lowerObj.includes(kw));

      if (fileMatch || (isProtectedType && matchesObjective)) {
        const severity = mem.severity;
        if (severity === "BLOCKING") hasBlocking = true;
        if (severity === "APPROVAL_REQUIRED") hasApprovalRequired = true;

        const description = fileMatch
          ? `Rule '${mem.title}' protects '${fileMatch}'. Proposed action targets this file.`
          : `Rule '${mem.title}' [${mem.type}] directly conflicts with objective: "${objective}".`;

        const conflictRecord = await db.forgeAiMemoryConflict.create({
          data: {
            projectId,
            memoryId: mem.id,
            taskId: taskId || null,
            runId: runId || null,
            ruleTitle: mem.title,
            severity,
            targetFile: fileMatch || targetFiles[0] || null,
            conflictDescription: description,
            suggestedRemedy: `Review rule '${mem.title}' and obtain user authorization override before proceeding.`,
            resolutionStatus: "PENDING",
          },
        });

        conflicts.push(conflictRecord);
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      blocked: hasBlocking,
      requiresApproval: hasApprovalRequired || hasBlocking,
      conflicts,
    };
  }

  /**
   * Resolve / override a memory conflict
   */
  public async resolveConflict(
    conflictId: string,
    resolutionStatus: "APPROVED_OVERRIDE" | "REJECTED" | "RESOLVED",
    resolvedBy?: string
  ): Promise<MemoryConflictEntity> {
    const updated = await db.forgeAiMemoryConflict.update({
      where: { id: conflictId },
      data: {
        resolutionStatus,
        resolvedBy: resolvedBy || null,
        resolvedAt: new Date(),
      },
    });

    return updated;
  }
}

export const memoryConflictService = new MemoryConflictService();
