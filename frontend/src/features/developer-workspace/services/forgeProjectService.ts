const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/v1/projects`;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options.headers,
    },
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

  if (!data) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Server returned non-JSON response (${res.status} ${res.statusText})`);
  }

  return data;
}

export interface ForgeProject {
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
  ): Promise<{ file: ProjectFile }> {
    return request<{ file: ProjectFile }>(`/${projectId}/files`, {
      method: "POST",
      body: JSON.stringify({ path: filePath, ...payload }),
    });
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

  async syncVisualToCode(
    projectId: string,
    filePath: string,
    element: any
  ): Promise<{ success: boolean; diagnostics: any[]; content: string }> {
    return request<{ success: boolean; diagnostics: any[]; content: string }>(
      `/${projectId}/sync/visual-to-code`,
      {
        method: "POST",
        body: JSON.stringify({ filePath, element }),
      }
    );
  },

  async syncCodeToVisual(
    projectId: string,
    filePath: string
  ): Promise<{
    success: boolean;
    appliedChangesCount: number;
    conflicts: any[];
    diagnostics: any[];
    reconciledEditorData?: any;
  }> {
    return request(
      `/${projectId}/sync/code-to-visual`,
      {
        method: "POST",
        body: JSON.stringify({ filePath }),
      }
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
  ): Promise<{ success: boolean; result: any }> {
    return request<{ success: boolean; result: any }>(`/${projectId}/domains/${domainId}/verify`, {
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
};

