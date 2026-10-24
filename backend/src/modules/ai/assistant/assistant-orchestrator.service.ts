import { AppError } from "../../../utils/app-error.js";
import { generateContextualText } from "../text/text-generation.service.js";
import { refineContent } from "../text/content-refinement.service.js";
import { generateSection } from "../sections/section-generation.service.js";
import { generateContainer, generateLayout } from "../layout/layout-generation.service.js";
import { generateAiImage, replaceImageElement, removeImageBackground } from "../images/image-generation.service.js";
import { generateCode, explainCode } from "../code/code-generation.service.js";
import { generateElementAnimation } from "../animation/animation-generation.service.js";
import { generateDynamicProperty } from "../dynamic/dynamic-properties.service.js";
import { generateSeoMetadata } from "../seo/seo-generation.service.js";
import { analyzeSite } from "../analysis/site-analysis.service.js";
import { generateSiteDraft } from "../site-generation.service.js";

export interface AssistantRequest {
  websiteId: string;
  actorId: string;
  prompt: string;
  expectedVersion: number;
  context?: {
    pageId?: string;
    elementId?: string;
    elementType?: string;
    sectionId?: string;
    selectedContent?: string;
  };
}

export type AssistantIntent =
  | "GENERATE_TEXT"
  | "REFINE_CONTENT"
  | "GENERATE_SECTION"
  | "GENERATE_CONTAINER"
  | "GENERATE_LAYOUT"
  | "GENERATE_IMAGE"
  | "REPLACE_IMAGE"
  | "REMOVE_BACKGROUND"
  | "GENERATE_CODE"
  | "EXPLAIN_CODE"
  | "GENERATE_ANIMATION"
  | "DYNAMIC_PROPERTY"
  | "GENERATE_SEO"
  | "ANALYZE_SITE"
  | "GENERATE_WEBSITE";

export function detectIntent(prompt: string, context?: AssistantRequest["context"]): AssistantIntent {
  const p = prompt.toLowerCase();

  // 1. Audit / Analysis
  if (p.includes("audit") || p.includes("analyze") || p.includes("check accessibility") || p.includes("check performance") || p.includes("check design")) {
    return "ANALYZE_SITE";
  }

  // 2. SEO
  if (p.includes("seo") || p.includes("meta description") || p.includes("meta title") || p.includes("meta tags") || p.includes("search optimization")) {
    return "GENERATE_SEO";
  }

  // 3. Background Removal
  if (p.includes("remove background") || p.includes("transparent background") || p.includes("no background")) {
    return "REMOVE_BACKGROUND";
  }

  // 4. Image Replacement / Generation
  if ((context?.elementType === "image" || context?.elementId) && (p.includes("replace image") || p.includes("change image") || p.includes("new photo"))) {
    return "REPLACE_IMAGE";
  }
  if (p.startsWith("generate image") || p.startsWith("create image") ||
      p.includes("illustration for") ||
      /^(?:generate|create|draw|design)\b[\s\S]*\b(?:image|photo|illustration)\b/.test(p)) {
    return "GENERATE_IMAGE";
  }

  // 5. Animation
  if (p.includes("animate") || p.includes("motion") || p.includes("hover effect") || p.includes("fade up") || p.includes("entrance animation")) {
    return "GENERATE_ANIMATION";
  }

  // 6. Dynamic property
  if (p.includes("dynamic") || p.includes("token") || p.includes("bind to") || p.includes("cms property")) {
    return "DYNAMIC_PROPERTY";
  }

  // 7. Code explanation vs generation
  if (p.startsWith("explain code") || p.includes("explain this snippet") ||
      /^explain\s+(?:how|why|what|this|the|a|an)\b/.test(p) &&
      /\b(?:code|javascript|typescript|html|css|function|method|snippet|algorithm)\b/.test(p)) {
    return "EXPLAIN_CODE";
  }
  if (p.includes("code") || p.includes("css") || p.includes("javascript") || p.includes("html snippet")) {
    return "GENERATE_CODE";
  }

  // 8. Content refinement (if selected content or explicit action)
  if (context?.selectedContent || p.startsWith("rewrite") || p.startsWith("shorten") || p.startsWith("expand") || p.startsWith("simplify") || p.includes("translate to") || p.startsWith("translate ") || p.includes("fix grammar")) {
    return "REFINE_CONTENT";
  }

  // 9. Full website generation
  if (p.startsWith("build a whole website") || p.startsWith("create website") ||
      p.startsWith("generate site") || p.startsWith("generate website") ||
      /^\s*(?:build|create|generate|design)\s+(?:a|an|the)\s+(?:(?:complete|full|entire|modern|responsive)\s+)*[\s\S]*\b(?:website|landing page)\b/.test(p)) {
    return "GENERATE_WEBSITE";
  }

  // 10. Container / Layout
  if (!/\bsection\b/.test(p) &&
      (p.includes("grid layout") || p.includes("flex container") ||
       p.includes("columns") || p.includes("2-column") || p.includes("3-column") ||
       /\b\d+-column\s+grid\s+container\b/.test(p))) {
    return "GENERATE_CONTAINER";
  }
  if (p.includes("reorganize layout") || p.includes("page layout") ||
      (p.includes("optimize") && p.includes("layout"))) {
    return "GENERATE_LAYOUT";
  }

  // 11. Explicit copywriting is not a request to insert a new page section.
  // Check this before generic keywords such as "hero", "features" or "footer".
  // Keep bare section-creation commands on the existing GENERATE_SECTION path.
  if (/^\s*(?:please\s+)?(?:write|draft|compose|suggest|generate)\s+(?:(?:me|some|a|an|the)\s+)*(?:copy|text|content|headline|heading|title|subtitle|caption|description|paragraph|tagline|slogan|button\s+text|cta\s+text)\b/i.test(prompt)
    || /^\s*(?:please\s+)?(?:write|draft|compose|suggest)\b[\s\S]*\b(?:copy|text|headline|heading|title|subtitle|caption|description|paragraph|tagline|slogan)\b/i.test(prompt)) {
    return "GENERATE_TEXT";
  }

  // 12. Section generation
  if (p.includes("section") || p.includes("hero") || p.includes("pricing") || p.includes("testimonial") || p.includes("faq") || p.includes("footer") || p.includes("header") || p.includes("features")) {
    return "GENERATE_SECTION";
  }

  // Default to contextual text generation
  return "GENERATE_TEXT";
}

