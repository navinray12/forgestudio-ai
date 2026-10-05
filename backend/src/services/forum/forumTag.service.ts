import { prisma } from "../../config/prisma.js";

const db = prisma as any;

export async function listTags(query?: string) {
  const where: any = {};
  if (query && query.trim()) {
    where.name = { contains: query.trim(), mode: "insensitive" };
  }

  const tags = await db.forumTag.findMany({
    where,
    orderBy: { usageCount: "desc" },
    take: 50,
  });

  return tags;
}
