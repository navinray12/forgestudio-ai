import type {
  ForumTopic,
  ForumCategory,
  ForumPost,
  ForumTag,
  ForumReport,
  ForumTopicFilters,
  ForumAnalyticsMetrics,
} from "../types/forum.types";

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/v1/forum`;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(`Server returned non-JSON response (${res.status} ${res.statusText})`);
  }

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message || data.message || "An unexpected error occurred");
  }
  return data;
}

export const forumService = {
  // Categories
  async listCategories(): Promise<{ success: boolean; categories: ForumCategory[] }> {
    return request<{ success: boolean; categories: ForumCategory[] }>("/categories");
  },

  async createCategory(payload: Partial<ForumCategory>): Promise<{ success: boolean; category: ForumCategory }> {
    return request<{ success: boolean; category: ForumCategory }>("/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Topics
  async listTopics(filters: ForumTopicFilters = {}): Promise<{
    items: ForumTopic[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const params = new URLSearchParams();
    if (filters.query) params.append("query", filters.query);
    if (filters.categoryId) params.append("categoryId", filters.categoryId);
    if (filters.categorySlug) params.append("categorySlug", filters.categorySlug);
    if (filters.tag) params.append("tag", filters.tag);
    if (filters.status) params.append("status", filters.status);
    if (filters.solved !== undefined) params.append("solved", String(filters.solved));
    if (filters.unanswered !== undefined) params.append("unanswered", String(filters.unanswered));
    if (filters.featured !== undefined) params.append("featured", String(filters.featured));
    if (filters.workspaceId) params.append("workspaceId", filters.workspaceId);
    if (filters.authorId) params.append("authorId", filters.authorId);
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.limit) params.append("limit", filters.limit.toString());
    if (filters.sortBy) params.append("sortBy", filters.sortBy);

    return request<{
      items: ForumTopic[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/topics?${params.toString()}`);
  },

  async getTopic(idOrSlug: string): Promise<{ topic: ForumTopic }> {
    return request<{ topic: ForumTopic }>(`/topics/${idOrSlug}`);
  },

  async createTopic(payload: {
    title: string;
    content: string;
    categoryId: string;
    workspaceId?: string;
    websiteId?: string;
    tags?: string[];
    visibility?: string;
    contextData?: any;
  }): Promise<{ success: boolean; topic: ForumTopic }> {
    return request<{ success: boolean; topic: ForumTopic }>("/topics", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Posts & Replies
  async createPost(
    topicId: string,
    content: string,
    parentPostId?: string
  ): Promise<{ success: boolean; post: ForumPost }> {
    return request<{ success: boolean; post: ForumPost }>(`/topics/${topicId}/posts`, {
      method: "POST",
      body: JSON.stringify({ content, parentPostId }),
    });
  },

  async editPost(postId: string, content: string): Promise<{ success: boolean; post: ForumPost }> {
    return request<{ success: boolean; post: ForumPost }>(`/posts/${postId}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    });
  },

  async deletePost(postId: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/posts/${postId}`, {
      method: "DELETE",
    });
  },

  // Solution Acceptance & Reactions
  async toggleAcceptedAnswer(postId: string): Promise<{ success: boolean; isAccepted: boolean }> {
    return request<{ success: boolean; isAccepted: boolean }>(`/posts/${postId}/accept`, {
      method: "POST",
    });
  },

  async toggleReaction(
    postId: string,
    type: string = "LIKE"
  ): Promise<{ success: boolean; reacted: boolean; type: string }> {
    return request<{ success: boolean; reacted: boolean; type: string }>(`/posts/${postId}/reactions`, {
      method: "POST",
      body: JSON.stringify({ type }),
    });
  },

  // Bookmarks & Follows
  async toggleBookmark(topicId: string): Promise<{ success: boolean; bookmarked: boolean }> {
    return request<{ success: boolean; bookmarked: boolean }>(`/topics/${topicId}/bookmark`, {
      method: "POST",
    });
  },

  async toggleFollow(topicId: string): Promise<{ success: boolean; followed: boolean }> {
    return request<{ success: boolean; followed: boolean }>(`/topics/${topicId}/follow`, {
      method: "POST",
    });
  },

  async getUserBookmarks(): Promise<{ success: boolean; topics: ForumTopic[] }> {
    return request<{ success: boolean; topics: ForumTopic[] }>("/bookmarks");
  },

  // Tags
  async listTags(query?: string): Promise<{ success: boolean; tags: ForumTag[] }> {
    const q = query ? `?query=${encodeURIComponent(query)}` : "";
    return request<{ success: boolean; tags: ForumTag[] }>(`/tags${q}`);
  },

  // Reports & Moderation
  async createReport(payload: {
    topicId?: string;
    postId?: string;
    reason: string;
    details?: string;
  }): Promise<{ success: boolean; report: ForumReport }> {
    return request<{ success: boolean; report: ForumReport }>("/reports", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listReports(status?: string): Promise<{ success: boolean; reports: ForumReport[] }> {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return request<{ success: boolean; reports: ForumReport[] }>(`/reports${q}`);
  },

  async moderateTopic(
    topicId: string,
    action: string,
    reason?: string
  ): Promise<{ success: boolean; topic: ForumTopic }> {
    return request<{ success: boolean; topic: ForumTopic }>(`/topics/${topicId}/moderate`, {
      method: "POST",
      body: JSON.stringify({ action, reason }),
    });
  },

  // Analytics
  async getAnalytics(): Promise<ForumAnalyticsMetrics> {
    return request<ForumAnalyticsMetrics>("/analytics");
  },
};
