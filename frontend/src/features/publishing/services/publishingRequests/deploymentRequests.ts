import type { DeploymentRecord } from "../../../../pages/editor/types";
import type { PublishApiResponse, ValidationApiResponse } from "./types";
import { getBaseUrl } from "./baseUrl";

/**
 * Internal publishing: pre-publish validation, publish, deployment history, rollback and scheduled code
 * publishes.
 * Methods moved verbatim from publishingService.ts (publishingService); the facade there exposes them
 * under the same names and in the original order.
 */
export const deploymentRequests = {
  /**
   * Run pre-publish validation on current draft
   */
  async validateWebsite(websiteId: string, editorData?: any, apiUrl?: string): Promise<ValidationApiResponse> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/validate-publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ editorData }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to validate website before publishing");
    }
    return data;
  },

  /**
   * Trigger production publish pipeline
   */
  async publishWebsite(
    websiteId: string,
    options: {
      editorData?: any;
      environment?: "PRODUCTION" | "STAGING" | "DEVELOPMENT";
      destinationType?: "INTERNAL" | "WORDPRESS" | "STATIC";
      metadata?: Record<string, any>;
    } = {},
    apiUrl?: string
  ): Promise<PublishApiResponse> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(options),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to execute website publishing");
    }
    return data;
  },

  /**
   * Fetch deployment history
   */
  async getDeployments(websiteId: string, apiUrl?: string): Promise<DeploymentRecord[]> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/deployments`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to fetch deployment history");
    }
    return data.deployments || [];
  },

  /**
   * Rollback to a previous successful deployment
   */
  async rollbackDeployment(websiteId: string, deploymentId: string, apiUrl?: string): Promise<PublishApiResponse> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/deployments/${deploymentId}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to initiate deployment rollback");
    }
    return data;
  },
  /**
   * F-115: Schedule code publishing for a future timestamp
   */
  async scheduleCodePublish(
    websiteId: string,
    payload: {
      scheduledTime: string;
      codeSnippet?: string;
      location?: "head" | "body" | "footer";
      environment?: string;
      targetPages?: string[];
    },
    apiUrl?: string
  ): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/scheduled-publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to schedule code publishing");
    return data;
  },

  /**
   * F-115: List scheduled code publishing jobs
   */
  async listScheduledCodePublishes(websiteId: string, apiUrl?: string): Promise<any[]> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/scheduled-publish`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to list scheduled code publishing jobs");
    return data.jobs || data || [];
  },

  /**
   * F-115: Cancel a scheduled code publishing job
   */
  async cancelScheduledCodePublish(websiteId: string, jobId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/scheduled-publish/${jobId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to cancel scheduled publishing job");
    return data;
  },
};
