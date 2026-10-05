import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { isSupportStaffRole } from "../../middlewares/supportAuthorization.middleware.js";
import {
  validateCreateTicketPayload,
  validateStatusTransition,
  VALID_PRIORITIES,
} from "../../validators/support.validator.js";
import { calculateSlaTarget, getSlaStatus } from "./ticketSla.service.js";
import { recordTicketEvent } from "./ticketAudit.service.js";
import { notifyTicketCreated, notifyStatusChange } from "./ticketNotification.service.js";

const db = prisma as any;

export async function generateTicketNumber(): Promise<string> {
  const count = await db.supportTicket.count();
  const nextNum = 1001 + count;
  const ticketNumber = `FS-${nextNum}`;

  const exists = await db.supportTicket.findUnique({
    where: { ticketNumber },
  });

  if (exists) {
    const timestamp = Date.now().toString().slice(-4);
    return `FS-${nextNum}-${timestamp}`;
  }

  return ticketNumber;
}

export async function createSupportTicket(params: {
  userId: string;
  userRole: string;
  body: any;
}) {
  const input = validateCreateTicketPayload(params.body);

  const category = await db.supportCategory.findUnique({
    where: { id: input.categoryId },
  });

  if (!category || !category.isActive) {
    throw new AppError("Invalid or inactive support category selected", 422, "VALIDATION_ERROR");
  }

  // Validate website if provided
  let websiteId: string | null = null;
  if (input.websiteId) {
    const site = await db.website.findUnique({
      where: { id: input.websiteId },
      include: { wpConnection: true },
    });
    if (site) {
      websiteId = site.id;
      // Enrich context with safe WP connection details
      input.contextData = {
        ...input.contextData,
        websiteName: site.name,
        wpSiteUrl: site.wpConnection?.siteUrl,
        wpStatus: site.wpConnection?.status,
        wpPluginVersion: site.wpConnection?.pluginVersion,
      };
    }
  }

  // Validate workspace if provided
  let workspaceId: string | null = null;
  if (input.workspaceId) {
    const ws = await db.workspace.findUnique({
      where: { id: input.workspaceId },
    });
    if (ws) workspaceId = ws.id;
  }

  const ticketNumber = await generateTicketNumber();
  const slaTarget = await calculateSlaTarget(input.priority || "NORMAL");

  const ticket = await db.supportTicket.create({
    data: {
      ticketNumber,
      userId: params.userId,
      workspaceId,
      websiteId,
      categoryId: input.categoryId,
      subject: input.subject,
      description: input.description,
      status: "NEW",
      priority: input.priority || "NORMAL",
      source: "WEB",
      slaDueAt: slaTarget.resolutionDue,
      contextData: input.contextData || {},
      environmentContext: input.contextData?.environment || {},
      wordpressContext: input.contextData?.wordpress || {},
    },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
      website: { select: { id: true, name: true, slug: true } },
      workspace: { select: { id: true, name: true, slug: true } },
    },
  });

  await recordTicketEvent({
    ticketId: ticket.id,
    actorId: params.userId,
    eventType: "TICKET_CREATED",
    newValue: ticket.ticketNumber,
    metadata: { subject: ticket.subject },
  });

  await notifyTicketCreated(ticket);

  return ticket;
}

export async function getTicketById(ticketId: string, currentUserId: string, currentUserRole: string) {
  const isStaff = isSupportStaffRole(currentUserRole);

  const ticket = await db.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      assignedAgent: { select: { id: true, fullName: true, email: true, role: true } },
      assignedTeam: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
      website: { select: { id: true, name: true, slug: true } },
      workspace: { select: { id: true, name: true, slug: true } },
      messages: {
        where: isStaff ? {} : { type: "PUBLIC_REPLY" }, // CRITICAL IDOR / INTERNAL NOTE SECURITY
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, fullName: true, email: true, role: true } },
          attachments: true,
        },
      },
      attachments: true,
      events: isStaff
        ? {
            orderBy: { createdAt: "asc" },
            include: { actor: { select: { id: true, fullName: true, role: true } } },
          }
        : false,
    },
  });

  if (!ticket) {
    throw new AppError("Ticket not found", 404, "NOT_FOUND");
  }

  // IDOR & WORKSPACE ISOLATION CHECK
  if (!isStaff && ticket.userId !== currentUserId) {
    // Check if user is member of the workspace
    let isWorkspaceMember = false;
    if (ticket.workspaceId) {
      const member = await db.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: ticket.workspaceId,
            userId: currentUserId,
          },
        },
      });
      if (member) isWorkspaceMember = true;
    }

    if (!isWorkspaceMember) {
      throw new AppError("You do not have permission to view this ticket", 403, "FORBIDDEN");
    }
  }

  const sla = getSlaStatus({
    createdAt: ticket.createdAt,
    firstResponseAt: ticket.firstResponseAt,
    resolvedAt: ticket.resolvedAt,
    priority: ticket.priority,
  });

  return {
    ...ticket,
    sla,
  };
}

