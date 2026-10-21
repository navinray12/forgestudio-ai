import { request } from "./request";

/**
 * GitHub: connect / import, repository creation, remote fetch / pull / push / sync, pull requests and checks.
 * Methods moved verbatim from forgeProjectService.ts (forgeProjectService); the facade there exposes them
 * under the same names and in the original order.
 */
export const githubRequests = {

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
};
