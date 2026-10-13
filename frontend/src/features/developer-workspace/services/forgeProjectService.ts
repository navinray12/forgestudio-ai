import { downloadAuthenticatedFile } from "../../../utils/downloadFile";
import type { CanvasEditPlan } from "./canvasSourceSync";

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/v1/projects`;

async function request<T>(endpoint: string, options: RequestInit & { allowFailure?: boolean } = {}): Promise<T> {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const contentType = res.headers.get("content-type") || "";
  let data: any = null;

  if (contentType.includes("json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  // Some operations report a structured, non-successful outcome (diagnostics,
  // conflicts) that the caller needs in full rather than as a thrown message
  if (options.allowFailure && data && typeof data === "object") {
    return data;
  }

  if (!res.ok || (data && data.success === false)) {
    const errorMsg =
      data?.error?.message ||
      data?.detail ||
      data?.message ||
      `Request failed with status ${res.status} (${res.statusText})`;
    throw new Error(errorMsg);
  }

  if (!data) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Server returned non-JSON response (${res.status} ${res.statusText})`);
  }

  return data;
}

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

type VisualPropValue = string | number | boolean;

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

export const forgeProjectService = {
  // Project Model
  async createProject(payload: {
    name: string;
    slug?: string;
    description?: string;
    projectType?: string;
    websiteId?: string;
    workspaceId?: string;
    frameworkMeta?: any;
    capabilities?: any;
  }): Promise<{ project: ForgeProject }> {
    return request<{ project: ForgeProject }>("", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getProject(projectId: string): Promise<{ project: ForgeProject }> {
    return request<{ project: ForgeProject }>(`/${projectId}`);
  },

  async getProjectByWebsite(websiteId: string): Promise<{ project: ForgeProject }> {
    return request<{ project: ForgeProject }>(`/website/${websiteId}`);
  },

  async listProjects(params: { workspaceId?: string; status?: string } = {}): Promise<{
    items: ForgeProject[];
    total: number;
  }> {
    const q = new URLSearchParams();
    if (params.workspaceId) q.append("workspaceId", params.workspaceId);
    if (params.status) q.append("status", params.status);
    return request(`?${q.toString()}`);
  },

  async updateProject(
    projectId: string,
    updates: Partial<ForgeProject> & { frameworkMeta?: any }
  ): Promise<{ project: ForgeProject }> {
    return request<{ project: ForgeProject }>(`/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  async transitionLifecycle(
    projectId: string,
    status: string
  ): Promise<{ project: ForgeProject }> {
    return request<{ project: ForgeProject }>(`/${projectId}/lifecycle`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  },

  async cloneProject(
    projectId: string,
    overrides?: { name?: string; slug?: string }
  ): Promise<{ project: ForgeProject }> {
    return request<{ project: ForgeProject }>(`/${projectId}/clone`, {
      method: "POST",
      body: JSON.stringify(overrides || {}),
    });
  },

  // Persistent Filesystem
  async getFileTree(projectId: string, includeIgnored = false): Promise<{ tree: FileTreeNode[] }> {
    return request<{ tree: FileTreeNode[] }>(`/${projectId}/files?includeIgnored=${includeIgnored}`);
  },

  async readFile(projectId: string, filePath: string): Promise<{ file: ProjectFile }> {
    return request<{ file: ProjectFile }>(`/${projectId}/files/content?path=${encodeURIComponent(filePath)}`);
  },

  async writeFile(
    projectId: string,
    filePath: string,
    payload: {
      content: string;
      encoding?: string;
      expectedVersion?: number;
      isProtected?: boolean;
      reason?: string;
    }
  ): Promise<{
    file: ProjectFile;
    sync?: CodeSyncResult | null;
    checkpoint?: { id: string; sequence: number; kind: string };
    replayed?: boolean;
  }> {
    // One change-set id per save. If the response is lost (network error), the save is retried
    // once with the same id and the server returns the already-committed result instead of
    // writing again. HTTP errors such as 409 conflicts are not retried.
    const changeSetId = crypto.randomUUID();
    const send = () =>
      request<{ file: ProjectFile; sync?: CodeSyncResult | null; checkpoint?: { id: string; sequence: number; kind: string }; replayed?: boolean }>(
        `/${projectId}/files`,
        {
          method: "POST",
          headers: { "Idempotency-Key": changeSetId },
          body: JSON.stringify({ path: filePath, ...payload }),
        }
      );
    try {
      return await send();
    } catch (err) {
      if (err instanceof TypeError) return send();
      throw err;
    }
  },

  async deleteFile(projectId: string, filePath: string): Promise<{ success: boolean; path: string }> {
    return request<{ success: boolean; path: string }>(`/${projectId}/files`, {
      method: "DELETE",
      body: JSON.stringify({ path: filePath }),
    });
  },

  async moveFile(
    projectId: string,
    sourcePath: string,
    destPath: string
  ): Promise<{ file: ProjectFile }> {
    return request<{ file: ProjectFile }>(`/${projectId}/files/move`, {
      method: "POST",
      body: JSON.stringify({ sourcePath, destPath }),
    });
  },

  async getFileRevisions(projectId: string, fileId: string): Promise<{ revisions: any[] }> {
    return request<{ revisions: any[] }>(`/${projectId}/files/${fileId}/revisions`);
  },

  async createSnapshot(
    projectId: string,
    payload: { name: string; description?: string }
  ): Promise<{ snapshot: any }> {
    return request<{ snapshot: any }>(`/${projectId}/snapshots`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listSnapshots(projectId: string): Promise<{ snapshots: any[] }> {
    return request<{ snapshots: any[] }>(`/${projectId}/snapshots`);
  },

  // Project Manifest
  async getManifest(projectId: string): Promise<{ manifest: any; diagnostics: any[] }> {
    return request<{ manifest: any; diagnostics: any[] }>(`/${projectId}/manifest`);
  },

  async updateManifest(
    projectId: string,
    manifest: any
  ): Promise<{ manifest: any; diagnostics: any[] }> {
    return request<{ manifest: any; diagnostics: any[] }>(`/${projectId}/manifest`, {
      method: "PUT",
      body: JSON.stringify(manifest),
    });
  },

  // Compiler & Visual ↔ Code Sync
  async compileProject(
    projectId: string,
    editorData?: any
  ): Promise<{ result: any }> {
    return request<{ result: any }>(`/${projectId}/compile`, {
      method: "POST",
      body: JSON.stringify({ editorData }),
    });
  },

  /**
   * Applies one visual edit to an element of a source file. A rejected edit (HTTP 422) resolves
   * with `success: false` and its diagnostics; `updated` is true only when the file changed.
   */
  async syncVisualToCode(
    projectId: string,
    filePath: string,
    element: { id: string; textContent?: string; content?: string; buttonText?: string },
    options: { mutation?: VisualSourceMutation; expectedRevision?: number } = {}
  ): Promise<VisualSourceSyncResult> {
    return request<VisualSourceSyncResult>(`/${projectId}/sync/visual-to-code`, {
      method: "POST",
      body: JSON.stringify({ filePath, element, ...options }),
      allowFailure: true,
    });
  },

  /**
   * The element edits that carry a canvas change (visual document before/after) into the
   * project's hand-written page files. Read-only; apply the edits with `syncVisualToCode`.
   */
  async planVisualToCode(
    projectId: string,
    body: { before: unknown; after: unknown; paths?: string[] }
  ): Promise<CanvasEditPlan> {
    return request<CanvasEditPlan>(`/${projectId}/sync/visual-to-code/plan`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /**
   * Reconcile a saved source file into the visual document. `resolve` settles a
   * reported conflict by keeping the code or the visual version.
   */
  async syncCodeToVisual(
    projectId: string,
    filePath: string,
    resolve?: "code" | "visual"
  ): Promise<CodeSyncResult> {
    const result = await request<CodeSyncResult & { message?: string }>(
      `/${projectId}/sync/code-to-visual`,
      {
        method: "POST",
        body: JSON.stringify({ filePath, resolve }),
        allowFailure: true,
      }
    );
    // A transport-level failure has no sync status
    if (!result.status) throw new Error(result.message || "Synchronisation failed");
    return result;
  },

  // Visual pages: the registry behind routes, page files and the Visual Editor page list
  async listPages(projectId: string): Promise<{ pages: ProjectPage[] }> {
    return request<{ pages: ProjectPage[] }>(`/${projectId}/pages`);
  },

  async createPage(
    projectId: string,
    payload: { name: string; route?: string; sourcePath?: string }
  ): Promise<PageMutationResult> {
    return request<PageMutationResult>(`/${projectId}/pages`, {
      method: "POST",
      body: JSON.stringify(payload),
      allowFailure: true,
    });
  },

  async updatePage(
    projectId: string,
    pageKey: string,
    payload: { name?: string; route?: string }
  ): Promise<PageMutationResult> {
    return request<PageMutationResult>(`/${projectId}/pages/${encodeURIComponent(pageKey)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      allowFailure: true,
    });
  },

  async deletePage(projectId: string, pageKey: string): Promise<PageMutationResult> {
    return request<PageMutationResult>(`/${projectId}/pages/${encodeURIComponent(pageKey)}`, {
      method: "DELETE",
      allowFailure: true,
    });
  },

  /** A runnable document built from the project's persisted source files */
  async getSourcePreview(projectId: string, route = "/"): Promise<{ preview: SourcePreview }> {
    return request<{ preview: SourcePreview }>(
      `/${projectId}/preview/source?route=${encodeURIComponent(route)}`
    );
  },

  // Workspace Layout & State
  async getWorkspaceState(projectId: string): Promise<{ state: any }> {
    return request<{ state: any }>(`/${projectId}/workspace-state`);
  },

  async saveWorkspaceState(
    projectId: string,
    payload: { layout?: any; preferences?: any }
  ): Promise<{ state: any }> {
    return request<{ state: any }>(`/${projectId}/workspace-state`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  // Module 10: Dependency Manager
  async getDependencies(projectId: string): Promise<{ analysis: any }> {
    return request<{ analysis: any }>(`/${projectId}/dependencies`);
  },

  async installDependency(
    projectId: string,
    payload: { name: string; version?: string; isDev?: boolean; isExact?: boolean }
  ): Promise<{ success: boolean; package: string; version: string; packageManager: string }> {
    return request(`/${projectId}/dependencies/install`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async removeDependency(
    projectId: string,
    name: string
  ): Promise<{ success: boolean; package: string }> {
    return request(`/${projectId}/dependencies/remove`, {
      method: "DELETE",
      body: JSON.stringify({ name }),
    });
  },

  async explainDependencyFailure(
    projectId: string,
    errorMessage: string
  ): Promise<{ diagnosis: string; probableCause: string; recommendedActions: string[] }> {
    return request(`/${projectId}/dependencies/explain-ai`, {
      method: "POST",
      body: JSON.stringify({ errorMessage }),
    });
  },

  // Module 11: Sandbox / Runtime
  async getRuntimeStatus(projectId: string): Promise<{ runtime: any }> {
    return request<{ runtime: any }>(`/${projectId}/runtime/status`);
  },

  async executeSandboxCommand(
    projectId: string,
    payload: { command: string; args?: string[]; cwd?: string; env?: any; secrets?: string[] }
  ): Promise<{
    processId: string;
    exitCode: number;
    stdout: string;
    stderr: string;
    discoveredPort?: number;
    durationMs: number;
  }> {
    return request(`/${projectId}/runtime/execute`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async stopSandboxProcess(
    projectId: string,
    processId: string
  ): Promise<{ success: boolean; processId: string }> {
    return request(`/${projectId}/runtime/stop`, {
      method: "POST",
      body: JSON.stringify({ processId }),
    });
  },

  // Module 12: Build System
  async triggerBuild(
    projectId: string,
    payload: { buildMode?: "development" | "production"; trigger?: string } = {}
  ): Promise<{ result: any }> {
    return request<{ result: any }>(`/${projectId}/builds`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listBuilds(projectId: string): Promise<{ builds: any[] }> {
    return request<{ builds: any[] }>(`/${projectId}/builds`);
  },

  // Module 13: Live Preview
  async createPreviewSession(
    projectId: string,
    payload: { viewport?: any; route?: string } = {}
  ): Promise<{ session: any }> {
    return request<{ session: any }>(`/${projectId}/preview/session`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updatePreviewViewport(
    projectId: string,
    sessionToken: string,
    viewport: any
  ): Promise<{ session: any }> {
    return request<{ session: any }>(`/${projectId}/preview/session/${sessionToken}/viewport`, {
      method: "PATCH",
      body: JSON.stringify({ viewport }),
    });
  },

  async logPreviewConsole(
    projectId: string,
    sessionToken: string,
    message: { type: string; text: string; sourceFile?: string; lineNumber?: number }
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/preview/session/${sessionToken}/console`, {
      method: "POST",
      body: JSON.stringify(message),
    });
  },

  // Module 14: Terminal
  async createTerminalSession(
    projectId: string,
    name?: string
  ): Promise<{ session: any }> {
    return request<{ session: any }>(`/${projectId}/terminal/sessions`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  async executeTerminalCommand(
    projectId: string,
    sessionId: string,
    command: string,
    confirmedByUser = false
  ): Promise<{
    sessionId: string;
    command: string;
    exitCode: number;
    output: string;
    durationMs: number;
    requiresConfirmation?: boolean;
    confirmationReason?: string;
  }> {
    return request(`/${projectId}/terminal/sessions/${sessionId}/execute`, {
      method: "POST",
      body: JSON.stringify({ command, confirmedByUser }),
    });
  },

  async getTerminalTasks(projectId: string): Promise<{ tasks: Array<{ name: string; command: string }> }> {
    return request<{ tasks: Array<{ name: string; command: string }> }>(`/${projectId}/terminal/tasks`);
  },

  // Module 15: Debugging
  async startDebugSession(
    projectId: string,
    target?: "client" | "server" | "fullstack"
  ): Promise<{ session: any }> {
    return request<{ session: any }>(`/${projectId}/debug/session`, {
      method: "POST",
      body: JSON.stringify({ target }),
    });
  },

  async setBreakpoint(
    projectId: string,
    sessionId: string,
    breakpoint: { file: string; line: number; condition?: string }
  ): Promise<{ breakpoint: any }> {
    return request<{ breakpoint: any }>(`/${projectId}/debug/session/${sessionId}/breakpoints`, {
      method: "POST",
      body: JSON.stringify(breakpoint),
    });
  },

  async removeBreakpoint(
    projectId: string,
    sessionId: string,
    bpId: string
  ): Promise<{ removed: boolean }> {
    return request<{ removed: boolean }>(`/${projectId}/debug/session/${sessionId}/breakpoints/${bpId}`, {
      method: "DELETE",
    });
  },

  async stepDebug(
    projectId: string,
    sessionId: string
  ): Promise<{ session: any }> {
    return request<{ session: any }>(`/${projectId}/debug/session/${sessionId}/step`, {
      method: "POST",
    });
  },

  async askAiDebug(
    projectId: string,
    sessionId: string,
    payload: { errorMessage: string; sourceFile?: string; line?: number }
  ): Promise<{
    analysis: string;
    rootCause: string;
    suggestedPatch: { file: string; line: number; originalCode: string; replacementCode: string };
    confidence: string;
  }> {
    return request(`/${projectId}/debug/session/${sessionId}/ask-ai`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Modules 08 & 09: React & Next.js Project Generators
  async generateReactProject(
    projectId: string,
    options?: any
  ): Promise<{ success: boolean; result: any }> {
    return request<{ success: boolean; result: any }>(`/${projectId}/generate/react`, {
      method: "POST",
      body: JSON.stringify({ options }),
    });
  },

  async generateNextJsProject(
    projectId: string,
    options?: any
  ): Promise<{ success: boolean; result: any }> {
    return request<{ success: boolean; result: any }>(`/${projectId}/generate/next`, {
      method: "POST",
      body: JSON.stringify({ options }),
    });
  },

  /** Download the project's persisted source files (including manual edits) as a ZIP */
  async exportProjectZip(projectId: string, fallbackName: string): Promise<string> {
    return downloadAuthenticatedFile(`${API_BASE}/${projectId}/export/zip`, `${fallbackName}.zip`);
  },

  async getGenerationPlan(
    projectId: string,
    framework: "react" | "nextjs"
  ): Promise<{ success: boolean; plan: any }> {
    return request<{ success: boolean; plan: any }>(`/${projectId}/generate/plan?framework=${framework}`);
  },

  async regenerateScope(
    projectId: string,
    framework: "react" | "nextjs",
    scope: { type: "full" | "page" | "component" | "route"; targetId?: string; targetPath?: string }
  ): Promise<{ success: boolean; result: any }> {
    return request<{ success: boolean; result: any }>(`/${projectId}/generate/scope`, {
      method: "POST",
      body: JSON.stringify({ framework, scope }),
    });
  },

  // Module 29: Source-Based Hosting
  async detectRuntime(projectId: string): Promise<{ success: boolean; runtime: any }> {
    return request<{ success: boolean; runtime: any }>(`/${projectId}/runtime/detect`);
  },

  async createDeployment(
    projectId: string,
    payload: {
      environment?: "preview" | "staging" | "production" | "development";
      branch?: string;
      commitHash?: string;
      config?: Record<string, any>;
      skipHealthCheck?: boolean;
    }
  ): Promise<{ success: boolean; deployment: any }> {
    return request<{ success: boolean; deployment: any }>(`/${projectId}/deployments`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listDeployments(
    projectId: string,
    environment?: string
  ): Promise<{ success: boolean; deployments: any[] }> {
    const query = environment ? `?environment=${environment}` : "";
    return request<{ success: boolean; deployments: any[] }>(`/${projectId}/deployments${query}`);
  },

  async getDeployment(
    projectId: string,
    deploymentId: string
  ): Promise<{ success: boolean; deployment: any }> {
    return request<{ success: boolean; deployment: any }>(`/${projectId}/deployments/${deploymentId}`);
  },

  async promoteDeployment(
    projectId: string,
    payload: { sourceDeploymentId: string; targetEnvironment: "staging" | "production" }
  ): Promise<{ success: boolean; deployment: any }> {
    return request<{ success: boolean; deployment: any }>(`/${projectId}/deployments/promote`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async rollbackDeployment(
    projectId: string,
    payload: { targetDeploymentId?: string; targetEnvironment: "preview" | "staging" | "production" }
  ): Promise<{ success: boolean; deployment: any }> {
    return request<{ success: boolean; deployment: any }>(`/${projectId}/deployments/rollback`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async executeDeploymentHealthCheck(
    projectId: string,
    deploymentId: string
  ): Promise<{ success: boolean; healthCheck: any }> {
    return request<{ success: boolean; healthCheck: any }>(`/${projectId}/deployments/${deploymentId}/health`, {
      method: "POST",
    });
  },

  // Module 30: CI/CD Pipelines
  async createPipelineRun(
    projectId: string,
    payload?: {
      trigger?: "push" | "pull_request" | "manual" | "schedule";
      environment?: "preview" | "staging" | "production";
      branch?: string;
      commitHash?: string;
      requireApproval?: boolean;
    }
  ): Promise<{ success: boolean; pipeline: any }> {
    return request<{ success: boolean; pipeline: any }>(`/${projectId}/pipelines`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },

  async listPipelines(projectId: string): Promise<{ success: boolean; pipelines: any[] }> {
    return request<{ success: boolean; pipelines: any[] }>(`/${projectId}/pipelines`);
  },

  async getPipeline(
    projectId: string,
    pipelineId: string
  ): Promise<{ success: boolean; pipeline: any }> {
    return request<{ success: boolean; pipeline: any }>(`/${projectId}/pipelines/${pipelineId}`);
  },

  async approvePipelineGate(
    projectId: string,
    pipelineId: string,
    notes?: string
  ): Promise<{ success: boolean; pipeline: any }> {
    return request<{ success: boolean; pipeline: any }>(`/${projectId}/pipelines/${pipelineId}/approve`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    });
  },

  async rerunPipeline(
    projectId: string,
    pipelineId: string
  ): Promise<{ success: boolean; pipeline: any }> {
    return request<{ success: boolean; pipeline: any }>(`/${projectId}/pipelines/${pipelineId}/rerun`, {
      method: "POST",
    });
  },

  async cancelPipeline(
    projectId: string,
    pipelineId: string
  ): Promise<{ success: boolean; pipeline: any }> {
    return request<{ success: boolean; pipeline: any }>(`/${projectId}/pipelines/${pipelineId}/cancel`, {
      method: "POST",
    });
  },

  // Module 31: GoDaddy & Custom Domain Automation
  async checkDomainAvailability(domain: string): Promise<{ success: boolean; availability: any }> {
    return request<{ success: boolean; availability: any }>(`/domains/availability?domain=${encodeURIComponent(domain)}`);
  },

  async connectDomain(
    projectId: string,
    payload: {
      domain: string;
      provider?: "godaddy" | "manual";
      environment?: "preview" | "staging" | "production";
      autoRenew?: boolean;
    }
  ): Promise<{ success: boolean; customDomain: any }> {
    return request<{ success: boolean; customDomain: any }>(`/${projectId}/domains/connect`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listDomains(projectId: string): Promise<{ success: boolean; domains: any[] }> {
    return request<{ success: boolean; domains: any[] }>(`/${projectId}/domains`);
  },

  async configureDomainDns(
    projectId: string,
    domainId: string,
    options?: { preserveExisting?: boolean }
  ): Promise<{ success: boolean; result: any }> {
    return request<{ success: boolean; result: any }>(`/${projectId}/domains/${domainId}/dns/configure`, {
      method: "POST",
      body: JSON.stringify(options || {}),
    });
  },

  async verifyDomainOwnership(
    projectId: string,
    domainId: string
  ): Promise<{ success: boolean; verified: boolean; domain?: any; result?: any }> {
    return request<{ success: boolean; verified: boolean; domain?: any; result?: any }>(`/${projectId}/domains/${domainId}/verify`, {
      method: "POST",
    });
  },

  async bindDomainDeployment(
    projectId: string,
    domainId: string,
    deploymentId: string
  ): Promise<{ success: boolean; customDomain: any }> {
    return request<{ success: boolean; customDomain: any }>(`/${projectId}/domains/${domainId}/bind`, {
      method: "POST",
      body: JSON.stringify({ deploymentId }),
    });
  },

  async detachDomain(
    projectId: string,
    domainId: string
  ): Promise<{ success: boolean; result: any }> {
    return request<{ success: boolean; result: any }>(`/${projectId}/domains/${domainId}`, {
      method: "DELETE",
    });
  },

  // Module 16: Local Version-Control & Git Engine
  async initGit(projectId: string, initialBranch = "main"): Promise<{ success: boolean; repository: any }> {
    return request<{ success: boolean; repository: any }>(`/${projectId}/git/init`, {
      method: "POST",
      body: JSON.stringify({ initialBranch }),
    });
  },

  async getGitStatus(projectId: string): Promise<{ success: boolean; status: any }> {
    return request<{ success: boolean; status: any }>(`/${projectId}/git/status`);
  },

  async stageGitFiles(projectId: string, paths: string[] | "all"): Promise<{ success: boolean; status: any }> {
    return request<{ success: boolean; status: any }>(`/${projectId}/git/stage`, {
      method: "POST",
      body: JSON.stringify({ paths }),
    });
  },

  async unstageGitFiles(projectId: string, paths: string[] | "all"): Promise<{ success: boolean; status: any }> {
    return request<{ success: boolean; status: any }>(`/${projectId}/git/unstage`, {
      method: "POST",
      body: JSON.stringify({ paths }),
    });
  },

  async commitGit(
    projectId: string,
    payload: { message: string; author?: { name: string; email: string } }
  ): Promise<{ success: boolean; commit: any }> {
    return request<{ success: boolean; commit: any }>(`/${projectId}/git/commit`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listGitBranches(projectId: string): Promise<{ success: boolean; branches: any[] }> {
    return request<{ success: boolean; branches: any[] }>(`/${projectId}/git/branches`);
  },

  async createGitBranch(
    projectId: string,
    payload: { name: string; startPoint?: string }
  ): Promise<{ success: boolean; branch: any }> {
    return request<{ success: boolean; branch: any }>(`/${projectId}/git/branches`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async switchGitBranch(
    projectId: string,
    payload: { name: string; createIfMissing?: boolean }
  ): Promise<{ success: boolean; branch: string; headCommit: string }> {
    return request<{ success: boolean; branch: string; headCommit: string }>(`/${projectId}/git/branches/switch`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async deleteGitBranch(
    projectId: string,
    branchName: string,
    force = false
  ): Promise<{ success: boolean; deletedBranch: string }> {
    return request<{ success: boolean; deletedBranch: string }>(`/${projectId}/git/branches/${encodeURIComponent(branchName)}?force=${force}`, {
      method: "DELETE",
    });
  },

  async getGitDiff(
    projectId: string,
    options?: { staged?: boolean; filePath?: string }
  ): Promise<{ success: boolean; diff: any[] }> {
    const params = new URLSearchParams();
    if (options?.staged) params.append("staged", "true");
    if (options?.filePath) params.append("filePath", options.filePath);
    const query = params.toString() ? `?${params.toString()}` : "";
    return request<{ success: boolean; diff: any[] }>(`/${projectId}/git/diff${query}`);
  },

  async getGitHistory(
    projectId: string,
    options?: { filePath?: string; limit?: number }
  ): Promise<{ success: boolean; history: any[] }> {
    const params = new URLSearchParams();
    if (options?.filePath) params.append("filePath", options.filePath);
    if (options?.limit) params.append("limit", String(options.limit));
    const query = params.toString() ? `?${params.toString()}` : "";
    return request<{ success: boolean; history: any[] }>(`/${projectId}/git/history${query}`);
  },

  async mergeGitBranch(
    projectId: string,
    payload: { sourceBranch: string; noFastForward?: boolean }
  ): Promise<{ success: boolean; status: string; mergeCommit?: any; conflicts?: string[] }> {
    return request<{ success: boolean; status: string; mergeCommit?: any; conflicts?: string[] }>(`/${projectId}/git/merge`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async resolveGitConflict(
    projectId: string,
    payload: { filePath: string; resolution: "ours" | "theirs" | "manual"; manualContent?: string }
  ): Promise<{ success: boolean; filePath: string }> {
    return request<{ success: boolean; filePath: string }>(`/${projectId}/git/conflicts/resolve`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async abortGitMerge(projectId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/git/merge/abort`, {
      method: "POST",
    });
  },

  async rebaseGit(
    projectId: string,
    payload: { upstreamBranch: string; force?: boolean }
  ): Promise<{ success: boolean; currentCommit: string }> {
    return request<{ success: boolean; currentCommit: string }>(`/${projectId}/git/rebase`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listGitStashes(projectId: string): Promise<{ success: boolean; stashes: any[] }> {
    return request<{ success: boolean; stashes: any[] }>(`/${projectId}/git/stashes`);
  },

  async createGitStash(projectId: string, message?: string): Promise<{ success: boolean; stash: any }> {
    return request<{ success: boolean; stash: any }>(`/${projectId}/git/stashes`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  },

  async applyGitStash(projectId: string, index = 0, drop = false): Promise<{ success: boolean; appliedIndex: number }> {
    return request<{ success: boolean; appliedIndex: number }>(`/${projectId}/git/stashes/${index}/apply`, {
      method: "POST",
      body: JSON.stringify({ drop }),
    });
  },

  async dropGitStash(projectId: string, index = 0): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/git/stashes/${index}`, {
      method: "DELETE",
    });
  },

  async cherryPickGit(projectId: string, commitHash: string): Promise<{ success: boolean; commit: any }> {
    return request<{ success: boolean; commit: any }>(`/${projectId}/git/cherry-pick`, {
      method: "POST",
      body: JSON.stringify({ commitHash }),
    });
  },

  async listGitTags(projectId: string): Promise<{ success: boolean; tags: any[] }> {
    return request<{ success: boolean; tags: any[] }>(`/${projectId}/git/tags`);
  },

  async createGitTag(
    projectId: string,
    payload: { name: string; commitHash?: string; message?: string }
  ): Promise<{ success: boolean; tag: any }> {
    return request<{ success: boolean; tag: any }>(`/${projectId}/git/tags`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async deleteGitTag(projectId: string, name: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/git/tags/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  },

  async getGitGraph(projectId: string, limit = 50): Promise<{ success: boolean; graph: any[] }> {
    return request<{ success: boolean; graph: any[] }>(`/${projectId}/git/graph?limit=${limit}`);
  },

  // Module 17: Native GitHub Integration
  async connectGithub(
    projectId: string,
    payload: { repoOwner: string; repoName: string; defaultBranch?: string; token?: string }
  ): Promise<{ success: boolean; connection: any }> {
    return request<{ success: boolean; connection: any }>(`/${projectId}/github/connect`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async importGithub(
    payload: { repoUrl: string; projectName?: string; defaultBranch?: string; token?: string }
  ): Promise<{ success: boolean; project: any; connection: any }> {
    return request<{ success: boolean; project: any; connection: any }>(`/github/import`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async createGithubRepo(
    projectId: string,
    payload: { name: string; description?: string; isPrivate?: boolean; defaultBranch?: string }
  ): Promise<{ success: boolean; connection: any }> {
    return request<{ success: boolean; connection: any }>(`/${projectId}/github/create-repo`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async fetchGithubRemote(projectId: string): Promise<{ success: boolean; branchesUpdated: number }> {
    return request<{ success: boolean; branchesUpdated: number }>(`/${projectId}/github/fetch`, {
      method: "POST",
    });
  },

  async pullGithubRemote(
    projectId: string,
    branch?: string
  ): Promise<{ success: boolean; status: string }> {
    return request<{ success: boolean; status: string }>(`/${projectId}/github/pull`, {
      method: "POST",
      body: JSON.stringify({ branch }),
    });
  },

  async pushGithubRemote(
    projectId: string,
    payload?: { branch?: string; force?: boolean }
  ): Promise<{ success: boolean; pushedBranch: string; newRemoteHead: string }> {
    return request<{ success: boolean; pushedBranch: string; newRemoteHead: string }>(`/${projectId}/github/push`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },

  async syncGithubBranch(
    projectId: string,
    branch?: string
  ): Promise<{ success: boolean; sync: any }> {
    const query = branch ? `?branch=${encodeURIComponent(branch)}` : "";
    return request<{ success: boolean; sync: any }>(`/${projectId}/github/sync${query}`);
  },

  async createGithubPr(
    projectId: string,
    payload: { title: string; body?: string; sourceBranch: string; targetBranch?: string; issueNumber?: number }
  ): Promise<{ success: boolean; pullRequest: any }> {
    return request<{ success: boolean; pullRequest: any }>(`/${projectId}/github/pulls`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listGithubPrs(
    projectId: string,
    status?: "OPEN" | "MERGED" | "CLOSED"
  ): Promise<{ success: boolean; pullRequests: any[] }> {
    const query = status ? `?status=${status}` : "";
    return request<{ success: boolean; pullRequests: any[] }>(`/${projectId}/github/pulls${query}`);
  },

  async getGithubPrDetails(
    projectId: string,
    prNumber: number
  ): Promise<{ success: boolean; pullRequest: any }> {
    return request<{ success: boolean; pullRequest: any }>(`/${projectId}/github/pulls/${prNumber}`);
  },

  async updateGithubPr(
    projectId: string,
    prNumber: number,
    updates: { title?: string; body?: string; status?: "OPEN" | "MERGED" | "CLOSED" }
  ): Promise<{ success: boolean; pullRequest: any }> {
    return request<{ success: boolean; pullRequest: any }>(`/${projectId}/github/pulls/${prNumber}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  async getGithubChecks(
    projectId: string,
    commitHash: string
  ): Promise<{ success: boolean; commitHash: string; status: string; checks: any[]; actions: any[] }> {
    return request<{ success: boolean; commitHash: string; status: string; checks: any[]; actions: any[] }>(
      `/${projectId}/github/commits/${commitHash}/checks`
    );
  },

  // Module 18: Forge CLI Remote Automation
  async executeCli(
    payload: { args: string[]; cwd?: string; json?: boolean; nonInteractive?: boolean; projectId?: string }
  ): Promise<{ success: boolean; command: string; exitCode: number; stdout: string; stderr: string; data?: any }> {
    return request<{ success: boolean; command: string; exitCode: number; stdout: string; stderr: string; data?: any }>(
      `/cli/execute`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },

  // Module 19: AI Provider Gateway
  async completeAi(
    projectId: string,
    payload: { task: string; messages: any[]; model?: string; provider?: string }
  ): Promise<{ success: boolean; result: any }> {
    return request<{ success: boolean; result: any }>(`/${projectId}/ai/complete`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getAiModels(): Promise<{ success: boolean; models: any[] }> {
    return request<{ success: boolean; models: any[] }>(`/ai/models`);
  },

  async getAiHealth(): Promise<{ success: boolean; health: any[] }> {
    return request<{ success: boolean; health: any[] }>(`/ai/health`);
  },

  async getAiUsage(projectId: string): Promise<{ success: boolean; stats: any }> {
    return request<{ success: boolean; stats: any }>(`/${projectId}/ai/usage`);
  },

  // Module 23: AI Tool Execution
  async listAiTools(projectId: string, category?: string): Promise<{ success: boolean; tools: any[] }> {
    const query = category ? `?category=${category}` : "";
    return request<{ success: boolean; tools: any[] }>(`/${projectId}/ai/tools${query}`);
  },

  async executeAiTool(
    projectId: string,
    payload: { name: string; parameters: any; sessionId?: string }
  ): Promise<{ success: boolean; status: string; result?: any; approvalId?: string }> {
    return request<{ success: boolean; status: string; result?: any; approvalId?: string }>(
      `/${projectId}/ai/tools/execute`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },

  async resolveToolApproval(
    projectId: string,
    payload: { executionId: string; decision: "APPROVED" | "DENIED" }
  ): Promise<{ success: boolean; status: string; result?: any }> {
    return request<{ success: boolean; status: string; result?: any }>(`/${projectId}/ai/tools/approve`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Module 22: AI Coding Agent
  async createCodingSession(
    projectId: string,
    payload: { goal: string; targetFiles?: string[] }
  ): Promise<{ success: boolean; sessionId: string; status: string }> {
    return request<{ success: boolean; sessionId: string; status: string }>(`/${projectId}/ai/coding/session`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async generateCodingPlan(
    projectId: string,
    sessionId: string
  ): Promise<{ success: boolean; plan: any }> {
    return request<{ success: boolean; plan: any }>(`/${projectId}/ai/coding/plan`, {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });
  },

  async executeCodingPlan(
    projectId: string,
    sessionId: string,
    planId?: string
  ): Promise<{ success: boolean; modifiedFiles: string[]; buildStatus: string; diffSummary: any }> {
    return request<{ success: boolean; modifiedFiles: string[]; buildStatus: string; diffSummary: any }>(
      `/${projectId}/ai/coding/execute`,
      {
        method: "POST",
        body: JSON.stringify({ sessionId, planId }),
      }
    );
  },

  // Module 20: AI Creator
  async generateCreatorPlan(
    prompt: string,
    framework?: "react" | "nextjs"
  ): Promise<{ success: boolean; plan: any }> {
    return request<{ success: boolean; plan: any }>(`/ai/creator/plan`, {
      method: "POST",
      body: JSON.stringify({ prompt, framework }),
    });
  },

  async createFromPrompt(
    prompt: string,
    framework?: "react" | "nextjs"
  ): Promise<{ success: boolean; project: any; previewUrl: string; buildStatus: string }> {
    return request<{ success: boolean; project: any; previewUrl: string; buildStatus: string }>(
      `/ai/creator/generate`,
      {
        method: "POST",
        body: JSON.stringify({ prompt, framework }),
      }
    );
  },

  async regenerateCreatorSection(
    projectId: string,
    payload: { targetFilePath: string; instruction: string }
  ): Promise<{ success: boolean; filePath: string }> {
    return request<{ success: boolean; filePath: string }>(`/${projectId}/ai/creator/regenerate`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Module 21: AI Website Agent
  async auditWebsite(projectId: string): Promise<{ success: boolean; report: any }> {
    return request<{ success: boolean; report: any }>(`/${projectId}/ai/website/audit`);
  },

  async fixWebsiteFinding(
    projectId: string,
    findingId: string
  ): Promise<{ success: boolean; modifiedFile: string }> {
    return request<{ success: boolean; modifiedFile: string }>(`/${projectId}/ai/website/fix`, {
      method: "POST",
      body: JSON.stringify({ findingId }),
    });
  },

  // Module 24: Model Context Protocol (MCP)
  async listMcpServers(projectId: string): Promise<{ success: boolean; servers: any[] }> {
    return request<{ success: boolean; servers: any[] }>(`/${projectId}/mcp/servers`);
  },

  async registerMcpServer(
    projectId: string,
    payload: { name: string; endpoint: string; transport?: string; trustLevel?: string }
  ): Promise<{ success: boolean; server: any }> {
    return request<{ success: boolean; server: any }>(`/${projectId}/mcp/servers`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async invokeMcpTool(
    projectId: string,
    payload: { serverId: string; toolName: string; arguments: any }
  ): Promise<{ success: boolean; result: any }> {
    return request<{ success: boolean; result: any }>(`/${projectId}/mcp/invoke`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ========================================================
  // AI Engineering Platform (Modules 37–42)
  // ========================================================

  // Module 37: AI Context Engine
  async assembleContext(
    projectId: string,
    payload: {
      objective?: string;
      query?: string;
      files?: string[];
      contextProfile?: string;
      tokenBudget?: number;
    }
  ): Promise<{ success: boolean; snapshot: any }> {
    return request<{ success: boolean; snapshot: any }>(`/${projectId}/ai/context`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getContextSnapshot(
    projectId: string,
    snapshotId: string
  ): Promise<{ success: boolean; snapshot: any }> {
    return request<{ success: boolean; snapshot: any }>(`/${projectId}/ai/context/${snapshotId}`);
  },

  // Module 38: AI Project Memory
  async createMemory(
    projectId: string,
    payload: {
      type: string;
      title: string;
      content: string;
      severity?: string;
      tags?: string[];
      relatedFiles?: string[];
    }
  ): Promise<{ success: boolean; memory: any }> {
    return request<{ success: boolean; memory: any }>(`/${projectId}/ai/memories`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listMemories(
    projectId: string,
    filters: { type?: string; status?: string; severity?: string; q?: string } = {}
  ): Promise<{ success: boolean; memories: any[] }> {
    const params = new URLSearchParams();
    if (filters.type) params.append("type", filters.type);
    if (filters.status) params.append("status", filters.status);
    if (filters.severity) params.append("severity", filters.severity);
    if (filters.q) params.append("q", filters.q);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return request<{ success: boolean; memories: any[] }>(`/${projectId}/ai/memories${qs}`);
  },

  async updateMemory(
    projectId: string,
    memoryId: string,
    payload: any
  ): Promise<{ success: boolean; memory: any }> {
    return request<{ success: boolean; memory: any }>(`/${projectId}/ai/memories/${memoryId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async revokeMemory(
    projectId: string,
    memoryId: string,
    reason?: string
  ): Promise<{ success: boolean; memory: any }> {
    return request<{ success: boolean; memory: any }>(`/${projectId}/ai/memories/${memoryId}/revoke`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  // Module 39: AI Planning Agent
  async generateAiPlan(
    projectId: string,
    payload: { objective: string; targetFiles?: string[]; constraints?: string[] }
  ): Promise<{ success: boolean; plan: any }> {
    return request<{ success: boolean; plan: any }>(`/${projectId}/ai/plans`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getAiPlan(
    projectId: string,
    planId: string
  ): Promise<{ success: boolean; plan: any }> {
    return request<{ success: boolean; plan: any }>(`/${projectId}/ai/plans/${planId}`);
  },

  async approveAiPlan(
    projectId: string,
    planId: string
  ): Promise<{ success: boolean; plan: any }> {
    return request<{ success: boolean; plan: any }>(`/${projectId}/ai/plans/${planId}/approve`, {
      method: "POST",
    });
  },

  async rejectAiPlan(
    projectId: string,
    planId: string,
    reason: string
  ): Promise<{ success: boolean; plan: any }> {
    return request<{ success: boolean; plan: any }>(`/${projectId}/ai/plans/${planId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  // Module 40: AI Architecture Agent
  async analyzeArchitecture(
    projectId: string
  ): Promise<{ success: boolean; snapshot: any }> {
    return request<{ success: boolean; snapshot: any }>(`/${projectId}/ai/architecture/analyze`, {
      method: "POST",
    });
  },

  async getArchitectureSnapshot(
    projectId: string
  ): Promise<{ success: boolean; snapshot: any }> {
    return request<{ success: boolean; snapshot: any }>(`/${projectId}/ai/architecture/snapshot`);
  },

  async listArchitectureFindings(
    projectId: string
  ): Promise<{ success: boolean; findings: any[] }> {
    return request<{ success: boolean; findings: any[] }>(`/${projectId}/ai/architecture/findings`);
  },

  // Module 42: Agent Task / Run Manager
  async createAiTask(
    projectId: string,
    payload: { title: string; objective: string; priority?: string }
  ): Promise<{ success: boolean; task: any }> {
    return request<{ success: boolean; task: any }>(`/${projectId}/ai/tasks`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listAiTasks(
    projectId: string,
    status?: string
  ): Promise<{ success: boolean; tasks: any[] }> {
    const qs = status ? `?status=${status}` : "";
    return request<{ success: boolean; tasks: any[] }>(`/${projectId}/ai/tasks${qs}`);
  },

  async getAiTask(
    projectId: string,
    taskId: string
  ): Promise<{ success: boolean; task: any }> {
    return request<{ success: boolean; task: any }>(`/${projectId}/ai/tasks/${taskId}`);
  },

  async startAiRun(
    projectId: string,
    taskId: string
  ): Promise<{ success: boolean; run: any }> {
    return request<{ success: boolean; run: any }>(`/${projectId}/ai/tasks/${taskId}/run`, {
      method: "POST",
    });
  },

  async getAiRun(
    projectId: string,
    runId: string
  ): Promise<{ success: boolean; run: any }> {
    return request<{ success: boolean; run: any }>(`/${projectId}/ai/runs/${runId}`);
  },

  async pauseAiRun(
    projectId: string,
    runId: string
  ): Promise<{ success: boolean; run: any }> {
    return request<{ success: boolean; run: any }>(`/${projectId}/ai/runs/${runId}/pause`, {
      method: "POST",
    });
  },

  async resumeAiRun(
    projectId: string,
    runId: string
  ): Promise<{ success: boolean; run: any }> {
    return request<{ success: boolean; run: any }>(`/${projectId}/ai/runs/${runId}/resume`, {
      method: "POST",
    });
  },

  async cancelAiRun(
    projectId: string,
    runId: string
  ): Promise<{ success: boolean; run: any }> {
    return request<{ success: boolean; run: any }>(`/${projectId}/ai/runs/${runId}/cancel`, {
      method: "POST",
    });
  },

  async retryAiRun(
    projectId: string,
    runId: string
  ): Promise<{ success: boolean; run: any }> {
    return request<{ success: boolean; run: any }>(`/${projectId}/ai/runs/${runId}/retry`, {
      method: "POST",
    });
  },

  async compareAiRuns(
    projectId: string,
    runId: string,
    otherRunId: string
  ): Promise<{ success: boolean; comparison: any }> {
    return request<{ success: boolean; comparison: any }>(`/${projectId}/ai/runs/${runId}/compare/${otherRunId}`);
  },

  async getRunEvents(
    projectId: string,
    runId: string
  ): Promise<{ success: boolean; events: any[] }> {
    return request<{ success: boolean; events: any[] }>(`/${projectId}/ai/runs/${runId}/events`);
  },

  async listRunArtifacts(
    projectId: string,
    runId: string
  ): Promise<{ success: boolean; artifacts: any[] }> {
    return request<{ success: boolean; artifacts: any[] }>(`/${projectId}/ai/runs/${runId}/artifacts`);
  },

  // ==========================================
  // Forge Data Platform (Modules 25–28)
  // ==========================================

  // Module 25: Forge Database
  async getDatabase(projectId: string, environment = "development"): Promise<{ success: boolean; database: any }> {
    return request<{ success: boolean; database: any }>(`/${projectId}/database?environment=${environment}`);
  },

  async listDatabases(projectId: string): Promise<{ success: boolean; databases: any[] }> {
    return request<{ success: boolean; databases: any[] }>(`/${projectId}/database/list`);
  },

  async branchDatabase(
    projectId: string,
    parentEnv: string,
    branchName: string
  ): Promise<{ success: boolean; database: any }> {
    return request<{ success: boolean; database: any }>(`/${projectId}/database/branch`, {
      method: "POST",
      body: JSON.stringify({ parentEnv, branchName }),
    });
  },

  async listDatabaseTables(projectId: string, databaseId: string): Promise<{ success: boolean; tables: any[] }> {
    return request<{ success: boolean; tables: any[] }>(`/${projectId}/database/${databaseId}/tables`);
  },

  async getTableSchema(
    projectId: string,
    databaseId: string,
    tableName: string
  ): Promise<{ success: boolean; schema: any }> {
    return request<{ success: boolean; schema: any }>(`/${projectId}/database/${databaseId}/tables/${tableName}/schema`);
  },

  async createTable(
    projectId: string,
    databaseId: string,
    payload: any
  ): Promise<{ success: boolean; schema: any }> {
    return request<{ success: boolean; schema: any }>(`/${projectId}/database/${databaseId}/tables`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async alterTable(
    projectId: string,
    databaseId: string,
    tableName: string,
    payload: any
  ): Promise<{ success: boolean; schema: any }> {
    return request<{ success: boolean; schema: any }>(`/${projectId}/database/${databaseId}/tables/${tableName}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async dropTable(
    projectId: string,
    databaseId: string,
    tableName: string,
    confirmed = true
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/database/${databaseId}/tables/${tableName}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmed }),
    });
  },

  async introspectDatabaseSchema(
    projectId: string,
    databaseId: string
  ): Promise<{ success: boolean; schema: { tables: any[] } }> {
    return request<{ success: boolean; schema: { tables: any[] } }>(`/${projectId}/database/${databaseId}/introspect`);
  },

  async createDatabaseBackup(
    projectId: string,
    databaseId: string,
    name?: string
  ): Promise<{ success: boolean; backup: any }> {
    return request<{ success: boolean; backup: any }>(`/${projectId}/database/${databaseId}/backups`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  async listDatabaseBackups(projectId: string, databaseId: string): Promise<{ success: boolean; backups: any[] }> {
    return request<{ success: boolean; backups: any[] }>(`/${projectId}/database/${databaseId}/backups`);
  },

  async restoreDatabaseBackup(
    projectId: string,
    databaseId: string,
    backupId: string
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/database/${databaseId}/backups/${backupId}/restore`, {
      method: "POST",
    });
  },

  async getDatabaseMetrics(projectId: string, databaseId: string): Promise<{ success: boolean; metrics: any }> {
    return request<{ success: boolean; metrics: any }>(`/${projectId}/database/${databaseId}/metrics`);
  },

  async listDatabaseMigrations(projectId: string, databaseId: string): Promise<{ success: boolean; migrations: any[] }> {
    return request<{ success: boolean; migrations: any[] }>(`/${projectId}/database/${databaseId}/migrations`);
  },

  async applyDatabaseMigration(
    projectId: string,
    databaseId: string,
    migrationId: string
  ): Promise<{ success: boolean; migration: any }> {
    return request<{ success: boolean; migration: any }>(
      `/${projectId}/database/${databaseId}/migrations/${migrationId}/apply`,
      { method: "POST" }
    );
  },

  async rollbackDatabaseMigration(
    projectId: string,
    databaseId: string,
    migrationId: string
  ): Promise<{ success: boolean; migration: any }> {
    return request<{ success: boolean; migration: any }>(
      `/${projectId}/database/${databaseId}/migrations/${migrationId}/rollback`,
      { method: "POST" }
    );
  },

  // Module 26: Database Studio
  async getTableData(
    projectId: string,
    databaseId: string,
    tableName: string,
    params: any = {}
  ): Promise<{ success: boolean; data: any }> {
    const qs = new URLSearchParams(params).toString();
    return request<{ success: boolean; data: any }>(
      `/${projectId}/database/${databaseId}/tables/${tableName}/data?${qs}`
    );
  },

  async insertTableRow(
    projectId: string,
    databaseId: string,
    tableName: string,
    row: any
  ): Promise<{ success: boolean; row: any }> {
    return request<{ success: boolean; row: any }>(
      `/${projectId}/database/${databaseId}/tables/${tableName}/data`,
      { method: "POST", body: JSON.stringify(row) }
    );
  },

  async updateTableRow(
    projectId: string,
    databaseId: string,
    tableName: string,
    pkField: string,
    pkValue: any,
    changes: any
  ): Promise<{ success: boolean; row: any }> {
    return request<{ success: boolean; row: any }>(
      `/${projectId}/database/${databaseId}/tables/${tableName}/data`,
      { method: "PATCH", body: JSON.stringify({ pkField, pkValue, changes }) }
    );
  },

  async deleteTableRow(
    projectId: string,
    databaseId: string,
    tableName: string,
    pkField: string,
    pkValue: any
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(
      `/${projectId}/database/${databaseId}/tables/${tableName}/data`,
      { method: "DELETE", body: JSON.stringify({ pkField, pkValue }) }
    );
  },

  async executeSqlQuery(
    projectId: string,
    databaseId: string,
    sql: string,
    confirmDestructive = false
  ): Promise<{ success: boolean; result: any }> {
    return request<{ success: boolean; result: any }>(`/${projectId}/database/${databaseId}/sql`, {
      method: "POST",
      body: JSON.stringify({ sql, confirmDestructive }),
    });
  },

  async explainSqlQuery(
    projectId: string,
    databaseId: string,
    sql: string,
    analyze = false
  ): Promise<{ success: boolean; result: any }> {
    return request<{ success: boolean; result: any }>(`/${projectId}/database/${databaseId}/explain`, {
      method: "POST",
      body: JSON.stringify({ sql, analyze }),
    });
  },

  async getQueryHistory(projectId: string, databaseId: string): Promise<{ success: boolean; history: any[] }> {
    return request<{ success: boolean; history: any[] }>(`/${projectId}/database/${databaseId}/history`);
  },

  async seedTableData(
    projectId: string,
    databaseId: string,
    tableName: string,
    count = 5
  ): Promise<{ success: boolean; result: { inserted: number } }> {
    return request<{ success: boolean; result: { inserted: number } }>(
      `/${projectId}/database/${databaseId}/tables/${tableName}/seed`,
      { method: "POST", body: JSON.stringify({ count }) }
    );
  },

  // Module 27: Data / API Layer
  async getApiConfigs(projectId: string, databaseId: string): Promise<{ success: boolean; configs: any[] }> {
    return request<{ success: boolean; configs: any[] }>(`/${projectId}/database/${databaseId}/api/configs`);
  },

  async updateApiConfig(
    projectId: string,
    databaseId: string,
    tableName: string,
    payload: any
  ): Promise<{ success: boolean; config: any }> {
    return request<{ success: boolean; config: any }>(
      `/${projectId}/database/${databaseId}/api/configs/${tableName}`,
      { method: "PATCH", body: JSON.stringify(payload) }
    );
  },

  async getOpenApiSpec(projectId: string, databaseId: string): Promise<any> {
    return request<any>(`/${projectId}/database/${databaseId}/api/openapi.json`);
  },

  async getTypedClientCode(
    projectId: string,
    databaseId: string
  ): Promise<{ success: boolean; client: { typescriptCode: string; typesDefinition: string } }> {
    return request<{ success: boolean; client: { typescriptCode: string; typesDefinition: string } }>(
      `/${projectId}/database/${databaseId}/api/client.ts`
    );
  },

  // Module 28: Object Storage
  async createStorageBucket(
    projectId: string,
    payload: { name: string; accessPolicy?: string; maxSizeBytes?: number }
  ): Promise<{ success: boolean; bucket: any }> {
    return request<{ success: boolean; bucket: any }>(`/${projectId}/storage/buckets`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listStorageBuckets(projectId: string): Promise<{ success: boolean; buckets: any[] }> {
    return request<{ success: boolean; buckets: any[] }>(`/${projectId}/storage/buckets`);
  },

  async deleteStorageBucket(projectId: string, bucketName: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/storage/buckets/${bucketName}`, {
      method: "DELETE",
    });
  },

  async listStorageObjects(
    projectId: string,
    bucketName: string,
    prefix?: string
  ): Promise<{ success: boolean; objects: any[] }> {
    const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
    return request<{ success: boolean; objects: any[] }>(`/${projectId}/storage/buckets/${bucketName}/objects${qs}`);
  },

  async uploadStorageObject(
    projectId: string,
    bucketName: string,
    key: string,
    content: string,
    fileName?: string,
    mimeType?: string
  ): Promise<{ success: boolean; object: any }> {
    return request<{ success: boolean; object: any }>(`/${projectId}/storage/buckets/${bucketName}/objects`, {
      method: "POST",
      body: JSON.stringify({ key, content, fileName: fileName || key, mimeType }),
    });
  },

  async deleteStorageObject(
    projectId: string,
    bucketName: string,
    key: string
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(
      `/${projectId}/storage/buckets/${bucketName}/objects/${encodeURIComponent(key)}`,
      { method: "DELETE" }
    );
  },

  async generateSignedStorageUrl(
    projectId: string,
    bucketName: string,
    key: string,
    method = "GET",
    expiresInSeconds = 300
  ): Promise<{ success: boolean; signedUrl: any }> {
    return request<{ success: boolean; signedUrl: any }>(`/${projectId}/storage/buckets/${bucketName}/signed-url`, {
      method: "POST",
      body: JSON.stringify({ key, method, expiresInSeconds }),
    });
  },

  // Modules 46–52: Application Runtime Platform
  // Module 46: Functions
  async listRuntimeFunctions(projectId: string, environment?: string): Promise<{ functions: any[] }> {
    const qs = environment ? `?environment=${environment}` : "";
    return request<{ functions: any[] }>(`/${projectId}/runtime/functions${qs}`);
  },

  async createRuntimeFunction(projectId: string, payload: any): Promise<{ function: any }> {
    return request<{ function: any }>(`/${projectId}/runtime/functions`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async invokeRuntimeFunction(projectId: string, fnId: string, payload: any): Promise<{ result: any }> {
    return request<{ result: any }>(`/${projectId}/runtime/functions/${fnId}/invoke`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async deleteRuntimeFunction(projectId: string, fnId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/runtime/functions/${fnId}`, {
      method: "DELETE",
    });
  },

  // Module 47: Queues
  async listTaskQueues(projectId: string): Promise<{ queues: any[] }> {
    return request<{ queues: any[] }>(`/${projectId}/runtime/queues`);
  },

  async createTaskQueue(projectId: string, payload: any): Promise<{ queue: any }> {
    return request<{ queue: any }>(`/${projectId}/runtime/queues`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getQueueMetrics(projectId: string, queueId: string): Promise<{ metrics: any }> {
    return request<{ metrics: any }>(`/${projectId}/runtime/queues/${queueId}/metrics`);
  },

  async listQueueJobs(projectId: string, queueId: string, status?: string): Promise<{ jobs: any[] }> {
    const qs = status ? `?status=${status}` : "";
    return request<{ jobs: any[] }>(`/${projectId}/runtime/queues/${queueId}/jobs${qs}`);
  },

  async enqueueQueueJob(projectId: string, queueId: string, payload: any): Promise<{ job: any }> {
    return request<{ job: any }>(`/${projectId}/runtime/queues/${queueId}/jobs`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async replayDlqJob(projectId: string, queueId: string, jobId: string): Promise<{ job: any }> {
    return request<{ job: any }>(`/${projectId}/runtime/queues/${queueId}/jobs/${jobId}/replay`, {
      method: "POST",
    });
  },

  // Module 48: Scheduler
  async listCronSchedules(projectId: string): Promise<{ schedules: any[] }> {
    return request<{ schedules: any[] }>(`/${projectId}/runtime/schedules`);
  },

  async createCronSchedule(projectId: string, payload: any): Promise<{ schedule: any }> {
    return request<{ schedule: any }>(`/${projectId}/runtime/schedules`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async triggerCronSchedule(projectId: string, scheduleId: string): Promise<{ execution: any }> {
    return request<{ execution: any }>(`/${projectId}/runtime/schedules/${scheduleId}/trigger`, {
      method: "POST",
    });
  },

  async deleteCronSchedule(projectId: string, scheduleId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/runtime/schedules/${scheduleId}`, {
      method: "DELETE",
    });
  },

  // Module 49: Event Bus
  async listEventTopics(projectId: string): Promise<{ topics: any[] }> {
    return request<{ topics: any[] }>(`/${projectId}/runtime/topics`);
  },

  async createEventTopic(projectId: string, payload: any): Promise<{ topic: any }> {
    return request<{ topic: any }>(`/${projectId}/runtime/topics`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async publishEvent(projectId: string, topicId: string, payload: any): Promise<any> {
    return request<any>(`/${projectId}/runtime/topics/${topicId}/publish`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listEventSubscriptions(projectId: string, topicId?: string): Promise<{ subscriptions: any[] }> {
    const qs = topicId ? `?topicId=${topicId}` : "";
    return request<{ subscriptions: any[] }>(`/${projectId}/runtime/subscriptions${qs}`);
  },

  async createEventSubscription(projectId: string, payload: any): Promise<{ subscription: any }> {
    return request<{ subscription: any }>(`/${projectId}/runtime/subscriptions`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Module 50: Realtime
  async listRealtimeChannels(projectId: string): Promise<{ channels: any[] }> {
    return request<{ channels: any[] }>(`/${projectId}/runtime/channels`);
  },

  async createRealtimeChannel(projectId: string, payload: any): Promise<{ channel: any }> {
    return request<{ channel: any }>(`/${projectId}/runtime/channels`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async broadcastRealtimeMessage(projectId: string, channel: string, payload: any): Promise<{ message: any }> {
    return request<{ message: any }>(`/${projectId}/runtime/channels/${channel}/broadcast`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getChannelPresence(projectId: string, channel: string): Promise<{ presence: any[] }> {
    return request<{ presence: any[] }>(`/${projectId}/runtime/channels/${channel}/presence`);
  },

  // Module 51: KV
  async listKvNamespaces(projectId: string): Promise<{ namespaces: any[] }> {
    return request<{ namespaces: any[] }>(`/${projectId}/runtime/kv/namespaces`);
  },

  async createKvNamespace(projectId: string, payload: any): Promise<{ namespace: any }> {
    return request<{ namespace: any }>(`/${projectId}/runtime/kv/namespaces`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listKvKeys(projectId: string, namespace: string, prefix?: string): Promise<{ keys: any[] }> {
    const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
    return request<{ keys: any[] }>(`/${projectId}/runtime/kv/${namespace}/keys${qs}`);
  },

  async getKvKey(projectId: string, namespace: string, key: string): Promise<{ key: string; value: any }> {
    return request<{ key: string; value: any }>(`/${projectId}/runtime/kv/${namespace}/keys/${key}`);
  },

  async setKvKey(projectId: string, namespace: string, key: string, payload: any): Promise<{ entry: any }> {
    return request<{ entry: any }>(`/${projectId}/runtime/kv/${namespace}/keys/${key}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async deleteKvKey(projectId: string, namespace: string, key: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/runtime/kv/${namespace}/keys/${key}`, {
      method: "DELETE",
    });
  },

  // Module 52: Gateway & Schema Registry
  async listGatewayRoutes(projectId: string): Promise<{ routes: any[] }> {
    return request<{ routes: any[] }>(`/${projectId}/runtime/gateway/routes`);
  },

  async createGatewayRoute(projectId: string, payload: any): Promise<{ route: any }> {
    return request<{ route: any }>(`/${projectId}/runtime/gateway/routes`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async deleteGatewayRoute(projectId: string, routeId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/runtime/gateway/routes/${routeId}`, {
      method: "DELETE",
    });
  },

  async listSchemas(projectId: string): Promise<{ schemas: any[] }> {
    return request<{ schemas: any[] }>(`/${projectId}/runtime/schemas`);
  },

  async registerSchema(projectId: string, payload: any): Promise<{ schema: any }> {
    return request<{ schema: any }>(`/${projectId}/runtime/schemas`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Modules 43–45: Quality, API Testing & Browser DevTools
  // Module 43: Automated Testing Platform
  async listTestSuites(projectId: string): Promise<{ suites: any[] }> {
    return request<{ suites: any[] }>(`/${projectId}/quality/tests/suites`);
  },

  async discoverTestSuites(projectId: string): Promise<{ suites: any[] }> {
    return request<{ suites: any[] }>(`/${projectId}/quality/tests/suites/discover`, {
      method: "POST",
    });
  },

  async runProjectTests(projectId: string, options: any = {}): Promise<{ testRun: any }> {
    return request<{ testRun: any }>(`/${projectId}/quality/tests/run`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  },

  async listTestRuns(projectId: string): Promise<{ runs: any[] }> {
    return request<{ runs: any[] }>(`/${projectId}/quality/tests/runs`);
  },

  // Module 44: API Testing Studio
  async listApiCollections(projectId: string): Promise<{ collections: any[] }> {
    return request<{ collections: any[] }>(`/${projectId}/quality/api/collections`);
  },

  async createApiCollection(projectId: string, payload: any): Promise<{ collection: any }> {
    return request<{ collection: any }>(`/${projectId}/quality/api/collections`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listApiRequests(projectId: string, collectionId: string): Promise<{ requests: any[] }> {
    return request<{ requests: any[] }>(`/${projectId}/quality/api/collections/${collectionId}/requests`);
  },

  async createApiRequest(projectId: string, collectionId: string, payload: any): Promise<{ request: any }> {
    return request<{ request: any }>(`/${projectId}/quality/api/collections/${collectionId}/requests`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async executeApiRequest(projectId: string, requestId: string, variables?: any): Promise<{ result: any }> {
    return request<{ result: any }>(`/${projectId}/quality/api/requests/${requestId}/execute`, {
      method: "POST",
      body: JSON.stringify({ variables: variables || {} }),
    });
  },

  async runApiCollection(projectId: string, collectionId: string, variables?: any): Promise<{ runRecord: any }> {
    return request<{ runRecord: any }>(`/${projectId}/quality/api/collections/${collectionId}/run`, {
      method: "POST",
      body: JSON.stringify({ variables: variables || {} }),
    });
  },

  async importOpenApiToCollection(projectId: string, spec: any, name?: string): Promise<{ collection: any }> {
    return request<{ collection: any }>(`/${projectId}/quality/api/collections/import-openapi`, {
      method: "POST",
      body: JSON.stringify({ spec, name }),
    });
  },

  // Module 45: Browser DevTools & Runtime Inspector
  async getDevToolsState(projectId: string): Promise<{ state: any }> {
    return request<{ state: any }>(`/${projectId}/quality/devtools/state`);
  },

  async ingestDevToolsConsole(projectId: string, payload: any): Promise<{ event: any }> {
    return request<{ event: any }>(`/${projectId}/quality/devtools/console`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async ingestDevToolsNetwork(projectId: string, payload: any): Promise<{ event: any }> {
    return request<{ event: any }>(`/${projectId}/quality/devtools/network`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async captureDevToolsSnapshot(projectId: string, url?: string): Promise<{ snapshot: any }> {
    return request<{ snapshot: any }>(`/${projectId}/quality/devtools/snapshot`, {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  },

  async analyzeDevToolsErrorWithAi(projectId: string, errorLogId?: string): Promise<{ analysis: any }> {
    return request<{ analysis: any }>(`/${projectId}/quality/devtools/analyze-ai`, {
      method: "POST",
      body: JSON.stringify({ errorLogId }),
    });
  },

  // Modules 53–56: DevOps, Observability, Security & Feature Flags Platform
  // Module 53: Preview Environment Manager
  async listPreviewEnvironments(projectId: string): Promise<{ environments: any[] }> {
    return request<{ environments: any[] }>(`/${projectId}/devops/previews`);
  },

  async createPreviewEnvironment(projectId: string, payload: any): Promise<{ environment: any }> {
    return request<{ environment: any }>(`/${projectId}/devops/previews`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async deployPreviewEnvironment(projectId: string, envId: string): Promise<{ environment: any }> {
    return request<{ environment: any }>(`/${projectId}/devops/previews/${envId}/deploy`, {
      method: "POST",
    });
  },

  async extendPreviewTtl(projectId: string, envId: string, additionalHours: number = 24): Promise<{ environment: any }> {
    return request<{ environment: any }>(`/${projectId}/devops/previews/${envId}/extend-ttl`, {
      method: "POST",
      body: JSON.stringify({ additionalHours }),
    });
  },

  async teardownPreviewEnvironment(projectId: string, envId: string): Promise<{ success: boolean; id: string }> {
    return request<{ success: boolean; id: string }>(`/${projectId}/devops/previews/${envId}`, {
      method: "DELETE",
    });
  },

  async promotePreviewEnvironment(projectId: string, envId: string, targetEnvironment: "staging" | "production" = "staging"): Promise<{ promotion: any }> {
    return request<{ promotion: any }>(`/${projectId}/devops/previews/${envId}/promote`, {
      method: "POST",
      body: JSON.stringify({ targetEnvironment }),
    });
  },

  // Module 54: Developer Observability
  async queryObservabilityLogs(projectId: string, filter?: any): Promise<{ logs: any[] }> {
    const params = new URLSearchParams(filter || {});
    return request<{ logs: any[] }>(`/${projectId}/devops/observability/logs?${params.toString()}`);
  },

  async getApmMetrics(projectId: string): Promise<{ metrics: any }> {
    return request<{ metrics: any }>(`/${projectId}/devops/observability/metrics`);
  },

  async getTrace(projectId: string, traceId: string): Promise<{ trace: any }> {
    return request<{ trace: any }>(`/${projectId}/devops/observability/traces/${traceId}`);
  },

  async listObservabilityIssues(projectId: string, status?: string): Promise<{ issues: any[] }> {
    const query = status ? `?status=${status}` : "";
    return request<{ issues: any[] }>(`/${projectId}/devops/observability/issues${query}`);
  },

  async updateObservabilityIssue(projectId: string, issueId: string, status: string): Promise<{ issue: any }> {
    return request<{ issue: any }>(`/${projectId}/devops/observability/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  async diagnoseObservabilityIssue(projectId: string, issueId: string): Promise<{ diagnostic: any }> {
    return request<{ diagnostic: any }>(`/${projectId}/devops/observability/issues/${issueId}/diagnose`, {
      method: "POST",
    });
  },

  // Module 55: Application Security Scanning
  async runSecurityScan(projectId: string, scanType: string = "FULL", policy?: any): Promise<{ scan: any }> {
    return request<{ scan: any }>(`/${projectId}/devops/security/scan`, {
      method: "POST",
      body: JSON.stringify({ scanType, policy }),
    });
  },

  async getLatestSecurityScan(projectId: string): Promise<{ scan: any }> {
    return request<{ scan: any }>(`/${projectId}/devops/security/latest`);
  },

  async listSecurityScans(projectId: string): Promise<{ scans: any[] }> {
    return request<{ scans: any[] }>(`/${projectId}/devops/security/scans`);
  },

  async generateSecurityRemediation(projectId: string, findingId: string): Promise<{ remediation: any }> {
    return request<{ remediation: any }>(`/${projectId}/devops/security/remediate`, {
      method: "POST",
      body: JSON.stringify({ findingId }),
    });
  },

  // Module 56: Feature Flags & Remote Configuration
  async listFeatureFlags(projectId: string): Promise<{ flags: any[] }> {
    return request<{ flags: any[] }>(`/${projectId}/devops/flags`);
  },

  async createFeatureFlag(projectId: string, payload: any): Promise<{ flag: any }> {
    return request<{ flag: any }>(`/${projectId}/devops/flags`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async toggleFeatureFlag(projectId: string, key: string, isEnabled: boolean): Promise<{ flag: any }> {
    return request<{ flag: any }>(`/${projectId}/devops/flags/${key}/toggle`, {
      method: "POST",
      body: JSON.stringify({ isEnabled }),
    });
  },

  async deleteFeatureFlag(projectId: string, key: string): Promise<{ success: boolean; key: string }> {
    return request<{ success: boolean; key: string }>(`/${projectId}/devops/flags/${key}`, {
      method: "DELETE",
    });
  },

  async evaluateFeatureFlags(projectId: string, context?: any): Promise<{ flags: Record<string, any> }> {
    return request<{ flags: Record<string, any> }>(`/${projectId}/devops/flags/evaluate`, {
      method: "POST",
      body: JSON.stringify(context || {}),
    });
  },

  async listRemoteConfigs(projectId: string, environment?: string): Promise<{ configs: any[] }> {
    const query = environment ? `?environment=${environment}` : "";
    return request<{ configs: any[] }>(`/${projectId}/devops/config${query}`);
  },

  async setRemoteConfig(projectId: string, payload: any): Promise<{ config: any }> {
    return request<{ config: any }>(`/${projectId}/devops/config`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async deleteRemoteConfig(projectId: string, key: string, environment?: string): Promise<{ success: boolean; key: string }> {
    const query = environment ? `?environment=${environment}` : "";
    return request<{ success: boolean; key: string }>(`/${projectId}/devops/config/${key}${query}`, {
      method: "DELETE",
    });
  },

  // Modules 62–64: Intelligence, Optimization, Recovery & Architecture Platform
  // Module 62: Optimization Engine
  async runOptimizationAudit(projectId: string): Promise<{ audit: any }> {
    return request<{ audit: any }>(`/${projectId}/intelligence/optimization/audit`, {
      method: "POST",
    });
  },

  async getLatestOptimizationAudit(projectId: string): Promise<{ audit: any }> {
    return request<{ audit: any }>(`/${projectId}/intelligence/optimization/latest`);
  },

  async listOptimizationAudits(projectId: string): Promise<{ audits: any[] }> {
    return request<{ audits: any[] }>(`/${projectId}/intelligence/optimization/audits`);
  },

  async generateOptimizationPatch(projectId: string, recId: string): Promise<{ patch: any }> {
    return request<{ patch: any }>(`/${projectId}/intelligence/optimization/patch/${recId}`, {
      method: "POST",
    });
  },

  // Module 63: Project Snapshot / Checkpoint / Recovery
  async createProjectCheckpoint(projectId: string, payload: any): Promise<{ checkpoint: any }> {
    return request<{ checkpoint: any }>(`/${projectId}/intelligence/checkpoints`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listProjectCheckpoints(projectId: string, tag?: string): Promise<{ checkpoints: any[] }> {
    const query = tag ? `?tag=${tag}` : "";
    return request<{ checkpoints: any[] }>(`/${projectId}/intelligence/checkpoints${query}`);
  },

  async getProjectCheckpoint(projectId: string, checkpointId: string): Promise<{ checkpoint: any }> {
    return request<{ checkpoint: any }>(`/${projectId}/intelligence/checkpoints/${checkpointId}`);
  },

  async diffProjectCheckpoint(projectId: string, checkpointId: string): Promise<{ diff: any }> {
    return request<{ diff: any }>(`/${projectId}/intelligence/checkpoints/${checkpointId}/diff`);
  },

  async rollbackProjectCheckpoint(projectId: string, checkpointId: string): Promise<{ rollback: any }> {
    return request<{ rollback: any }>(`/${projectId}/intelligence/checkpoints/${checkpointId}/rollback`, {
      method: "POST",
    });
  },

  async restoreProjectSingleFile(projectId: string, checkpointId: string, filePath: string): Promise<{ restored: any }> {
    return request<{ restored: any }>(`/${projectId}/intelligence/checkpoints/${checkpointId}/restore-file`, {
      method: "POST",
      body: JSON.stringify({ filePath }),
    });
  },

  async exportDisasterRecoveryBundle(projectId: string, checkpointId: string): Promise<{ bundle: any }> {
    return request<{ bundle: any }>(`/${projectId}/intelligence/checkpoints/${checkpointId}/export`);
  },

  async importDisasterRecoveryBundle(projectId: string, bundle: any): Promise<{ rollback: any }> {
    return request<{ rollback: any }>(`/${projectId}/intelligence/checkpoints/import`, {
      method: "POST",
      body: JSON.stringify({ bundle }),
    });
  },

  // Module 64: Architecture Visualization
  async getArchitectureGraph(projectId: string, layer: string = "ALL"): Promise<{ graph: any }> {
    return request<{ graph: any }>(`/${projectId}/intelligence/architecture/graph?layer=${layer}`);
  },
};


