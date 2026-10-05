import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { recordTicketEvent, RecordTicketEventInput } from "./ticketAudit.service.js";

const db = prisma as any;

export async function bulkUpdateTickets(params: {
  ticketIds: string[];
  action: "ASSIGN" | "CHANGE_STATUS" | "CHANGE_PRIORITY" | "ADD_TAGS" | "REMOVE_TAGS" | "CLOSE" | "RESOLVE";
  payload: {
    assignedAgentId?: string;
    assignedTeamId?: string;
    status?: string;
    priority?: string;
    tags?: string[];
  };
  actorId: string;
}) {
  const { ticketIds, action, payload, actorId } = params;

  if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
    throw new AppError("At least one ticket ID must be provided", 400, "VALIDATION_ERROR");
  }

  const results = [];

  for (const id of ticketIds) {
    const ticket = await db.supportTicket.findUnique({ where: { id } });
    if (!ticket) continue;

    let updateData: any = { updatedAt: new Date() };
    let eventType: RecordTicketEventInput["eventType"] = "BULK_UPDATED";
    let oldValue: string | null = null;
    let newValue: string | null = null;

    if (action === "ASSIGN") {
      if (payload.assignedAgentId !== undefined) {
        updateData.assignedAgentId = payload.assignedAgentId;
        eventType = "AGENT_ASSIGNED";
        oldValue = ticket.assignedAgentId;
        newValue = payload.assignedAgentId || "UNASSIGNED";
      }
      if (payload.assignedTeamId !== undefined) {
        updateData.assignedTeamId = payload.assignedTeamId;
        eventType = "TEAM_ASSIGNED";
        oldValue = ticket.assignedTeamId;
        newValue = payload.assignedTeamId || "UNASSIGNED";
      }
    } else if (action === "CHANGE_STATUS") {
      if (payload.status) {
        updateData.status = payload.status;
        if (payload.status === "RESOLVED") updateData.resolvedAt = new Date();
        if (payload.status === "CLOSED") updateData.closedAt = new Date();
        eventType = "STATUS_CHANGED";
        oldValue = ticket.status;
        newValue = payload.status;
      }
    } else if (action === "CHANGE_PRIORITY") {
      if (payload.priority) {
        updateData.priority = payload.priority;
        eventType = "PRIORITY_CHANGED";
        oldValue = ticket.priority;
        newValue = payload.priority;
      }
    } else if (action === "ADD_TAGS" && payload.tags) {
      const currentTags: string[] = ticket.tags || [];
      const newTags = Array.from(new Set([...currentTags, ...payload.tags]));
      updateData.tags = newTags;
      eventType = "TAGS_UPDATED";
      oldValue = currentTags.join(",");
      newValue = newTags.join(",");
    } else if (action === "REMOVE_TAGS" && payload.tags) {
      const currentTags: string[] = ticket.tags || [];
      const removeSet = new Set(payload.tags);
      const newTags = currentTags.filter((t: string) => !removeSet.has(t));
      updateData.tags = newTags;
      eventType = "TAGS_UPDATED";
      oldValue = currentTags.join(",");
      newValue = newTags.join(",");
    } else if (action === "CLOSE") {
      updateData.status = "CLOSED";
      updateData.closedAt = new Date();
      eventType = "CLOSED";
      oldValue = ticket.status;
      newValue = "CLOSED";
    } else if (action === "RESOLVE") {
      updateData.status = "RESOLVED";
      updateData.resolvedAt = new Date();
      eventType = "RESOLVED";
      oldValue = ticket.status;
      newValue = "RESOLVED";
    }

    const updated = await db.supportTicket.update({
      where: { id },
      data: updateData,
    });

    await recordTicketEvent({
      ticketId: id,
      actorId,
      eventType,
      oldValue: oldValue || undefined,
      newValue: newValue || undefined,
      metadata: { bulkAction: action },
    });

    results.push(updated);
  }

  return { success: true, count: results.length, updatedTickets: results };
}
