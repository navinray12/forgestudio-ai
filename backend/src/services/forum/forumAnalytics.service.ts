import { prisma } from "../../config/prisma.js";

const db = prisma as any;

export async function getForumAnalytics() {
  const [
    totalTopics,
    totalPosts,
    solvedTopics,
    totalCategories,
    topTags,
    activeAuthors,
  ] = await Promise.all([
    db.forumTopic.count(),
    db.forumPost.count(),
    db.forumTopic.count({ where: { isSolved: true } }),
    db.forumCategory.count({ where: { isActive: true } }),
    db.forumTag.findMany({
      orderBy: { usageCount: "desc" },
      take: 10,
    }),
    db.forumTopic.groupBy({
      by: ["authorId"],
      _count: { authorId: true },
      orderBy: { _count: { authorId: "desc" } },
      take: 5,
    }),
  ]);

  const solvedPercentage = totalTopics > 0 ? Math.round((solvedTopics / totalTopics) * 100) : 0;

  return {
    metrics: {
      totalTopics,
      totalPosts,
      solvedTopics,
      solvedPercentage,
      totalCategories,
    },
    topTags,
    topContributorsCount: activeAuthors.length,
  };
}
