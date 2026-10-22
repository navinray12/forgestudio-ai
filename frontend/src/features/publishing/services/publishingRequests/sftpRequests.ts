import { getBaseUrl } from "./baseUrl";

/**
 * SFTP destination: configuration, verification and sync.
 * Methods moved verbatim from publishingService.ts (publishingService); the facade there exposes them
 * under the same names and in the original order.
 */
export const sftpRequests = {

  /**
   * Fetch SFTP destination configuration
   */
  async getSftpConfig(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/sftp/config/${websiteId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to get SFTP config");
    }
    return data;
  },

  /**
   * Save SFTP destination credentials
   */
  async saveSftpConfig(config: any, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/sftp/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to save SFTP config");
    }
    return data;
  },

  /**
   * Verify SFTP destination connectivity
   */
  async verifySftpConfig(config: any, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/sftp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to verify SFTP connection");
    }
    return data;
  },

  /**
   * Sync compiled files to SFTP server
   */
  async syncSftp(websiteId: string, options: any = {}, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/sftp/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ websiteId, ...options }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || "Failed to sync files via SFTP");
    }
    return data;
  },
};
