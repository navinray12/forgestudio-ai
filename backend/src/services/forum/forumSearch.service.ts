import { prisma } from "../../config/prisma.js";
import { isForumModeratorRole } from "../../middlewares/forumAuthorization.middleware.js";

const db = prisma as any;

export interface ForumSearchFilters {
  query?: string;
  categoryId?: string;
  categorySlug?: string;
  tag?: string;
  status?: string;
  solved?: boolean;
  unanswered?: boolean;
  featured?: boolean;
  workspaceId?: string;
  authorId?: string;
  page?: number;
  limit?: number;
  sortBy?: "latest" | "popular" | "activity" | "views" | "replies";
}

export async function searchTopics(filters: ForumSearchFilters, currentUserId?: string, currentUserRole?: string) {
  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const isModerator = isForumModeratorRole(currentUserRole);

  const andConditions: any[] = [];

  // Visibility & Workspace Isolation:
  // Non-moderators can only see PUBLIC topics, or WORKSPACE topics in their authorized workspace, or topics they authored.
  if (!isModerator) {
    const visibilityClauses: any[] = [{ visibility: "PUBLIC" }];
    if (filters.workspaceId) {
      visibilityClauses.push({ workspaceId: filters.workspaceId });
    }
    if (currentUserId) {
      visibilityClauses.push({ authorId: currentUserId });
    }
    andConditions.push({ OR: visibilityClauses });
    andConditions.push({ status: { not: "HIDDEN" } });
  }

  if (filters.categoryId) {
    andConditions.push({ categoryId: filters.categoryId });
  }

  if (filters.categorySlug) {
    const category = await db.forumCategory.findUnique({ where: { slug: filters.categorySlug } });
    if (category) {
      andConditions.push({ categoryId: category.id });
    }
  }

  if (filters.authorId) {
    andConditions.push({ authorId: filters.authorId });
  }

  if (filters.status && isModerator) {
    andConditions.push({ status: filters.status });
  }

  if (filters.solved === true) {
    andConditions.push({ isSolved: true });
  } else if (filters.solved === false) {
    andConditions.push({ isSolved: false });
  }

  if (filters.unanswered === true) {
    andConditions.push({ replyCount: 0 });
  }

  if (filters.featured === true) {
    andConditions.push({ isFeatured: true });
  }

  if (filters.tag) {
    andConditions.push({ tags: { has: filters.tag.toLowerCase() } });
  }

  if (filters.query && filters.query.trim().length > 0) {
    const q = filters.query.trim();
    andConditions.push({
      OR: [
        { topicNumber: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
        { author: { fullName: { contains: q, mode: "insensitive" } } },
        { author: { email: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const where = andConditions.length > 0 ? { AND: andConditions } : {};

  let orderBy: any = { isPinned: "desc" };

  switch (filters.sortBy) {
    case "popular":
      orderBy = [{ isPinned: "desc" }, { viewCount: "desc" }];
      break;
    case "activity":
      orderBy = [{ isPinned: "desc" }, { lastActivityAt: "desc" }];
      break;
    case "replies":
      orderBy = [{ isPinned: "desc" }, { replyCount: "desc" }];
      break;
    case "views":
      orderBy = [{ isPinned: "desc" }, { viewCount: "desc" }];
      break;
    case "latest":
    default:
      orderBy = [{ isPinned: "desc" }, { createdAt: "desc" }];
      break;
  }

  const [total, items] = await Promise.all([
    db.forumTopic.count({ where }),
    db.forumTopic.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        author: { select: { id: true, fullName: true, email: true, role: true } },
        category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
        workspace: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