export async function updateTicketStatus(params: {
  ticketId: string;
  newStatus: string;
  actorId: string;
  actorRole: string;
}) {
  const ticket = await db.supportTicket.findUnique({
    where: { id: params.ticketId },
  });

  if (!ticket) throw new AppError("Ticket not found", 404, "NOT_FOUND");

  validateStatusTransition(ticket.status, params.newStatus);

  const isStaff = isSupportStaffRole(params.actorRole);
  if (!isStaff && (params.newStatus === "CLOSED" || params.newStatus === "IN_PROGRESS")) {
    throw new AppError("Only support staff can directly perform this status change", 403, "FORBIDDEN");
  }

  const data: any = {
    status: params.newStatus,
    updatedAt: new Date(),
  };

  if (params.newStatus === "RESOLVED") {
    data.resolvedAt = new Date();
  } else if (params.newStatus === "CLOSED") {
    data.closedAt = new Date();
  } else if (params.newStatus === "REOPENED") {
    data.reopenedAt = new Date();
  }

  const updated = await db.supportTicket.update({
    where: { id: params.ticketId },
    data,
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      assignedAgent: { select: { id: true, fullName: true, email: true } },
      category: { select: { id: true, name: true, slug: true, color: true } },
    },
  });

  await recordTicketEvent({
    ticketId: params.ticketId,
    actorId: params.actorId,
    eventType:
      params.newStatus === "RESOLVED"
        ? "RESOLVED"
        : params.newStatus === "REOPENED"
        ? "REOPENED"
        : params.newStatus === "CLOSED"
        ? "CLOSED"
        : "STATUS_CHANGED",
    oldValue: ticket.status,
    newValue: params.newStatus,
  });

  await notifyStatusChange(updated, ticket.status, params.newStatus, params.actorId);

  return updated;
}

export async function updateTicketPriority(params: {
  ticketId: string;
  newPriority: string;
  actorId: string;
  actorRole: string;
}) {
  if (!VALID_PRIORITIES.includes(params.newPriority as any)) {
    throw new AppError("Invalid priority value", 422, "VALIDATION_ERROR");
  }

  const isStaff = isSupportStaffRole(params.actorRole);
  if (!isStaff) {
    throw new AppError("Only support staff can change ticket priority", 403, "FORBIDDEN");
  }

  const ticket = await db.supportTicket.findUnique({
    where: { id: params.ticketId },
  });

  if (!ticket) throw new AppError("Ticket not found", 404, "NOT_FOUND");

  const oldPriority = ticket.priority;

  const updated = await db.supportTicket.update({
    where: { id: params.ticketId },
    data: { priority: params.newPriority },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      assignedAgent: { select: { id: true, fullName: true, email: true } },
      category: { select: { id: true, name: true, slug: true, color: true } },
    },
  });

  await recordTicketEvent({
    ticketId: params.ticketId,
    actorId: params.actorId,
    eventType: "PRIORITY_CHANGED",
    oldValue: oldPriority,
    newValue: params.newPriority,
  });

  return updated;
}

// Support Categories CRUD
export async function getCategories() {
  const categories = await db.supportCategory.findMany({
    orderBy: { sortOrder: "asc" },
  });

  if (categories.length === 0) {
    // Seed initial default categories if empty
    const defaults = [
      { name: "General Support", slug: "general", description: "General inquiries and questions", icon: "💬", color: "blue", sortOrder: 1 },
      { name: "WordPress Integration", slug: "wordpress", description: "WordPress connection, sync, and plugin issues", icon: "🌐", color: "purple", sortOrder: 2 },
      { name: "Editor & Visual Builder", slug: "editor", description: "Visual builder, components, and layout issues", icon: "🎨", color: "emerald", sortOrder: 3 },
      { name: "Billing & Subscriptions", slug: "billing", description: "Invoices, plans, and payments", icon: "💳", color: "amber", sortOrder: 4 },
      { name: "Technical Bug / Issue", slug: "bug", description: "System bugs or unexpected errors", icon: "🐛", color: "red", sortOrder: 5 },
    ];
    for (const d of defaults) {
      await db.supportCategory.create({ data: d });
    }
    return await db.supportCategory.findMany({ orderBy: { sortOrder: "asc" } });
  }

  return categories;
}

export async function createCategory(data: {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}) {
  const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return await db.supportCategory.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      icon: data.icon || "🎫",
      color: data.color || "blue",
      sortOrder: data.sortOrder || 0,
    },
  });
}

// Support Teams CRUD
export async function getTeams() {
  return await db.supportTeam.findMany({
    include: {
      members: {
        include: {
          user: { select: { id: true, fullName: true, email: true, role: true } },
        },
      },
    },
  });
}

export async function createTeam(data: { name: string; description?: string }) {
  return await db.supportTeam.create({
    data: {
      name: data.name,
      description: data.description,
    },
  });
}

export async function addTeamMember(teamId: string, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");

  return await db.supportTeamMember.create({
    data: { teamId, userId },
    include: {
      user: { select: { id: true, fullName: true, email: true, role: true } },
    },
  });
}

