import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { validateCreateTopicPayload } from "../../validators/forum.validator.js";
import { isForumModeratorRole } from "../../middlewares/forumAuthorization.middleware.js";

const db = prisma as any;

export async function generateTopicNumber(): Promise<string> {
  const count = await db.forumTopic.count();
  const nextNum = 1001 + count;
  const topicNumber = `FMT-${nextNum}`;

  const exists = await db.forumTopic.findUnique({
    where: { topicNumber },
  });

  if (exists) {
    const timestamp = Date.now().toString().slice(-4);
    return `FMT-${nextNum}-${timestamp}`;
  }

  return topicNumber;
}

export async function generateUniqueSlug(title: string): Promise<string> {
  let baseSlug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);

  if (!baseSlug) baseSlug = "topic";

  const count = await db.forumTopic.count({
    where: { slug: { startsWith: baseSlug } },
  });

  if (count === 0) return baseSlug;
  return `${baseSlug}-${count + 1}`;
}

export async function createTopic(params: {
  userId: string;
  userRole: string;
  body: any;
}) {
  const input = validateCreateTopicPayload(params.body);

  const category = await db.forumCategory.findUnique({
    where: { id: input.categoryId },
  });

  if (!category || !category.isActive) {
    throw new AppError("Invalid or inactive category selected", 422, "VALIDATION_ERROR");
  }

  // Workspace validation if scoping specified
  let workspaceId: string | null = null;
  if (input.workspaceId) {
    const ws = await db.workspace.findUnique({ where: { id: input.workspaceId } });
    if (ws) workspaceId = ws.id;
  }

  const topicNumber = await generateTopicNumber();
  const slug = await generateUniqueSlug(input.title);

  const topic = await db.forumTopic.create({
    data: {
      topicNumber,
      title: input.title,
      slug,
      content: input.content,
      categoryId: input.categoryId,
      authorId: params.userId,
      workspaceId,
      websiteId: input.websiteId || null,
      status: "OPEN",
      visibility: input.visibility || "PUBLIC",
      tags: input.tags || [],
      contextData: input.contextData || {},
      lastActivityAt: new Date(),
    },
    include: {
      author: { select: { id: true, fullName: true, email: true, role: true } },
      category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
      workspace: { select: { id: true, name: true, slug: true } },
    },
  });

  // Auto-follow own created topic
  await db.forumTopicFollower.create({
    data: {
      topicId: topic.id,
      userId: params.userId,
    },
  }).catch(() => null);

  // Update tag usage counters
  if (input.tags && input.tags.length > 0) {
    for (const tagName of input.tags) {
      const tagSlug = tagName.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      await db.forumTag.upsert({
        where: { slug: tagSlug },
        create: { name: tagName, slug: tagSlug, usageCount: 1 },
        update: { usageCount: { increment: 1 } },
      }).catch(() => null);
    }
  }

  return topic;
}

export async function getTopicByIdOrSlug(idOrSlug: string, currentUserId?: string, currentUserRole?: string) {
  const isModerator = isForumModeratorRole(currentUserRole);

  const topic = await db.forumTopic.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }, { topicNumber: idOrSlug }],
    },
    include: {
      author: { select: { id: true, fullName: true, email: true, role: true } },
      category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
      workspace: { select: { id: true, name: true, slug: true } },
      attachments: true,
      posts: {
        where: isModerator ? {} : { isHidden: false },
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, fullName: true, email: true, role: true } },
          reactions: {
            include: { user: { select: { id: true, fullName: true } } },
          },
          attachments: true,
          replies: {
            where: isModerator ? {} : { isHidden: false },
            orderBy: { createdAt: "asc" },
            include: {
              author: { select: { id: true, fullName: true, email: true, role: true } },
              reactions: true,
            },
          },
        },
      },
    },
  });

  if (!topic) {
    throw new AppError("Topic not found", 404, "NOT_FOUND");
  }

  // Visibility & Workspace Isolation check
  if (topic.visibility !== "PUBLIC" && !isModerator) {
    if (!currentUserId) {
      throw new AppError("Authentication required to view this topic", 401, "UNAUTHORIZED");
    }

    if (topic.authorId !== currentUserId) {
      let isMember = false;
      if (topic.workspaceId) {
        const member = await db.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: topic.workspaceId,
              userId: currentUserId,
            },
          },
        });
        if (member) isMember = true;
      }

      if (!isMember) {
        throw new AppError("You do not have permission to view this private topic", 403, "FORBIDDEN");
      }
    }
  }

  // Increment view count asynchronously
  db.forumTopic.update({
    where: { id: topic.id },
    data: { viewCount: { increment: 1 } },
  }).catch(() => null);

  // Check if current user bookmarked or followed
  let isBookmarked = false;
  let isFollowed = false;

  if (currentUserId) {
    const [bm, fl] = await Promise.all([
      db.forumBookmark.findUnique({
        where: { topicId_userId: { topicId: topic.id, userId: currentUserId } },
      }),
      db.forumTopicFollower.findUnique({
        where: { topicId_userId: { topicId: topic.id, userId: currentUserId } },
      }),
    ]);
    isBookmarked = !!bm;
    isFollowed = !!fl;
  }

  return {
    ...topic,
    isBookmarked,
    isFollowed,
  };
}
