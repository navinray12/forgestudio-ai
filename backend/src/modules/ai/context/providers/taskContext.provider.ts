/**
 * ForgeStudio Module 37: Task Context Provider
 * Retrieves active task, run steps, and user instructions from Module 42
 */

import crypto from "node:crypto";
import { IContextProvider, ContextRequest, ContextItem } from "../context.types.js";
import { prisma } from "../../../../config/prisma.js";
import { estimateTokenCount } from "../tokenBudget.js";

const db = prisma as any;

export class TaskContextProvider implements IContextProvider {
  public name = "task" as const;

  public async collect(req: ContextRequest): Promise<ContextItem[]> {
    const items: ContextItem[] = [];

    try {
      if (req.taskId) {
        const task = await db.forgeAiTask.findUnique({
          where: { id: req.taskId },
        });

        if (task) {
          const taskContent = `Task: ${task.title}\nStatus: ${task.status}\nPriority: ${task.priority}\nObjective: ${task.objective}`;
          items.push({
            id: `task-${task.id}`,
            source: "task",
            sourceId: task.id,
            title: `Active Task: ${task.title}`,
            content: taskContent,
            relevanceScore: 100,
            estimatedTokens: estimateTokenCount(taskContent),
            freshnessTimestamp: task.updatedAt ? new Date(task.updatedAt).toISOString() : new Date().toISOString(),
            hash: crypto.createHash("sha256").update(taskContent).digest("hex").slice(0, 16),
            isCritical: true, // The primary task objective is always critical
            metadata: { taskId: task.id, status: task.status },
          });
        }
      }
    } catch (err) {
      console.warn("[TaskContextProvider] Error collecting task context:", err);
    }

    return items;
  }
}
