import { request } from "./request";

/**
 * Quality and operations: tests, API collections, devtools, preview environments, observability, security
 * scans, feature flags, remote config and optimization audits.
 * Methods moved verbatim from forgeProjectService.ts (forgeProjectService); the facade there exposes them
 * under the same names and in the original order.
 */
export const qualityOpsRequests = {

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
};
