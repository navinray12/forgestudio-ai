import { AppError } from "../../../utils/app-error.js";
import { prisma } from "../../../config/prisma.js";
import { authorizeWebsiteDocumentWrite } from "../../../services/websites/save-document.js";
import { documentObject, validateDocumentTree, type JsonObject } from "../../../services/websites/document-policy.js";
import { siteGenerationProvider } from "../provider-routing.js";
import { encryptPrompt, promptRetentionEnabled, retentionExpiry } from "../prompt-vault.js";

import { reserveWorkspaceAiQuota, releaseAiExecutionQuota, settleAiExecutionQuota } from "../ai-quota.js";

export type RefinementAction =
  | "rewrite"
  | "shorten"
  | "expand"
  | "simplify"
  | "tone_professional"
  | "tone_conversational"
  | "tone_persuasive"
  | "seo_rewrite"
  | "grammar_correction"
  | "translate";

export interface RefineContentInput {
  websiteId: string;
  actorId: string;
  action: RefinementAction;
  originalText: string;
  expectedVersion: number;
  context?: {
    elementId?: string;
    pageId?: string;
    targetLanguage?: string;
    instructions?: string;
  };
}

export async function refineContent(input: RefineContentInput) {
  if (!input.originalText || input.originalText.trim().length === 0) {
    throw new AppError("Original text is required for content refinement", 400, "INVALID_INPUT");
  }

  const website = await prisma.$transaction(async tx => {
    const scope = await authorizeWebsiteDocumentWrite(tx, input.websiteId, input.actorId);
    if (!scope.can("EDIT_DESIGN") && !scope.can("EDIT_CONTENT")) {
      throw new AppError("Content editing is not permitted", 403, "DOCUMENT_EDIT_FORBIDDEN");
    }
    return scope.website;
  });

  if (website.documentVersion !== input.expectedVersion) {
    throw new AppError("The website changed before refinement started. Reload to continue.", 412, "DOCUMENT_VERSION_CONFLICT");
  }

  const provider = siteGenerationProvider();
  const retention = promptRetentionEnabled();
  const units = 1;

  const execution = await prisma.$transaction(async tx => {
    await reserveWorkspaceAiQuota(tx, { workspaceId: website.workspaceId, actorId: input.actorId, units });
    return tx.aiExecution.create({
      data: {
        websiteId: website.id,
        workspaceId: website.workspaceId,
        organizationId: website.organizationId,
        actorId: input.actorId,
        operation: "CONTENT_REFINEMENT",
        provider: provider.name,
        model: provider.model,
        reservedUnits: units,
        expectedDocumentVersion: input.expectedVersion,
        inputSummary: {
          action: input.action,
          originalLength: input.originalText.length,
          context: input.context ?? {},
        },
        promptCiphertext: retention ? encryptPrompt(input.originalText.trim()) : null,
        promptExpiresAt: retention ? retentionExpiry() : null,
        scope: input.context as unknown as JsonObject,
      },
    });
  });

  const actionInstructions: Record<RefinementAction, string> = {
    rewrite: "Rewrite this copy for higher clarity, elegance, and impact while preserving key facts.",
    shorten: "Make this copy significantly more concise, punchy, and brief without losing core meaning.",
    expand: "Elaborate and expand on this copy, providing richer depth, clarity, and benefits.",
    simplify: "Simplify this copy so it is effortlessly readable and accessible to anyone.",
    tone_professional: "Transform the tone to be authoritative, polished, and professional.",
    tone_conversational: "Transform the tone to be friendly, approachable, warm, and conversational.",
    tone_persuasive: "Transform the tone to be compelling, action-oriented, and high-converting.",
    seo_rewrite: "Optimize this copy for organic search readability and natural keyword integration.",
    grammar_correction: "Correct all spelling, grammar, punctuation, and phrasing issues without altering meaning.",
    translate: `Translate this copy accurately and naturally into ${input.context?.targetLanguage || "the target language"}.`,
  };

  const systemPrompt = `You are a master web copy editor.
Goal: ${actionInstructions[input.action]}
${input.context?.instructions ? `Additional user instructions: ${input.context.instructions}` : ""}

Original text to refine:
"""${input.originalText}"""

Requirements:
- Never fabricate false facts or claims.
- Return ONLY a valid JSON object matching this schema:
{
  "refined": "the primary refined text",
  "variants": ["alternative 1", "alternative 2"],
  "changeNotes": "summary of edits made"
}`;

  let rawResult: { text: string };
  try {
    rawResult = await provider.generate({
      operation: "CONTENT_REFINEMENT",
      prompt: input.originalText,
      context: {
        action: input.action,
        targetLanguage: input.context?.targetLanguage,
      },
      systemPrompt,
      schema: {
        type: "object",
        properties: {
          refined: { type: "string" },
          variants: { type: "array", items: { type: "string" } },
          changeNotes: { type: "string" },
        },
        required: ["refined", "variants"],
      },
    });
  } catch (error) {
    await releaseAiExecutionQuota(execution.id, "FAILED", error instanceof AppError ? error.code : "AI_PROVIDER_UNAVAILABLE");
    throw error;
  }

  let parsed: { refined: string; variants: string[]; changeNotes?: string };
  try {
    const textToParse = rawResult.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    parsed = JSON.parse(textToParse);
    if (!parsed.refined || typeof parsed.refined !== "string") throw new Error("Missing refined text");
    if (!Array.isArray(parsed.variants)) parsed.variants = [parsed.refined];
  } catch {
    parsed = {
      refined: rawResult.text.trim(),
      variants: [rawResult.text.trim()],
      changeNotes: "Refined copy",
    };
  }

  // Construct proposed document
  const currentDoc = documentObject(typeof website.editorData === "string" ? JSON.parse(website.editorData) : website.editorData);
  const proposedDoc = JSON.parse(JSON.stringify(currentDoc)) as JsonObject;

  if (input.context?.elementId) {
    const updateElement = (nodes: unknown) => {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (node && typeof node === "object") {
          if (node.id === input.context!.elementId) {
            node.content = parsed.refined;
          }
          if (node.children) updateElement(node.children);
        }
      }
    };

    if (Array.isArray(proposedDoc.pages)) {
      for (const page of proposedDoc.pages as any[]) {
        if (page.elements) updateElement(page.elements);
      }
    }
    if (proposedDoc.elements) updateElement(proposedDoc.elements);
  }

  validateDocumentTree(proposedDoc);

  const changeset = await prisma.$transaction(async tx => {
    await settleAiExecutionQuota(tx, execution.id, units, {
      action: input.action,
      originalLength: input.originalText.length,
      refinedLength: parsed.refined.length,
    });

    return tx.aiChangeset.create({
      data: {
        executionId: execution.id,
        websiteId: website.id,
        workspaceId: website.workspaceId,
        organizationId: website.organizationId,
        actorId: input.actorId,
        expectedDocumentVersion: input.expectedVersion,
        proposedDocument: proposedDoc,
        summary: {
          operation: "CONTENT_REFINEMENT",
          action: input.action,
          originalText: input.originalText,
          refinedText: parsed.refined,
          variants: parsed.variants,
          changeNotes: parsed.changeNotes,
          targetElementId: input.context?.elementId,
        },
      },
    });
  });

  return {
    executionId: execution.id,
    changesetId: changeset.id,
    refinedText: parsed.refined,
    variants: parsed.variants,
    changeNotes: parsed.changeNotes,
    changeset,
  };
}