/**
 * Phase 22: Unified AI Assistant Orchestrator
 */
export async function orchestrateAssistantRequest(request: AssistantRequest) {
  if (!request.prompt || request.prompt.trim().length === 0) {
    throw new AppError("Command prompt is required for AI Assistant", 400, "INVALID_INPUT");
  }

  const intent = detectIntent(request.prompt, request.context);

  switch (intent) {
    case "ANALYZE_SITE": {
      const type = request.prompt.toLowerCase().includes("accessibility") ? "accessibility"
        : request.prompt.toLowerCase().includes("performance") ? "performance"
        : request.prompt.toLowerCase().includes("design") ? "design" : "all";
      const result = await analyzeSite({
        websiteId: request.websiteId,
        actorId: request.actorId,
        type,
      });
      return { intent, success: true, result };
    }

    case "GENERATE_SEO": {
      const result = await generateSeoMetadata({
        websiteId: request.websiteId,
        actorId: request.actorId,
        pageId: request.context?.pageId,
        expectedVersion: request.expectedVersion,
      });
      return { intent, success: true, result };
    }

    case "REMOVE_BACKGROUND": {
      if (!request.context?.elementId) {
        throw new AppError("Target image element is required to remove background", 400, "ELEMENT_REQUIRED");
      }
      const result = await removeImageBackground({
        assetId: request.context.elementId,
        actorId: request.actorId,
        websiteId: request.websiteId,
      });
      return { intent, success: true, result };
    }

    case "REPLACE_IMAGE": {
      if (!request.context?.elementId) {
        throw new AppError("Target element ID is required for image replacement", 400, "ELEMENT_REQUIRED");
      }
      const result = await replaceImageElement({
        websiteId: request.websiteId,
        actorId: request.actorId,
        elementId: request.context.elementId,
        prompt: request.prompt,
        expectedVersion: request.expectedVersion,
      });
      return { intent, success: true, result };
    }

    case "GENERATE_IMAGE": {
      const result = await generateAiImage({
        websiteId: request.websiteId,
        actorId: request.actorId,
        prompt: request.prompt,
      });
      return { intent, success: true, result };
    }

    case "GENERATE_ANIMATION": {
      if (!request.context?.elementId) {
        throw new AppError("Select an element to add animation", 400, "ELEMENT_REQUIRED");
      }
      const result = await generateElementAnimation({
        websiteId: request.websiteId,
        actorId: request.actorId,
        elementId: request.context.elementId,
        intent: request.prompt,
        expectedVersion: request.expectedVersion,
      });
      return { intent, success: true, result };
    }

    case "DYNAMIC_PROPERTY": {
      if (!request.context?.elementId) {
        throw new AppError("Select an element to bind dynamic properties", 400, "ELEMENT_REQUIRED");
      }
      const result = await generateDynamicProperty({
        websiteId: request.websiteId,
        actorId: request.actorId,
        elementId: request.context.elementId,
        targetField: "content",
        prompt: request.prompt,
        expectedVersion: request.expectedVersion,
      });
      return { intent, success: true, result };
    }

    case "EXPLAIN_CODE": {
      const result = await explainCode({
        code: request.context?.selectedContent || request.prompt,
        language: "JS",
        actorId: request.actorId,
        websiteId: request.websiteId,
      });
      return { intent, success: true, result };
    }

    case "GENERATE_CODE": {
      const lang = request.prompt.toLowerCase().includes("css") ? "CSS" : request.prompt.toLowerCase().includes("html") ? "HTML" : "JS";
      const result = await generateCode({
        websiteId: request.websiteId,
        actorId: request.actorId,
        language: lang,
        prompt: request.prompt,
      });
      return { intent, success: true, result };
    }

    case "REFINE_CONTENT": {
      const p = request.prompt.toLowerCase();
      const action = p.includes("shorten") ? "shorten"
        : p.includes("expand") ? "expand"
        : p.includes("simplify") ? "simplify"
        : p.includes("professional") ? "tone_professional"
        : p.includes("conversational") ? "tone_conversational"
        : p.includes("persuasive") ? "tone_persuasive"
        : p.includes("grammar") ? "grammar_correction"
        : p.includes("translate") ? "translate"
        : "rewrite";

      const originalText = request.context?.selectedContent || request.prompt;
      const result = await refineContent({
        websiteId: request.websiteId,
        actorId: request.actorId,
        action,
        originalText,
        expectedVersion: request.expectedVersion,
        context: {
          elementId: request.context?.elementId,
          pageId: request.context?.pageId,
        },
      });
      return { intent, success: true, result };
    }

    case "GENERATE_CONTAINER": {
      const p = request.prompt.toLowerCase();
      const layoutType = p.includes("grid") ? "grid-3-col" : "flex-row";
      const result = await generateContainer({
        websiteId: request.websiteId,
        actorId: request.actorId,
        layoutType,
        prompt: request.prompt,
        expectedVersion: request.expectedVersion,
        context: { pageId: request.context?.pageId },
      });
      return { intent, success: true, result };
    }

    case "GENERATE_LAYOUT": {
      const result = await generateLayout({
        websiteId: request.websiteId,
        actorId: request.actorId,
        prompt: request.prompt,
        expectedVersion: request.expectedVersion,
        context: { pageId: request.context?.pageId },
      });
      return { intent, success: true, result };
    }

    case "GENERATE_SECTION": {
      const p = request.prompt.toLowerCase();
      const sectionType = p.includes("hero") ? "hero"
        : p.includes("pricing") ? "pricing"
        : p.includes("testimonial") ? "testimonials"
        : p.includes("faq") ? "faq"
        : p.includes("contact") ? "contact"
        : p.includes("footer") ? "footer"
        : p.includes("header") ? "header"
        : p.includes("features") ? "features"
        : "custom";

      const result = await generateSection({
        websiteId: request.websiteId,
        actorId: request.actorId,
        sectionType,
        prompt: request.prompt,
        expectedVersion: request.expectedVersion,
        context: { pageId: request.context?.pageId },
      });
      return { intent, success: true, result };
    }

    case "GENERATE_WEBSITE": {
      const result = await generateSiteDraft({
        websiteId: request.websiteId,
        actorId: request.actorId,
        prompt: request.prompt,
        expectedVersion: request.expectedVersion,
      });
      return { intent, success: true, result };
    }

    case "GENERATE_TEXT":
    default: {
      const p = request.prompt.toLowerCase();
      const targetType = p.includes("heading") ? "heading"
        : p.includes("cta") || p.includes("button") ? "cta"
        : p.includes("title") ? "title"
        : p.includes("subtitle") ? "subtitle"
        : p.includes("caption") ? "caption"
        : p.includes("feature") ? "feature"
        : p.includes("testimonial") ? "testimonial"
        : "paragraph";

      const result = await generateContextualText({
        websiteId: request.websiteId,
        actorId: request.actorId,
        targetType,
        prompt: request.prompt,
        expectedVersion: request.expectedVersion,
        context: {
          elementId: request.context?.elementId,
          pageId: request.context?.pageId,
        },
      });
      return { intent, success: true, result };
    }
  }
}

export const executeAssistantCommand = orchestrateAssistantRequest;
