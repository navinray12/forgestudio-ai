import { getBaseUrl } from "./baseUrl";

/**
 * WordPress media library: upload, list, read, update and delete.
 * Methods moved verbatim from publishingService.ts (publishingService); the facade there exposes them
 * under the same names and in the original order.
 */
export const wordpressMediaRequests = {

  /**
   * Upload Media to WordPress Media Library (F-493)
   */
  async uploadWordPressMedia(
    websiteId: string,
    file: File,
    options?: { title?: string; altText?: string; caption?: string; description?: string },
    apiUrl?: string,
    onProgress?: (percent: number) => void
  ): Promise<any> {
    const base = getBaseUrl(apiUrl);

    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const commaIdx = result.indexOf(",");
        resolve(commaIdx !== -1 ? result.substring(commaIdx + 1) : result);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

    if (onProgress) onProgress(30);

    const payload = {
      filename: file.name,
      mimeType: file.type || "image/png",
      base64Data,
      title: options?.title || file.name.substring(0, file.name.lastIndexOf(".")) || file.name,
      altText: options?.altText || "",
      caption: options?.caption || "",
      description: options?.description || "",
    };

    if (onProgress) onProgress(60);

    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (onProgress) onProgress(90);

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || "Failed to upload media to WordPress Media Library");
    }

    if (onProgress) onProgress(100);
    return data;
  },

  /**
   * List WordPress Media (F-494)
   */
  async listWordPressMedia(
    websiteId: string,
    query?: {
      search?: string;
      mimeType?: string;
      mediaType?: "image" | "document" | "all";
      order?: "ASC" | "DESC";
      orderby?: "date" | "modified" | "title" | "filename";
      page?: number;
      perPage?: number;
    },
    apiUrl?: string
  ): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const params = new URLSearchParams();
    if (query?.search) params.append("search", query.search);
    if (query?.mimeType) params.append("mimeType", query.mimeType);
    if (query?.mediaType) params.append("mediaType", query.mediaType);
    if (query?.order) params.append("order", query.order);
    if (query?.orderby) params.append("orderby", query.orderby);
    if (query?.page) params.append("page", query.page.toString());
    if (query?.perPage) params.append("perPage", query.perPage.toString());

    const queryString = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/media${queryString}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || "Failed to list WordPress media");
    }
    return data;
  },

  /**
   * Get WordPress Media Details (F-494)
   */
  async getWordPressMedia(websiteId: string, mediaId: number, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/media/${mediaId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `Failed to fetch WordPress media ID ${mediaId}`);
    }
    return data;
  },

  /**
   * Update WordPress Media Metadata (F-494)
   */
  async updateWordPressMedia(
    websiteId: string,
    mediaId: number,
    metadata: { title?: string; altText?: string; caption?: string; description?: string },
    apiUrl?: string
  ): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/media/${mediaId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(metadata),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `Failed to update WordPress media ID ${mediaId}`);
    }
    return data;
  },

  /**
   * Delete WordPress Media (F-494)
   */
  async deleteWordPressMedia(
    websiteId: string,
    mediaId: number,
    options?: { force?: boolean },
    apiUrl?: string
  ): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const forceParam = options?.force ? "?force=true" : "";
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/media/${mediaId}${forceParam}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `Failed to delete WordPress media ID ${mediaId}`);
    }
    return data;
  },
};
