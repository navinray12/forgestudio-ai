import { AppError } from "../utils/app-error.js";

export const VALID_STATUSES = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_CUSTOMER",
  "CUSTOMER_REPLIED",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
] as const;

export const VALID_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"] as const;

export const VALID_SOURCES = ["WEB", "EMAIL", "API", "SYSTEM"] as const;

const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ["OPEN", "IN_PROGRESS"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED"],
  IN_PROGRESS: ["WAITING_FOR_CUSTOMER", "RESOLVED"],
  WAITING_FOR_CUSTOMER: ["CUSTOMER_REPLIED", "IN_PROGRESS", "RESOLVED"],
  CUSTOMER_REPLIED: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["CLOSED", "REOPENED", "IN_PROGRESS"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "OPEN"],
};

export function validateStatusTransition(currentStatus: string, nextStatus: string): void {
  if (currentStatus === nextStatus) return;
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(
      `Invalid status transition from '${currentStatus}' to '${nextStatus}'.`,
      409,
      "INVALID_STATE_TRANSITION"
    );
  }
}

export function validateCreateTicketPayload(body: any): {
  subject: string;
  description: string;
  categoryId: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  websiteId?: string;
  workspaceId?: string;
  contextData?: any;
} {
  if (!body || typeof body !== "object") {
    throw new AppError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  const { subject, description, categoryId, priority, websiteId, workspaceId, contextData } = body;

  if (!subject || typeof subject !== "string" || subject.trim().length < 3) {
    throw new AppError("Subject must be at least 3 characters long", 422, "VALIDATION_ERROR");
  }

  if (subject.length > 255) {
    throw new AppError("Subject cannot exceed 255 characters", 422, "VALIDATION_ERROR");
  }

  if (!description || typeof description !== "string" || description.trim().length < 5) {
    throw new AppError("Description must be at least 5 characters long", 422, "VALIDATION_ERROR");
  }

  if (description.length > 20000) {
    throw new AppError("Description cannot exceed 20,000 characters", 422, "VALIDATION_ERROR");
  }

  if (!categoryId || typeof categoryId !== "string") {
    throw new AppError("Valid Category ID is required", 422, "VALIDATION_ERROR");
  }

  if (priority && !VALID_PRIORITIES.includes(priority)) {
    throw new AppError(`Priority must be one of: ${VALID_PRIORITIES.join(", ")}`, 422, "VALIDATION_ERROR");
  }

  return {
    subject: subject.trim(),
    description: description.trim(),
    categoryId: categoryId.trim(),
    priority: priority || "NORMAL",
    websiteId: typeof websiteId === "string" ? websiteId.trim() : undefined,
    workspaceId: typeof workspaceId === "string" ? workspaceId.trim() : undefined,
    contextData: contextData && typeof contextData === "object" ? contextData : {},
  };
}

export function validateMessagePayload(body: any): {
  content: string;
  type?: "PUBLIC_REPLY" | "INTERNAL_NOTE";
} {
  if (!body || typeof body !== "object") {
    throw new AppError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  const { content, type } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    throw new AppError("Message content cannot be empty", 422, "VALIDATION_ERROR");
  }

  if (content.length > 10000) {
    throw new AppError("Message content cannot exceed 10,000 characters", 422, "VALIDATION_ERROR");
  }

  if (type && !["PUBLIC_REPLY", "INTERNAL_NOTE"].includes(type)) {
    throw new AppError("Message type must be PUBLIC_REPLY or INTERNAL_NOTE", 422, "VALIDATION_ERROR");
  }

  return {
    content: content.trim(),
    type: type || "PUBLIC_REPLY",
  };
}
