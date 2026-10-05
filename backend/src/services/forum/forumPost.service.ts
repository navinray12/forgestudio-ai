import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { validateCreatePostPayload } from "../../validators/forum.validator.js";
import { isForumModeratorRole } from "../../middlewares/forumAuthorization.middleware.js";
import { notifyTopicFollowers } from "./forumNotification.service.js";

const db = prisma as any;

export async function createPost(params: {
  topicId: string;
  userId: string;
  userRole: string;
  body: any;
}) {
  const input = validateCreatePostPayload(params.body);

  const topic = await db.forumTopic.findUnique({
    where: { id: params.topicId },
  });

  if (!topic) {
    throw new AppError("Topic not found", 404, "NOT_FOUND");
  }

  if (topic.isLocked || topic.status === "LOCKED") {
    throw new AppError("This topic is locked for replies", 403, "TOPIC_LOCKED");
  }

  // Validate parent post if provided
  if (input.parentPostId) {
    const parentPost = await db.forumPost.findUnique({
      where: { id: input.parentPostId },
    });
    if (!parentPost || parentPost.topicId !== params.topicId) {
      throw new AppError("Invalid parent reply specified", 422, "VALIDATION_ERROR");
    }
  }

  const post = await db.forumPost.create({
    data: {
      topicId: params.topicId,
      authorId: params.userId,
      parentPostId: input.parentPostId || null,
      content: input.content,
    },
    include: {
      author: { select: { id: true, fullName: true, email: true, role: true } },
      reactions: true,
      attachments: true,
    },
  });

  // Update topic reply count and lastActivityAt
  await db.forumTopic.update({
    where: { id: params.topicId },
    data: {
      replyCount: { increment: 1 },
      lastActivityAt: new Date(),
    },
  });

  // Notify topic followers
  notifyTopicFollowers(topic, params.userId, input.content).catch(() => null);

  return post;
}

export async function editPost(postId: string, userId: string, userRole: string, newContent: string) {
  const post = await db.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw new AppError("Post not found", 404, "NOT_FOUND");

  const isModerator = isForumModeratorRole(userRole);
  if (!isModerator && post.authorId !== userId) {
    throw new AppError("You can only edit your own posts", 403, "FORBIDDEN");
  }

  const updated = await db.forumPost.update({
    where: { id: postId },
    data: {
      content: newContent,
      editedAt: new Date(),
      editedById: userId,
    },
  });

  return updated;
}

export async function deletePost(postId: string, userId: string, userRole: string) {
  const post = await db.forumPost.findUnique({ where: { id: postId } });
  if (!post) throw new AppError("Post not found", 404, "NOT_FOUND");

  const isModerator = isForumModeratorRole(userRole);
  if (!isModerator && post.authorId !== userId) {
    throw new AppError("You can only delete your own posts", 403, "FORBIDDEN");
  }

  // Soft-delete post by marking isHidden
  const updated = await db.forumPost.update({
    where: { id: postId },
    data: { isHidden: true },
  });

  return updated;
}
