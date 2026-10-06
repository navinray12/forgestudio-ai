/**
 * ForgeStudio Module 37: Build Context Provider
 */

import crypto from "node:crypto";
import { IContextProvider, ContextRequest, ContextItem } from "../context.types.js";
import { prisma } from "../../../../config/prisma.js";
import { estimateTokenCount } from "../tokenBudget.js";

const db = prisma as any;

export class BuildContextProvider implements IContextProvider {
  public name = "build" as const;

  public async collect(req: ContextRequest): Promise<ContextItem[]> {
    const items: ContextItem[] = [];
    const projectId = req.projectId;

    try {
      const latestBuild = await db.forgeBuildRecord.findFirst({
        where: { projectId },
        orderBy: { createdAt: "desc" },
      });

      if (latestBuild) {
        const buildInfo = {
          buildId: latestBuild.id,
          status: latestBuild.status,
          durationMs: latestBuild.durationMs,
          diagnostics: latestBuild.diagnostics || [],
          errors: latestBuild.errorMessage || null,
          logsSnippet: Array.isArray(latestBuild.logs)
            ? latestBuild.logs.slice(-20)
            : typeof latestBuild.logs === "string"
            ? latestBuild.logs.slice(-2000)
            : null,
        };

        const content = JSON.stringify(buildInfo, null, 2);
        const isFailed = latestBuild.status === "FAILED";

        items.push({
          id: `build-${latestBuild.id}`,
          source: "build",
          sourceId: latestBuild.id,
          title: `Build Record (${latestBuild.status})`,
          content,
          relevanceScore: isFailed ? 95 : 60,
          estimatedTokens: estimateTokenCount(content),
          freshnessTimestamp: latestBuild.createdAt ? new Date(latestBuild.createdAt).toISOString() : new Date().toISOString(),
          hash: crypto.createHash("sha256").update(content).digest("hex").slice(0, 16),
          isCritical: isFailed, // Critical if build failed so agent sees the errors
          metadata: { status: latestBuild.status },
        });
      }
    } catch (err) {
      console.warn("[BuildContextProvider] Error fetching build context:", err);
    }

    return items;
  }
}
