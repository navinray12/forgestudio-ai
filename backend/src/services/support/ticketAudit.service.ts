import { prisma } from "../../config/prisma.js";
import { recordAuditLog } from "../audit.service.js";

const db = prisma as any;

export type TicketAuditEventType =
  | "TICKET_CREATED"
  | "ASSIGNED"
  | "UNASSIGNED"
  | "STATUS_CHANGED"
  | "PRIORITY_CHANGED"
  | "CATEGORY_CHANGED"
  | "MESSAGE_ADDED"
  | "INTERNAL_NOTE_ADDED"
  | "ATTACHMENT_ADDED"
  | "RESOLVED"
  | "REOPENED"
  | "CLOSED"
  | "TICKET_MERGED"
  | "TICKET_MERGE_RECEIVED"
  | "TICKET_SPLIT"
  | "TICKET_CREATED_VIA_SPLIT"
  | "BULK_UPDATED"
  | "AGENT_ASSIGNED"
  | "TEAM_ASSIGNED"
  | "TAGS_UPDATED"
  | "CSAT_RATING_SUBMITTED";

export interface RecordTicketEventInput {
  ticketId: string;
  actorId: string;
  eventType: TicketAuditEventType;
  oldValue?: string;
  newValue?: string;
  metadata?: any;
}

export async function recordTicketEvent(input: RecordTicketEventInput) {
  try {
    const event = await db.supportTicketEvent.create({
      data: {
        ticketId: input.ticketId,
        actorId: input.actorId,
        eventType: input.eventType,
        oldValue: input.oldValue,
        newValue: input.newValue,
        metadata: input.metadata || {},
      },
    });

    // Also record into system audit log for centralized auditing
    await recordAuditLog({
      userId: input.actorId,
      action: `SUPPORT_${input.eventType}`,
      targetResource: `SupportTicket:${input.ticketId}`,
      details: {
        eventType: input.eventType,
        oldValue: input.oldValue,
        newValue: input.newValue,
        metadata: input.metadata,
      },
    });

    return event;
  } catch (error) {
    console.error("Failed to record support ticket audit event:", error);
    return null;
  }
}

export async function getTicketEvents(ticketId: string) {
  return await db.supportTicketEvent.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
    include: {
      actor: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
    },
  });
}
