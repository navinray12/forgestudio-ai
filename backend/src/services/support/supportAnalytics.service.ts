import { prisma } from "../../config/prisma.js";
import { getSlaStatus } from "./ticketSla.service.js";

const db = prisma as any;

export async function getSupportAnalytics(params: {
  workspaceId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const where: any = {};

  if (params.workspaceId) where.workspaceId = params.workspaceId;
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) where.createdAt.gte = new Date(params.startDate);
    if (params.endDate) where.createdAt.lte = new Date(params.endDate);
  }

  const [
    total,
    statusCountsRaw,
    priorityCountsRaw,
    categoryCountsRaw,
    allTickets,
  ] = await Promise.all([
    db.supportTicket.count({ where }),
    db.supportTicket.groupBy({
      by: ["status"],
      where,
      _count: { status: true },
    }),
    db.supportTicket.groupBy({
      by: ["priority"],
      where,
      _count: { priority: true },
    }),
    db.supportTicket.groupBy({
      by: ["categoryId"],
      where,
      _count: { categoryId: true },
    }),
    db.supportTicket.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        firstResponseAt: true,
        resolvedAt: true,
        status: true,
        priority: true,
      },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  statusCountsRaw.forEach((sc: any) => {
    statusCounts[sc.status] = sc._count.status;
  });

  const priorityCounts: Record<string, number> = {};
  priorityCountsRaw.forEach((pc: any) => {
    priorityCounts[pc.priority] = pc._count.priority;
  });

  let totalFirstResponseMinutes = 0;
  let firstResponseCount = 0;
  let totalResolutionMinutes = 0;
  let resolutionCount = 0;
  let slaOnTrackOrCompleted = 0;

  allTickets.forEach((t: any) => {
    if (t.firstResponseAt) {
      const diffMs = new Date(t.firstResponseAt).getTime() - new Date(t.createdAt).getTime();
      totalFirstResponseMinutes += Math.max(diffMs / (1000 * 60), 0);
      firstResponseCount++;
    }

    if (t.resolvedAt) {
      const diffMs = new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime();
      totalResolutionMinutes += Math.max(diffMs / (1000 * 60), 0);
      resolutionCount++;
    }

    const sla = getSlaStatus({
      createdAt: t.createdAt,
      firstResponseAt: t.firstResponseAt,
      resolvedAt: t.resolvedAt,
      priority: t.priority,
    });

    if (sla.status === "ON_TRACK" || sla.status === "COMPLETED") {
      slaOnTrackOrCompleted++;
    }
  });

  const avgFirstResponseMinutes = firstResponseCount > 0
    ? Math.round(totalFirstResponseMinutes / firstResponseCount)
    : 0;

  const avgResolutionMinutes = resolutionCount > 0
    ? Math.round(totalResolutionMinutes / resolutionCount)
    : 0;

  const slaCompliancePercentage = total > 0
    ? Math.round((slaOnTrackOrCompleted / total) * 100)
    : 100;

  return {
    metrics: {
      totalTickets: total,
      newTickets: statusCounts["NEW"] || 0,
      openTickets: statusCounts["OPEN"] || 0,
      inProgressTickets: statusCounts["IN_PROGRESS"] || 0,
      waitingCustomerTickets: statusCounts["WAITING_FOR_CUSTOMER"] || 0,
      customerRepliedTickets: statusCounts["CUSTOMER_REPLIED"] || 0,
      resolvedTickets: statusCounts["RESOLVED"] || 0,
      closedTickets: statusCounts["CLOSED"] || 0,
      reopenedTickets: statusCounts["REOPENED"] || 0,
      avgFirstResponseMinutes,
      avgResolutionMinutes,
      slaCompliancePercentage,
    },
    byStatus: statusCounts,
    byPriority: priorityCounts,
    byCategory: categoryCountsRaw.map((c: any) => ({
      categoryId: c.categoryId,
      count: c._count.categoryId,
    })),
  };
}
