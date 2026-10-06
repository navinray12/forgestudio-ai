/**
 * ForgeStudio Module 37: Token Budgeting & Packing
 * Implements token-aware context packing, hierarchical truncation, and critical context preservation.
 */

import { ContextItem } from "./context.types.js";

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Standard tokenization heuristic (~4 characters per token in English / code)
  return Math.ceil(text.length / 4);
}

export interface PackingResult {
  packedItems: ContextItem[];
  tokensUsed: number;
  droppedCount: number;
  truncatedCount: number;
}

export function packContextWithinBudget(
  items: ContextItem[],
  tokenBudget: number = 32000
): PackingResult {
  const packedItems: ContextItem[] = [];
  let currentTokens = 0;
  let droppedCount = 0;
  let truncatedCount = 0;

  // 1. Critical items must always be preserved first
  const criticalItems = items.filter((i) => i.isCritical);
  const normalItems = items.filter((i) => !i.isCritical);

  // Sort normal items by relevance score descending
  normalItems.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Process critical items first
  for (const item of criticalItems) {
    const itemTokens = item.estimatedTokens || estimateTokenCount(item.content);
    packedItems.push({
      ...item,
      estimatedTokens: itemTokens,
    });
    currentTokens += itemTokens;
  }

  // Process normal items within remaining budget
  for (const item of normalItems) {
    const remainingBudget = tokenBudget - currentTokens;
    if (remainingBudget <= 50) {
      // No meaningful space remaining
      droppedCount++;
      continue;
    }

    const itemTokens = item.estimatedTokens || estimateTokenCount(item.content);

    if (itemTokens <= remainingBudget) {
      // Fits completely
      packedItems.push({
        ...item,
        estimatedTokens: itemTokens,
      });
      currentTokens += itemTokens;
    } else {
      // Partially truncate to fit remaining budget (minimum 100 tokens to be useful)
      if (remainingBudget >= 100) {
        const allowedChars = (remainingBudget - 20) * 4;
        const truncatedContent =
          item.content.slice(0, allowedChars) +
          "\n... [Context truncated to fit model token budget]";
        const newTokens = estimateTokenCount(truncatedContent);

        packedItems.push({
          ...item,
          content: truncatedContent,
          estimatedTokens: newTokens,
        });
        currentTokens += newTokens;
        truncatedCount++;
      } else {
        droppedCount++;
      }
    }
  }

  return {
    packedItems,
    tokensUsed: currentTokens,
    droppedCount,
    truncatedCount,
  };
}
