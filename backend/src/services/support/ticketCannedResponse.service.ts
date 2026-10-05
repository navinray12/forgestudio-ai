import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";

const db = prisma as any;

export async function getCannedResponses(categoryId?: string) {
  const where: any = {};
  if (categoryId) where.categoryId = categoryId;

  let responses = await db.supportCannedResponse.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  if (responses.length === 0) {
    // Seed default canned responses if empty
    const defaults = [
      {
        title: "WordPress REST API Connection Issue",
        shortcut: "wp-rest",
        content: "Hello {{customer_name}},\n\nIt appears that ForgeStudio is unable to communicate with your WordPress REST API at {{website_name}}.\n\nPlease verify that:\n1. Application Passwords or the ForgeStudio helper plugin is active.\n2. Your server firewall is allowing incoming requests.\n\nBest regards,\n{{agent_name}}",
      },
      {
        title: "Publishing Verification & Cache Clear",
        shortcut: "pub-cache",
        content: "Hi {{customer_name}},\n\nYour deployment for {{website_name}} on ticket {{ticket_number}} has completed successfully. If changes are not visible immediately, please clear your browser cache or CDN cache.\n\nThank you,\n{{agent_name}}",
      },
      {
        title: "Request Additional Logs / Details",
        shortcut: "req-logs",
        content: "Hello {{customer_name}},\n\nTo help us investigate ticket {{ticket_number}} further, could you please provide:\n1. Browser Console logs (F12 -> Console tab)\n2. Network tab export or exact error response\n3. Any relevant screenshots\n\nThanks,\n{{agent_name}}",
      },
    ];

    for (const d of defaults) {
      try {
        await db.supportCannedResponse.create({
          data: {
            ...d,
            createdById: "00000000-0000-0000-0000-000000000000",
          },
        });
      } catch {}
    }

    responses = await db.supportCannedResponse.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  return responses;
}

export async function createCannedResponse(params: {
  title: string;
  shortcut: string;
  content: string;
  categoryId?: string;
  createdById: string;
}) {
  const { title, shortcut, content, categoryId, createdById } = params;

  if (!title || !shortcut || !content) {
    throw new AppError("Title, shortcut, and content are required", 400, "VALIDATION_ERROR");
  }

  const cleanShortcut = shortcut.toLowerCase().replace(/[^a-z0-9_-]/g, "");

  const existing = await db.supportCannedResponse.findUnique({
    where: { shortcut: cleanShortcut },
  });

  if (existing) {
    throw new AppError(`Canned response shortcut '${cleanShortcut}' already exists`, 409, "DUPLICATE_ENTRY");
  }

  return await db.supportCannedResponse.create({
    data: {
      title,
      shortcut: cleanShortcut,
      content,
      categoryId: categoryId || null,
      createdById,
    },
  });
}

export function interpolateTemplateVariables(template: string, vars: {
  customer_name?: string;
  ticket_number?: string;
  website_name?: string;
  agent_name?: string;
  workspace_name?: string;
}): string {
  let result = template;
  result = result.replace(/\{\{\s*customer_name\s*\}\}/g, vars.customer_name || "Valued Customer");
  result = result.replace(/\{\{\s*ticket_number\s*\}\}/g, vars.ticket_number || "Ticket");
  result = result.replace(/\{\{\s*website_name\s*\}\}/g, vars.website_name || "Website");
  result = result.replace(/\{\{\s*agent_name\s*\}\}/g, vars.agent_name || "Support Team");
  result = result.replace(/\{\{\s*workspace_name\s*\}\}/g, vars.workspace_name || "Workspace");
  return result;
}
