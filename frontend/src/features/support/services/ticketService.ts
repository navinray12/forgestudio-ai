import type {
  SupportTicket,
  SupportCategory,
  SupportTeam,
  SupportSlaPolicy,
  SupportTicketMessage,
  TicketSearchFilters,
  AnalyticsMetrics,
} from "../types/support.types";

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/v1/support`;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options.headers,
    },
    credentials: "include",
  });

  const contentType = res.headers.get("content-type") || "";
  let data: any = null;

  if (contentType.includes("json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  if (!res.ok || (data && data.success === false)) {
    const errorMsg =
      data?.error?.message ||
      data?.detail ||
      data?.message ||
      `Server error (${res.status} ${res.statusText})`;
    throw new Error(errorMsg);
  }

  if (!data) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Server returned non-JSON response (${res.status} ${res.statusText})`);
  }

  return data;
}

export const ticketService = {
  // Tickets
  async createTicket(payload: {
    subject: string;
    description: string;
    categoryId: string;
    priority?: string;
    websiteId?: string;
    workspaceId?: string;
    contextData?: any;
  }): Promise<{ success: boolean; ticket: SupportTicket }> {
    return request<{ success: boolean; ticket: SupportTicket }>("/tickets", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listTickets(filters: TicketSearchFilters = {}): Promise<{
    items: SupportTicket[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const params = new URLSearchParams();
    if (filters.query) params.append("query", filters.query);
    if (filters.categoryId) params.append("categoryId", filters.categoryId);
    if (filters.assignedAgentId) params.append("assignedAgentId", filters.assignedAgentId);
    if (filters.assignedTeamId) params.append("assignedTeamId", filters.assignedTeamId);
    if (filters.workspaceId) params.append("workspaceId", filters.workspaceId);
    if (filters.websiteId) params.append("websiteId", filters.websiteId);
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.limit) params.append("limit", filters.limit.toString());
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        filters.status.forEach((s) => params.append("status", s));
      } else {
        params.append("status", filters.status);
      }
    }
    if (filters.priority) {
      if (Array.isArray(filters.priority)) {
        filters.priority.forEach((p) => params.append("priority", p));
      } else {
        params.append("priority", filters.priority);
      }
    }

    return request<{
      items: SupportTicket[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/tickets?${params.toString()}`);
  },

  async getTicket(id: string): Promise<{ ticket: SupportTicket }> {
    return request<{ ticket: SupportTicket }>(`/tickets/${id}`);
  },

  async addMessage(
    ticketId: string,
    content: string,
    type: "PUBLIC_REPLY" | "INTERNAL_NOTE" = "PUBLIC_REPLY"
  ): Promise<{ message: SupportTicketMessage }> {
    return request<{ message: SupportTicketMessage }>(`/tickets/${ticketId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, type }),
    });
  },

  async updateStatus(ticketId: string, status: string): Promise<{ ticket: SupportTicket }> {
    return request<{ ticket: SupportTicket }>(`/tickets/${ticketId}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  },

  async updatePriority(ticketId: string, priority: string): Promise<{ ticket: SupportTicket }> {
    return request<{ ticket: SupportTicket }>(`/tickets/${ticketId}/priority`, {
      method: "POST",
      body: JSON.stringify({ priority }),
    });
  },

  async assignAgent(ticketId: string, agentId: string | null): Promise<{ ticket: SupportTicket }> {
    return request<{ ticket: SupportTicket }>(`/tickets/${ticketId}/assign`, {
      method: "POST",
      body: JSON.stringify({ agentId }),
    });
  },

  async assignTeam(ticketId: string, teamId: string | null): Promise<{ ticket: SupportTicket }> {
    return request<{ ticket: SupportTicket }>(`/tickets/${ticketId}/assign`, {
      method: "POST",
      body: JSON.stringify({ teamId }),
    });
  },

  async resolveTicket(ticketId: string): Promise<{ ticket: SupportTicket }> {
    return request<{ ticket: SupportTicket }>(`/tickets/${ticketId}/resolve`, {
      method: "POST",
    });
  },

  async reopenTicket(ticketId: string): Promise<{ ticket: SupportTicket }> {
    return request<{ ticket: SupportTicket }>(`/tickets/${ticketId}/reopen`, {
      method: "POST",
    });
  },

  async closeTicket(ticketId: string): Promise<{ ticket: SupportTicket }> {
    return request<{ ticket: SupportTicket }>(`/tickets/${ticketId}/close`, {
      method: "POST",
    });
  },

  // Categories & Teams & SLA
  async getCategories(): Promise<{ categories: SupportCategory[] }> {
    return request<{ categories: SupportCategory[] }>("/categories");
  },

  async createCategory(payload: { name: string; description?: string; color?: string; icon?: string }): Promise<{ category: SupportCategory }> {
    return request<{ category: SupportCategory }>("/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getTeams(): Promise<{ teams: SupportTeam[] }> {
    return request<{ teams: SupportTeam[] }>("/teams");
  },

  async getSlaPolicies(): Promise<{ policies: SupportSlaPolicy[] }> {
    return request<{ policies: SupportSlaPolicy[] }>("/sla");
  },

  async getAnalytics(params: { workspaceId?: string } = {}): Promise<{
    analytics: {
      metrics: AnalyticsMetrics;
      byStatus: Record<string, number>;
      byPriority: Record<string, number>;
      byCategory: Array<{ categoryId: string; count: number }>;
    };
  }> {
    const q = params.workspaceId ? `?workspaceId=${params.workspaceId}` : "";
    return request(`/analytics${q}`);
  },

  async getAuditLog(ticketId: string): Promise<{ events: any[] }> {
    return request(`/tickets/${ticketId}/audit`);
  },

  // Enterprise Merge & Split
  async mergeTickets(sourceTicketId: string, targetTicketId: string, reason?: string): Promise<{ success: boolean }> {
    return request(`/tickets/${sourceTicketId}/merge`, {
      method: "POST",
      body: JSON.stringify({ targetTicketId, reason }),
    });
  },

  async splitTicket(sourceTicketId: string, payload: { subject: string; description: string; categoryId?: string }): Promise<{ ticket: SupportTicket }> {
    return request(`/tickets/${sourceTicketId}/split`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Duplicate Check
  async checkDuplicates(subject: string, websiteId?: string, userId?: string): Promise<{ duplicates: any[] }> {
    const params = new URLSearchParams();
    params.append("subject", subject);
    if (websiteId) params.append("websiteId", websiteId);
    if (userId) params.append("userId", userId);
    return request(`/tickets/duplicates/check?${params.toString()}`);
  },

  // Bulk Operations
  async bulkUpdate(payload: {
    ticketIds: string[];
    action: "ASSIGN" | "CHANGE_STATUS" | "CHANGE_PRIORITY" | "ADD_TAGS" | "REMOVE_TAGS" | "CLOSE" | "RESOLVE";
    payload: any;
  }): Promise<{ success: boolean; count: number }> {
    return request("/tickets/bulk-update", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Canned Responses
  async getCannedResponses(categoryId?: string): Promise<{ cannedResponses: any[] }> {
    const q = categoryId ? `?categoryId=${categoryId}` : "";
    return request(`/canned-responses${q}`);
  },

  async createCannedResponse(payload: { title: string; shortcut: string; content: string; categoryId?: string }): Promise<{ cannedResponse: any }> {
    return request("/canned-responses", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // CSAT Rating
  async submitCsat(ticketId: string, score: number, comment?: string): Promise<{ ticket: SupportTicket }> {
    return request(`/tickets/${ticketId}/csat`, {
      method: "POST",
      body: JSON.stringify({ score, comment }),
    });
  },
};
