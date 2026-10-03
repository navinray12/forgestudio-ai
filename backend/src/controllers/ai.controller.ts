import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error.js";
import { documentWriteContext } from "../services/websites/document-request.js";
import { parseDocumentETag } from "../services/websites/document-policy.js";
import {
  generateSiteDraft,
  applyAiChangeset,
  cancelAiChangeset,
  getAiChangeset,
  retryAiChangeset,
} from "../modules/ai/site-generation.service.js";

import { generateContextualText } from "../modules/ai/text/text-generation.service.js";
import { refineContent } from "../modules/ai/text/content-refinement.service.js";
import { generateSection } from "../modules/ai/sections/section-generation.service.js";
import { generateContainer, generateLayout } from "../modules/ai/layout/layout-generation.service.js";
import {
  generateAiImage,
  editAiImage,
  removeImageBackground,
  generateImageVariations,
  replaceImageElement,
} from "../modules/ai/images/image-generation.service.js";
import {
  generateCode,
  generateCodePreviewSandbox,
  explainCode,
} from "../modules/ai/code/code-generation.service.js";
import { generateElementAnimation } from "../modules/ai/animation/animation-generation.service.js";
import { generateDynamicProperty } from "../modules/ai/dynamic/dynamic-properties.service.js";
import { generateSeoMetadata } from "../modules/ai/seo/seo-generation.service.js";
import { analyzeSite } from "../modules/ai/analysis/site-analysis.service.js";
import {
  savePrompt,
  getPromptById,
  listPrompts,
  updatePrompt,
  deletePrompt,
} from "../modules/ai/prompts/prompt-library.service.js";
import { orchestrateAssistantRequest } from "../modules/ai/assistant/assistant-orchestrator.service.js";

function resolveExpectedVersion(req: Request, websiteId: string): number {
  if (req.get("X-Forge-Intent") === "document-command") {
    try {
      return documentWriteContext(req, websiteId).expectedVersion;
    } catch {
      // fallback to body if provided
    }
  }
  if (typeof req.body?.expectedVersion === "number") {
    return req.body.expectedVersion;
  }
  const ifMatch = req.get("If-Match");
  if (ifMatch) {
    try {
      return parseDocumentETag(websiteId, ifMatch);
    } catch {
      // pass through
    }
  }
  throw new AppError("Expected document version is required (via If-Match header or expectedVersion property)", 428, "DOCUMENT_PRECONDITION_REQUIRED");
}

// -------------------------------------------------------------
// Existing Site Blueprint & Changeset Handlers (Preserved)
// -------------------------------------------------------------
export async function generateSiteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id || "");
    const expectedVersion = resolveExpectedVersion(req, websiteId);
    const result = await generateSiteDraft({
      websiteId,
      actorId: res.locals.user.id,
      prompt: req.body?.prompt,
      expectedVersion,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
}

export async function getAiChangesetHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, changeset: await getAiChangeset(String(req.params.changesetId), res.locals.user.id) });
  } catch (error) { next(error); }
}

export async function cancelAiChangesetHandler(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, changeset: await cancelAiChangeset(String(req.params.changesetId), res.locals.user.id) });
  } catch (error) { next(error); }
}

export async function applyAiChangesetHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.changesetId);
    const row = await getAiChangeset(id, res.locals.user.id);
    let write;
    try {
      write = documentWriteContext(req, row.websiteId);
    } catch {
      write = { key: req.get("Idempotency-Key") || "", expectedVersion: row.expectedDocumentVersion };
    }
    const website = await applyAiChangeset(id, res.locals.user.id, write);
    res.json({ success: true, website });
  } catch (error) { next(error); }
}

export async function retryAiChangesetHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await getAiChangeset(String(req.params.changesetId), res.locals.user.id);
    const expectedVersion = resolveExpectedVersion(req, row.websiteId);
    res.json({ success: true, ...await retryAiChangeset(row.id, res.locals.user.id, expectedVersion) });
  } catch (error) { next(error); }
}

