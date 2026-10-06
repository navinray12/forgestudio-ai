/**
 * ForgeStudio Module 37: Tool Result Context Provider
 */

import crypto from "node:crypto";
import { IContextProvider, ContextRequest, ContextItem } from "../context.types.js";
import { prisma } from "../../../../config/prisma.js";
import { estimateTokenCount } from "../tokenBudget.js";

const db = prisma as any;

export class ToolResultContextProvider implements IContextProvider {
  public name = "tool_result" as const;

  public async collect(req: ContextRequest): Promise<ContextItem[]> {
    const items: ContextItem[] = [];
    const projectId = req.projectId;

    try {
      const recentExecutions = await db.forgeAiToolExecution.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      for (const exec of recentExecutions) {
        const toolContent = JSON.stringify(
          {
            toolName: exec.toolName,
            status: exec.status,
            parameters: exec.parameters,
            result: exec.result,
            error: exec.errorMessage,
          },
          null,
          2
        );

        items.push({
          id: `tool-${exec.id}`,
          source: "tool_result",
          sourceId: exec.id,
          title: `Tool Execution: ${exec.toolName} (${exec.status})`,
          content: toolContent,
          relevanceScore: exec.status === "FAILED" ? 80 : 60,
          estimatedTokens: estimateTokenCount(toolContent),
          freshnessTimestamp: exec.createdAt ? new Date(exec.createdAt).toISOString() : new Date().toISOString(),
          hash: crypto.createHash("sha256").update(toolContent).digest("hex").slice(0, 16),
          isCritical: false,
          metadata: { toolName: exec.toolName, status: exec.status },
        });
      }
    } catch (err) {
      console.warn("[ToolResultContextProvider] Error collecting tool results:", err);
    }

    return items;
  }
}
