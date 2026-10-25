import { getBaseUrl } from "./baseUrl";

/**
 * WordPress site administration: menus, webhooks, plugins, themes and cache.
 * Methods moved verbatim from publishingService.ts (publishingService); the facade there exposes them
 * under the same names and in the original order.
 */
export const wordpressSiteAdminRequests = {

  /**
   * F-504: Get Menu Capabilities
   */
  async getWordPressMenuCapabilities(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/menus/capabilities`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to fetch WordPress Menu capabilities");
    return data;
  },

  /**
   * F-504: List Menus
   */
  async listWordPressMenus(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/menus`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to list WordPress menus");
    return data;
  },

  /**
   * F-504: Create Menu
   */
  async createWordPressMenu(websiteId: string, menuData: { name: string; slug?: string; description?: string }, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/menus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(menuData),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to create WordPress menu");
    return data;
  },

  /**
   * F-504: Delete Menu
   */
  async deleteWordPressMenu(websiteId: string, menuId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/menus/${menuId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to delete WordPress menu");
    return data;
  },

  /**
   * F-504: List Menu Items
   */
  async listWordPressMenuItems(websiteId: string, menuId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/menus/${menuId}/items`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to list menu items");
    return data;
  },

  /**
   * F-504: Create Menu Item
   */
  async createWordPressMenuItem(websiteId: string, menuId: string, itemData: any, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/menus/${menuId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(itemData),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to create menu item");
    return data;
  },

  /**
   * F-504: Reorder Menu Items
   */
  async reorderWordPressMenuItems(websiteId: string, menuId: string, reorderPayload: any[], apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/menus/${menuId}/items/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: reorderPayload }),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to reorder menu items");
    return data;
  },

  /**
   * F-504: Get Theme Menu Locations
   */
  async getWordPressMenuLocations(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/menus/locations`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to fetch menu locations");
    return data;
  },

  /**
   * F-504: Assign Menu Location
   */
  async assignWordPressMenuLocation(websiteId: string, menuId: string, location: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/menus/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuId, location }),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to assign menu location");
    return data;
  },

  /**
   * F-505: Get Webhook Capabilities
   */
  async getWordPressWebhookCapabilities(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/webhooks/capabilities`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to fetch webhook capabilities");
    return data;
  },

  /**
   * F-505: List Webhooks
   */
  async listWordPressWebhooks(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/webhooks`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to list webhooks");
    return data;
  },

  /**
   * F-505: Create Webhook
   */
  async createWordPressWebhook(websiteId: string, webhookData: any, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/webhooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookData),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to create webhook");
    return data;
  },

  /**
   * F-505: Delete Webhook
   */
  async deleteWordPressWebhook(websiteId: string, webhookId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/webhooks/${webhookId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to delete webhook");
    return data;
  },

  /**
   * F-505: Enable Webhook
   */
  async enableWordPressWebhook(websiteId: string, webhookId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/webhooks/${webhookId}/enable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to enable webhook");
    return data;
  },

  /**
   * F-505: Disable Webhook
   */
  async disableWordPressWebhook(websiteId: string, webhookId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/webhooks/${webhookId}/disable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to disable webhook");
    return data;
  },

  /**
   * F-505: List Webhook Deliveries
   */
  async listWordPressWebhookDeliveries(websiteId: string, webhookId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/webhooks/${webhookId}/deliveries`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to fetch webhook deliveries");
    return data;
  },

  /**
   * F-506: Get Plugin Capabilities
   */
  async getWordPressPluginCapabilities(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/plugins/capabilities`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to fetch plugin capabilities");
    return data;
  },

  /**
   * F-506: List Plugins
   */
  async listWordPressPlugins(websiteId: string, filter: any = {}, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const params = new URLSearchParams(filter).toString();
    const query = params ? `?${params}` : "";
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/plugins${query}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to list plugins");
    return data;
  },

  /**
   * F-506: Activate Plugin
   */
  async activateWordPressPlugin(websiteId: string, pluginId: string, isNetwork = false, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/plugins/${encodeURIComponent(pluginId)}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isNetwork }),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to activate plugin");
    return data;
  },

  /**
   * F-506: Deactivate Plugin
   */
  async deactivateWordPressPlugin(websiteId: string, pluginId: string, isNetwork = false, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/plugins/${encodeURIComponent(pluginId)}/deactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isNetwork }),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to deactivate plugin");
    return data;
  },

  /**
   * F-506: Update Plugin
   */
  async updateWordPressPlugin(websiteId: string, pluginId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/plugins/${encodeURIComponent(pluginId)}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to update plugin");
    return data;
  },

  /**
   * F-506: Delete Plugin
   */
  async deleteWordPressPlugin(websiteId: string, pluginId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/plugins/${encodeURIComponent(pluginId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to delete plugin");
    return data;
  },

  /**
   * F-507: Get Theme Capabilities
   */
  async getWordPressThemeCapabilities(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/themes/capabilities`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to fetch theme capabilities");
    return data;
  },

  /**
   * F-507: List Themes
   */
  async listWordPressThemes(websiteId: string, filter: any = {}, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const params = new URLSearchParams(filter).toString();
    const query = params ? `?${params}` : "";
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/themes${query}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to list themes");
    return data;
  },

  /**
   * F-507: Get Active Theme
   */
  async getActiveWordPressTheme(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/themes/active`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to fetch active theme");
    return data;
  },

  /**
   * F-507: Activate Theme
   */
  async activateWordPressTheme(websiteId: string, themeId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/themes/${encodeURIComponent(themeId)}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to activate theme");
    return data;
  },

  /**
   * F-507: Update Theme
   */
  async updateWordPressTheme(websiteId: string, themeId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/themes/${encodeURIComponent(themeId)}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to update theme");
    return data;
  },

  /**
   * F-507: Delete Theme
   */
  async deleteWordPressTheme(websiteId: string, themeId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/themes/${encodeURIComponent(themeId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to delete theme");
    return data;
  },

  /**
   * F-508: Get Cache Capabilities
   */
  async getWordPressCacheCapabilities(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/cache/capabilities`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to fetch cache capabilities");
    return data;
  },

  /**
   * F-508: Get Remote Cache Status
   */
  async getWordPressCacheStatus(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/cache/status`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to fetch cache status");
    return data;
  },

  /**
   * F-508: Purge Cache
   */
  async purgeWordPressCache(websiteId: string, target: any = {}, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/cache/purge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(target),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to purge cache");
    return data;
  },

  /**
   * F-508: Clear All Cache
   */
  async clearWordPressCache(websiteId: string, apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/cache/clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to clear cache");
    return data;
  },

  /**
   * F-508: Warm Cache
   */
  async warmWordPressCache(websiteId: string, urls: string[] = [], apiUrl?: string): Promise<any> {
    const base = getBaseUrl(apiUrl);
    const res = await fetch(`${base}/api/websites/${websiteId}/wordpress/cache/warm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls }),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to warm cache");
    return data;
  },
};
