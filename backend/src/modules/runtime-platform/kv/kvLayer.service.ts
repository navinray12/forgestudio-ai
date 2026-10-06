/**
 * Module 51: Cache / KV Layer Service
 * Features fast in-memory caching, durable persistence, TTL expiration, atomic counters, and tag invalidation.
 */

import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import {
  KvNamespaceConfig,
  KvEntryRecord,
  SetKvDto,
} from "./kv.types.js";

export class KvLayerService {
  // In-memory hot cache: `${namespaceId}:${key}` -> { value: any, expiresAt: number | null, tags: string[] }
  private memoryCache: Map<string, { value: any; expiresAt: number | null; tags: string[] }> = new Map();

  /**
   * Create or configure a KV namespace
   */
  public async createNamespace(
    projectId: string,
    name: string,
    description?: string,
    isEncrypted = false
  ): Promise<KvNamespaceConfig> {
    const ns = await (prisma as any).forgeKvNamespace.create({
      data: {
        projectId,
        name,
        description: description || null,
        isEncrypted,
      },
    });

    return ns;
  }

  /**
   * List namespaces for a project
   */
  public async listNamespaces(projectId: string): Promise<KvNamespaceConfig[]> {
    return (prisma as any).forgeKvNamespace.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Get namespace by name or ID
   */
  public async getNamespace(projectId: string, namespaceNameOrId: string): Promise<KvNamespaceConfig> {
    const ns = await (prisma as any).forgeKvNamespace.findFirst({
      where: {
        projectId,
        OR: [{ id: namespaceNameOrId }, { name: namespaceNameOrId }],
      },
    });

    if (!ns) {
      throw new AppError(`KV Namespace '${namespaceNameOrId}' not found`, 404);
    }

    return ns;
  }

  /**
   * Set a key-value pair with optional TTL and cache tags
   */
  public async set(
    projectId: string,
    namespaceNameOrId: string,
    dto: SetKvDto
  ): Promise<KvEntryRecord> {
    const ns = await this.getNamespace(projectId, namespaceNameOrId);

    const expiresAtDate = dto.ttlSeconds ? new Date(Date.now() + dto.ttlSeconds * 1000) : null;
    const expiresAtMs = expiresAtDate ? expiresAtDate.getTime() : null;
    const tags = dto.tags || [];

    // 1. Update in-memory hot cache
    const memKey = `${ns.id}:${dto.key}`;
    this.memoryCache.set(memKey, {
      value: dto.value,
      expiresAt: expiresAtMs,
      tags,
    });

    // 2. Persist to database (upsert)
    const existing = await (prisma as any).forgeKvEntry.findFirst({
      where: { namespaceId: ns.id, key: dto.key },
    });

    if (existing) {
      return (prisma as any).forgeKvEntry.update({
        where: { id: existing.id },
        data: {
          value: dto.value,
          tags,
          expiresAt: expiresAtDate,
          updatedAt: new Date(),
        },
      });
    }

    return (prisma as any).forgeKvEntry.create({
      data: {
        namespaceId: ns.id,
        projectId,
        key: dto.key,
        value: dto.value,
        tags,
        expiresAt: expiresAtDate,
      },
    });
  }

  /**
   * Get value by key
   */
  public async get(
    projectId: string,
    namespaceNameOrId: string,
    key: string
  ): Promise<any | null> {
    const ns = await this.getNamespace(projectId, namespaceNameOrId);
    const memKey = `${ns.id}:${key}`;

    // 1. Check in-memory hot cache
    const memItem = this.memoryCache.get(memKey);
    if (memItem) {
      if (memItem.expiresAt && Date.now() > memItem.expiresAt) {
        this.memoryCache.delete(memKey);
        await (prisma as any).forgeKvEntry.deleteMany({
          where: { namespaceId: ns.id, key },
        });
        return null;
      }
      return memItem.value;
    }

    // 2. Fallback to database
    const entry = await (prisma as any).forgeKvEntry.findFirst({
      where: { namespaceId: ns.id, key },
    });

    if (!entry) return null;

    if (entry.expiresAt && new Date(entry.expiresAt).getTime() < Date.now()) {
      await (prisma as any).forgeKvEntry.delete({ where: { id: entry.id } });
      return null;
    }

    // Populate hot cache
    this.memoryCache.set(memKey, {
      value: entry.value,
      expiresAt: entry.expiresAt ? new Date(entry.expiresAt).getTime() : null,
      tags: entry.tags || [],
    });

    return entry.value;
  }

  /**
   * Delete key
   */
  public async delete(
    projectId: string,
    namespaceNameOrId: string,
    key: string
  ): Promise<boolean> {
    const ns = await this.getNamespace(projectId, namespaceNameOrId);
    const memKey = `${ns.id}:${key}`;
    this.memoryCache.delete(memKey);

    const res = await (prisma as any).forgeKvEntry.deleteMany({
      where: { namespaceId: ns.id, key },
    });

    return res.count > 0;
  }

  /**
   * List keys with prefix
   */
  public async listKeys(
    projectId: string,
    namespaceNameOrId: string,
    prefix = "",
    limit = 100
  ): Promise<KvEntryRecord[]> {
    const ns = await this.getNamespace(projectId, namespaceNameOrId);

    const where: any = { namespaceId: ns.id, projectId };
    if (prefix) {
      where.key = { startsWith: prefix };
    }

    const entries = await (prisma as any).forgeKvEntry.findMany({
      where,
      orderBy: { key: "asc" },
      take: Math.min(200, Math.max(1, limit)),
    });

    const now = Date.now();
    return entries.filter((e: any) => !e.expiresAt || new Date(e.expiresAt).getTime() > now);
  }

  /**
   * Atomic increment / decrement
   */
  public async atomicIncr(
    projectId: string,
    namespaceNameOrId: string,
    key: string,
    amount = 1
  ): Promise<number> {
    const current = await this.get(projectId, namespaceNameOrId, key);
    const num = typeof current === "number" ? current : 0;
    const nextVal = num + amount;

    await this.set(projectId, namespaceNameOrId, {
      key,
      value: nextVal,
    });

    return nextVal;
  }

  /**
   * Invalidate all keys matching a specific cache tag
   */
  public async invalidateByTag(
    projectId: string,
    namespaceNameOrId: string,
    tag: string
  ): Promise<number> {
    const ns = await this.getNamespace(projectId, namespaceNameOrId);

    // Evict from memory
    for (const [memKey, item] of this.memoryCache.entries()) {
      if (memKey.startsWith(`${ns.id}:`) && item.tags.includes(tag)) {
        this.memoryCache.delete(memKey);
      }
    }

    // Evict from database
    const entries = await (prisma as any).forgeKvEntry.findMany({
      where: { namespaceId: ns.id, tags: { has: tag } },
    });

    if (entries.length > 0) {
      const ids = entries.map((e: any) => e.id);
      await (prisma as any).forgeKvEntry.deleteMany({
        where: { id: { in: ids } },
      });
    }

    return entries.length;
  }
}

export const kvLayerService = new KvLayerService();
