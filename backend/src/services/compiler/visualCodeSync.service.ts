import crypto from "node:crypto";
import { ts } from "./tsCompiler.js";
import { AppError } from "../../utils/app-error.js";
import { readFile, writeFile, listFiles, sanitizeAndNormalizePath } from "../project/forgeFilesystem.service.js";
import { prisma } from "../../config/prisma.js";
import { updateProjectMetadataAtomic } from "../workspace/workspaceCheckpoints.service.js";
import { extractProtectedRegions, injectProtectedRegions } from "../generator/sourcePreservation.service.js";
import { compileAndSyncProject } from "./unifiedCompiler.service.js";
import {
  buildPageRegistry,
  buildSyncBaseline,
  hashPage,
  hashSharedParts,
  normalizePageSourcePath,
  pageRouteIdentity,
  resolvePageSourceTarget,
  parseEditorDocument,
  toProjectFramework,
  RegisteredPage,
} from "./pageRegistry.js";
import {
  JsxNode,
  SyncDiagnostic,
  PageSyncStatus,
  parseJsxSource,
  parseSyntax,
  reconcilePageSource,
} from "./pageSourceSync.js";
import { saveDocumentFromCode } from "../websites/documentGateway.js";
import { applyJsxMutation, type JsxMutation, type JsxMutationCode, type JsxMutationResult } from "./jsxAstMutation.js";

export type { JsxMutation, JsxMutationCode, JsxMutationResult };

const db = prisma as any;

export type { SyncDiagnostic } from "./pageSourceSync.js";
export { extractProtectedRegions, injectProtectedRegions };

export type SyncMode = "VISUAL_TO_CODE" | "CODE_TO_VISUAL" | "BIDIRECTIONAL" | "MANUAL";

export type CodeOwnershipBoundary =
  | "VISUAL_COMPOSITION"
  | "SOURCE_OWNED"
  | "CMS_CONTENT"
  | "APPLICATION_SPEC_OWNED";

export interface WorkspaceCheckpointReference {
  checkpointId: string;
  revision: number;
  hash: string;
  timestamp: string;
}

export interface SyncConflict {
  elementId?: string;
  filePath: string;
  visualValue: any;
  sourceValue: any;
  reason: string;
}

/**
 * Outcome of reconciling a saved source file with the visual document:
 * - synced: the document was updated and the source regenerated from it
 * - unchanged: the code already matches the document
 * - not-a-page: the file is not a registered page, nothing to reconcile
 * - unsupported / invalid: the code cannot be represented; it is preserved as hand-written code
 * - conflict: the visual page changed since this code was generated; nothing was overwritten
 * - reverted: the code edit was discarded in favour of the visual document
 * - error: the document was updated but its source could not be regenerated
 * - draft_saved: invalid draft saved safely without destroying last valid semantic checkpoint
 */
export type CodeSyncStatus = PageSyncStatus | "conflict" | "reverted" | "error" | "draft_saved";

export interface VisualCodeSyncResult {
  success: boolean;
  mode: SyncMode;
  status?: CodeSyncStatus;
  message?: string;
  page?: RegisteredPage;
  appliedChangesCount: number;
  conflicts: SyncConflict[];
  diagnostics: SyncDiagnostic[];
  /** Paths whose persisted content changed as a result of the sync */
  updatedFiles: string[];
  documentVersion?: number;
  reconciledEditorData?: any;
  checkpointId?: string;
}

