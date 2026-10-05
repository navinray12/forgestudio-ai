import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { isSupportStaffRole } from "../../middlewares/supportAuthorization.middleware.js";
import { validateMessagePayload } from "../../validators/support.validator.js";
import { recordTicketEvent } from "./ticketAudit.service.js";
import { notifyPublicReply } from "./ticketNotification.service.js";

const db = prisma as any;

export async function addTicketMessage(params: {
  ticketId: string;
  authorId: string;
  authorRole: string;
  content: string;
  type?: "PUBLIC_REPLY" | "INTERNAL_NOTE";
}) {
  const validated = validateMessagePayload({
    content: params.content,
    type: params.type,
  });

  const ticket = await db.supportTicket.findUnique({
    where: { id: params.ticketId },
  });

  if (!ticket) throw new AppError("Ticket not found", 404, "NOT_FOUND");

  // Security Check: Customer CANNOT send INTERNAL_NOTE
  if (validated.type === "INTERNAL_NOTE" && !isSupportStaffRole(params.authorRole)) {
    throw new AppError("Customers are not authorized to create internal notes", 403, "FORBIDDEN");
  }

  const message = await db.supportTicketMessage.create({
    data: {
      ticketId: params.ticketId,
      authorId: params.authorId,
      type: validated.type,
      content: validated.content,
    },
    include: {
      author: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
      attachments: true,
    },
  });

  // Handle status update and response metrics on PUBLIC_REPLY
  if (validated.type === "PUBLIC_REPLY") {
    const isStaff = isSupportStaffRole(params.authorRole);
    let nextStatus = ticket.status;
    let firstResponseAt = ticket.firstResponseAt;

    if (isStaff) {
      if (!firstResponseAt) firstResponseAt = new Date();
      if (ticket.status === "CUSTOMER_REPLIED" || ticket.status === "NEW" || ticket.status === "OPEN") {
        nextStatus = "IN_PROGRESS";
      }
    } else {
      // Customer replied
      if (ticket.status === "WAITING_FOR_CUSTOMER" || ticket.status === "IN_PROGRESS") {
        nextStatus = "CUSTOMER_REPLIED";
      }
    }

    await db.supportTicket.update({
      where: { id: params.ticketId },
      data: {
        status: nextStatus,
        firstResponseAt,
        updatedAt: new Date(),
      },
    });

    await recordTicketEvent({
      ticketId: params.ticketId,
      actorId: params.authorId,
      eventType: "MESSAGE_ADDED",
      newValue: validated.content.substring(0, 50),
    });

    await notifyPublicReply(ticket, params.authorId, validated.content);
  } else {
    // Internal note
    await recordTicketEvent({
      ticketId: params.ticketId,
      actorId: params.authorId,
      eventType: "INTERNAL_NOTE_ADDED",
      newValue: validated.content.substring(0, 50),
    });
  }

  return message;
}

export async function getTicketMessages(ticketId: string, currentUserRole: string) {
  const isStaff = isSupportStaffRole(currentUserRole);

  const where: any = { ticketId };
  if (!isStaff) {
    // CRITICAL SECURITY REQUIREMENT: Never expose INTERNAL_NOTE to customers!
    where.type = "PUBLIC_REPLY";
  }

  return await db.supportTicketMessage.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      author: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
      attachments: true,
    },
  });
}
