import { prisma } from "../../config/prisma.js";

const db = prisma as any;

export interface TicketSearchFilters {
  query?: string;
  status?: string | string[];
  priority?: string | string[];
  categoryId?: string;
  assignedAgentId?: string;
  assignedTeamId?: string;
  workspaceId?: string;
  websiteId?: string;
  userId?: string; // Limit to specific customer if restricted
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "updatedAt" | "priority" | "status";
  sortOrder?: "asc" | "desc";
}

export async function searchTickets(filters: TicketSearchFilters, currentUserRole: string, currentUserId: string) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 25, 1), 100);
  const skip = (page - 1) * limit;

  const where: any = {};

  // Scope isolation: Regular customers can only search their own tickets or workspace tickets
  if (currentUserRole === "USER" || currentUserRole === "TEAM_MEMBER") {
    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId;
    } else {
      where.userId = currentUserId;
    }
  } else if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.workspaceId && currentUserRole !== "USER" && currentUserRole !== "TEAM_MEMBER") {
    where.workspaceId = filters.workspaceId;
  }

  if (filters.websiteId) {
    where.websiteId = filters.websiteId;
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.assignedAgentId) {
    where.assignedAgentId = filters.assignedAgentId;
  }

  if (filters.assignedTeamId) {
    where.assignedTeamId = filters.assignedTeamId;
  }

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      where.status = { in: filters.status };
    } else {
      where.status = filters.status;
    }
  }

  if (filters.priority) {
    if (Array.isArray(filters.priority)) {
      where.priority = { in: filters.priority };
    } else {
      where.priority = filters.priority;
    }
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
  }

  if (filters.query && filters.query.trim().length > 0) {
    const q = filters.query.trim();
    where.OR = [
      { ticketNumber: { contains: q, mode: "insensitive" } },
      { subject: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { fullName: { contains: q, mode: "insensitive" } } },
      { website: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const orderByField = filters.sortBy || "createdAt";
  const orderDirection = filters.sortOrder || "desc";

  const [total, items] = await Promise.all([
    db.supportTicket.count({ where }),
    db.supportTicket.findMany({
      where,
      orderBy: { [orderByField]: orderDirection },
      skip,
      take: limit,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        assignedAgent: { select: { id: true, fullName: true, email: true } },
        assignedTeam: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
        website: { select: { id: true, name: true, slug: true } },
        workspace: { select: { id: true, name: true, slug: true } },
        _count: { select: { messages: true, attachments: true } },
      },
    }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
