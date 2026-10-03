import { AppError } from "../../../utils/app-error.js";
import { prisma } from "../../../config/prisma.js";
import { authorizeWebsiteDocumentWrite } from "../../../services/websites/save-document.js";
import { documentObject, validateDocumentTree, type JsonObject } from "../../../services/websites/document-policy.js";
import { siteGenerationProvider } from "../provider-routing.js";
import { encryptPrompt, promptRetentionEnabled, retentionExpiry } from "../prompt-vault.js";

import { reserveWorkspaceAiQuota, releaseAiExecutionQuota, settleAiExecutionQuota } from "../ai-quota.js";

export type TextTargetType =
  | "heading"
  | "paragraph"
  | "title"
  | "subtitle"
  | "description"
  | "cta"
  | "label"
  | "caption"
  | "feature"
  | "testimonial"
  | "product_description"
  | "marketing";

export interface GenerateTextInput {
  websiteId: string;
  actorId: string;
  targetType: TextTargetType;
  prompt: string;
  expectedVersion: number;
  context?: {
    pageId?: string;
    sectionId?: string;
    elementId?: string;
    brandVoice?: string;
    tone?: string;
    targetAudience?: string;
    language?: string;
  };
}

export async function generateContextualText(input: GenerateTextInput) {
  if (!input.prompt || input.prompt.trim().length < 3) {
    throw new AppError("A descriptive prompt is required for text generation", 400, "INVALID_PROMPT");
  }

  const website = await prisma.$transaction(async tx => {
    const scope = await authorizeWebsiteDocumentWrite(tx, input.websiteId, input.actorId);
    if (!scope.can("EDIT_DESIGN") && !scope.can("EDIT_CONTENT")) {
      throw new AppError("Text editing is not permitted", 403, "DOCUMENT_EDIT_FORBIDDEN");
    }
    return scope.website;
  });

  if (website.documentVersion !== input.expectedVersion) {
    throw new AppError("The website changed before text generation started. Reload to continue.", 412, "DOCUMENT_VERSION_CONFLICT");
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
        operation: "TEXT_GENERATION",
        provider: provider.name,
        model: provider.model,
        reservedUnits: units,
        expectedDocumentVersion: input.expectedVersion,
        inputSummary: {
          targetType: input.targetType,
          promptLength: input.prompt.trim().length,
          context: input.context ?? {},
        },
        promptCiphertext: retention ? encryptPrompt(input.prompt.trim()) : null,
        promptExpiresAt: retention ? retentionExpiry() : null,
        scope: input.context as unknown as JsonObject,
      },
    });
  });

  const systemPrompt = `You are a world-class copywriter and web content strategist.
Your task is to generate compelling, contextual website text for target type: "${input.targetType}".
Context:
- Brand voice: ${input.context?.brandVoice || "Modern, clear, premium"}
- Tone: ${input.context?.tone || "Professional, engaging"}
- Target audience: ${input.context?.targetAudience || "General web visitors"}
- Language: ${input.context?.language || "English"}
- Website name: ${website.name}

Requirements:
- Never fabricate false statistics or unverifiable awards.
- Ensure the text fits natural web design patterns for ${input.targetType}.
- Provide a primary recommended text and 2-3 strong alternatives.
- Return ONLY a valid JSON object matching this schema:
{
  "primary": "main text recommendation",
  "variants": ["variant 1", "variant 2"],
  "summary": "Brief explanation of tone and angle"
}`;

  let rawResult: { text: string };
  try {
    rawResult = await provider.generate({
      operation: "TEXT_GENERATION",
      prompt: input.prompt.trim(),
      context: {
        websiteName: website.name,
        targetType: input.targetType,
        ...input.context,
      },
      systemPrompt,
      schema: {
        type: "object",
        properties: {
          primary: { type: "string" },
          variants: { type: "array", items: { type: "string" } },
          summary: { type: "string" },
        },
        required: ["primary", "variants"],
      },
    });
  } catch (error) {
    await releaseAiExecutionQuota(execution.id, "FAILED", error instanceof AppError ? error.code : "AI_PROVIDER_UNAVAILABLE");
    throw error;
  }

  let parsed: { primary: string; variants: string[]; summary?: string };
  try {
    const textToParse = rawResult.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    parsed = JSON.parse(textToParse);
    if (!parsed.primary || typeof parsed.primary !== "string") throw new Error("Missing primary text");
    if (!Array.isArray(parsed.variants)) parsed.variants = [parsed.primary];
  } catch {
    parsed = {
      primary: rawResult.text.trim(),
      variants: [rawResult.text.trim()],
      summary: "Generated copy",
    };
  }

  // Construct proposed document
  const currentDoc = documentObject(typeof website.editorData === "string" ? JSON.parse(website.editorData) : website.editorData);
  const proposedDoc = JSON.parse(JSON.stringify(currentDoc)) as JsonObject;

  // If a target element is specified, apply the new text to that element in the proposal
  if (input.context?.elementId) {
    let elementFound = false;
    const updateElement = (nodes: unknown) => {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (node && typeof node === "object") {
          if (node.id === input.context!.elementId) {
            node.content = parsed.primary;
            elementFound = true;
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
      primary: parsed.primary,
      variantCount: parsed.variants.length,
      targetType: input.targetType,
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
          operation: "TEXT_GENERATION",
          targetType: input.targetType,
          primaryText: parsed.primary,
          variants: parsed.variants,
          rationale: parsed.summary,
          targetElementId: input.context?.elementId,
        },
      },
    });
  });

  return {
    executionId: execution.id,
    changesetId: changeset.id,
    primary: parsed.primary,
    variants: parsed.variants,
    summary: parsed.summary,
    changeset,
  };
}
