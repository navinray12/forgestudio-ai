import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { recordTicketEvent } from "./ticketAudit.service.js";

const db = prisma as any;

export async function submitCsatRating(params: {
  ticketId: string;
  userId: string;
  score: number;
  comment?: string;
}) {
  const { ticketId, userId, score, comment } = params;

  if (score < 1 || score > 5) {
    throw new AppError("Rating score must be an integer between 1 and 5", 422, "VALIDATION_ERROR");
  }

  const ticket = await db.supportTicket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) {
    throw new AppError("Ticket not found", 404, "NOT_FOUND");
  }

  if (ticket.userId !== userId) {
    throw new AppError("Only the ticket creator can submit feedback", 403, "FORBIDDEN");
  }

  if (ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") {
    throw new AppError("Feedback can only be submitted for resolved or closed tickets", 409, "INVALID_STATE");
  }

  const updated = await db.supportTicket.update({
    where: { id: ticketId },
    data: {
      csatScore: score,
      csatComment: comment ? comment.trim() : null,
      csatRatedAt: new Date(),
    },
  });

  await recordTicketEvent({
    ticketId,
    actorId: userId,
    eventType: "CSAT_RATING_SUBMITTED",
    newValue: `${score} Stars`,
    metadata: { score, comment },
  });

  return updated;
}
