import type { CodeSyncResult, FileTreeNode, ForgeProject, ProjectFile } from "./types";
import { request } from "./request";

/**
 * Projects, the project file system (tree, read / write / move / delete, revisions), snapshots and the
 * project manifest.
 * Methods moved verbatim from forgeProjectService.ts (forgeProjectService); the facade there exposes them
 * under the same names and in the original order.
 */
export const projectRequests = {
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
};
