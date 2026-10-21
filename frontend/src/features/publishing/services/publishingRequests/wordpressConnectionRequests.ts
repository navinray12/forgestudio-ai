import { getBaseUrl } from "./baseUrl";

/**
 * WordPress connection lifecycle (connect, status, verify, disconnect, revoke), the connector plugin
 * download, and site information / health.
 * Methods moved verbatim from publishingService.ts (publishingService); the facade there exposes them
 * under the same names and in the original order.
 */
export const wordpressConnectionRequests = {

  /**
   * Connect to a WordPress destination site
   */
  async connectWordPress(
    websiteId: string,
    siteUrl: string,
    apiKey: string,
    siteName?: string,
    apiUrl?: string
  ): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ siteUrl, apiKey, siteName }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to connect to WordPress");
    }
    return data;
  },

  /**
   * Fetch WordPress connection status
   */
  async getWordPressStatus(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/status`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to get WordPress status");
    }
    return data;
  },

  /**
   * Verify WordPress connection health
   */
  async verifyWordPress(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to verify WordPress connection");
    }
    return data;
  },

  /**
   * Safely disconnect WordPress integration
   */
  async disconnectWordPress(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to disconnect WordPress");
    }
    return data;
  },

  /**
   * Revoke an active WordPress connection
   */
  async revokeWordPressConnection(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || "Failed to revoke WordPress connection");
    }
    return data;
  },

  /**
   * Download the official ForgeStudio WordPress Connector plugin ZIP archive
   */
  async downloadWordPressPlugin(websiteId: string, apiUrl?: string): Promise<void> {
    const base = getBaseUrl(apiUrl);
    const downloadUrl = `${base}/api/websites/${websiteId}/wordpress/download-plugin`;
    const res = await fetch(downloadUrl, {
      method: "GET",
      credentials: "include",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error?.message || data?.message || "Failed to download WordPress plugin archive");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "forgestudio-connector.zip";
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  /**
   * Fetch WordPress Site Information
   */
  async getWordPressSiteInfo(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/site-info`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || "Failed to retrieve site information");
    }
    return data;
  },

  /**
   * Fetch WordPress Site Health & Diagnostics
   */
  async getWordPressSiteHealth(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/site-health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || "Failed to retrieve site health diagnostics");
    }
    return data;
  },
};
