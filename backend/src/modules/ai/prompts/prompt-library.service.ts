import { AppError } from "../../../utils/app-error.js";
import { prisma } from "../../../config/prisma.js";

export interface PromptLibraryItem {
  id: string;
  userId: string;
  name: string;
  description?: string;
  prompt: string;
  category: string;
  tags: string[];
  targetType?: string;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavePromptInput {
  userId: string;
  name: string;
  prompt: string;
  description?: string;
  category?: string;
  tags?: string[];
  targetType?: string;
  isFavorite?: boolean;
}

export interface ListPromptsFilter {
  category?: string;
  tag?: string;
  search?: string;
  isFavorite?: boolean;
}

export async function savePrompt(input: SavePromptInput): Promise<PromptLibraryItem> {
  if (!input.name || !input.prompt) {
    throw new AppError("Name and prompt content are required", 400, "INVALID_INPUT");
  }

  const record = await (prisma as any).templates.create({
    data: {
      userId: input.userId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      type: "AI_PROMPT",
      category: input.category || "General",
      isFavorite: input.isFavorite || false,
      templateData: {
        prompt: input.prompt.trim(),
        tags: input.tags || [],
        targetType: input.targetType || "text",
      },
    },
  });

  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    description: record.description,
    prompt: (record.templateData as any).prompt,
    category: record.category,
    tags: (record.templateData as any).tags || [],
    targetType: (record.templateData as any).targetType,
    isFavorite: record.isFavorite,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function listPrompts(userId: string, filter?: ListPromptsFilter): Promise<PromptLibraryItem[]> {
  const where: any = {
    userId,
    type: "AI_PROMPT",
  };

  if (filter?.category) where.category = filter.category;
  if (filter?.isFavorite !== undefined) where.isFavorite = filter.isFavorite;

  const records = await (prisma as any).templates.findMany({
    where,
    orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }],
  });

  let items: PromptLibraryItem[] = records.map((r: any) => ({
    id: r.id,
    userId: r.userId,
    name: r.name,
    description: r.description,
    prompt: (r.templateData as any)?.prompt || "",
    category: r.category,
    tags: (r.templateData as any)?.tags || [],
    targetType: (r.templateData as any)?.targetType,
    isFavorite: r.isFavorite,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  if (filter?.tag) {
    items = items.filter(item => item.tags.includes(filter.tag!));
  }
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    items = items.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.prompt.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  }

  return items;
}

export async function getPromptById(id: string, userId: string): Promise<PromptLibraryItem> {
  const existing = await (prisma as any).templates.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId || existing.type !== "AI_PROMPT") {
    throw new AppError("Prompt not found", 404, "PROMPT_NOT_FOUND");
  }

  return {
    id: existing.id,
    userId: existing.userId,
    name: existing.name,
    description: existing.description,
    prompt: (existing.templateData as any)?.prompt || "",
    category: existing.category,
    tags: (existing.templateData as any)?.tags || [],
    targetType: (existing.templateData as any)?.targetType,
    isFavorite: existing.isFavorite,
    createdAt: existing.createdAt,
    updatedAt: existing.updatedAt,
  };
}

export async function updatePrompt(id: string, userId: string, updates: Partial<SavePromptInput>): Promise<PromptLibraryItem> {
  const existing = await (prisma as any).templates.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId || existing.type !== "AI_PROMPT") {
    throw new AppError("Prompt not found", 404, "PROMPT_NOT_FOUND");
  }

  const existingData = (existing.templateData as any) || {};
  const templateData = {
    ...existingData,
    ...(updates.prompt !== undefined ? { prompt: updates.prompt.trim() } : {}),
    ...(updates.tags !== undefined ? { tags: updates.tags } : {}),
    ...(updates.targetType !== undefined ? { targetType: updates.targetType } : {}),
  };

  const updated = await (prisma as any).templates.update({
    where: { id },
    data: {
      ...(updates.name ? { name: updates.name.trim() } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.category ? { category: updates.category } : {}),
      ...(updates.isFavorite !== undefined ? { isFavorite: updates.isFavorite } : {}),
      templateData,
    },
  });

  return {
    id: updated.id,
    userId: updated.userId,
    name: updated.name,
    description: updated.description,
    prompt: templateData.prompt,
    category: updated.category,
    tags: templateData.tags,
    targetType: templateData.targetType,
    isFavorite: updated.isFavorite,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

export async function deletePrompt(id: string, userId: string): Promise<boolean> {
  const existing = await (prisma as any).templates.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId || existing.type !== "AI_PROMPT") {
    throw new AppError("Prompt not found", 404, "PROMPT_NOT_FOUND");
  }

  await (prisma as any).templates.delete({ where: { id } });
  return true;
}
