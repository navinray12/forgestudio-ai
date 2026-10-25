import { request } from "./request";

/**
 * Hosting: deployments (promote, rollback, health checks), CI/CD pipelines and custom domains.
 * Methods moved verbatim from forgeProjectService.ts (forgeProjectService); the facade there exposes them
 * under the same names and in the original order.
 */
export const hostingRequests = {

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
};
