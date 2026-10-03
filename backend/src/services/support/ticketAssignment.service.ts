import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { isSupportStaffRole } from "../../middlewares/supportAuthorization.middleware.js";
import { recordTicketEvent } from "./ticketAudit.service.js";
import { notifyAgentAssigned } from "./ticketNotification.service.js";

const db = prisma as any;

export async function assignTicketAgent(params: {
  ticketId: string;
  agentId: string | null;
  actorId: string;
}) {
  const ticket = await db.supportTicket.findUnique({
    where: { id: params.ticketId },
    include: { assignedAgent: true },
  });

  if (!ticket) throw new AppError("Ticket not found", 404, "NOT_FOUND");

  let newAgent = null;
  if (params.agentId) {
    newAgent = await db.user.findUnique({
      where: { id: params.agentId },
      select: { id: true, fullName: true, email: true, role: true },
    });

    if (!newAgent) throw new AppError("Assigned user not found", 404, "NOT_FOUND");

    if (!isSupportStaffRole(newAgent.role)) {
      throw new AppError(
        `User ${newAgent.email} cannot be assigned to support tickets as they lack a support agent role.`,
        422,
        "INVALID_ASSIGNMENT"
      );
    }
  }

  const oldAgentId = ticket.assignedAgentId;
  const oldAgentName = ticket.assignedAgent?.fullName || oldAgentId || "Unassigned";
  const newAgentName = newAgent?.fullName || params.agentId || "Unassigned";

  const updated = await db.supportTicket.update({
    where: { id: params.ticketId },
    data: {
      assignedAgentId: params.agentId,
      status: ticket.status === "NEW" ? "OPEN" : ticket.status,
    },
    include: {
      assignedAgent: { select: { id: true, fullName: true, email: true } },
      assignedTeam: { select: { id: true, name: true } },
    },
  });

  await recordTicketEvent({
    ticketId: params.ticketId,
    actorId: params.actorId,
    eventType: params.agentId ? "ASSIGNED" : "UNASSIGNED",
    oldValue: oldAgentName,
    newValue: newAgentName,
    metadata: { agentId: params.agentId },
  });

  if (params.agentId) {
    await notifyAgentAssigned(updated, params.agentId);
  }

  return updated;
}

export async function assignTicketTeam(params: {
  ticketId: string;
  teamId: string | null;
  actorId: string;
}) {
  const ticket = await db.supportTicket.findUnique({
    where: { id: params.ticketId },
    include: { assignedTeam: true },
  });

  if (!ticket) throw new AppError("Ticket not found", 404, "NOT_FOUND");

  let newTeam = null;
  if (params.teamId) {
    newTeam = await db.supportTeam.findUnique({
      where: { id: params.teamId },
    });
    if (!newTeam) throw new AppError("Support team not found", 404, "NOT_FOUND");
  }

  const oldTeamName = ticket.assignedTeam?.name || ticket.assignedTeamId || "No Team";
  const newTeamName = newTeam?.name || params.teamId || "No Team";

  const updated = await db.supportTicket.update({
    where: { id: params.ticketId },
    data: { assignedTeamId: params.teamId },
    include: {
      assignedAgent: { select: { id: true, fullName: true, email: true } },
      assignedTeam: { select: { id: true, name: true } },
    },
  });

  await recordTicketEvent({
    ticketId: params.ticketId,
    actorId: params.actorId,
    eventType: "ASSIGNED",
    oldValue: `Team: ${oldTeamName}`,
    newValue: `Team: ${newTeamName}`,
    metadata: { teamId: params.teamId },
  });

  return updated;
}
