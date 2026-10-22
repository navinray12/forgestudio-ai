import { db } from "./db.js";
import { prisma } from "../../../config/prisma.js";

// ForgeStudio page <-> WordPress post mappings.
// Moved verbatim from connector.service.ts (now a compatibility entry point that re-exports the public API).

/**
 * Helper to fetch a single page mapping by websiteId & forgePageId
 */
export async function getPageMapping(websiteId: string, forgePageId: string) {
  if (db?.wordPressPageMapping?.findUnique) {
    return await db.wordPressPageMapping.findUnique({
      where: { websiteId_forgePageId: { websiteId, forgePageId } },
    });
  }

  const rows: any[] = await prisma.$queryRaw`
    SELECT * FROM wordpress_page_mappings WHERE "websiteId" = ${websiteId}::uuid AND "forgePageId" = ${forgePageId} LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * Retrieve durable page mappings for a website.
 */
export async function getWebsitePageMappings(websiteId: string) {
  if (db?.wordPressPageMapping?.findMany) {
    return await db.wordPressPageMapping.findMany({
      where: { websiteId },
      orderBy: { createdAt: "asc" },
    });
  }

  const rows: any[] = await prisma.$queryRaw`
    SELECT * FROM wordpress_page_mappings WHERE "websiteId" = ${websiteId}::uuid ORDER BY "createdAt" ASC
  `;
  return rows.map((r) => ({
    id: r.id,
    websiteId: r.websiteId,
    forgePageId: r.forgePageId,
    wpPostId: r.wpPostId,
    wpPostSlug: r.wpPostSlug,
    wpPostUrl: r.wpPostUrl,
    lastSyncedAt: r.lastSyncedAt,
    createdAt: r.createdAt,
  }));
}

export async function upsertPageMapping(
  websiteId: string,
  forgePageId: string,
  wpPostId: number,
  wpPostSlug: string,
  wpPostUrl: string
) {
  const now = new Date();
  if (db?.wordPressPageMapping?.upsert) {
    return await db.wordPressPageMapping.upsert({
      where: { websiteId_forgePageId: { websiteId, forgePageId } },
      update: { wpPostId, wpPostSlug, wpPostUrl, lastSyncedAt: now },
      create: { websiteId, forgePageId, wpPostId, wpPostSlug, wpPostUrl, lastSyncedAt: now },
    });
  }

  return await prisma.$executeRawUnsafe(
    `INSERT INTO wordpress_page_mappings (id, "websiteId", "forgePageId", "wpPostId", "wpPostSlug", "wpPostUrl", "lastSyncedAt", "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5, $6, NOW(), NOW())
     ON CONFLICT ("websiteId", "forgePageId") DO UPDATE
     SET "wpPostId" = EXCLUDED."wpPostId",
         "wpPostSlug" = EXCLUDED."wpPostSlug",
         "wpPostUrl" = EXCLUDED."wpPostUrl",
         "lastSyncedAt" = EXCLUDED."lastSyncedAt",
         "updatedAt" = NOW()`,
    websiteId,
    forgePageId,
    wpPostId,
    wpPostSlug,
    wpPostUrl,
    now
  );
}
