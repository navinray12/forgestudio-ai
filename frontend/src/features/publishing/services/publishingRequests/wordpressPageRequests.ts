import { getBaseUrl } from "./baseUrl";

/**
 * WordPress pages: list, read, import, create, update, delete, duplicate and reorder.
 * Methods moved verbatim from publishingService.ts (publishingService); the facade there exposes them
 * under the same names and in the original order.
 */
export const wordpressPageRequests = {

  /**
   * List WordPress Pages
   */
  async listWordPressPages(websiteId: string, query?: { search?: string; status?: string; parent?: number; page?: number; perPage?: number }, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const params = new URLSearchParams();
    if (query?.search) params.append("search", query.search);
    if (query?.status) params.append("status", query.status);
    if (query?.parent !== undefined) params.append("parent", query.parent.toString());
    if (query?.page) params.append("page", query.page.toString());
    if (query?.perPage) params.append("perPage", query.perPage.toString());

    const queryString = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/pages${queryString}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || "Failed to list WordPress pages");
    }
    return data;
  },

  /**
   * Get Single WordPress Page
   */
  async getWordPressPage(websiteId: string, pageId: number, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/pages/${pageId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `Failed to fetch WordPress Page ${pageId}`);
    }
    return data;
  },

  /**
   * Import WordPress Page into ForgeStudio Editor Session
   */
  async importWordPressPage(websiteId: string, pageId: number, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/pages/${pageId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `Failed to import WordPress Page ${pageId}`);
    }
    return data;
  },

  /**
   * Create WordPress Page
   */
  async createWordPressPage(websiteId: string, pageData: { title: string; slug?: string; content?: string; status?: string; parent?: number; menuOrder?: number; template?: string; excerpt?: string; forgePageId?: string }, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(pageData),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || "Failed to create WordPress page");
    }
    return data;
  },

  /**
   * Update WordPress Page
   */
  async updateWordPressPage(websiteId: string, pageId: number, pageData: { title?: string; slug?: string; content?: string; status?: string; parent?: number; menuOrder?: number; template?: string; excerpt?: string; forgePageId?: string }, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(pageData),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `Failed to update WordPress Page ${pageId}`);
    }
    return data;
  },

  /**
   * Delete WordPress Page
   */
  async deleteWordPressPage(websiteId: string, pageId: number, force: boolean = false, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/pages/${pageId}?force=${force ? "true" : "false"}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `Failed to delete WordPress Page ${pageId}`);
    }
    return data;
  },

  /**
   * Duplicate WordPress Page (F-491)
   */
  async duplicateWordPressPage(
    websiteId: string,
    pageId: number,
    options?: { customTitle?: string; customSlug?: string },
    apiUrl?: string
  ): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/pages/${pageId}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(options || {}),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `Failed to duplicate WordPress Page ${pageId}`);
    }
    return data;
  },

  /**
   * Reorder WordPress Page (F-492)
   */
  async reorderWordPressPage(
    websiteId: string,
    pageId: number,
    options?: { targetPageId?: number; position?: "BEFORE" | "AFTER" | "FIRST" | "LAST"; parentId?: number },
    apiUrl?: string
  ): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/pages/${pageId}/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(options || {}),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `Failed to reorder WordPress Page ${pageId}`);
    }
    return data;
  },
};
