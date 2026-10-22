import { request } from "./request";

/**
 * CLI and AI platform: completions, models, tools and approvals, coding sessions and plans, website
 * creator / audit, MCP servers, context and memories, AI plans, architecture analysis, AI tasks and runs.
 * Methods moved verbatim from forgeProjectService.ts (forgeProjectService); the facade there exposes them
 * under the same names and in the original order.
 */
export const aiPlatformRequests = {

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
};
