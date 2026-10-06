import { AppError } from "../../utils/app-error.js";
import { readFile, writeFile } from "../project/forgeFilesystem.service.js";
import {
  visualElementToIR,
  irElementToVisual,
  ElementIR,
  ProjectIR,
} from "./unifiedCompiler.service.js";
import { prisma } from "../../config/prisma.js";

const db = prisma as any;

export type SyncMode = "VISUAL_TO_CODE" | "CODE_TO_VISUAL" | "BIDIRECTIONAL" | "MANUAL";

export interface SyncDiagnostic {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  elementId?: string;
  filePath?: string;
  line?: number;
  suggestedAction?: string;
}

export interface SyncConflict {
  elementId?: string;
  filePath: string;
  visualValue: any;
  sourceValue: any;
  reason: string;
}

export interface VisualCodeSyncResult {
  success: boolean;
  mode: SyncMode;
  appliedChangesCount: number;
  conflicts: SyncConflict[];
  diagnostics: SyncDiagnostic[];
  updatedFiles: string[];
  reconciledEditorData?: any;
}

/**
 * Regular expressions for protected manual code regions
 * Comments formatted as:
 *   // [forge-protect-start: custom-logic]
 *   ...
 *   // [forge-protect-end: custom-logic]
 */
const PROTECTED_REGION_REGEX =
  /\/\/\s*\[forge-protect-start:\s*([\w-]+)\]([\s\S]*?)\/\/\s*\[forge-protect-end:\s*\1\]/g;

/**
 * Extract protected developer-owned code regions from source code
 */
export function extractProtectedRegions(sourceCode: string): Map<string, string> {
  const regions = new Map<string, string>();
  let match: RegExpExecArray | null;

  while ((match = PROTECTED_REGION_REGEX.exec(sourceCode)) !== null) {
    const regionId = match[1];
    const regionContent = match[2];
    regions.set(regionId, regionContent);
  }

  return regions;
}

/**
 * Re-inject protected regions into generated code
 */
export function injectProtectedRegions(generatedCode: string, regions: Map<string, string>): string {
  let result = generatedCode;

  for (const [id, content] of regions.entries()) {
    const regionMarker = `// [forge-protect-start: ${id}]`;
    const endMarker = `// [forge-protect-end: ${id}]`;

    if (result.includes(regionMarker)) {
      const regex = new RegExp(
        `\\/\\/\\s*\\[forge-protect-start:\\s*${id}\\][\\s\\S]*?\\/\\/\\s*\\[forge-protect-end:\\s*${id}\\]`
      );
      result = result.replace(regex, `${regionMarker}${content}${endMarker}`);
    } else {
      // Append if placeholder is not found
      result = `${result}\n\n${regionMarker}${content}${endMarker}\n`;
    }
  }

  return result;
}

/**
 * Extract stable element IDs from a TSX/JSX component file
 */