// Enterprise Ticket Merging
export async function mergeTickets(params: {
  sourceTicketId: string;
  targetTicketId: string;
  actorId: string;
  reason?: string;
}) {
  const { sourceTicketId, targetTicketId, actorId, reason } = params;

  if (sourceTicketId === targetTicketId) {
    throw new AppError("Cannot merge a ticket into itself", 400, "VALIDATION_ERROR");
  }

  const source = await db.supportTicket.findUnique({ where: { id: sourceTicketId }, include: { messages: true } });
  const target = await db.supportTicket.findUnique({ where: { id: targetTicketId } });

  if (!source || !target) {
    throw new AppError("Source or target ticket not found", 404, "NOT_FOUND");
  }

  if (source.isMerged) {
    throw new AppError(`Ticket ${source.ticketNumber} is already merged`, 409, "ALREADY_MERGED");
  }

  // Update source ticket
  await db.supportTicket.update({
    where: { id: sourceTicketId },
    data: {
      status: "CLOSED",
      isMerged: true,
      mergedIntoTicketId: targetTicketId,
      closedAt: new Date(),
    },
  });

  // Create system internal note on target ticket documenting merge
  await db.supportTicketMessage.create({
    data: {
      ticketId: targetTicketId,
      authorId: actorId,
      type: "INTERNAL_NOTE",
      content: `📌 Ticket ${source.ticketNumber} ("${source.subject}") was merged into this ticket.\nReason: ${reason || "Duplicate issue resolution"}`,
    },
  });

  await recordTicketEvent({
    ticketId: sourceTicketId,
    actorId,
    eventType: "TICKET_MERGED",
    newValue: target.ticketNumber,
    metadata: { targetTicketId, reason },
  });

  await recordTicketEvent({
    ticketId: targetTicketId,
    actorId,
    eventType: "TICKET_MERGE_RECEIVED",
    newValue: source.ticketNumber,
    metadata: { sourceTicketId, reason },
  });

  return { success: true, sourceTicketNumber: source.ticketNumber, targetTicketNumber: target.ticketNumber };
}

// Enterprise Ticket Splitting
export async function splitTicket(params: {
  sourceTicketId: string;
  subject: string;
  description: string;
  categoryId?: string;
  actorId: string;
}) {
  const { sourceTicketId, subject, description, categoryId, actorId } = params;

  const source = await db.supportTicket.findUnique({ where: { id: sourceTicketId } });
  if (!source) throw new AppError("Source ticket not found", 404, "NOT_FOUND");

  const ticketNumber = await generateTicketNumber();

  const newTicket = await db.supportTicket.create({
    data: {
      ticketNumber,
      userId: source.userId,
      workspaceId: source.workspaceId,
      websiteId: source.websiteId,
      categoryId: categoryId || source.categoryId,
      subject: subject.trim(),
      description: description.trim(),
      status: "NEW",
      priority: source.priority,
      source: "SYSTEM",
      parentTicketId: sourceTicketId,
    },
  });

  // Record audit events on both tickets
  await recordTicketEvent({
    ticketId: sourceTicketId,
    actorId,
    eventType: "TICKET_SPLIT",
    newValue: newTicket.ticketNumber,
    metadata: { newTicketId: newTicket.id, subject },
  });

  await recordTicketEvent({
    ticketId: newTicket.id,
    actorId,
    eventType: "TICKET_CREATED_VIA_SPLIT",
    oldValue: source.ticketNumber,
    metadata: { parentTicketId: sourceTicketId },
  });

  return newTicket;
}

// Enterprise Duplicate Detection
export async function detectDuplicateTickets(params: {
  userId?: string;
  websiteId?: string;
  subject: string;
}) {
  const { userId, websiteId, subject } = params;

  const where: any = {
    status: { in: ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "CUSTOMER_REPLIED"] },
  };

  if (userId) where.userId = userId;
  if (websiteId) where.websiteId = websiteId;

  const activeTickets = await db.supportTicket.findMany({
    where,
    select: {
      id: true,
      ticketNumber: true,
      subject: true,
      status: true,
      createdAt: true,
      user: { select: { fullName: true, email: true } },
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  const cleanSubject = subject.toLowerCase().replace(/[^a-z0-9 ]/g, "");

  const duplicates = activeTickets
    .map((t: any) => {
      const targetSub = t.subject.toLowerCase().replace(/[^a-z0-9 ]/g, "");
      const isExactMatch = cleanSubject === targetSub;
      const isPartialMatch = cleanSubject.includes(targetSub) || targetSub.includes(cleanSubject);
      let similarityScore = 0;
      if (isExactMatch) similarityScore = 1.0;
      else if (isPartialMatch) similarityScore = 0.8;
      else {
        const wordsA = new Set(cleanSubject.split(/\s+/).filter((w: string) => w.length > 3));
        const wordsB = new Set(targetSub.split(/\s+/).filter((w: string) => w.length > 3));
        const intersection = [...wordsA].filter(w => wordsB.has(w));
        if (wordsA.size > 0 && intersection.length > 0) {
          similarityScore = intersection.length / Math.max(wordsA.size, wordsB.size);
        }
      }
      return { ...t, similarityScore };
    })
    .filter((t: any) => t.similarityScore > 0.4)
    .sort((a: any, b: any) => b.similarityScore - a.similarityScore);

  return duplicates;
}

