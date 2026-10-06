/**
 * ForgeStudio Module 37: Context Ranking & Deduplication
 * Evaluates relevance signals and removes duplicate / overlapping items.
 */

import crypto from "node:crypto";
import { ContextItem, ContextRequest } from "./context.types.js";

export function calculateRelevanceScore(
  item: ContextItem,
  request: ContextRequest
): number {
  let score = 50; // Baseline

  // 1. Critical items get maximum score
  if (item.isCritical) return 100;

  const targetObjective = (request.objective || "").toLowerCase();
  const targetQuery = (request.query || "").toLowerCase();
  const textContent = (item.title + " " + item.content).toLowerCase();

  // 2. Explicitly requested files
  if (request.files && request.files.length > 0) {
    if (request.files.some((f) => item.sourceId.includes(f) || f.includes(item.sourceId))) {
      score += 35;
    }
  }

  // 3. Keyword relevance matching
  if (targetObjective) {
    const words = targetObjective.split(/\s+/).filter((w) => w.length > 3);
    for (const w of words) {
      if (textContent.includes(w)) {
        score += 5;
      }
    }
  }

  if (targetQuery) {
    const words = targetQuery.split(/\s+/).filter((w) => w.length > 3);
    for (const w of words) {
      if (textContent.includes(w)) {
        score += 7;
      }
    }
  }

  // 4. Source type priorities by profile
  const profile = request.contextProfile || "DEFAULT";
  if (profile === "PlanningAgentContext") {
    if (item.source === "architecture" || item.source === "manifest" || item.source === "memory") {
      score += 20;
    }
  } else if (profile === "ArchitectureAgentContext") {
    if (item.source === "architecture" || item.source === "manifest" || item.source === "database") {
      score += 25;
    }
  } else if (profile === "CodingAgentContext") {
    if (item.source === "file" || item.source === "git" || item.source === "memory") {
      score += 20;
    }
  } else if (profile === "TestingAgentContext") {
    if (item.source === "build" || item.source === "runtime" || item.source === "terminal") {
      score += 30;
    }
  }

  // 5. Freshness boost
  const itemAgeSec = (Date.now() - new Date(item.freshnessTimestamp).getTime()) / 1000;
  if (itemAgeSec < 300) {
    score += 10; // Modified in last 5 minutes
  }

  return Math.min(100, Math.max(0, score));
}

export function deduplicateContextItems(items: ContextItem[]): ContextItem[] {
  const seenHashes = new Set<string>();
  const seenSourceIds = new Set<string>();
  const uniqueItems: ContextItem[] = [];

  for (const item of items) {
    // Generate content hash if missing
    const contentHash =
      item.hash ||
      crypto.createHash("sha256").update(item.source + ":" + item.content).digest("hex").slice(0, 16);

    const sourceKey = `${item.source}:${item.sourceId}`;

    if (seenHashes.has(contentHash) || seenSourceIds.has(sourceKey)) {
      continue;
    }

    seenHashes.add(contentHash);
    seenSourceIds.add(sourceKey);
    uniqueItems.push({
      ...item,
      hash: contentHash,
    });
  }

  return uniqueItems;
}
