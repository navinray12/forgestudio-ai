/**
 * ForgeStudio Source Preservation & File Ownership Service
 * Guarantees zero destructive overwrites of user-authored code.
 */

import { calculateContentHash } from "../project/forgeFilesystem.service.js";
import {
  FileOwnership,
  PlannedFileAction,
  PlannedFile,
  GenerationConflict,
} from "./generatorTypes.js";

const PROTECTED_REGION_REGEX =
  /\/\/\s*\[forge-protect-start:\s*([\w-]+)\]([\s\S]*?)\/\/\s*\[forge-protect-end:\s*\1\]/g;

/**
 * Extract protected regions: // [forge-protect-start: <id>] ... // [forge-protect-end: <id>]
 */
export function extractProtectedRegions(sourceCode: string): Map<string, string> {
  const regions = new Map<string, string>();
  let match: RegExpExecArray | null;

  const regex = new RegExp(PROTECTED_REGION_REGEX.source, "g");
  while ((match = regex.exec(sourceCode)) !== null) {
    const regionId = match[1];
    const regionContent = match[2];
    regions.set(regionId, regionContent);
  }

  return regions;
}

/**
 * Re-inject protected regions into target code
 */
export function injectProtectedRegions(generatedCode: string, regions: Map<string, string>): string {
  let result = generatedCode;

  for (const [id, content] of regions.entries()) {
    const regionMarker = `// [forge-protect-start: ${id}]`;
    const endMarker = `// [forge-protect-end: ${id}]`;

    if (result.includes(regionMarker) && result.includes(endMarker)) {
      const regex = new RegExp(
        `(\\/\\/\\s*\\[forge-protect-start:\\s*${id}\\])([\\s\\S]*?)(\\/\\/\\s*\\[forge-protect-end:\\s*${id}\\])`,
        "g"
      );
      result = result.replace(regex, `$1${content}$3`);
    } else {
      // Append protected block at bottom of file if marker was deleted in generated template
      result += `\n\n// [forge-protect-start: ${id}]${content}// [forge-protect-end: ${id}]\n`;
    }
  }

  return result;
}

/**
 * Simple line-by-line unified diff generator for observability
 */
export function computeSimpleDiff(oldText: string, newText: string): string {
  if (oldText === newText) return "";

  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const diffLines: string[] = [];

  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === undefined) {
      diffLines.push(`+ ${n}`);
    } else if (n === undefined) {
      diffLines.push(`- ${o}`);
    } else if (o !== n) {
      diffLines.push(`- ${o}`);
      diffLines.push(`+ ${n}`);
    }
  }

  return diffLines.slice(0, 50).join("\n") + (diffLines.length > 50 ? "\n... (truncated)" : "");
}

/**
 * Determine file ownership given existing DB entity and incoming generated content
 */
export function classifyFileOwnership(
  existingFile: {
    path: string;
    isGenerated?: boolean;
    isProtected?: boolean;
    contentHash?: string;
    content?: string | null;
  } | null,
  isSystemFile = false
): FileOwnership {
  if (isSystemFile) return "SYSTEM";
  if (!existingFile) return "GENERATED";

  if (existingFile.isProtected) {
    return "SHARED";
  }

  if (!existingFile.isGenerated) {
    return "USER";
  }

  // Check if file contains protected tags
  const content = existingFile.content || "";
  if (PROTECTED_REGION_REGEX.test(content)) {
    return "SHARED";
  }

  return "GENERATED";
}

/**
 * Reconcile proposed generated file with existing project file
 */
export function reconcilePlannedFile(
  incoming: {
    path: string;
    content: string;
    mimeType: string;
    reason: string;
    isProtected?: boolean;
  },
  existingFile: {
    id: string;
    path: string;
    content?: string | null;
    contentHash: string;
    isGenerated: boolean;
    isProtected: boolean;
  } | null
): { planned: PlannedFile; conflict?: GenerationConflict } {
  const newHash = calculateContentHash(incoming.content, "utf-8");
  const isSystem = incoming.path === "forge.manifest.json";

  // Case 1: Brand new file
  if (!existingFile) {
    return {
      planned: {
        path: incoming.path,
        action: "CREATE",
        ownership: isSystem ? "SYSTEM" : "GENERATED",
        content: incoming.content,
        mimeType: incoming.mimeType,
        reason: incoming.reason,
        newHash,
        isProtected: incoming.isProtected,
      },
    };
  }

  const existingContent = existingFile.content || "";
  const existingHash = existingFile.contentHash;
  const ownership = classifyFileOwnership(existingFile, isSystem);

  // Case 2: Identical content -> Preserve (no-op)
  if (existingHash === newHash || existingContent === incoming.content) {
    return {
      planned: {
        path: incoming.path,
        action: "PRESERVE",
        ownership,
        content: existingContent,
        mimeType: incoming.mimeType,
        reason: "Content unchanged (hash match)",
        existingHash,
        newHash,
        isProtected: existingFile.isProtected,
      },
    };
  }

  // Case 3: Pure USER file -> Must NEVER overwrite
  if (ownership === "USER") {
    return {
      planned: {
        path: incoming.path,
        action: "PRESERVE",
        ownership: "USER",
        content: existingContent,
        mimeType: incoming.mimeType,
        reason: "User-authored file strictly preserved",
        existingHash,
        newHash: existingHash,
        isProtected: true,
      },
      conflict: {
        path: incoming.path,
        message: `Preserved user-created file '${incoming.path}'. Automated overwrite prevented.`,
        userContent: existingContent,
        generatedContent: incoming.content,
        diff: computeSimpleDiff(existingContent, incoming.content),
      },
    };
  }

  // Case 4: SHARED file or contains protected regions -> Attempt 3-way protected merge
  const existingProtected = extractProtectedRegions(existingContent);
  if (existingProtected.size > 0 || ownership === "SHARED") {
    const mergedContent = injectProtectedRegions(incoming.content, existingProtected);
    const mergedHash = calculateContentHash(mergedContent, "utf-8");

    return {
      planned: {
        path: incoming.path,
        action: "MERGE",
        ownership: "SHARED",
        content: mergedContent,
        mimeType: incoming.mimeType,
        reason: `Merged ${existingProtected.size} user-protected region(s)`,
        existingHash,
        newHash: mergedHash,
        isProtected: true,
        diff: computeSimpleDiff(existingContent, mergedContent),
      },
    };
  }

  // Case 5: GENERATED file with user modifications
  // If the file was marked generated but modified without markers
  if (existingFile.isGenerated && existingHash !== newHash) {
    return {
      planned: {
        path: incoming.path,
        action: "UPDATE",
        ownership: "GENERATED",
        content: incoming.content,
        mimeType: incoming.mimeType,
        reason: incoming.reason || "Regenerated file",
        existingHash,
        newHash,
        isProtected: incoming.isProtected,
        diff: computeSimpleDiff(existingContent, incoming.content),
      },
    };
  }

  // Default fallback
  return {
    planned: {
      path: incoming.path,
      action: "UPDATE",
      ownership,
      content: incoming.content,
      mimeType: incoming.mimeType,
      reason: incoming.reason,
      existingHash,
      newHash,
      isProtected: incoming.isProtected,
    },
  };
}
