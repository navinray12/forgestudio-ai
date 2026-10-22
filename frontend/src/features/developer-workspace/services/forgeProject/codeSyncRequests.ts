import type { CanvasEditPlan } from "../canvasSourceSync";
import type { CodeSyncResult, PageMutationResult, ProjectPage, SourcePreview, VisualSourceMutation, VisualSourceSyncResult } from "./types";
import { request } from "./request";

/**
 * Visual / code synchronization: compile, visual-to-code and code-to-visual sync, project pages, the
 * source preview and the saved workspace state.
 * Methods moved verbatim from forgeProjectService.ts (forgeProjectService); the facade there exposes them
 * under the same names and in the original order.
 */
export const codeSyncRequests = {

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
};
