import { getBaseUrl } from "./baseUrl";

/**
 * Publishing to WordPress: publish, HTML / Gutenberg previews, publish status, rollback and publish jobs.
 * Methods moved verbatim from publishingService.ts (publishingService); the facade there exposes them
 * under the same names and in the original order.
 */
export const wordpressPublishRequests = {

  /**
   * Publish a ForgeStudio page to WordPress synchronously (F-495 & F-499)
   */
  async publishWordPressPage(
    websiteId: string,
    options?: {
      pageId?: string;
      wordpressPageId?: number;
      title?: string;
      slug?: string;
      status?: "draft" | "publish" | "private";
      content?: string;
      excerpt?: string;
      template?: string;
      format?: "html" | "gutenberg";
      mode?: "html" | "gutenberg";
    },
    apiUrl?: string
  ): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/publish-page`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(options || {}),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || "Failed to publish page to WordPress");
    }
    return data;
  },

  /**
   * Preview sanitized HTML & CSS payload without publishing mutation (F-499)
   */
  async previewWordPressHtml(
    websiteId: string,
    pageId: string = "default",
    apiUrl?: string
  ): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/pages/${pageId}/preview-html`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || "Failed to generate HTML preview");
    }
    return data.data || data;
  },

  /**
   * Preview native Gutenberg blocks payload without publishing mutation (F-500)
   */
  async previewWordPressGutenberg(
    websiteId: string,
    pageId: string = "default",
    apiUrl?: string
  ): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/pages/${pageId}/preview-gutenberg`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || "Failed to generate Gutenberg preview");
    }
    return data.data || data;
  },

  /**
   * Get WordPress publish status (F-496)
   */
  async getWordPressPublishStatus(
    websiteId: string,
    pageId: string = "default",
    apiUrl?: string
  ): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/pages/${pageId}/publish-status`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || "Failed to get WordPress publish status");
    }
    return data.data || data;
  },

  /**
   * Get WordPress rollback target snapshots (F-497)
   */
  async getWordPressRollbackTargets(
    websiteId: string,
    pageId: string = "default",
    apiUrl?: string
  ): Promise<any[]> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/pages/${pageId}/rollback-targets`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || "Failed to fetch WordPress rollback targets");
    }
    return data.data || data || [];
  },

  /**
   * Rollback WordPress page to a historical publish snapshot (F-497)
   */
  async rollbackWordPressPage(
    websiteId: string,
    pageId: string = "default",
    snapshotId: string,
    apiUrl?: string
  ): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/pages/${pageId}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ snapshotId }),
    });

    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data?.error?.message || data?.message || "Failed to rollback WordPress page");
      (err as any).code = data?.error?.code || data?.code;
      throw err;
    }
    return data;
  },

  /**
   * Create an asynchronous WordPress publishing job (F-498 & F-499)
   */
  async createWordPressPublishJob(
    websiteId: string,
    pageId: string = "default",
    options: { targetWpPostId?: number; slug?: string; status?: string; title?: string; format?: "html" | "gutenberg" } = {},
    apiUrl?: string
  ): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/pages/${pageId}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(options),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || "Failed to create WordPress publishing job");
    }
    return data;
  },

  /**
   * Get detailed status and step progress of a WordPress publishing job (F-498)
   */
  async getWordPressPublishJobStatus(
    websiteId: string,
    jobId: string,
    apiUrl?: string
  ): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/jobs/${jobId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || "Failed to fetch job status");
    }
    return data.job || data;
  },

  /**
   * List WordPress publishing jobs (F-498)
   */
  async listWordPressPublishJobs(
    websiteId: string,
    pageId?: string,
    apiUrl?: string
  ): Promise<any[]> {
    const base = getBaseUrl(apiUrl);
    const query = pageId ? `?pageId=${encodeURIComponent(pageId)}` : "";
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/jobs${query}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || "Failed to list publishing jobs");
    }
    return data.jobs || [];
  },

  /**
   * Cancel an active or queued WordPress publishing job (F-498)
   */
  async cancelWordPressPublishJob(
    websiteId: string,
    jobId: string,
    reason?: string,
    apiUrl?: string
  ): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/jobs/${jobId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ reason }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || "Failed to cancel publishing job");
    }
    return data;
  },

  /**
   * Retry a failed or cancelled WordPress publishing job (F-498)
   */
  async retryWordPressPublishJob(
    websiteId: string,
    jobId: string,
    apiUrl?: string
  ): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/jobs/${jobId}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || "Failed to retry publishing job");
    }
    return data;
  },
};
