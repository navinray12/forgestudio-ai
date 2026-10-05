import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { validateCategoryPayload } from "../../validators/forum.validator.js";

const db = prisma as any;

const DEFAULT_FORUM_CATEGORIES = [
  { name: "General Discussion", slug: "general-discussion", description: "Talk about anything related to web design, digital creation, and community.", icon: "MessageSquare", color: "#3b82f6", displayOrder: 1 },
  { name: "ForgeStudio Builder", slug: "forgestudio-builder", description: "Tips, workflows, drag-and-drop techniques, and feature discussions.", icon: "Layout", color: "#6366f1", displayOrder: 2 },
  { name: "Website Editor", slug: "website-editor", description: "Canvas elements, CSS styling, responsive breakpoints, and visual design.", icon: "Edit3", color: "#8b5cf6", displayOrder: 3 },
  { name: "WordPress & Plugins", slug: "wordpress-plugins", description: "WordPress integration, block theme sync, custom post types, and legacy widgets.", icon: "Globe", color: "#06b6d4", displayOrder: 4 },
  { name: "Templates & Design System", slug: "templates-design-system", description: "Design tokens, reusable components, site templates, and global typography.", icon: "Palette", color: "#ec4899", displayOrder: 5 },
  { name: "Custom Code & APIs", slug: "custom-code-apis", description: "Custom JS/CSS snippets, developer REST APIs, SFTP, and Webhooks.", icon: "Code", color: "#10b981", displayOrder: 6 },
  { name: "Performance & SEO", slug: "performance-seo", description: "Image optimization, PageSpeed performance, metadata, and analytics.", icon: "Zap", color: "#f59e0b", displayOrder: 7 },
  { name: "Hosting & Multisite", slug: "hosting-multisite", description: "Enterprise multisite setups, custom domains, staging, and server configs.", icon: "Server", color: "#14b8a6", displayOrder: 8 },
  { name: "Showcase & Feedback", slug: "showcase-feedback", description: "Share your ForgeStudio website builds and get feedback from peers.", icon: "Sparkles", color: "#84cc16", displayOrder: 9 },
  { name: "Feature Requests", slug: "feature-requests", description: "Suggest new tools, integrations, and capabilities for ForgeStudio.", icon: "Lightbulb", color: "#eab308", displayOrder: 10 },
  { name: "Tips & Tutorials", slug: "tips-tutorials", description: "Guides, video walkthroughs, and step-by-step design strategies.", icon: "BookOpen", color: "#a855f7", displayOrder: 11 },
  { name: "Community Announcements", slug: "community-announcements", description: "Official updates, releases, and ecosystem news from the ForgeStudio team.", icon: "Megaphone", color: "#ef4444", displayOrder: 12 },
];

export async function seedDefaultCategoriesIfEmpty() {
  const count = await db.forumCategory.count();
  if (count === 0) {
    for (const cat of DEFAULT_FORUM_CATEGORIES) {
      await db.forumCategory.create({
        data: cat,
      });
    }
  }
}

export async function listCategories() {
  await seedDefaultCategoriesIfEmpty();
  const categories = await db.forumCategory.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    include: {
      _count: { select: { topics: true } },
    },
  });
  return categories;
}

export async function createCategory(body: any) {
  const input = validateCategoryPayload(body);
  const exists = await db.forumCategory.findUnique({
    where: { slug: input.slug },
  });
  if (exists) {
    throw new AppError("Category slug already exists", 409, "DUPLICATE_SLUG");
  }

  const category = await db.forumCategory.create({
    data: input,
  });
  return category;
}

export async function updateCategory(id: string, body: any) {
  const category = await db.forumCategory.findUnique({ where: { id } });
  if (!category) throw new AppError("Category not found", 404, "NOT_FOUND");

  const input = validateCategoryPayload({ ...category, ...body });
  const updated = await db.forumCategory.update({
    where: { id },
    data: input,
  });
  return updated;
}
