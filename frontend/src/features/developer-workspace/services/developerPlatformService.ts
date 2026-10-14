/**
 * ForgeStudio Modules 57–61: Developer Platform Service (Frontend API Client)
 *
 * Provides typed REST clients for:
 * - Module 57: Collaborative Development (Sessions, Comments, Mentions, Reviews, Previews, Conflict Resolution, Timeline)
 * - Module 58: Forge Extension & Plugin SDK (Catalog, Lifecycle, Hooks, AI Tools)
 * - Module 59: Project Import & Migration (Sources, Jobs, Detection, Staging, Rollback)
 * - Module 60: Monorepo & Multi-service Support (Workspaces, Graph, Affected Analysis, Coordinated Deploy)
 * - Module 61: Container & Infrastructure Tooling (Dockerfile, Compose, Sandbox, K8s, Terraform, Secret Scan)
 */

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/v1/projects`;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

  if (!res.ok || (data && data.success === false)) {
    const errorMsg =
      data?.error?.message ||
      data?.detail ||
      data?.message ||
      `Request failed with status ${res.status} (${res.statusText})`;
    throw new Error(errorMsg);
  }

  return data;
}

export interface AppGenerationRun {
  id: string;
  mode: "AI_PROVIDER" | "APPROVED_TEMPLATE";
  status: "QUEUED" | "PLANNING" | "GENERATING_SOURCE" | "WRITING_SOURCE" | "SOURCE_WRITTEN" | "FAILED";
  brief: string;
  templateId: string | null;
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  providerCalls: number;
  repairAttempts: number;
  appModel: { applicationName: string; entities: Array<{ name: string; fields: Array<{ name: string; type: string; required: boolean }> }> } | null;
  files: Array<{ path: string; role: string; written: boolean }>;
  diagnostics: Array<{ severity: "info" | "warn" | "error"; message: string }>;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export const developerPlatformService = {
  // =========================================================================
  // Module 57: Collaborative Development
  // =========================================================================
  async getActiveSessions(projectId: string): Promise<{ sessions: any[] }> {
    return request<{ sessions: any[] }>(`/${projectId}/collaboration/sessions`);
  },

  async heartbeatSession(projectId: string, data: any): Promise<{ session: any }> {
    return request<{ session: any }>(`/${projectId}/collaboration/heartbeat`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async closeSession(projectId: string, sessionId: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/${projectId}/collaboration/sessions/${sessionId}`, {
      method: "DELETE",
    });
  },

  async detectFileConflict(
    projectId: string,
    data: { filePath: string; baseRevisionId?: string; incomingContent: string }
  ): Promise<{ result: any }> {
    return request<{ result: any }>(`/${projectId}/collaboration/conflict/detect`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async resolveFileConflict(
    projectId: string,
    data: { conflictId: string; resolutionStrategy: string; resolvedContent: string }
  ): Promise<{ result: any }> {
    return request<{ result: any }>(`/${projectId}/collaboration/conflict/resolve`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async listComments(projectId: string, filePath?: string): Promise<{ comments: any[] }> {
    const query = filePath ? `?filePath=${encodeURIComponent(filePath)}` : "";
    return request<{ comments: any[] }>(`/${projectId}/collaboration/comments${query}`);
  },

  async createComment(projectId: string, data: any): Promise<{ comment: any }> {
    return request<{ comment: any }>(`/${projectId}/collaboration/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async replyComment(projectId: string, commentId: string, data: any): Promise<{ comment: any }> {
    return request<{ comment: any }>(`/${projectId}/collaboration/comments/${commentId}/reply`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async resolveComment(projectId: string, commentId: string): Promise<{ comment: any }> {
    return request<{ comment: any }>(`/${projectId}/collaboration/comments/${commentId}/resolve`, {
      method: "POST",
    });
  },

  async listReviews(projectId: string): Promise<{ reviews: any[] }> {
    return request<{ reviews: any[] }>(`/${projectId}/collaboration/reviews`);
  },

  async createReview(projectId: string, data: any): Promise<{ review: any }> {
    return request<{ review: any }>(`/${projectId}/collaboration/reviews`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async submitReviewDecision(
    projectId: string,
    reviewId: string,
    data: { status: string; comment?: string }
  ): Promise<{ review: any }> {
    return request<{ review: any }>(`/${projectId}/collaboration/reviews/${reviewId}/decision`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getCollaborationTimeline(projectId: string, limit: number = 50): Promise<{ activities: any[] }> {
    return request<{ activities: any[] }>(`/${projectId}/collaboration/timeline?limit=${limit}`);
  },

  // =========================================================================
  // Module 58: Forge Extension & Plugin SDK
  // =========================================================================
  async listPlugins(projectId: string): Promise<{ plugins: any[] }> {
    return request<{ plugins: any[] }>(`/${projectId}/extensions`);
  },

  async installPlugin(projectId: string, manifest: any): Promise<{ plugin: any }> {
    return request<{ plugin: any }>(`/${projectId}/extensions/install`, {
      method: "POST",
      body: JSON.stringify({ manifest }),
    });
  },

  async enablePlugin(projectId: string, pluginId: string): Promise<{ plugin: any }> {
    return request<{ plugin: any }>(`/${projectId}/extensions/${pluginId}/enable`, {
      method: "POST",
    });
  },

  async disablePlugin(projectId: string, pluginId: string): Promise<{ plugin: any }> {
    return request<{ plugin: any }>(`/${projectId}/extensions/${pluginId}/disable`, {
      method: "POST",
    });
  },

  async uninstallPlugin(projectId: string, pluginId: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/${projectId}/extensions/${pluginId}`, {
      method: "DELETE",
    });
  },

  async executePluginHook(projectId: string, hookName: string, context?: any): Promise<{ results: any[] }> {
    return request<{ results: any[] }>(`/${projectId}/extensions/hooks/execute`, {
      method: "POST",
      body: JSON.stringify({ hookName, context }),
    });
  },

  async executePluginAiTool(
    projectId: string,
    pluginId: string,
    toolName: string,
    params?: any
  ): Promise<{ result: any }> {
    return request<{ result: any }>(`/${projectId}/extensions/tools/execute`, {
      method: "POST",
      body: JSON.stringify({ pluginId, toolName, params }),
    });
  },

  // =========================================================================
  // Module 59: Project Import & Migration
  // =========================================================================
  // Full-stack application generation (durable runs; AI provider or approved template)
  async listAppGenerationTemplates(projectId: string): Promise<{ templates: Array<{ id: string; applicationName: string; entities: string[] }> }> {
    return request(`/${projectId}/app-generation-templates`);
  },

  async startAppGeneration(
    projectId: string,
    input: { mode: "AI_PROVIDER"; brief: string } | { mode: "APPROVED_TEMPLATE"; templateId: string },
    idempotencyKey: string
  ): Promise<{ run: AppGenerationRun }> {
    return request(`/${projectId}/app-generations`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    });
  },

  async getAppGeneration(projectId: string, runId: string): Promise<{ run: AppGenerationRun }> {
    return request(`/${projectId}/app-generations/${runId}`);
  },

  async listAppGenerations(projectId: string): Promise<{ runs: AppGenerationRun[] }> {
    return request(`/${projectId}/app-generations`);
  },

  async retryAppGeneration(projectId: string, runId: string): Promise<{ run: AppGenerationRun }> {
    return request(`/${projectId}/app-generations/${runId}/retry`, { method: "POST" });
  },

  async startProjectImport(projectId: string, source: any): Promise<{ job: any }> {
    return request<{ job: any }>(`/${projectId}/import/start`, {
      method: "POST",
      body: JSON.stringify(source),
    });
  },

  async getProjectImportStatus(projectId: string, jobId: string): Promise<{ job: any }> {
    return request<{ job: any }>(`/${projectId}/import/jobs/${jobId}`);
  },

  async commitProjectImport(projectId: string, jobId: string): Promise<{ result: any }> {
    return request<{ result: any }>(`/${projectId}/import/jobs/${jobId}/commit`, {
      method: "POST",
    });
  },

  // =========================================================================
  // Module 60: Monorepo & Multi-service Support
  // =========================================================================
  async getMonorepoGraph(projectId: string): Promise<{ graph: any }> {
    return request<{ graph: any }>(`/${projectId}/monorepo/graph`);
  },

  async getAffectedPackages(projectId: string, changedFiles: string[]): Promise<{ affected: any[] }> {
    return request<{ affected: any[] }>(`/${projectId}/monorepo/affected`, {
      method: "POST",
      body: JSON.stringify({ changedFiles }),
    });
  },

  async getMonorepoDeployPlan(projectId: string, targetServices?: string[]): Promise<{ plan: any }> {
    return request<{ plan: any }>(`/${projectId}/monorepo/deploy-plan`, {
      method: "POST",
      body: JSON.stringify({ targetServices }),
    });
  },

  // =========================================================================
  // Module 61: Container & Infrastructure Tooling
  // =========================================================================
  async getDockerfile(projectId: string): Promise<{ definition: any }> {
    return request<{ definition: any }>(`/${projectId}/containers/dockerfile`);
  },

  async generateDockerfile(projectId: string, options: any): Promise<{ dockerfile: string }> {
    return request<{ dockerfile: string }>(`/${projectId}/containers/dockerfile/generate`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  },

  async triggerContainerBuild(projectId: string, options: any): Promise<{ build: any }> {
    return request<{ build: any }>(`/${projectId}/containers/build`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  },

  async startContainer(projectId: string, options: any): Promise<{ run: any }> {
    return request<{ run: any }>(`/${projectId}/containers/run`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  },

  async listContainers(projectId: string): Promise<{ runs: any[] }> {
    return request<{ runs: any[] }>(`/${projectId}/containers`);
  },

  async stopContainer(projectId: string, runId: string): Promise<{ stopped: boolean }> {
    return request<{ stopped: boolean }>(`/${projectId}/containers/${runId}`, {
      method: "DELETE",
    });
  },

  async getDockerCompose(projectId: string): Promise<{ compose: any }> {
    return request<{ compose: any }>(`/${projectId}/containers/compose`);
  },

  async generateKubernetes(projectId: string, options: any): Promise<{ manifests: Record<string, string> }> {
    return request<{ manifests: Record<string, string> }>(`/${projectId}/infra/kubernetes/generate`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  },

  async generateTerraform(projectId: string, options: any): Promise<{ terraform: Record<string, string> }> {
    return request<{ terraform: Record<string, string> }>(`/${projectId}/infra/terraform/generate`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  },

  async validateInfrastructure(projectId: string): Promise<{ result: any }> {
    return request<{ result: any }>(`/${projectId}/infra/validate`);
  },
};
