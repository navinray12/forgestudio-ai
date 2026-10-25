/**
 * Types used by the Developer Workspace project API (re-exported from forgeProjectService.ts).
 * Moved verbatim from forgeProjectService.ts.
 */
export interface SyncDiagnostic {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  filePath?: string;
  line?: number;
  col?: number;
  suggestedAction?: string;
}

export type CodeSyncStatus =
  | "synced"
  | "unchanged"
  | "not-a-page"
  | "unsupported"
  | "invalid"
  | "conflict"
  | "reverted"
  | "error";

/** Outcome of reconciling a saved source file with the visual document */
export interface CodeSyncResult {
  success: boolean;
  status?: CodeSyncStatus;
  message?: string;
  page?: ProjectPage;
  appliedChangesCount: number;
  conflicts: Array<{ filePath: string; reason: string }>;
  diagnostics: SyncDiagnostic[];
  /** Paths whose persisted content changed because of the sync */
  updatedFiles: string[];
  documentVersion?: number;
}

export interface ProjectPage {
  key: string;
  pageId: string | null;
  name: string;
  title: string;
  routePath: string;
  filePath: string;
  componentName: string;
  isHome: boolean;
  fileExists?: boolean;
  ownership?: "generated" | "code" | "missing";
  sync?: { status: string; message?: string; diagnostics?: SyncDiagnostic[]; updatedAt?: string } | null;
}

export interface VisualSyncState {
  synced: boolean;
  stale: boolean;
  error?: string;
  /** Page files that kept hand-written code instead of the latest visual design */
  conflicts?: string[];
}

export interface PageMutationResult {
  success: boolean;
  message?: string;
  code?: string;
  page?: ProjectPage | null;
  pages?: ProjectPage[];
  visualSync?: VisualSyncState;
  preservedFile?: string;
  diagnostics?: SyncDiagnostic[];
}

export interface SourcePreview {
  success: boolean;
  html: string;
  framework: "react" | "nextjs";
  route: string;
  routes: string[];
  errors: Array<{ file?: string; line?: number; column?: number; message: string }>;
  warnings: string[];
  mode: "local" | "cdn";
  sourceHash: string;
}

export interface ForgeProject {
  /** Present when opened through a website: whether source was regenerated from the saved design */
  visualSync?: VisualSyncState;
  id: string;
  slug: string;
  name: string;
  description?: string;
  projectType: string;
  lifecycleStatus: string;
  websiteId?: string;
  workspaceId?: string;
  organizationId?: string;
  framework: string;
  frameworkVersion: string;
  runtime: string;
  runtimeVersion: string;
  packageManager: string;
  language: string;
  capabilities: Record<string, boolean>;
  settings: Record<string, any>;
  compatibility: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface FileTreeNode {
  id: string;
  path: string;
  name: string;
  extension: string;
  isDirectory: boolean;
  sizeBytes: number;
  version: number;
  isGenerated: boolean;
  isProtected: boolean;
  children?: FileTreeNode[];
}

export interface ProjectFile {
  id: string;
  projectId: string;
  path: string;
  name: string;
  extension: string;
  mimeType: string;
  isDirectory: boolean;
  sizeBytes: number;
  content?: string;
  encoding: string;
  contentHash: string;
  version: number;
  isGenerated: boolean;
  isProtected: boolean;
  createdAt: string;
  updatedAt: string;
}

export type VisualPropValue = string | number | boolean;

/** Mirrors JsxMutation in backend/src/services/compiler/jsxAstMutation.ts. */
export type VisualSourceMutation =
  | { type: "SET_TEXT"; text: string }
  | { type: "SET_PROP"; name: string; value: VisualPropValue | null }
  | { type: "SET_CLASSES"; classes?: string[]; add?: string[]; remove?: string[] }
  | { type: "SET_STYLE"; style: Record<string, string | number | null> }
  | {
      type: "INSERT";
      parentId: string;
      index?: number;
      element: { tag: string; text?: string; classes?: string[]; props?: Record<string, VisualPropValue>; style?: Record<string, string | number> };
    }
  | { type: "REMOVE" }
  | { type: "REORDER"; index: number }
  | { type: "MOVE"; parentId: string; index?: number };

export interface VisualSourceSyncResult {
  success: boolean;
  updated: boolean;
  code?: string;
  diagnostics: Array<{ severity: string; code: string; message: string; filePath?: string }>;
  content: string;
  version?: number;
  changedRange?: { startLine: number; endLine: number };
}
