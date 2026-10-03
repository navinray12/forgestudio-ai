import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";

const db = prisma as any;

export async function toggleBookmark(topicId: string, userId: string) {
  const topic = await db.forumTopic.findUnique({ where: { id: topicId } });
  if (!topic) throw new AppError("Topic not found", 404, "NOT_FOUND");

  const existing = await db.forumBookmark.findUnique({
    where: { topicId_userId: { topicId, userId } },
  });

  if (existing) {
    await db.forumBookmark.delete({ where: { id: existing.id } });
    return { bookmarked: false };
  } else {
    await db.forumBookmark.create({ data: { topicId, userId } });
    return { bookmarked: true };
  }
}

export async function toggleFollow(topicId: string, userId: string) {
  const topic = await db.forumTopic.findUnique({ where: { id: topicId } });
  if (!topic) throw new AppError("Topic not found", 404, "NOT_FOUND");

  const existing = await db.forumTopicFollower.findUnique({
    where: { topicId_userId: { topicId, userId } },
  });

  if (existing) {
    await db.forumTopicFollower.delete({ where: { id: existing.id } });
    return { followed: false };
  } else {
    await db.forumTopicFollower.create({ data: { topicId, userId } });
    return { followed: true };
  }
}

export async function getUserBookmarks(userId: string) {
  const bookmarks = await db.forumBookmark.findMany({
    where: { userId },
    include: {
      topic: {
        include: {
          author: { select: { id: true, fullName: true } },
          category: { select: { id: true, name: true, slug: true, color: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return bookmarks.map((b: any) => b.topic);
}
