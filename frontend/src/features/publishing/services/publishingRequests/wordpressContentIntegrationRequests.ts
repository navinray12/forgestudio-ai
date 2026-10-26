import { getBaseUrl } from "./baseUrl";

/**
 * WordPress content integrations: forms, page SEO and analytics.
 * Methods moved verbatim from publishingService.ts (publishingService); the facade there exposes them
 * under the same names and in the original order.
 */
export const wordpressContentIntegrationRequests = {

  /**
   * Get WordPress Forms capabilities for site
   */
  async getWordPressFormsCapabilities(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/forms/capabilities`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to fetch WordPress forms capabilities");
    }
    return data;
  },

  /**
   * List WordPress forms for site
   */
  async listWordPressForms(websiteId: string, apiUrl?: string): Promise<any[]> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/forms`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to list WordPress forms");
    }
    return data;
  },

  /**
   * Synchronize form definition to WordPress
   */
  async syncWordPressForm(websiteId: string, formId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/forms/${formId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to sync form to WordPress");
    }
    return data;
  },

  /**
   * Submit form payload
   */
  async submitWordPressForm(websiteId: string, formId: string, payload: any, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/forms/${formId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to submit form");
    }
    return data;
  },

  /**
   * F-502: Get WordPress SEO capabilities
   */
  async getWordPressSeoCapabilities(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/seo/capabilities`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to fetch WordPress SEO capabilities");
    }
    return data;
  },

  /**
   * F-502: Get page SEO metadata
   */
  async getWordPressPageSeo(websiteId: string, pageId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/seo/pages/${pageId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to fetch WordPress page SEO");
    }
    return data;
  },

  /**
   * F-502: Update page SEO metadata
   */
  async updateWordPressPageSeo(websiteId: string, pageId: string, metadata: any, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/seo/pages/${pageId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(metadata),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to update WordPress page SEO");
    }
    return data;
  },

  /**
   * F-502: Synchronize page SEO metadata to WordPress
   */
  async syncWordPressPageSeo(websiteId: string, pageId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/seo/pages/${pageId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to sync page SEO to WordPress");
    }
    return data;
  },

  /**
   * F-503: Get WordPress Analytics capabilities
   */
  async getWordPressAnalyticsCapabilities(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/analytics/capabilities`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to fetch WordPress Analytics capabilities");
    }
    return data;
  },

  /**
   * F-503: Get Analytics Configuration
   */
  async getWordPressAnalyticsConfig(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/analytics/config`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to fetch WordPress Analytics configuration");
    }
    return data;
  },

  /**
   * F-503: Update Analytics Configuration
   */
  async updateWordPressAnalyticsConfig(websiteId: string, config: any, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/analytics/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to update WordPress Analytics configuration");
    }
    return data;
  },

  /**
   * F-503: Get Analytics Data
   */
  async getWordPressAnalyticsData(websiteId: string, params?: any, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const query = new URLSearchParams(params || {}).toString();
    const url = `${base}/api/websites/${websiteId}/wordpress/analytics${query ? `?${query}` : ""}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to fetch WordPress Analytics data");
    }
    return data;
  },

  /**
   * F-503: Synchronize Analytics
   */
  async syncWordPressAnalytics(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/analytics/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to sync WordPress Analytics");
    }
    return data;
  },
};
