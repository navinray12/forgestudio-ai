import { request } from "./request";

/**
 * Developer runtime tools: dependencies, sandbox runtime, builds, preview sessions, terminal and debugger.
 * Methods moved verbatim from forgeProjectService.ts (forgeProjectService); the facade there exposes them
 * under the same names and in the original order.
 */
export const runtimeToolRequests = {

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
};
