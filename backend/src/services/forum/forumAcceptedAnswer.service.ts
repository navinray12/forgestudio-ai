import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { isForumModeratorRole } from "../../middlewares/forumAuthorization.middleware.js";

const db = prisma as any;

export async function toggleAcceptedAnswer(params: {
  postId: string;
  userId: string;
  userRole: string;
}) {
  const post = await db.forumPost.findUnique({
    where: { id: params.postId },
    include: { topic: true },
  });

  if (!post) throw new AppError("Post not found", 404, "NOT_FOUND");

  const topic = post.topic;
  const isModerator = isForumModeratorRole(params.userRole);

  if (!isModerator && topic.authorId !== params.userId) {
    throw new AppError("Only the topic author or a moderator can accept an answer", 403, "FORBIDDEN");
  }

  const isCurrentlyAccepted = post.isAcceptedAnswer;

  if (isCurrentlyAccepted) {
    // Unmark accepted answer
    await db.forumPost.update({
      where: { id: params.postId },
      data: { isAcceptedAnswer: false },
    });

    await db.forumTopic.update({
      where: { id: topic.id },
      data: {
        isSolved: false,
        acceptedAnswerId: null,
      },
    });

    return { isAccepted: false };
  } else {
    // Reset previous accepted answer on this topic
    await db.forumPost.updateMany({
      where: { topicId: topic.id, isAcceptedAnswer: true },
      data: { isAcceptedAnswer: false },
    });

    // Mark current post as accepted
    await db.forumPost.update({
      where: { id: params.postId },
      data: { isAcceptedAnswer: true },
    });

    await db.forumTopic.update({
      where: { id: topic.id },
      data: {
        isSolved: true,
        acceptedAnswerId: params.postId,
        status: topic.status === "OPEN" ? "SOLVED" : topic.status,
      },
    });

    return { isAccepted: true };
  }
}
