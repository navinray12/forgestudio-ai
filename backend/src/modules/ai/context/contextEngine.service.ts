/**
 * ForgeStudio Module 37: AI Context Engine Service
 * Central context assembly layer shared by all Forge agents.
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import {
  ContextRequest,
  ContextSnapshot,
  ContextItem,
  IContextProvider,
  ContextSourceType,
} from "./context.types.js";
import { FileContextProvider } from "./providers/fileContext.provider.js";
import { ManifestContextProvider } from "./providers/manifestContext.provider.js";
import { GitContextProvider } from "./providers/gitContext.provider.js";
import { BuildContextProvider } from "./providers/buildContext.provider.js";
import { DatabaseContextProvider } from "./providers/databaseContext.provider.js";
import { ToolResultContextProvider } from "./providers/toolResultContext.provider.js";
import { MemoryContextProvider } from "./providers/memoryContext.provider.js";
import { ArchitectureContextProvider } from "./providers/architectureContext.provider.js";
import { TaskContextProvider } from "./providers/taskContext.provider.js";
import { calculateRelevanceScore, deduplicateContextItems } from "./contextRanking.js";
import { sanitizeSensitiveText } from "./sensitiveFilter.js";
import { packContextWithinBudget } from "./tokenBudget.js";

const db = prisma as any;

export class ContextEngineService {
  private providers: Map<ContextSourceType, IContextProvider> = new Map();

  constructor() {
    this.registerProvider(new FileContextProvider());
    this.registerProvider(new ManifestContextProvider());
    this.registerProvider(new GitContextProvider());
    this.registerProvider(new BuildContextProvider());
    this.registerProvider(new DatabaseContextProvider());
    this.registerProvider(new ToolResultContextProvider());
    this.registerProvider(new MemoryContextProvider());
    this.registerProvider(new ArchitectureContextProvider());
    this.registerProvider(new TaskContextProvider());
  }

  public registerProvider(provider: IContextProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Build targeted, deduplicated, security-redacted, and token-budgeted context
   */
  public async assembleContext(request: ContextRequest): Promise<ContextSnapshot> {
    if (!request.projectId) {
      throw new AppError("projectId is required for context assembly", 400, "MISSING_PROJECT_ID");
    }

    const tokenBudget = request.tokenBudget || 32000;
    const profile = request.contextProfile || "DEFAULT";

    // 1. Determine which providers to invoke
    const allowed = new Set(request.allowedSources || Array.from(this.providers.keys()));
    const excluded = new Set(request.excludeSources || []);

    const targetProviders = Array.from(this.providers.values()).filter(
      (p) => allowed.has(p.name) && !excluded.has(p.name)
    );

    // 2. Concurrently collect items across providers
    const collectionPromises = targetProviders.map(async (provider) => {
      try {
        return await provider.collect(request);
      } catch (err) {
        console.warn(`[ContextEngine] Provider ${provider.name} failed:`, err);
        return [];
      }
    });

    const settled = await Promise.allSettled(collectionPromises);
    let rawItems: ContextItem[] = [];
    for (const res of settled) {
      if (res.status === "fulfilled") {
        rawItems.push(...res.value);
      }
    }

    // 3. Score and rank items
    for (const item of rawItems) {
      item.relevanceScore = calculateRelevanceScore(item, request);
    }

    // 4. Deduplicate items
    let uniqueItems = deduplicateContextItems(rawItems);

    // 5. Sensitive data redaction
    let totalRedactedCount = 0;
    const allRedactedPatterns = new Set<string>();

    uniqueItems = uniqueItems.map((item) => {
      const sanitized = sanitizeSensitiveText(item.content);
      if (sanitized.redactedCount > 0) {
        totalRedactedCount += sanitized.redactedCount;
        sanitized.patternsDetected.forEach((p) => allRedactedPatterns.add(p));
        return {
          ...item,
          content: sanitized.text,
          isRedacted: true,
        };
      }
      return item;
    });

    // 6. Token budgeting & hierarchical compression
    const packingResult = packContextWithinBudget(uniqueItems, tokenBudget);

    // 7. Compute explainability metadata
    const scoresMap: Record<string, number> = {};
    for (const item of packingResult.packedItems) {
      scoresMap[item.title] = item.relevanceScore;
    }

    const rationale = [
      `Assembled context for profile '${profile}' under ${tokenBudget} token budget.`,
      `Collected from ${targetProviders.length} active providers (${rawItems.length} raw candidates).`,
      `Deduplicated to ${uniqueItems.length} unique items.`,
      `Redacted ${totalRedactedCount} sensitive tokens/credentials.`,
      `Packed ${packingResult.packedItems.length} items (${packingResult.tokensUsed} tokens), dropped ${packingResult.droppedCount} items, truncated ${packingResult.truncatedCount} items.`,
    ];

    const sourcesUsed = Array.from(new Set(packingResult.packedItems.map((i) => i.source)));

    // 8. Persist snapshot in database for audit and observability
    let snapshotRecord: any = null;
    try {
      snapshotRecord = await db.forgeAiContextSnapshot.create({
        data: {
          projectId: request.projectId,
          taskId: request.taskId || null,
          runId: request.runId || null,
          agentId: request.agentId || null,
          profile,
          tokenBudget,
          tokensUsed: packingResult.tokensUsed,
          sources: sourcesUsed,
          items: packingResult.packedItems,
          redactedCount: totalRedactedCount,
          explainability: {
            selectedCount: packingResult.packedItems.length,
            droppedCount: packingResult.droppedCount,
            scores: scoresMap,
            rationale,
            redactedPatterns: Array.from(allRedactedPatterns),
          },
        },
      });
    } catch (err) {
      console.warn("[ContextEngine] Failed to save context snapshot:", err);
    }

    const snapshot: ContextSnapshot = {
      id: snapshotRecord?.id || `ctx-${Date.now()}`,
      projectId: request.projectId,
      taskId: request.taskId,
      runId: request.runId,
      agentId: request.agentId,
      profile,
      tokenBudget,
      tokensUsed: packingResult.tokensUsed,
      sources: sourcesUsed,
      items: packingResult.packedItems,
      redactedCount: totalRedactedCount,
      explainability: {
        selectedCount: packingResult.packedItems.length,
        droppedCount: packingResult.droppedCount,
        scores: scoresMap,
        rationale,
        redactedPatterns: Array.from(allRedactedPatterns),
      },
      createdAt: new Date().toISOString(),
    };

    return snapshot;
  }

  /**
   * Retrieve an existing context snapshot by ID
   */
  public async getSnapshot(snapshotId: string): Promise<ContextSnapshot | null> {
    const snap = await db.forgeAiContextSnapshot.findUnique({
      where: { id: snapshotId },
    });
    return snap || null;
  }
}

export const contextEngineService = new ContextEngineService();
