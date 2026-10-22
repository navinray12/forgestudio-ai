import { request } from "./request";

/**
 * Local Git: init, status, staging, commits, branches, diff / history, merge / rebase / conflicts, stashes,
 * cherry-pick, tags and the commit graph.
 * Methods moved verbatim from forgeProjectService.ts (forgeProjectService); the facade there exposes them
 * under the same names and in the original order.
 */
export const gitRequests = {

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
};