export interface CodeSyncOptions {
  /** Resolve a detected conflict by keeping the saved code or the visual document */
  resolve?: "code" | "visual";
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
 * Hash editor data deterministically
 */
export function hashEditorData(editorData: any): string {
  const raw = typeof editorData === "string" ? editorData : JSON.stringify(editorData ?? {});
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Validate syntax using TypeScript compiler AST
 */
export function validateSourceSyntax(code: string, fileName = "component.tsx"): {
  isValid: boolean;
  sourceFile?: any;
  diagnostics: SyncDiagnostic[];
} {
  const { sourceFile, diagnostics } = parseSyntax(code, fileName);
  return { isValid: !!sourceFile && diagnostics.length === 0, sourceFile, diagnostics };
}

/**
 * Detect unsupported React/JS constructs that cannot be visually manipulated
 */
export function detectUnsupportedConstructs(sourceFile: any, filePath = ""): SyncDiagnostic[] {
  const diagnostics: SyncDiagnostic[] = [];
  if (!ts || !sourceFile) return diagnostics;

  function visit(node: any) {
    // Detect React Hooks usage (useState, useEffect, custom hooks)
    if (ts.isCallExpression(node)) {
      const exprText = node.expression.getText(sourceFile);
      if (/^use[A-Z0-9]/.test(exprText) && !["useRef"].includes(exprText)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        diagnostics.push({
          severity: "warning",
          code: "UNSUPPORTED_HOOK",
          message: `Hook '${exprText}' is code-only logic and cannot be edited visually on the canvas.`,
          filePath,
          line: line + 1,
          col: character + 1,
          suggestedAction: "Preserved in source file as protected code-only logic.",
        });
      }
    }

    // Detect loops / control flow inside JSX expressions
    if (ts.isIterationStatement(node, false)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      diagnostics.push({
        severity: "warning",
        code: "UNSUPPORTED_LOOP",
        message: "Imperative loops cannot be directly rendered on visual canvas.",
        filePath,
        line: line + 1,
        col: character + 1,
        suggestedAction: "Preserved in source file.",
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return diagnostics;
}

/**
 * Build a lookup map of existing elements by ID
 */
function buildExistingElementMap(elements: any[]): Map<string, any> {
  const map = new Map<string, any>();
  function walk(list: any[]) {
    if (!Array.isArray(list)) return;
    for (const el of list) {
      if (el && el.id) map.set(el.id, el);
      if (el && Array.isArray(el.children)) walk(el.children);
      if (el && Array.isArray(el.elements)) walk(el.elements);
    }
  }
  walk(elements);
  return map;
}

/** Best-effort conversion of an arbitrary JSX node to an editor element (no validation) */
function looseElementFromNode(node: JsxNode, existingMap: Map<string, any>): any {
  const id = node.forgeId || `el_${crypto.randomBytes(4).toString("hex")}`;
  const existing = existingMap.get(id);
  const styles: Record<string, string> = { ...(existing?.styles || {}), ...node.style };
  const classes = node.classes;
  const text = node.text;
  const base = { ...(existing || {}), id, styles, classes };

  if (/^h[1-6]$/.test(node.tag)) {
    return {
      ...base,
      type: "heading",
      headingLevel: node.tag,
      content: text || existing?.content || existing?.textContent || "Heading",
      textContent: text || existing?.textContent || existing?.content || "Heading",
    };
  }
  if (node.tag === "p" || node.tag === "span") {
    return {
      ...base,
      type: "text",
      content: text || existing?.content || existing?.textContent || "",
      textContent: text || existing?.textContent || existing?.content || "",
    };
  }
  if (node.tag === "button" || node.tag === "a") {
    return {
      ...base,
      type: "button",
      content: text || existing?.content || existing?.buttonText || "Button",
      buttonText: text || existing?.buttonText || existing?.content || "Button",
      textContent: text || existing?.textContent || existing?.content || "Button",
      href: node.attrs.href || existing?.href || "#",
    };
  }
  if (node.tag === "img") {
    return { ...base, type: "image", content: "", src: node.attrs.src || existing?.src || "", alt: node.attrs.alt || existing?.alt || "" };
  }
  if (node.tag === "video") return { ...base, type: "video", content: "", src: node.attrs.src || existing?.src || "" };
  if (node.tag === "hr") return { ...base, type: "divider", content: "" };

  const children = node.children.map((child) => looseElementFromNode(child, existingMap));
  const layout: Record<string, any> = { ...(existing?.layout || {}) };
  if (node.style.flexDirection) layout.direction = node.style.flexDirection === "row" ? "row" : "column";
  if (node.style.justifyContent) layout.justifyContent = node.style.justifyContent;
  if (node.style.alignItems) layout.alignItems = node.style.alignItems;
  if (node.style.gap) layout.gap = parseInt(node.style.gap, 10) || 0;
  return {
    ...base,
    type: "container",
    tag: node.tag,
    content: children.length === 0 ? text : "",
    layout: Object.keys(layout).length > 0 ? layout : { direction: "column", gap: 16 },
    children,
    elements: children,
  };
}

/**
 * Parse TSX/JSX source code into an EditorElement tree.
 *
 * This is a best-effort reader for arbitrary components: constructs that have no
 * visual equivalent are reported as warnings and skipped. Synchronising a page
 * into the saved visual document goes through `syncSourceToVisualWebsite`, which
 * validates the result and refuses anything it cannot represent.
 */
export function parseSourceCodeToElements(
  sourceCode: string,
  existingElements: any[] = [],
  filePath = ""
): {
  success: boolean;
  elements: any[];
  diagnostics: SyncDiagnostic[];
} {
  const parsed = parseJsxSource(sourceCode, filePath || "component.tsx");
  if (!parsed.valid) {
    return { success: false, elements: existingElements, diagnostics: parsed.diagnostics };
  }

  const diagnostics: SyncDiagnostic[] = parsed.diagnostics.map((d) =>
    d.code === "NO_JSX_ROOT" ? d : { ...d, severity: "warning" as const }
  );
  diagnostics.push(...detectUnsupportedConstructs(parsed.sourceFile, filePath));

  if (!parsed.root) {
    return { success: false, elements: existingElements, diagnostics };
  }

  const existingMap = buildExistingElementMap(existingElements);
  const roots = parsed.root.tag === "#fragment" ? parsed.root.children : [parsed.root];
  return {
    success: true,
    elements: roots.map((node) => looseElementFromNode(node, existingMap)),
    diagnostics,
  };
}

/**
 * Applies one visual edit to a JSX element through the TypeScript AST (see jsxAstMutation.ts for
 * the supported mutations and the reasons an edit is rejected). A string is shorthand for SET_TEXT.
 * `updated` is true only when the returned content differs from the source.
 */
export function updateJsxElementViaAst(
  sourceCode: string,
  elementId: string,
  change?: string | JsxMutation,
  fileName = "component.tsx"
): JsxMutationResult {
  if (change === undefined || change === null) {
    return { updated: false, content: sourceCode, code: "INVALID_MUTATION", diagnostic: "No mutation supplied." };
  }
  const mutation: JsxMutation = typeof change === "string" ? { type: "SET_TEXT", text: change } : change;
  return applyJsxMutation(sourceCode, String(elementId), mutation, fileName);
}

export interface SyncVisualElementOptions {
  authorId?: string;
  expectedRevision?: number;
  /** The edit to apply. Without it, the element's text (textContent/content/buttonText) is synced. */
  mutation?: JsxMutation;
}

export interface VisualElementSyncResult {
  /** False when the edit was rejected. A request that matches the source already is a success. */
  success: boolean;
  /** True only when the source file was changed and written. */
  updated: boolean;
  code?: JsxMutationCode;
  diagnostics: SyncDiagnostic[];
  content: string;
  /** The file version after the request. */
  version?: number;
  changedRange?: { startLine: number; endLine: number };
}

/**
 * Visual -> code edit of one element in a persisted source file, bound to the expected file
 * revision. The file is written only when the AST mutation changed it and the result parses;
 * a rejected or no-op edit leaves the file and its version untouched.
 */
export async function syncVisualElementToSource(
  projectId: string,
  filePath: string,
  element: any,
  authorIdOrOptions?: string | SyncVisualElementOptions
): Promise<VisualElementSyncResult> {
  const options: SyncVisualElementOptions =
    typeof authorIdOrOptions === "string"
      ? { authorId: authorIdOrOptions }
      : authorIdOrOptions || {};

  const file = await readFile(projectId, filePath);

  if (!file.content) {
    throw new AppError(`Target source file '${filePath}' is empty`, 400, "EMPTY_SOURCE_FILE");
  }
  const source: string = file.content;

  // Revision-bound validation
  if (options.expectedRevision !== undefined && file.version !== undefined) {
    if (file.version !== options.expectedRevision) {
      throw new AppError(
        `Revision conflict: expected file version ${options.expectedRevision}, but found ${file.version}`,
        409,
        "REVISION_CONFLICT"
      );
    }
  }

  const rejected = (code: JsxMutationCode | undefined, diagnosticCode: string, message: string): VisualElementSyncResult => ({
    success: false,
    updated: false,
    code,
    diagnostics: [{ severity: "error", code: diagnosticCode, message, filePath }],
    content: source,
    version: file.version,
  });

  if (file.isProtected) {
    return rejected("SOURCE_OWNED", "FILE_PROTECTED", `File '${filePath}' is protected. Sync skipped.`);
  }

  const elementId = element?.id;
  if (!elementId) {
    throw new AppError("Visual element must possess a stable ID for sync", 400, "MISSING_ELEMENT_ID");
  }

  const text = element.textContent ?? element.content ?? element.buttonText;
  const mutation: JsxMutation | undefined = options.mutation ?? (typeof text === "string" ? { type: "SET_TEXT", text } : undefined);
  if (!mutation) {
    throw new AppError("A mutation or the element's text is required for visual sync", 400, "MISSING_MUTATION");
  }

  const result = updateJsxElementViaAst(source, String(elementId), mutation, filePath);
  if (!result.updated) {
    if (result.code === "NO_CHANGE") {
      return {
        success: true,
        updated: false,
        code: "NO_CHANGE",
        diagnostics: [{ severity: "info", code: "NO_CHANGE", message: result.diagnostic || "No change", filePath }],
        content: source,
        version: file.version,
      };
    }
    return rejected(result.code, `VISUAL_SYNC_${result.code ?? "REJECTED"}`, result.diagnostic || "The edit was not applied.");
  }

  const written = await writeFile(projectId, filePath, {
    content: result.content,
    expectedVersion: file.version,
    authorId: options.authorId,
    reason: `Visual ${mutation.type} for element: ${elementId}`,
  });

  return {
    success: true,
    updated: true,
    diagnostics: [],
    content: result.content,
    version: (written as any)?.version,
    changedRange: result.changedRange,
  };
}

// ---------------------------------------------------------------------------
// Code -> Visual: reconcile a persisted source file into the saved visual document
// ---------------------------------------------------------------------------

interface CodeSyncEntry {
  status: CodeSyncStatus;
  /** Fingerprints of the visual page / shared parts this code was last in step with */
  basePageHash?: string;
  baseSharedHash?: string;
  message?: string;
  diagnostics?: SyncDiagnostic[];
  updatedAt: string;
}

function projectMetadata(project: any): Record<string, any> {
  return project?.metadata && typeof project.metadata === "object" ? project.metadata : {};
}

/** Row-locked so concurrent syncs of different pages cannot overwrite each other's state. */
async function updateProjectMetadata(projectId: string, mutate: (metadata: Record<string, any>) => void) {
  await updateProjectMetadataAtomic(projectId, mutate);
}

/** Ownership decides whether regeneration may rewrite the file */
async function setFileGenerated(file: { id: string; isGenerated: boolean }, isGenerated: boolean) {
  if (file.isGenerated === isGenerated) return;
  await db.forgeProjectFile.update({ where: { id: file.id }, data: { isGenerated } });
}

/**
 * Reconcile Code -> Visual: parses the saved source with the TypeScript AST and
 * updates the canonical visual document. The document is only written when the
 * code is fully representable and neither side has moved on since they last agreed.
 */
export async function syncSourceToVisualWebsite(
  projectId: string,
  websiteId: string,
  filePath: string,
  authorId?: string,
  options: CodeSyncOptions = {}
): Promise<VisualCodeSyncResult> {
  const relativePath = normalizePageSourcePath(filePath);
  if (!relativePath) throw new AppError("Expected a safe project-relative source path", 422, "INVALID_PAGE_SOURCE_PATH");
  const cleanPath = sanitizeAndNormalizePath(relativePath);
  if (options.resolve !== undefined && options.resolve !== "code" && options.resolve !== "visual") {
    throw new AppError("Choose code or visual to resolve a sync conflict", 422, "INVALID_SYNC_RESOLUTION");
  }
  const project = await db.forgeProject.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError("Project not found", 404, "NOT_FOUND");
  // This relationship check supplements, rather than replaces, caller authorization.
  if (project.websiteId !== websiteId) {
    throw new AppError("Website is not bound to this project", 403, "PROJECT_WEBSITE_MISMATCH");
  }
  const website = await db.website.findUnique({ where: { id: websiteId } });
  if (!website) throw new AppError("Associated website not found", 404, "NOT_FOUND");
  const file = await readFile(projectId, cleanPath);

  const editorData = parseEditorDocument(website.editorData);
  const framework = toProjectFramework(project.framework);
  const identity = { id: project.id, name: project.name, slug: project.slug };
  const actorId = authorId || project.ownerId;
  const metadata = projectMetadata(project);

  const result = (
    status: CodeSyncStatus,
    extra: Partial<VisualCodeSyncResult> = {}
  ): VisualCodeSyncResult => ({
    success: status === "synced" || status === "unchanged" || status === "not-a-page" || status === "reverted",
    mode: "CODE_TO_VISUAL",
    status,
    appliedChangesCount: 0,
    conflicts: [],
    diagnostics: [],
    updatedFiles: [],
    ...extra,
  });

  const regenerate = async (document: any) => {
    // The file is handed back to the generator here, so any hold on it is lifted first
    await updateProjectMetadata(projectId, (meta) => {
      if (meta.codeSync?.[cleanPath]) {
        const { [cleanPath]: _released, ...rest } = meta.codeSync;
        meta.codeSync = rest;
      }
    });
    const before = new Map((await listFiles(projectId)).map((f: any) => [f.path, f.contentHash]));
    const compiled = await compileAndSyncProject(projectId, document, { ...identity, framework }, actorId);
    const after = await listFiles(projectId);
    const updatedFiles = after.filter((f: any) => before.get(f.path) !== f.contentHash).map((f: any) => f.path);
    for (const path of before.keys()) {
      if (!after.some((f: any) => f.path === path)) updatedFiles.push(path);
    }
    if (compiled.success) {
      await updateProjectMetadata(projectId, (meta) => {
        meta.visualSync = buildSyncBaseline(document, framework);
        if (meta.codeSync) {
          const { [cleanPath]: _resolved, ...rest } = meta.codeSync;
          meta.codeSync = rest;
        }
      });
    }
    return { compiled, updatedFiles };
  };

  const target = resolvePageSourceTarget(buildPageRegistry(editorData, framework), cleanPath, framework);
  if (target.status === "conflict") {
    return result("conflict", {
      message: target.message,
      diagnostics: [{ severity: "error", code: target.code, message: target.message, filePath: cleanPath }],
      conflicts: target.conflictingPages.map((other) => ({
        filePath: cleanPath,
        visualValue: { pageId: other.pageId, filePath: other.filePath, routePath: other.routePath },
        sourceValue: { filePath: cleanPath },
        reason: target.message,
      })),
    });
  }
  if (target.status === "invalid" || target.status === "unsupported") {
    return result(target.status, {
      message: target.message,
      diagnostics: [{ severity: "error", code: target.code, message: target.message, filePath: cleanPath }],
    });
  }
  if (target.status === "not-a-page") {
    return result("not-a-page", { message: `${cleanPath} is not a registered page; source was preserved.` });
  }

  if (target.status === "new") {
    const pageEntry = target.entry;
    // Registration is a draft operation. It must not take ownership of a page
    // with a matching title/URL or silently move source to a generated filename.
    const nextDoc = JSON.parse(JSON.stringify(editorData ?? {}));
    if (!Array.isArray(nextDoc.pages) || nextDoc.pages.length === 0) {
      const defaultTitle = String(nextDoc.pageSettings?.title || nextDoc.title || nextDoc.name || "Home");
      nextDoc.pages = [
        {
          id: "home",
          name: defaultTitle,
          slug: "/",
          elements: Array.isArray(nextDoc.elements) ? nextDoc.elements : [],
          pageSettings: { ...(nextDoc.pageSettings || {}), title: defaultTitle, path: "/" },
          isHome: true,
        },
      ];
      nextDoc.homePageId = "home";
    }

    // The file becomes the page's generated source, so it is registered only when
    // everything in it can be represented. Otherwise it stays the hand-written file
    // it is: no placeholder content is invented and nothing is overwritten.
    const { importPageElements } = await import("./pageSourceSync.js");
    const imported = importPageElements(file.content || "", cleanPath, nextDoc, framework);
    if (!imported.ok) {
      return result("unsupported", {
        message: `${cleanPath} was saved but not registered as a visual page: it contains code the Visual Editor cannot represent.`,
        diagnostics: imported.diagnostics,
      });
    }
    const importedElements: any[] = imported.elements;

    const pageId = `page_${crypto.randomUUID()}`;
    const newPageObj = {
      id: pageId,
      name: pageEntry.pageTitle,
      slug: pageEntry.routePath,
      elements: importedElements,
      pageSettings: {
        title: pageEntry.pageTitle,
        path: pageEntry.routePath,
        description: "",
        backgroundColor: "#ffffff",
        isMaintenanceMode: false,
        siteLanguage: "en",
      },
      isHome: pageEntry.routePath === "/",
    };
    nextDoc.pages.push(newPageObj);

    // The legacy emitter does not yet preserve every router's source layout.
    // Check its plan BEFORE saving the document or changing file ownership.
    const plannedPage = buildPageRegistry(nextDoc, framework).find((p) => p.pageId === pageId);
    if (!plannedPage || plannedPage.filePath !== cleanPath ||
        pageRouteIdentity(plannedPage.routePath) !== pageRouteIdentity(pageEntry.routePath)) {
      const message = "The current compiler would relocate this source or change its route. " +
        "The file was preserved; register it only after a compatible source-layout adapter is available.";
      return result("unsupported", {
        message,
        diagnostics: [{ severity: "error", code: "PAGE_SOURCE_LAYOUT_UNSUPPORTED", message, filePath: cleanPath }],
      });
    }

    let documentVersion: number;
    try {
      const saved = await saveDocumentFromCode(websiteId, actorId, nextDoc, website.documentVersion ?? 1);
      documentVersion = saved.documentVersion;
    } catch (err: any) {
      if (err?.code === "DOCUMENT_VERSION_CONFLICT") {
        const reason = "The website changed while the new source page was being registered. Neither version was overwritten.";
        return result("conflict", {
          message: reason,
          conflicts: [{ filePath: cleanPath, visualValue: "newer visual document", sourceValue: "saved source", reason }],
        });
      }
      return result("error", {
        message: `Failed to register page ${pageEntry.pageTitle}: ${err?.message || "Document save error"}`,
      });
    }

    await setFileGenerated(file, true);
    const freshSite = await db.website.findUnique({ where: { id: websiteId } });
    const persistedDoc = parseEditorDocument(freshSite?.editorData ?? nextDoc);
    const { compiled, updatedFiles } = await regenerate(persistedDoc);
    if (!compiled.success) {
      const firstError = compiled.diagnostics.find((d) => d.severity === "error");
      return result("error", {
        documentVersion,
        updatedFiles,
        message: `Page "${pageEntry.pageTitle}" was registered, but its source could not be generated: ${
          firstError?.message || "generation failed"
        }`,
      });
    }

    const registeredPage = buildPageRegistry(persistedDoc, framework).find(
      (p) => p.pageId === pageId
    );

    return result("synced", {
      page: registeredPage,
      documentVersion,
      appliedChangesCount: importedElements.length,
      diagnostics: [],
      updatedFiles,
      reconciledEditorData: persistedDoc,
      message: `Registered new page "${pageEntry.pageTitle}" (${pageEntry.routePath}) and synchronized routes.`,
    });
  }

  const page = target.page;
  const baseline = metadata.visualSync || {};
  const previousEntry: CodeSyncEntry | undefined = metadata.codeSync?.[cleanPath];
  // A held file was not regenerated by later visual saves, so the code it contains is still based
  // on the page as it was when the hold started; the latest visual baseline is not its base.
  const basePageHash: string | undefined = previousEntry
    ? previousEntry.basePageHash
    : baseline.pages?.[page.key]?.hash;
  const baseSharedHash: string | undefined = previousEntry ? previousEntry.baseSharedHash : baseline.sharedHash;

  /** Keep the saved code as hand-written source until the two sides agree again */
  const holdAsCode = async (status: CodeSyncStatus, message: string, diagnostics: SyncDiagnostic[]) => {
    await setFileGenerated(file, false);
    await updateProjectMetadata(projectId, (meta) => {
      const entry: CodeSyncEntry = {
        status,
        basePageHash,
        baseSharedHash,
        message,
        diagnostics: diagnostics.filter((d) => d.severity === "error").slice(0, 20),
        updatedAt: new Date().toISOString(),
      };
      meta.codeSync = { ...(meta.codeSync || {}), [cleanPath]: entry };
    });
  };

  // Discard the code edit: regenerate this page from the visual document
  if (options.resolve === "visual") {
    await setFileGenerated(file, true);
    const { compiled, updatedFiles } = await regenerate(editorData);
    if (!compiled.success) {
      const firstError = compiled.diagnostics.find((d) => d.severity === "error");
      return result("error", { page, message: firstError?.message || "Source regeneration failed", updatedFiles });
    }
    return result("reverted", {
      page,
      updatedFiles,
      message: `${cleanPath} was regenerated from the visual document.`,
    });
  }

  // The visual page moved on after this code was generated: applying the code would undo that work
  if (options.resolve !== "code") {
    const pageChanged = !!basePageHash && basePageHash !== hashPage(editorData, page.key);
    const sharedChanged = !!baseSharedHash && baseSharedHash !== hashSharedParts(editorData);
    if (pageChanged || sharedChanged) {
      const reason = pageChanged
        ? `Page "${page.name}" was changed in the Visual Editor after this source was generated.`
        : "The shared header or footer was changed in the Visual Editor after this source was generated.";
      await holdAsCode("conflict", reason, []);
      return result("conflict", {
        page,
        message: `${reason} Neither side was overwritten: keep the code or keep the visual version.`,
        conflicts: [{ filePath: cleanPath, visualValue: "visual document", sourceValue: "saved source", reason }],
      });
    }
  }

  const outcome = await reconcilePageSource({
    source: file.content || "",
    filePath: cleanPath,
    editorData,
    framework,
    project: identity,
  });

  if (outcome.status === "invalid" || outcome.status === "unsupported") {
    const message =
      outcome.status === "invalid"
        ? `${cleanPath} has syntax errors. The file was saved; the visual document was not changed.`
        : `${cleanPath} contains code the Visual Editor cannot represent. The file was saved and is preserved as hand-written code; the visual document was not changed.`;
    await holdAsCode(outcome.status, message, outcome.diagnostics);
    return result(outcome.status, { page, message, diagnostics: outcome.diagnostics });
  }

  if (outcome.status === "unchanged") {
    await setFileGenerated(file, true);
    if (previousEntry) {
      await updateProjectMetadata(projectId, (meta) => {
        const { [cleanPath]: _resolved, ...rest } = meta.codeSync || {};
        meta.codeSync = rest;
      });
    }
    return result("unchanged", {
      page,
      diagnostics: outcome.diagnostics,
      message: "The source already matches the visual document.",
    });
  }

  // Persist the canonical document first; the source is then regenerated from what was saved
  let documentVersion: number;
  try {
    const saved = await saveDocumentFromCode(websiteId, actorId, outcome.editorData, website.documentVersion ?? 1);
    documentVersion = saved.documentVersion;
  } catch (err: any) {
    if (err?.code === "DOCUMENT_VERSION_CONFLICT") {
      const reason = "The website was saved in the Visual Editor while this source was being synchronised.";
      await holdAsCode("conflict", reason, []);
      return result("conflict", {
        page,
        message: `${reason} Neither side was overwritten.`,
        conflicts: [{ filePath: cleanPath, visualValue: "visual document", sourceValue: "saved source", reason }],
      });
    }
    throw err;
  }

  await setFileGenerated(file, true);
  const fresh = await db.website.findUnique({ where: { id: websiteId } });
  const persisted = parseEditorDocument(fresh?.editorData ?? outcome.editorData);
  const { compiled, updatedFiles } = await regenerate(persisted);

  if (!compiled.success) {
    const firstError = compiled.diagnostics.find((d) => d.severity === "error");
    return result("error", {
      page,
      documentVersion,
      updatedFiles,
      diagnostics: outcome.diagnostics,
      message: `The visual document was updated, but its source could not be regenerated: ${
        firstError?.message || "generation failed"
      }`,
    });
  }

  return result("synced", {
    page,
    documentVersion,
    appliedChangesCount: outcome.changedElements,
    diagnostics: outcome.diagnostics,
    updatedFiles,
    reconciledEditorData: persisted,
    message: `Synchronised ${outcome.changedElements} element change(s) into page "${page.name}".`,
  });
}

export const syncVisualToCode = syncVisualElementToSource;

/**
 * Dual signature for unit tests and direct callers:
 * syncCodeToVisual(projectId, filePath, editorDataOrWebsiteId, authorId)
 */
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

  const existingElements = Array.isArray(editorData.elements)
    ? editorData.elements
    : Array.isArray(editorData.pages?.[0]?.elements)
    ? editorData.pages[0].elements
    : [];

  const parseResult = parseSourceCodeToElements(file.content || "", existingElements, filePath);

  if (!parseResult.success) {
    return {
      success: false,
      mode: "CODE_TO_VISUAL",
      appliedChangesCount: 0,
      conflicts: [],
      diagnostics: parseResult.diagnostics,
      updatedFiles: [filePath],
      reconciledEditorData: editorData,
    };
  }

  // Update pages and elements
  const pages = editorData.pages
    ? editorData.pages.map((p: any, idx: number) =>
        idx === 0 ? { ...p, elements: parseResult.elements } : p
      )
    : undefined;

  const reconciledEditorData = {
    ...editorData,
    elements: parseResult.elements,
    ...(pages ? { pages } : {}),
  };

  return {
    success: true,
    mode: "CODE_TO_VISUAL",
    appliedChangesCount: parseResult.elements.length > 0 ? parseResult.elements.length : 1,
    conflicts: [],
    diagnostics: parseResult.diagnostics,
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
  parseSourceCodeToElements,
  validateSourceSyntax,
  detectUnsupportedConstructs,
  hashEditorData,
};
