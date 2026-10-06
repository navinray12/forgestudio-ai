/**
 * ForgeStudio Module 37: Architecture Context Provider
 * Retrieves architecture findings and metrics from Module 40
 */

import crypto from "node:crypto";
import { IContextProvider, ContextRequest, ContextItem } from "../context.types.js";
import { prisma } from "../../../../config/prisma.js";
import { estimateTokenCount } from "../tokenBudget.js";

const db = prisma as any;

export class ArchitectureContextProvider implements IContextProvider {
  public name = "architecture" as const;

  public async collect(req: ContextRequest): Promise<ContextItem[]> {
    const items: ContextItem[] = [];
    const projectId = req.projectId;

    try {
      const latestSnapshot = await db.forgeAiArchitectureSnapshot.findFirst({
        where: { projectId },
        orderBy: { createdAt: "desc" },
      });

      if (latestSnapshot) {
        const archSummary = {
          score: latestSnapshot.score,
          moduleCount: latestSnapshot.moduleCount,
          serviceCount: latestSnapshot.serviceCount,
          circularDependencies: latestSnapshot.circularDependencies || [],
          layerViolations: latestSnapshot.layerViolations || [],
          duplicatedModules: latestSnapshot.duplicatedModules || [],
          recommendations: latestSnapshot.recommendations || [],
        };

        const content = JSON.stringify(archSummary, null, 2);
        items.push({
          id: `arch-${latestSnapshot.id}`,
          source: "architecture",
          sourceId: latestSnapshot.id,
          title: `Architecture Snapshot (Health: ${latestSnapshot.score}/100)`,
          content,
          relevanceScore: 80,
          estimatedTokens: estimateTokenCount(content),
          freshnessTimestamp: latestSnapshot.createdAt ? new Date(latestSnapshot.createdAt).toISOString() : new Date().toISOString(),
          hash: crypto.createHash("sha256").update(content).digest("hex").slice(0, 16),
          isCritical: false,
          metadata: { score: latestSnapshot.score },
        });
      }
    } catch (err) {
      console.warn("[ArchitectureContextProvider] Error collecting architecture context:", err);
    }

    return items;
  }
}
