import { request } from "./request";

/**
 * Data platform: API configuration / OpenAPI, object storage, runtime functions, task queues, cron,
 * event topics, realtime channels, KV namespaces, gateway routes and schemas.
 * Methods moved verbatim from forgeProjectService.ts (forgeProjectService); the facade there exposes them
 * under the same names and in the original order.
 */
export const dataPlatformRequests = {

  // Module 27: Data / API Layer
  async getApiConfigs(projectId: string, databaseId: string): Promise<{ success: boolean; configs: any[] }> {
    return request<{ success: boolean; configs: any[] }>(`/${projectId}/database/${databaseId}/api/configs`);
  },

  async updateApiConfig(
    projectId: string,
    databaseId: string,
    tableName: string,
    payload: any
  ): Promise<{ success: boolean; config: any }> {
    return request<{ success: boolean; config: any }>(
      `/${projectId}/database/${databaseId}/api/configs/${tableName}`,
      { method: "PATCH", body: JSON.stringify(payload) }
    );
  },

  async getOpenApiSpec(projectId: string, databaseId: string): Promise<any> {
    return request<any>(`/${projectId}/database/${databaseId}/api/openapi.json`);
  },

  async getTypedClientCode(
    projectId: string,
    databaseId: string
  ): Promise<{ success: boolean; client: { typescriptCode: string; typesDefinition: string } }> {
    return request<{ success: boolean; client: { typescriptCode: string; typesDefinition: string } }>(
      `/${projectId}/database/${databaseId}/api/client.ts`
    );
  },

  // Module 28: Object Storage
  async createStorageBucket(
    projectId: string,
    payload: { name: string; accessPolicy?: string; maxSizeBytes?: number }
  ): Promise<{ success: boolean; bucket: any }> {
    return request<{ success: boolean; bucket: any }>(`/${projectId}/storage/buckets`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listStorageBuckets(projectId: string): Promise<{ success: boolean; buckets: any[] }> {
    return request<{ success: boolean; buckets: any[] }>(`/${projectId}/storage/buckets`);
  },

  async deleteStorageBucket(projectId: string, bucketName: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/storage/buckets/${bucketName}`, {
      method: "DELETE",
    });
  },

  async listStorageObjects(
    projectId: string,
    bucketName: string,
    prefix?: string
  ): Promise<{ success: boolean; objects: any[] }> {
    const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
    return request<{ success: boolean; objects: any[] }>(`/${projectId}/storage/buckets/${bucketName}/objects${qs}`);
  },

  async uploadStorageObject(
    projectId: string,
    bucketName: string,
    key: string,
    content: string,
    fileName?: string,
    mimeType?: string
  ): Promise<{ success: boolean; object: any }> {
    return request<{ success: boolean; object: any }>(`/${projectId}/storage/buckets/${bucketName}/objects`, {
      method: "POST",
      body: JSON.stringify({ key, content, fileName: fileName || key, mimeType }),
    });
  },

  async deleteStorageObject(
    projectId: string,
    bucketName: string,
    key: string
  ): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(
      `/${projectId}/storage/buckets/${bucketName}/objects/${encodeURIComponent(key)}`,
      { method: "DELETE" }
    );
  },

  async generateSignedStorageUrl(
    projectId: string,
    bucketName: string,
    key: string,
    method = "GET",
    expiresInSeconds = 300
  ): Promise<{ success: boolean; signedUrl: any }> {
    return request<{ success: boolean; signedUrl: any }>(`/${projectId}/storage/buckets/${bucketName}/signed-url`, {
      method: "POST",
      body: JSON.stringify({ key, method, expiresInSeconds }),
    });
  },

  // Modules 46–52: Application Runtime Platform
  // Module 46: Functions
  async listRuntimeFunctions(projectId: string, environment?: string): Promise<{ functions: any[] }> {
    const qs = environment ? `?environment=${environment}` : "";
    return request<{ functions: any[] }>(`/${projectId}/runtime/functions${qs}`);
  },

  async createRuntimeFunction(projectId: string, payload: any): Promise<{ function: any }> {
    return request<{ function: any }>(`/${projectId}/runtime/functions`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async invokeRuntimeFunction(projectId: string, fnId: string, payload: any): Promise<{ result: any }> {
    return request<{ result: any }>(`/${projectId}/runtime/functions/${fnId}/invoke`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async deleteRuntimeFunction(projectId: string, fnId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/runtime/functions/${fnId}`, {
      method: "DELETE",
    });
  },

  // Module 47: Queues
  async listTaskQueues(projectId: string): Promise<{ queues: any[] }> {
    return request<{ queues: any[] }>(`/${projectId}/runtime/queues`);
  },

  async createTaskQueue(projectId: string, payload: any): Promise<{ queue: any }> {
    return request<{ queue: any }>(`/${projectId}/runtime/queues`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getQueueMetrics(projectId: string, queueId: string): Promise<{ metrics: any }> {
    return request<{ metrics: any }>(`/${projectId}/runtime/queues/${queueId}/metrics`);
  },

  async listQueueJobs(projectId: string, queueId: string, status?: string): Promise<{ jobs: any[] }> {
    const qs = status ? `?status=${status}` : "";
    return request<{ jobs: any[] }>(`/${projectId}/runtime/queues/${queueId}/jobs${qs}`);
  },

  async enqueueQueueJob(projectId: string, queueId: string, payload: any): Promise<{ job: any }> {
    return request<{ job: any }>(`/${projectId}/runtime/queues/${queueId}/jobs`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async replayDlqJob(projectId: string, queueId: string, jobId: string): Promise<{ job: any }> {
    return request<{ job: any }>(`/${projectId}/runtime/queues/${queueId}/jobs/${jobId}/replay`, {
      method: "POST",
    });
  },

  // Module 48: Scheduler
  async listCronSchedules(projectId: string): Promise<{ schedules: any[] }> {
    return request<{ schedules: any[] }>(`/${projectId}/runtime/schedules`);
  },

  async createCronSchedule(projectId: string, payload: any): Promise<{ schedule: any }> {
    return request<{ schedule: any }>(`/${projectId}/runtime/schedules`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async triggerCronSchedule(projectId: string, scheduleId: string): Promise<{ execution: any }> {
    return request<{ execution: any }>(`/${projectId}/runtime/schedules/${scheduleId}/trigger`, {
      method: "POST",
    });
  },

  async deleteCronSchedule(projectId: string, scheduleId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/runtime/schedules/${scheduleId}`, {
      method: "DELETE",
    });
  },

  // Module 49: Event Bus
  async listEventTopics(projectId: string): Promise<{ topics: any[] }> {
    return request<{ topics: any[] }>(`/${projectId}/runtime/topics`);
  },

  async createEventTopic(projectId: string, payload: any): Promise<{ topic: any }> {
    return request<{ topic: any }>(`/${projectId}/runtime/topics`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async publishEvent(projectId: string, topicId: string, payload: any): Promise<any> {
    return request<any>(`/${projectId}/runtime/topics/${topicId}/publish`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listEventSubscriptions(projectId: string, topicId?: string): Promise<{ subscriptions: any[] }> {
    const qs = topicId ? `?topicId=${topicId}` : "";
    return request<{ subscriptions: any[] }>(`/${projectId}/runtime/subscriptions${qs}`);
  },

  async createEventSubscription(projectId: string, payload: any): Promise<{ subscription: any }> {
    return request<{ subscription: any }>(`/${projectId}/runtime/subscriptions`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Module 50: Realtime
  async listRealtimeChannels(projectId: string): Promise<{ channels: any[] }> {
    return request<{ channels: any[] }>(`/${projectId}/runtime/channels`);
  },

  async createRealtimeChannel(projectId: string, payload: any): Promise<{ channel: any }> {
    return request<{ channel: any }>(`/${projectId}/runtime/channels`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async broadcastRealtimeMessage(projectId: string, channel: string, payload: any): Promise<{ message: any }> {
    return request<{ message: any }>(`/${projectId}/runtime/channels/${channel}/broadcast`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getChannelPresence(projectId: string, channel: string): Promise<{ presence: any[] }> {
    return request<{ presence: any[] }>(`/${projectId}/runtime/channels/${channel}/presence`);
  },

  // Module 51: KV
  async listKvNamespaces(projectId: string): Promise<{ namespaces: any[] }> {
    return request<{ namespaces: any[] }>(`/${projectId}/runtime/kv/namespaces`);
  },

  async createKvNamespace(projectId: string, payload: any): Promise<{ namespace: any }> {
    return request<{ namespace: any }>(`/${projectId}/runtime/kv/namespaces`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listKvKeys(projectId: string, namespace: string, prefix?: string): Promise<{ keys: any[] }> {
    const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
    return request<{ keys: any[] }>(`/${projectId}/runtime/kv/${namespace}/keys${qs}`);
  },

  async getKvKey(projectId: string, namespace: string, key: string): Promise<{ key: string; value: any }> {
    return request<{ key: string; value: any }>(`/${projectId}/runtime/kv/${namespace}/keys/${key}`);
  },

  async setKvKey(projectId: string, namespace: string, key: string, payload: any): Promise<{ entry: any }> {
    return request<{ entry: any }>(`/${projectId}/runtime/kv/${namespace}/keys/${key}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async deleteKvKey(projectId: string, namespace: string, key: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/runtime/kv/${namespace}/keys/${key}`, {
      method: "DELETE",
    });
  },

  // Module 52: Gateway & Schema Registry
  async listGatewayRoutes(projectId: string): Promise<{ routes: any[] }> {
    return request<{ routes: any[] }>(`/${projectId}/runtime/gateway/routes`);
  },

  async createGatewayRoute(projectId: string, payload: any): Promise<{ route: any }> {
    return request<{ route: any }>(`/${projectId}/runtime/gateway/routes`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async deleteGatewayRoute(projectId: string, routeId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/${projectId}/runtime/gateway/routes/${routeId}`, {
      method: "DELETE",
    });
  },

  async listSchemas(projectId: string): Promise<{ schemas: any[] }> {
    return request<{ schemas: any[] }>(`/${projectId}/runtime/schemas`);
  },

  async registerSchema(projectId: string, payload: any): Promise<{ schema: any }> {
    return request<{ schema: any }>(`/${projectId}/runtime/schemas`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
