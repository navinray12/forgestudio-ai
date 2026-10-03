import { z } from "zod";
import type { JsonObject } from "../../../services/websites/document-policy.js";

export const sitePlanSchema = z.object({
  design: z.string().min(20).max(8000),
  pages: z.array(z.object({ name: z.string().min(1).max(100), slug: z.string().regex(/^\/(?:[a-z0-9-]+\/?)*$/), brief: z.string().min(20).max(8000) }).strict()).min(1).max(8),
  setupRequired: z.array(z.string().max(300)).max(20),
}).strict();
export type SitePlan = z.infer<typeof sitePlanSchema>;
export interface DesignPlanner {
  plan(brief: string, signal?: AbortSignal): Promise<SitePlan>;
  repair(html: string, issues: string[], signal?: AbortSignal): Promise<string>;
  edit(document: JsonObject, brief: string, scope: EditScope, signal?: AbortSignal): Promise<EditOperation[]>;
}
export interface DesignProvider {
  createProject(title: string): Promise<string>;
  generate(projectId: string, prompt: string): Promise<{ screenId: string }>;
  html(projectId: string, screenId: string): Promise<string>;
  close(): Promise<void>;
}
export interface ArtifactStore { put(value: string): Promise<string>; get(key: string): Promise<string>; }
export interface DesignConverter { convert(html: string, namespace: string): Promise<JsonObject[]>; }
export type EditScope = { type: "site" | "page" | "selection"; pageId?: string; elementId?: string };
export const editOperationsSchema = z.array(z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), elementId: z.string().max(200), text: z.string().max(10000) }).strict(),
  z.object({ type: z.literal("style"), elementId: z.string().max(200), styles: z.record(z.string(), z.string().max(300)) }).strict(),
])).min(1).max(100);
export type EditOperation = z.infer<typeof editOperationsSchema>[number];

export const DESIGN_CONTRACT = `Create a complete responsive website page with strong visual hierarchy, intentional color and typography, generous spacing and varied section layouts. Include a real header, navigation, main content and footer. Return self-contained semantic HTML and CSS. Use system fonts and CSS decorative shapes/gradients instead of remote images, icon fonts, SVG, canvas, iframes or third-party scripts. Use flex/grid and mobile CSS at max-width:767px and tablet at max-width:1023px; no fixed-width overflow at 320px. Supported tags: header, nav, main, footer, section, article, div, h1-h6, p, span, strong, em, ul, ol, li, a, button, br. Links must resolve to supplied site routes. No fabricated statistics, testimonials or facts. No inert forms, fake CMS or mock working application controls. Any required integrations must be reported separately, not represented as working. Prefer inline styles or embedded CSS with simple class selectors. Avoid pseudo-elements, CSS animation, @import and JavaScript. Every heading/text/button must remain editable as a native element.`;
