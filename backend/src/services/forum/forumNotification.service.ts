import { prisma } from "../../config/prisma.js";

const db = prisma as any;

export interface ForumNotificationPayload {
  topicId: string;
  recipientUserId: string;
  eventType: string;
  title: string;
  message: string;
}

export async function dispatchForumNotification(payload: ForumNotificationPayload) {
  try {
    await db.auditLog.create({
      data: {
        userId: payload.recipientUserId,
        action: `FORUM_NOTIFICATION_${payload.eventType}`,
        targetResource: `ForumTopic:${payload.topicId}`,
        details: {
          title: payload.title,
          message: payload.message,
          timestamp: new Date().toISOString(),
        },
      },
    });

    console.log(
      `[Forum Notification] To User ${payload.recipientUserId} | Topic ${payload.topicId} | ${payload.title}: ${payload.message}`
    );
  } catch (err) {
    console.error("Failed to dispatch forum notification:", err);
  }
}

export async function notifyTopicFollowers(topic: any, actorId: string, replyContent: string) {
  const followers = await db.forumTopicFollower.findMany({
    where: { topicId: topic.id },
  });

  for (const follow of followers) {
    if (follow.userId !== actorId) {
      await dispatchForumNotification({
        topicId: topic.id,
        recipientUserId: follow.userId,
        eventType: "NEW_REPLY",
        title: `New reply in followed topic: ${topic.title}`,
        message: replyContent.substring(0, 120),
      });
    }
  }
}
