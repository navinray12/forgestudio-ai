/**
 * ForgeStudio Module 37: Memory Context Provider
 * Retrieves durable project engineering memories from Module 38
 */

import crypto from "node:crypto";
import { IContextProvider, ContextRequest, ContextItem } from "../context.types.js";
import { prisma } from "../../../../config/prisma.js";
import { estimateTokenCount } from "../tokenBudget.js";

const db = prisma as any;

export class MemoryContextProvider implements IContextProvider {
  public name = "memory" as const;

  public async collect(req: ContextRequest): Promise<ContextItem[]> {
    const items: ContextItem[] = [];
    const projectId = req.projectId;

    try {
      const memories = await db.forgeAiProjectMemory.findMany({
        where: { projectId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      for (const m of memories) {
        const isCritical =
          m.severity === "BLOCKING" ||
          m.type === "DO_NOT_BREAK_RULE" ||
          m.type === "PROTECTED_BEHAVIOR" ||
          m.type === "SECURITY_RULE";

        const memoryText = `[Type: ${m.type} | Severity: ${m.severity}]\nTitle: ${m.title}\n${m.content}`;

        items.push({
          id: `memory-${m.id}`,
          source: "memory",
          sourceId: m.id,
          title: `Project Memory: ${m.title}`,
          content: memoryText,
          relevanceScore: isCritical ? 100 : 85,
          estimatedTokens: estimateTokenCount(memoryText),
          freshnessTimestamp: m.updatedAt ? new Date(m.updatedAt).toISOString() : new Date().toISOString(),
          hash: crypto.createHash("sha256").update(memoryText).digest("hex").slice(0, 16),
          isCritical,
          metadata: { type: m.type, severity: m.severity, version: m.version },
        });
      }
    } catch (err) {
      console.warn("[MemoryContextProvider] Error collecting memories:", err);
    }

    return items;
  }
}
