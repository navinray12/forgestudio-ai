import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError } from "../../utils/app-error.js";
import { validateDocumentTree, type JsonObject } from "../../services/websites/document-policy.js";

// Models propose only a small, renderer-supported vocabulary. IDs, styles and
// canonical editor structure are owned by the server, not by model output.
export const SITE_BLUEPRINT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["pages"],
  properties: {
    pages: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["name", "slug", "sections"],
      properties: {
        name: { type: "string" }, slug: { type: "string" },
        sections: { type: "array", items: {
          type: "object", additionalProperties: false,
          required: ["heading", "body", "ctaLabel", "ctaHref"],
          properties: {
            heading: { type: "string" }, body: { type: "string" },
            ctaLabel: { type: "string" }, ctaHref: { type: "string" },
          },
        } },
      },
    } },
  },
} as const;

export const SITE_BLUEPRINT_INSTRUCTIONS = [
  "Return JSON for an editable multi-page website. Use only the supplied schema.",
  "The first page is Home with slug '/'. Other slugs are unique lowercase paths such as '/about'.",
  "Each section needs a concise heading and useful plain-text body. CTA links must be same-site paths or anchors; use empty strings when no CTA is needed.",
  "Do not invent testimonials, customers, certifications, addresses, prices or statistics. Do not include HTML, scripts, CSS or external image URLs.",
  "A blog page may be a layout proposal, but do not claim a CMS collection was created.",
].join(" ");

const sectionSchema = z.object({
  heading: z.string().trim().min(1).max(140),
  body: z.string().trim().min(1).max(1200),
  ctaLabel: z.string().trim().max(80),
  ctaHref: z.string().trim().max(160),
}).strict().refine(section => !section.ctaLabel || section.ctaHref === "#" || /^\/(?:[a-z0-9-]+\/?)*$/.test(section.ctaHref) || /^#[a-z0-9-]+$/.test(section.ctaHref));
const pageSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().max(120).regex(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/?)*$/),
  sections: z.array(sectionSchema).min(1).max(10),
}).strict();
const blueprintSchema = z.object({ pages: z.array(pageSchema).min(1).max(8) }).strict();

export function canonicalSiteFromBlueprint(raw: unknown): { editorData: JsonObject; pageNames: string[]; sectionCount: number } {
  const parsed = blueprintSchema.safeParse(raw);
  if (!parsed.success || parsed.data.pages[0]?.slug !== "/" ||
      new Set(parsed.data.pages.map(page => page.slug)).size !== parsed.data.pages.length) {
    throw new AppError("AI provider returned an invalid website draft", 502, "AI_INVALID_OUTPUT");
  }
  const pages = parsed.data.pages.map((page, pageIndex) => {
    const elements = page.sections.map((section, sectionIndex) => {
      const children: JsonObject[] = [
        { id: randomUUID(), type: "heading", content: section.heading, headingLevel: pageIndex === 0 && sectionIndex === 0 ? "h1" : "h2",
          styles: { fontSize: "2rem", color: "#0f172a", fontWeight: "700" } },
        { id: randomUUID(), type: "text", content: section.body,
          styles: { fontSize: "1rem", color: "#475569" } },
      ];
      if (section.ctaLabel) children.push({ id: randomUUID(), type: "button", content: section.ctaLabel,
        href: section.ctaHref, styles: { backgroundColor: "#2563eb", color: "#ffffff", padding: "12px 24px" } });
      return { id: randomUUID(), type: "container", content: section.heading,
        styles: { width: "100%", padding: "48px 24px", backgroundColor: "#ffffff" }, children };
    });
    return { id: randomUUID(), name: page.name, slug: page.slug, isHome: pageIndex === 0,
      elements, pageSettings: { title: page.name, path: page.slug } };
  });
  const editorData: JsonObject = { version: 1, homePageId: pages[0]!.id, pages,
    elements: pages[0]!.elements, pageSettings: pages[0]!.pageSettings };
  validateDocumentTree(editorData);
  return { editorData, pageNames: pages.map(page => page.name),
    sectionCount: parsed.data.pages.reduce((count, page) => count + page.sections.length, 0) };
}
