import type { Request, Response, NextFunction } from "express";
import {
  createSupportTicket,
  getTicketById,
  updateTicketStatus,
  updateTicketPriority,
  getCategories,
  createCategory,
  getTeams,
  createTeam,
  addTeamMember,
} from "../services/support/ticket.service.js";
import { addTicketMessage } from "../services/support/ticketMessage.service.js";
import { assignTicketAgent, assignTicketTeam } from "../services/support/ticketAssignment.service.js";
import { searchTickets } from "../services/support/ticketSearch.service.js";
import { saveSupportAttachment, getAttachmentFilePath } from "../services/support/ticketAttachment.service.js";
import { getSupportAnalytics } from "../services/support/supportAnalytics.service.js";
import { getTicketEvents } from "../services/support/ticketAudit.service.js";
import { getOrCreateDefaultSlaPolicies } from "../services/support/ticketSla.service.js";
import { AppError } from "../utils/app-error.js";
import fs from "fs";

export async function createTicketHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const ticket = await createSupportTicket({
      userId: user.id,
      userRole: user.role,
      body: req.body,
    });
    res.status(201).json({ success: true, ticket });
  } catch (error) {
    next(error);
  }
}

export async function listTicketsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const filters = {
      query: req.query.query as string,
      status: req.query.status as any,
      priority: req.query.priority as any,
      categoryId: req.query.categoryId as string,
      assignedAgentId: req.query.assignedAgentId as string,
      assignedTeamId: req.query.assignedTeamId as string,
      workspaceId: req.query.workspaceId as string,
      websiteId: req.query.websiteId as string,
      userId: req.query.userId as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 25,
      sortBy: req.query.sortBy as any,
      sortOrder: req.query.sortOrder as any,
    };

    const result = await searchTickets(filters, user.role, user.id);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getTicketHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const ticketId = req.params.id as string;
    const ticket = await getTicketById(ticketId, user.id, user.role);
    res.status(200).json({ success: true, ticket });
  } catch (error) {
    next(error);
  }
}

export async function addMessageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const ticketId = req.params.id as string;
    const message = await addTicketMessage({
      ticketId,
      authorId: user.id,
      authorRole: user.role,
      content: req.body.content,
      type: req.body.type || "PUBLIC_REPLY",
    });
    res.status(201).json({ success: true, message });
  } catch (error) {
    next(error);
  }
}

export async function addInternalNoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const ticketId = req.params.id as string;
    const message = await addTicketMessage({
      ticketId,
      authorId: user.id,
      authorRole: user.role,
      content: req.body.content,
      type: "INTERNAL_NOTE",
    });
    res.status(201).json({ success: true, message });
  } catch (error) {
    next(error);
  }
}

export async function uploadAttachmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const ticketId = req.params.id as string;
    const reqFile = (req as any).file;

    // Check authorization to ticket first
    await getTicketById(ticketId, user.id, user.role);

    if (!reqFile) {
      throw new AppError("No attachment file provided in request", 400, "VALIDATION_ERROR");
    }

    const attachment = await saveSupportAttachment({
      ticketId,
      messageId: req.body.messageId || undefined,
      uploadedById: user.id,
      fileBuffer: reqFile.buffer,
      originalName: reqFile.originalname,
      mimeType: reqFile.mimetype,
    });

    res.status(201).json({ success: true, attachment });
  } catch (error) {
    next(error);
  }
}

export async function downloadAttachmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const ticketId = req.params.id as string;
    const attachmentId = req.params.attachmentId as string;

    // SECURITY / IDOR CHECK: Verify user can access the ticket first!
    await getTicketById(ticketId, user.id, user.role);

    const { attachment, fullPath } = await getAttachmentFilePath(attachmentId);

    if (attachment.ticketId !== ticketId) {
      throw new AppError("Attachment does not belong to the specified ticket", 403, "FORBIDDEN");
    }

    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${attachment.fileName}"`);

    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

export async function assignTicketHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const ticketId = req.params.id as string;
    const { agentId, teamId } = req.body;

    let updatedTicket = null;
    if (agentId !== undefined) {
      updatedTicket = await assignTicketAgent({
        ticketId,
        agentId,
        actorId: user.id,
      });
    }

    if (teamId !== undefined) {
      updatedTicket = await assignTicketTeam({
        ticketId,
        teamId,
        actorId: user.id,
      });
    }

    res.status(200).json({ success: true, ticket: updatedTicket });
  } catch (error) {
    next(error);
  }
}

export async function updateStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const ticketId = req.params.id as string;
    const { status } = req.body;

    const ticket = await updateTicketStatus({
      ticketId,
      newStatus: status,
      actorId: user.id,
      actorRole: user.role,
    });

    res.status(200).json({ success: true, ticket });
  } catch (error) {
    next(error);
  }
}

export async function updatePriorityHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const ticketId = req.params.id as string;
    const { priority } = req.body;

    const ticket = await updateTicketPriority({
      ticketId,
      newPriority: priority,
      actorId: user.id,
      actorRole: user.role,
    });

    res.status(200).json({ success: true, ticket });
  } catch (error) {
    next(error);
  }
}