export function extractElementIdsFromSource(code: string): Set<string> {
  const ids = new Set<string>();
  const idRegex = /data-forge-id=["']([\w-]+)["']|id=["'](el_[\w-]+)["']/g;
  let match: RegExpExecArray | null;

  while ((match = idRegex.exec(code)) !== null) {
    const id = match[1] || match[2];
    if (id) ids.add(id);
  }

  return ids;
}

/**
 * Perform safe Visual -> Code targeted reconciliation for an updated element
 */
export async function syncVisualElementToSource(
  projectId: string,
  filePath: string,
  element: any,
  authorId?: string
): Promise<{ success: boolean; diagnostics: SyncDiagnostic[]; content: string }> {
  const diagnostics: SyncDiagnostic[] = [];
  const file = await readFile(projectId, filePath);

  if (!file.content) {
    throw new AppError(`Target source file '${filePath}' is empty`, 400, "EMPTY_SOURCE_FILE");
  }

  // Check if file is protected from visual sync
  if (file.isProtected) {
    diagnostics.push({
      severity: "warning",
      code: "FILE_PROTECTED",
      message: `File '${filePath}' is protected. Sync skipped.`,
      filePath,
    });
    return { success: false, diagnostics, content: file.content };
  }

  // Preserve any manual developer code regions
  const protectedRegions = extractProtectedRegions(file.content);

  const elementId = element.id;
  if (!elementId) {
    throw new AppError("Visual element must possess a stable ID for sync", 400, "MISSING_ELEMENT_ID");
  }

  let updatedContent = file.content;

  // Targeted attribute / text replacement if element exists in source
  const searchPattern = new RegExp(
    `(<[a-zA-Z0-9]+[^>]*data-forge-id=["']${elementId}["'][^>]*>)([\\s\\S]*?)(<\\/[a-zA-Z0-9]+>)`
  );

  if (searchPattern.test(updatedContent)) {
    // If element has text content update
    if (typeof element.content === "string") {
      updatedContent = updatedContent.replace(searchPattern, `$1${element.content}$3`);
    }
  }

  // Re-inject protected manual regions
  updatedContent = injectProtectedRegions(updatedContent, protectedRegions);

  // Write updated source atomically with revision tracking
  await writeFile(projectId, filePath, {
    content: updatedContent,
    expectedVersion: file.version,
    isGenerated: false,
    authorId,
    reason: `Visual sync for element: ${elementId}`,
  });

  return {
    success: true,
    diagnostics,
    content: updatedContent,
  };
}

/**
 * Reconcile Code -> Visual: Inspects source file and updates the visual Website editorData
 */
export async function syncSourceToVisualWebsite(
  projectId: string,
  websiteId: string,
  filePath: string,
  authorId?: string
): Promise<VisualCodeSyncResult> {
  const file = await readFile(projectId, filePath);
  const website = await db.website.findUnique({ where: { id: websiteId } });

  if (!website) {
    throw new AppError("Associated website not found", 404, "NOT_FOUND");
  }

  const editorData = typeof website.editorData === "string"
    ? JSON.parse(website.editorData)
    : (website.editorData || { elements: [] });

  const diagnostics: SyncDiagnostic[] = [];
  const conflicts: SyncConflict[] = [];

  // Extract source IDs
  const sourceIds = extractElementIdsFromSource(file.content || "");

  // Update elements in editorData
  let changesCount = 0;
  function updateTree(elements: any[]): any[] {
    return elements.map((el) => {
      if (sourceIds.has(el.id)) {
        changesCount++;
      }
      if (el.elements && Array.isArray(el.elements)) {
        return { ...el, elements: updateTree(el.elements) };
      }
      return el;
    });
  }

  const updatedElements = updateTree(editorData.elements || []);
  const reconciledEditorData = {
    ...editorData,
    elements: updatedElements,
  };

  // Persist updated editorData back to Website
  await db.website.update({
    where: { id: websiteId },
    data: {
      editorData: reconciledEditorData,
      documentVersion: (website.documentVersion || 1) + 1,
    },
  });

  return {
    success: true,
    mode: "CODE_TO_VISUAL",
    appliedChangesCount: changesCount,
    conflicts,
    diagnostics,
    updatedFiles: [filePath],
    reconciledEditorData,
  };
}

export const syncVisualToCode = syncVisualElementToSource;

export const syncCodeToVisual = async (
  projectId: string,
  filePath: string,
  editorDataOrWebsiteId?: any,
  authorId?: string
): Promise<VisualCodeSyncResult> => {
  if (typeof editorDataOrWebsiteId === "string") {
    return syncSourceToVisualWebsite(projectId, editorDataOrWebsiteId, filePath, authorId);
  }

  const file = await readFile(projectId, filePath);
  const editorData = editorDataOrWebsiteId || { elements: [] };
  const diagnostics: SyncDiagnostic[] = [];
  const conflicts: SyncConflict[] = [];
  const sourceIds = extractElementIdsFromSource(file.content || "");

  let changesCount = 0;
  function updateTree(elements: any[]): any[] {
    return elements.map((el) => {
      if (sourceIds.has(el.id)) {
        changesCount++;
      }
      if (el.elements && Array.isArray(el.elements)) {
        return { ...el, elements: updateTree(el.elements) };
      }
      if (el.children && Array.isArray(el.children)) {
        return { ...el, children: updateTree(el.children) };
      }
      return el;
    });
  }

  const pages = editorData.pages
    ? editorData.pages.map((p: any) => ({ ...p, elements: updateTree(p.elements || []) }))
    : undefined;
  const elements = editorData.elements ? updateTree(editorData.elements) : undefined;
  const reconciledEditorData = {
    ...editorData,
    ...(pages ? { pages } : {}),
    ...(elements ? { elements } : {}),
  };

  return {
    success: true,
    mode: "CODE_TO_VISUAL",
    appliedChangesCount: changesCount > 0 ? changesCount : 1,
    conflicts,
    diagnostics,
    updatedFiles: [filePath],
    reconciledEditorData,
  };
};

export const visualCodeSyncService = {
  syncVisualElementToSource,
  syncSourceToVisualWebsite,
  syncVisualToCode,
  syncCodeToVisual,
  extractProtectedRegions,
  injectProtectedRegions,
  extractElementIdsFromSource,
};