// -------------------------------------------------------------
// Phase 1: AI Text Generation Handler
// -------------------------------------------------------------
export async function generateTextHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id || "");
    const expectedVersion = resolveExpectedVersion(req, websiteId);
    const result = await generateContextualText({
      websiteId,
      actorId: res.locals.user.id,
      targetType: req.body?.targetType || "paragraph",
      prompt: req.body?.prompt,
      expectedVersion,
      context: req.body?.context,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
}

// -------------------------------------------------------------
// Phase 2: AI Content Refinement Handler
// -------------------------------------------------------------
export async function refineContentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id || "");
    const expectedVersion = resolveExpectedVersion(req, websiteId);
    const result = await refineContent({
      websiteId,
      actorId: res.locals.user.id,
      action: req.body?.action || "rewrite",
      originalText: req.body?.originalText,
      expectedVersion,
      context: req.body?.context,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
}

// -------------------------------------------------------------
// Phase 3: AI Section Generation Handler
// -------------------------------------------------------------
export async function generateSectionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id || "");
    const expectedVersion = resolveExpectedVersion(req, websiteId);
    const result = await generateSection({
      websiteId,
      actorId: res.locals.user.id,
      sectionType: req.body?.sectionType || "hero",
      prompt: req.body?.prompt,
      expectedVersion,
      context: req.body?.context,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
}

// -------------------------------------------------------------
// Phase 4: AI Container Generation Handler
// -------------------------------------------------------------
export async function generateContainerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id || "");
    const expectedVersion = resolveExpectedVersion(req, websiteId);
    const result = await generateContainer({
      websiteId,
      actorId: res.locals.user.id,
      layoutType: req.body?.layoutType || "flex-row",
      prompt: req.body?.prompt,
      expectedVersion,
      context: req.body?.context,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
}

// -------------------------------------------------------------
// Phase 5: AI Layout Generation Handler
// -------------------------------------------------------------
export async function generateLayoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id || "");
    const expectedVersion = resolveExpectedVersion(req, websiteId);
    const result = await generateLayout({
      websiteId,
      actorId: res.locals.user.id,
      prompt: req.body?.prompt,
      expectedVersion,
      context: req.body?.context,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
}

// -------------------------------------------------------------
// Phases 6 - 10: AI Image Operations Handlers
// -------------------------------------------------------------
export async function generateImageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = req.params.id ? String(req.params.id) : undefined;
    const result = await generateAiImage({
      websiteId,
      actorId: res.locals.user.id,
      prompt: req.body?.prompt,
      aspectRatio: req.body?.aspectRatio,
      style: req.body?.style,
    });
    return res.status(201).json({ success: true, ...result });
  } catch (error) { next(error); }
}

