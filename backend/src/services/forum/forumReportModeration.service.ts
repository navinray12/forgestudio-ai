import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { isForumModeratorRole } from "../../middlewares/forumAuthorization.middleware.js";

const db = prisma as any;

export async function createReport(params: {
  reporterId: string;
  topicId?: string;
  postId?: string;
  reason: string;
  details?: string;
}) {
  if (!params.topicId && !params.postId) {
    throw new AppError("Must specify topicId or postId to report", 400, "VALIDATION_ERROR");
  }

  const report = await db.forumReport.create({
    data: {
      reporterId: params.reporterId,
      topicId: params.topicId || null,
      postId: params.postId || null,
      reason: params.reason,
      details: params.details || null,
      status: "PENDING",
    },
  });

  return report;
}

export async function listReports(userRole: string, status?: string) {
  if (!isForumModeratorRole(userRole)) {
    throw new AppError("Moderator permission required", 403, "FORBIDDEN");
  }

  const where: any = {};
  if (status) where.status = status;

  const reports = await db.forumReport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: { id: true, fullName: true, email: true } },
      topic: { select: { id: true, title: true, topicNumber: true } },
      post: { select: { id: true, content: true } },
    },
  });

  return reports;
}

export async function moderateTopic(params: {
  topicId: string;
  actorId: string;
  actorRole: string;
  action: "PIN" | "UNPIN" | "LOCK" | "UNLOCK" | "HIDE" | "UNHIDE" | "SOLVE" | "UNSOLVE" | "FEATURE";
  reason?: string;
}) {
  if (!isForumModeratorRole(params.actorRole)) {
    throw new AppError("Moderator permission required", 403, "FORBIDDEN");
  }

  const topic = await db.forumTopic.findUnique({ where: { id: params.topicId } });
  if (!topic) throw new AppError("Topic not found", 404, "NOT_FOUND");

  let updateData: any = {};
  let oldValue = "";
  let newValue = "";

  switch (params.action) {
    case "PIN":
      updateData = { isPinned: true };
      oldValue = String(topic.isPinned);
      newValue = "true";
      break;
    case "UNPIN":
      updateData = { isPinned: false };
      oldValue = String(topic.isPinned);
      newValue = "false";
      break;
    case "LOCK":
      updateData = { isLocked: true, status: "LOCKED" };
      oldValue = topic.status;
      newValue = "LOCKED";
      break;
    case "UNLOCK":
      updateData = { isLocked: false, status: "OPEN" };
      oldValue = topic.status;
      newValue = "OPEN";
      break;
    case "HIDE":
      updateData = { status: "HIDDEN" };
      oldValue = topic.status;
      newValue = "HIDDEN";
      break;
    case "UNHIDE":
      updateData = { status: "OPEN" };
      oldValue = topic.status;
      newValue = "OPEN";
      break;
    case "FEATURE":
      updateData = { isFeatured: !topic.isFeatured };
      oldValue = String(topic.isFeatured);
      newValue = String(!topic.isFeatured);
      break;
  }

  const updatedTopic = await db.forumTopic.update({
    where: { id: params.topicId },
    data: updateData,
  });

  await db.forumModerationEvent.create({
    data: {
      topicId: params.topicId,
      actorId: params.actorId,
      action: params.action,
      oldValue,
      newValue,
      reason: params.reason || null,
    },
  });

  return updatedTopic;
}
