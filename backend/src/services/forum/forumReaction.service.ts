import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";

const db = prisma as any;

export async function toggleReaction(postId: string, userId: string, type: string = "LIKE") {
  const post = await db.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw new AppError("Post not found", 404, "NOT_FOUND");

  const existing = await db.forumReaction.findUnique({
    where: {
      postId_userId_type: {
        postId,
        userId,
        type,
      },
    },
  });

  if (existing) {
    await db.forumReaction.delete({
      where: { id: existing.id },
    });
    return { reacted: false, type };
  } else {
    await db.forumReaction.create({
      data: {
        postId,
        userId,
        type,
      },
    });
    return { reacted: true, type };
  }
}
