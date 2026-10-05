import { AppError } from "../utils/app-error.js";

export function validateCreateTopicPayload(body: any) {
  if (!body || typeof body !== "object") {
    throw new AppError("Invalid payload provided", 400, "VALIDATION_ERROR");
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";

  if (!title || title.length < 5) {
    throw new AppError("Topic title must be at least 5 characters long", 422, "VALIDATION_ERROR");
  }

  if (title.length > 255) {
    throw new AppError("Topic title cannot exceed 255 characters", 422, "VALIDATION_ERROR");
  }

  if (!content || content.length < 10) {
    throw new AppError("Topic content must be at least 10 characters long", 422, "VALIDATION_ERROR");
  }

  if (!categoryId) {
    throw new AppError("A valid forum category is required", 422, "VALIDATION_ERROR");
  }

  const tags = Array.isArray(body.tags)
    ? body.tags.map((t: any) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 10)
    : [];

  const visibility = ["PUBLIC", "WORKSPACE", "PRIVATE"].includes(body.visibility)
    ? body.visibility
    : "PUBLIC";

  return {
    title,
    content,
    categoryId,
    workspaceId: typeof body.workspaceId === "string" ? body.workspaceId.trim() : undefined,
    websiteId: typeof body.websiteId === "string" ? body.websiteId.trim() : undefined,
    tags,
    visibility,
    contextData: body.contextData && typeof body.contextData === "object" ? body.contextData : {},
  };
}

export function validateCreatePostPayload(body: any) {
  if (!body || typeof body !== "object") {
    throw new AppError("Invalid payload provided", 400, "VALIDATION_ERROR");
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content || content.length < 2) {
    throw new AppError("Reply content cannot be empty", 422, "VALIDATION_ERROR");
  }

  return {
    content,
    parentPostId: typeof body.parentPostId === "string" ? body.parentPostId.trim() : undefined,
  };
}

export function validateCategoryPayload(body: any) {
  if (!body || typeof body !== "object") {
    throw new AppError("Invalid payload provided", 400, "VALIDATION_ERROR");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length < 2) {
    throw new AppError("Category name must be at least 2 characters long", 422, "VALIDATION_ERROR");
  }

  const slug = typeof body.slug === "string" && body.slug.trim()
    ? body.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")
    : name.toLowerCase().replace(/[^a-z0-9-]+/g, "-");

  return {
    name,
    slug,
    description: typeof body.description === "string" ? body.description.trim() : undefined,
    icon: typeof body.icon === "string" ? body.icon.trim() : undefined,
    color: typeof body.color === "string" ? body.color.trim() : undefined,
    displayOrder: typeof body.displayOrder === "number" ? body.displayOrder : 0,
    isActive: typeof body.isActive === "boolean" ? body.isActive : true,
    isPublic: typeof body.isPublic === "boolean" ? body.isPublic : true,
  };
}
