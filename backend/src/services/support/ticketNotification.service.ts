import { prisma } from "../../config/prisma.js";

const db = prisma as any;

export interface NotificationPayload {
  ticketId: string;
  recipientUserId: string;
  eventType: string;
  title: string;
  message: string;
}

export async function dispatchTicketNotification(payload: NotificationPayload) {
  try {
    // Log system audit log for notification tracking
    await db.auditLog.create({
      data: {
        userId: payload.recipientUserId,
        action: `NOTIFICATION_${payload.eventType}`,
        targetResource: `SupportTicket:${payload.ticketId}`,
        details: {
          title: payload.title,
          message: payload.message,
          timestamp: new Date().toISOString(),
        },
      },
    });

    console.log(
      `[Support Notification] To User ${payload.recipientUserId} | Ticket ${payload.ticketId} | ${payload.title}: ${payload.message}`
    );
  } catch (err) {
    console.error("Failed to dispatch ticket notification:", err);
  }
}

export async function notifyTicketCreated(ticket: any) {
  await dispatchTicketNotification({
    ticketId: ticket.id,
    recipientUserId: ticket.userId,
    eventType: "TICKET_CREATED",
    title: `Ticket Received: ${ticket.ticketNumber}`,
    message: `Your ticket "${ticket.subject}" has been created successfully.`,
  });
}

export async function notifyAgentAssigned(ticket: any, agentId: string) {
  await dispatchTicketNotification({
    ticketId: ticket.id,
    recipientUserId: agentId,
    eventType: "TICKET_ASSIGNED",
    title: `Ticket Assigned: ${ticket.ticketNumber}`,
    message: `Ticket "${ticket.subject}" has been assigned to you.`,
  });
}

export async function notifyPublicReply(ticket: any, authorId: string, content: string) {
  const isAuthorCustomer = authorId === ticket.userId;

  if (isAuthorCustomer) {
    // Notify assigned agent or staff queue
    if (ticket.assignedAgentId) {
      await dispatchTicketNotification({
        ticketId: ticket.id,
        recipientUserId: ticket.assignedAgentId,
        eventType: "CUSTOMER_REPLIED",
        title: `Customer Replied: ${ticket.ticketNumber}`,
        message: content.substring(0, 100),
      });
    }
  } else {
    // Notify customer
    await dispatchTicketNotification({
      ticketId: ticket.id,
      recipientUserId: ticket.userId,
      eventType: "AGENT_REPLIED",
      title: `Reply Received: ${ticket.ticketNumber}`,
      message: content.substring(0, 100),
    });
  }
}

export async function notifyStatusChange(ticket: any, oldStatus: string, newStatus: string, actorId: string) {
  if (actorId !== ticket.userId) {
    await dispatchTicketNotification({
      ticketId: ticket.id,
      recipientUserId: ticket.userId,
      eventType: "STATUS_CHANGED",
      title: `Status Updated: ${ticket.ticketNumber}`,
      message: `Your ticket status changed from ${oldStatus} to ${newStatus}.`,
    });
  }
}