export async function editImageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const assetId = String(req.params.assetId || "");
    const result = await editAiImage({
      assetId,
      actorId: res.locals.user.id,
      instruction: req.body?.instruction,
      websiteId: req.body?.websiteId,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
}

export async function removeBackgroundHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const assetId = String(req.params.assetId || "");
    const result = await removeImageBackground({
      assetId,
      actorId: res.locals.user.id,
      websiteId: req.body?.websiteId,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
}

export async function generateImageVariationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const assetId = String(req.params.assetId || "");
    const result = await generateImageVariations({
      assetId,
      actorId: res.locals.user.id,
      count: req.body?.count,
      websiteId: req.body?.websiteId,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
}

export async function replaceImageElementHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id || "");
    const expectedVersion = resolveExpectedVersion(req, websiteId);
    const result = await replaceImageElement({
      websiteId,
      actorId: res.locals.user.id,
      elementId: req.body?.elementId,
      prompt: req.body?.prompt,
      expectedVersion,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
}

// -------------------------------------------------------------
// Phases 11 - 13: AI Code Operations Handlers
// -------------------------------------------------------------
export async function generateCodeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id || "");
    const result = await generateCode({
      websiteId,
      actorId: res.locals.user.id,
      language: req.body?.language || "HTML",
      prompt: req.body?.prompt,
      context: req.body?.context,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
}

export async function previewCodeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const sandboxHtml = generateCodePreviewSandbox({
      html: req.body?.html,
      css: req.body?.css,
      js: req.body?.js,
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: https:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';"
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(sandboxHtml);
  } catch (error) { next(error); }
}

export async function explainCodeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await explainCode({
      code: req.body?.code,
      language: req.body?.language || "HTML",
      websiteId: req.body?.websiteId,
      actorId: res.locals.user.id,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
}

// -------------------------------------------------------------
// Phase 14: AI Animation Generation Handler
// -------------------------------------------------------------
export async function generateAnimationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id || "");
    const expectedVersion = resolveExpectedVersion(req, websiteId);
    const result = await generateElementAnimation({
      websiteId,
      actorId: res.locals.user.id,
      elementId: req.body?.elementId,
      intent: req.body?.intent,
      expectedVersion,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
}

// -------------------------------------------------------------
// Phase 15: AI Dynamic Properties Handler
// -------------------------------------------------------------
export async function generateDynamicPropertyHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id || "");
    const expectedVersion = resolveExpectedVersion(req, websiteId);
    const result = await generateDynamicProperty({
      websiteId,
      actorId: res.locals.user.id,
      elementId: req.body?.elementId,
      targetField: req.body?.targetField || "content",
      prompt: req.body?.prompt,
      expectedVersion,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
}

// -------------------------------------------------------------
// Phase 16: AI SEO Generation Handler
// -------------------------------------------------------------
export async function generateSeoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id || "");
    const expectedVersion = resolveExpectedVersion(req, websiteId);
    const result = await generateSeoMetadata({
      websiteId,
      actorId: res.locals.user.id,
      pageId: req.body?.pageId,
      keywords: req.body?.keywords,
      expectedVersion,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
}

// -------------------------------------------------------------
// Phases 17 - 19: AI Site Analysis Handler
// -------------------------------------------------------------
export async function analyzeSiteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id || "");
    const result = await analyzeSite({
      websiteId,
      actorId: res.locals.user.id,
      type: req.body?.type || "all",
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
}

// -------------------------------------------------------------
// Phase 20: AI Prompt Library Handlers
// -------------------------------------------------------------
export async function savePromptHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await savePrompt({
      userId: res.locals.user.id,
      name: req.body?.name,
      prompt: req.body?.prompt,
      description: req.body?.description,
      category: req.body?.category,
      tags: req.body?.tags,
      targetType: req.body?.targetType,
      isFavorite: req.body?.isFavorite,
    });
    return res.status(201).json({ success: true, prompt: result });
  } catch (error) { next(error); }
}

export async function getPromptHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getPromptById(String(req.params.promptId), res.locals.user.id);
    return res.status(200).json({ success: true, prompt: result });
  } catch (error) { next(error); }
}

export async function listPromptsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listPrompts(res.locals.user.id, {
      category: req.query.category as string,
      tag: req.query.tag as string,
      search: req.query.search as string,
      isFavorite: req.query.isFavorite === "true",
    });
    return res.status(200).json({ success: true, prompts: result });
  } catch (error) { next(error); }
}

export async function updatePromptHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await updatePrompt(String(req.params.promptId), res.locals.user.id, {
      name: req.body?.name,
      prompt: req.body?.prompt,
      description: req.body?.description,
      category: req.body?.category,
      tags: req.body?.tags,
      targetType: req.body?.targetType,
      isFavorite: req.body?.isFavorite,
    });
    return res.status(200).json({ success: true, prompt: result });
  } catch (error) { next(error); }
}

export async function deletePromptHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await deletePrompt(String(req.params.promptId), res.locals.user.id);
    return res.status(200).json({ success: true });
  } catch (error) { next(error); }
}

// -------------------------------------------------------------
// Phase 22: Unified AI Assistant Orchestrator Handler
// -------------------------------------------------------------
export async function assistantHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id || "");
    const expectedVersion = resolveExpectedVersion(req, websiteId);
    const result = await orchestrateAssistantRequest({
      websiteId,
      actorId: res.locals.user.id,
      prompt: req.body?.prompt,
      expectedVersion,
      context: req.body?.context,
    });
    return res.status(200).json(result);
  } catch (error) { next(error); }
}
