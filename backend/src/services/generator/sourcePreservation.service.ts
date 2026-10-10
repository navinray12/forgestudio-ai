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
      // Function replacer: user code may contain "$1", "$&" etc., which a string replacement would expand
      result = result.replace(regex, (_m, start: string, _old: string, end: string) => `${start}${content}${end}`);
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

  // Check if file contains protected tags: always SHARED so user code survives and visual updates apply
  const content = existingFile.content || "";
  if (new RegExp(PROTECTED_REGION_REGEX.source).test(content)) {
    return "SHARED";
  }

  // Page component entry points represent canonical visual pages: always SHARED for bidirectional sync
  const p = (existingFile.path || "").replace(/\\/g, "/");
  if (
    p.startsWith("src/pages/") ||
    p.startsWith("pages/") ||
    (p.startsWith("app/") && p.endsWith("/page.tsx")) ||
    (p.startsWith("src/app/") && p.endsWith("/page.tsx"))
  ) {
    return "SHARED";
  }

  if (!existingFile.isGenerated) {
    return "USER";
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
        heldBack: true,
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

  // Case 3b: File explicitly locked by the user -> never rewritten by a generator
  if (existingFile.isProtected) {
    return {
      planned: {
        path: incoming.path,
        action: "PRESERVE",
        ownership: "SHARED",
        content: existingContent,
        mimeType: incoming.mimeType,
        reason: "Protected file preserved",
        existingHash,
        newHash: existingHash,
        isProtected: true,
        heldBack: true,
      },
      conflict: {
        path: incoming.path,
        message: `Preserved protected file '${incoming.path}'. Unprotect it to receive regenerated code.`,
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

    // Regenerated output identical once the user's regions are re-applied -> nothing to write
    if (mergedContent === existingContent) {
      return {
        planned: {
          path: incoming.path,
          action: "PRESERVE",
          ownership: "SHARED",
          content: existingContent,
          mimeType: incoming.mimeType,
          reason: "Content unchanged after protected-region merge",
          existingHash,
          newHash: existingHash,
          isProtected: existingFile.isProtected,
        },
      };
    }

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
        // Regions are protected by their markers; flagging the whole file would
        // make the filesystem reject every later regeneration of it.
        isProtected: existingFile.isProtected,
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

/**
 * Paths of page files whose saved code could not be reconciled with the visual
 * document (unsupported code, syntax errors or an unresolved conflict). They are
 * recorded on the project and must not be regenerated until that is resolved.
 */
export function heldCodePaths(projectMetadata: unknown): Set<string> {
  const codeSync = (projectMetadata as any)?.codeSync;
  return new Set(codeSync && typeof codeSync === "object" ? Object.keys(codeSync) : []);
}

/** Keep the existing content of every held file, whatever the plan wanted to do with it */
export function holdBackPlannedFiles<T extends PlannedFile>(
  planned: T[],
  existingFiles: Array<{ path: string; content?: string | null; contentHash: string; isProtected?: boolean }>,
  held: Set<string>
): T[] {
  if (held.size === 0) return planned;
  const existing = new Map(existingFiles.map((f) => [f.path, f]));
  return planned.map((file) => {
    const current = existing.get(file.path);
    if (!held.has(file.path) || !current) return file;
    return {
      ...file,
      action: "PRESERVE",
      ownership: "USER",
      content: current.content || "",
      reason: "Hand-written code awaiting reconciliation with the visual document",
      existingHash: current.contentHash,
      newHash: current.contentHash,
      isProtected: true,
      heldBack: true,
      diff: undefined,
    };
  });
}

const GENERATOR_ROOT_FILES = new Set([
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "vitest.config.ts",
  "eslint.config.js",
  "index.html",
  "next.config.mjs",
  "postcss.config.mjs",
  "middleware.ts",
  ".env.example",
]);

/**
 * Paths the React / Next.js project generators own. Files produced by other
 * tooling (manifest, Dockerfiles, infrastructure) are never considered stale.
 */
export function isGeneratorOwnedPath(filePath: string): boolean {
  return (
    GENERATOR_ROOT_FILES.has(filePath) ||
    filePath.startsWith("src/") ||
    filePath.startsWith("app/") ||
    filePath.startsWith("components/") ||
    filePath === "lib/forgeStyle.ts"
  );
}

/**
 * Generated files left over from a previous generation (a removed page, or the
 * other framework's scaffold) that a full regeneration no longer produces.
 * User-authored and protected files are never returned.
 */
export function findStaleGeneratedFiles<
  T extends { path: string; isGenerated?: boolean; isProtected?: boolean; isDirectory?: boolean }
>(existingFiles: T[], plannedPaths: Iterable<string>): T[] {
  const planned = new Set(plannedPaths);
  return existingFiles.filter(
    (f) => !f.isDirectory && f.isGenerated && !f.isProtected && !planned.has(f.path) && isGeneratorOwnedPath(f.path)
  );
}
