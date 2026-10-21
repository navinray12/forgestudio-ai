import { request } from "./request";

/**
 * Project checkpoints and disaster recovery, and the architecture graph.
 * Methods moved verbatim from forgeProjectService.ts (forgeProjectService); the facade there exposes them
 * under the same names and in the original order.
 */
export const checkpointRequests = {

  // Module 63: Project Snapshot / Checkpoint / Recovery
  async createProjectCheckpoint(projectId: string, payload: any): Promise<{ checkpoint: any }> {
    return request<{ checkpoint: any }>(`/${projectId}/intelligence/checkpoints`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listProjectCheckpoints(projectId: string, tag?: string): Promise<{ checkpoints: any[] }> {
    const query = tag ? `?tag=${tag}` : "";
    return request<{ checkpoints: any[] }>(`/${projectId}/intelligence/checkpoints${query}`);
  },

  async getProjectCheckpoint(projectId: string, checkpointId: string): Promise<{ checkpoint: any }> {
    return request<{ checkpoint: any }>(`/${projectId}/intelligence/checkpoints/${checkpointId}`);
  },

  async diffProjectCheckpoint(projectId: string, checkpointId: string): Promise<{ diff: any }> {
    return request<{ diff: any }>(`/${projectId}/intelligence/checkpoints/${checkpointId}/diff`);
  },

  async rollbackProjectCheckpoint(projectId: string, checkpointId: string): Promise<{ rollback: any }> {
    return request<{ rollback: any }>(`/${projectId}/intelligence/checkpoints/${checkpointId}/rollback`, {
      method: "POST",
    });
  },

  async restoreProjectSingleFile(projectId: string, checkpointId: string, filePath: string): Promise<{ restored: any }> {
    return request<{ restored: any }>(`/${projectId}/intelligence/checkpoints/${checkpointId}/restore-file`, {
      method: "POST",
      body: JSON.stringify({ filePath }),
    });
  },

  async exportDisasterRecoveryBundle(projectId: string, checkpointId: string): Promise<{ bundle: any }> {
    return request<{ bundle: any }>(`/${projectId}/intelligence/checkpoints/${checkpointId}/export`);
  },

  async importDisasterRecoveryBundle(projectId: string, bundle: any): Promise<{ rollback: any }> {
    return request<{ rollback: any }>(`/${projectId}/intelligence/checkpoints/import`, {
      method: "POST",
      body: JSON.stringify({ bundle }),
    });
  },

  // Module 64: Architecture Visualization
  async getArchitectureGraph(projectId: string, layer: string = "ALL"): Promise<{ graph: any }> {
    return request<{ graph: any }>(`/${projectId}/intelligence/architecture/graph?layer=${layer}`);
  },
};