export async function resolveTicketHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const ticketId = req.params.id as string;

    const ticket = await updateTicketStatus({
      ticketId,
      newStatus: "RESOLVED",
      actorId: user.id,
      actorRole: user.role,
    });

    res.status(200).json({ success: true, ticket });
  } catch (error) {
    next(error);
  }
}

export async function reopenTicketHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const ticketId = req.params.id as string;

    const ticket = await updateTicketStatus({
      ticketId,
      newStatus: "REOPENED",
      actorId: user.id,
      actorRole: user.role,
    });

    res.status(200).json({ success: true, ticket });
  } catch (error) {
    next(error);
  }
}

export async function closeTicketHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const ticketId = req.params.id as string;

    const ticket = await updateTicketStatus({
      ticketId,
      newStatus: "CLOSED",
      actorId: user.id,
      actorRole: user.role,
    });

    res.status(200).json({ success: true, ticket });
  } catch (error) {
    next(error);
  }
}

export async function listCategoriesHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await getCategories();
    res.status(200).json({ success: true, categories });
  } catch (error) {
    next(error);
  }
}

export async function createCategoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await createCategory(req.body);
    res.status(201).json({ success: true, category });
  } catch (error) {
    next(error);
  }
}

export async function listTeamsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const teams = await getTeams();
    res.status(200).json({ success: true, teams });
  } catch (error) {
    next(error);
  }
}

export async function createTeamHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const team = await createTeam(req.body);
    res.status(201).json({ success: true, team });
  } catch (error) {
    next(error);
  }
}

export async function addTeamMemberHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const teamId = req.params.teamId as string;
    const { userId } = req.body;
    const member = await addTeamMember(teamId, userId);
    res.status(201).json({ success: true, member });
  } catch (error) {
    next(error);
  }
}

export async function getSlaPoliciesHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const policies = await getOrCreateDefaultSlaPolicies();
    res.status(200).json({ success: true, policies });
  } catch (error) {
    next(error);
  }
}

export async function getAnalyticsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.query.workspaceId as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const analytics = await getSupportAnalytics({ workspaceId, startDate, endDate });
    res.status(200).json({ success: true, analytics });
  } catch (error) {
    next(error);
  }
}

import { mergeTickets, splitTicket, detectDuplicateTickets } from "../services/support/ticket.service.js";
import { bulkUpdateTickets } from "../services/support/ticketBulk.service.js";
import { getCannedResponses, createCannedResponse } from "../services/support/ticketCannedResponse.service.js";
import { submitCsatRating } from "../services/support/ticketCsat.service.js";

export async function getAuditLogHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const ticketId = req.params.id as string;
    const events = await getTicketEvents(ticketId);
    res.status(200).json({ success: true, events });
  } catch (error) {
    next(error);
  }
}

export async function mergeTicketsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const sourceTicketId = req.params.id as string;
    const { targetTicketId, reason } = req.body;
    const result = await mergeTickets({
      sourceTicketId,
      targetTicketId,
      actorId: user.id,
      reason,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function splitTicketHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const sourceTicketId = req.params.id as string;
    const { subject, description, categoryId } = req.body;
    const newTicket = await splitTicket({
      sourceTicketId,
      subject,
      description,
      categoryId,
      actorId: user.id,
    });
    res.status(201).json({ success: true, ticket: newTicket });
  } catch (error) {
    next(error);
  }
}

export async function detectDuplicatesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, websiteId, subject } = req.query;
    const duplicates = await detectDuplicateTickets({
      userId: userId as string,
      websiteId: websiteId as string,
      subject: (subject as string) || "",
    });
    res.status(200).json({ success: true, duplicates });
  } catch (error) {
    next(error);
  }
}

export async function bulkUpdateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const { ticketIds, action, payload } = req.body;
    const result = await bulkUpdateTickets({
      ticketIds,
      action,
      payload: payload || {},
      actorId: user.id,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listCannedResponsesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const categoryId = req.query.categoryId as string;
    const cannedResponses = await getCannedResponses(categoryId);
    res.status(200).json({ success: true, cannedResponses });
  } catch (error) {
    next(error);
  }
}

export async function createCannedResponseHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const { title, shortcut, content, categoryId } = req.body;
    const cannedResponse = await createCannedResponse({
      title,
      shortcut,
      content,
      categoryId,
      createdById: user.id,
    });
    res.status(201).json({ success: true, cannedResponse });
  } catch (error) {
    next(error);
  }
}

export async function submitCsatHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = res.locals.user;
    const ticketId = req.params.id as string;
    const { score, comment } = req.body;
    const updatedTicket = await submitCsatRating({
      ticketId,
      userId: user.id,
      score: parseInt(score, 10),
      comment,
    });
    res.status(200).json({ success: true, ticket: updatedTicket });
  } catch (error) {
    next(error);
  }
}

