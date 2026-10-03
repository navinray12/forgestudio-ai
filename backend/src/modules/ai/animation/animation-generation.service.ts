import { z } from "zod";
import { AppError } from "../../../utils/app-error.js";
import { prisma } from "../../../config/prisma.js";
import { authorizeWebsiteDocumentWrite } from "../../../services/websites/save-document.js";
import { documentObject, validateDocumentTree, type JsonObject } from "../../../services/websites/document-policy.js";
import { siteGenerationProvider } from "../provider-routing.js";
import { reserveWorkspaceAiQuota, releaseAiExecutionQuota, settleAiExecutionQuota } from "../ai-quota.js";

export const canonicalEntranceAnimations = [
  "none",
  "fade-in",
  "fade-in-up",
  "fade-in-down",
  "zoom-in",
  "slide-up",
  "slide-down",
  "bounce-in",
] as const;

export const motionConfigSchema = z.object({
  entranceAnimation: z.enum(canonicalEntranceAnimations).optional().default("fade-in-up"),
  entranceDurationMs: z.string().regex(/^\d+$/).optional().default("600"),
  entranceDelayMs: z.string().regex(/^\d+$/).optional().default("0"),
  entranceReplay: z.boolean().optional().default(false),
  hover: z.object({
    scale: z.string().optional(),
    rotate: z.string().optional(),
    translateY: z.string().optional(),
    opacity: z.string().optional(),
    durationMs: z.string().optional(),
  }).optional(),
  scroll: z.object({
    enabled: z.boolean().default(false),
    speedX: z.string().optional(),
    speedY: z.string().optional(),
    transparency: z.enum(["none", "fade-in", "fade-out", "fade-in-out"]).optional(),
  }).optional(),
}).strict();

export type CanonicalMotionConfig = z.infer<typeof motionConfigSchema>;

export interface GenerateAnimationInput {
  websiteId: string;
  actorId: string;
  elementId: string;
  intent: string;
  expectedVersion: number;
}

export async function generateElementAnimation(input: GenerateAnimationInput) {
  if (!input.intent || input.intent.trim().length === 0) {
    throw new AppError("Animation intent description is required", 400, "INVALID_INPUT");
  }

  const website = await prisma.$transaction(async tx => {
    const scope = await authorizeWebsiteDocumentWrite(tx, input.websiteId, input.actorId);
    if (!scope.can("EDIT_DESIGN")) throw new AppError("Design editing is not permitted", 403, "DOCUMENT_EDIT_FORBIDDEN");
    return scope.website;
  });

  if (website.documentVersion !== input.expectedVersion) {
    throw new AppError("Website changed before animation update. Reload to continue.", 412, "DOCUMENT_VERSION_CONFLICT");
  }

  const units = 1;
  const execution = await prisma.$transaction(async tx => {
    await reserveWorkspaceAiQuota(tx, { workspaceId: website.workspaceId, actorId: input.actorId, units });
    return tx.aiExecution.create({
      data: {
        websiteId: website.id,
        workspaceId: website.workspaceId,
        organizationId: website.organizationId,
        actorId: input.actorId,
        operation: "ANIMATION_GENERATION",
        provider: "site-generation-provider",
        model: "canonical",
        reservedUnits: units,
        expectedDocumentVersion: input.expectedVersion,
        inputSummary: { elementId: input.elementId, intent: input.intent },
      },
    });
  });

  const provider = siteGenerationProvider();
  const systemPrompt = `You are a web motion and micro-interaction designer for ForgeStudio.
Convert the user motion intent into the canonical ForgeStudio MotionConfig schema.

Valid entranceAnimation types:
"fade-in", "fade-in-up", "fade-in-down", "zoom-in", "slide-up", "slide-down", "bounce-in", "none"

Durations and delays are strings representing milliseconds (e.g. "600", "0").

Return ONLY valid JSON matching this schema:
{
  "motionConfig": {
    "entranceAnimation": "fade-in-up",
    "entranceDurationMs": "600",
    "entranceDelayMs": "0",
    "entranceReplay": false,
    "hover": {
      "scale": "1.05",
      "translateY": "-4",
      "durationMs": "300"
    }
  },
  "summary": "Subtle fade-in entrance with slight hover lift"
}`;

  try {
    const rawResult = await provider.generate({
      operation: "ANIMATION_GENERATION",
      prompt: input.intent,
      context: { elementId: input.elementId },
      systemPrompt,
    });

    let parsedMotionConfig: CanonicalMotionConfig;
    let summaryText = "AI generated motion configuration";
    try {
      const cleaned = rawResult.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
      const json = JSON.parse(cleaned);
      parsedMotionConfig = motionConfigSchema.parse(json.motionConfig || json);
      if (json.summary) summaryText = json.summary;
    } catch {
      // Map intent keywords cleanly to canonical schema fallback
      const i = input.intent.toLowerCase();
      parsedMotionConfig = {
        entranceAnimation: i.includes("zoom") ? "zoom-in"
          : i.includes("down") ? "fade-in-down"
          : i.includes("bounce") ? "bounce-in"
          : i.includes("slide") ? "slide-up"
          : "fade-in-up",
        entranceDurationMs: "600",
        entranceDelayMs: "0",
        entranceReplay: false,
        hover: i.includes("hover") ? { scale: "1.03", translateY: "-2", durationMs: "200" } : undefined,
      };
    }

    const currentDoc = documentObject(typeof website.editorData === "string" ? JSON.parse(website.editorData) : website.editorData);
    const proposedDoc = JSON.parse(JSON.stringify(currentDoc)) as JsonObject;

    let attached = false;
    const attachMotion = (nodes: unknown) => {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (node && typeof node === "object") {
          if ((node as any).id === input.elementId) {
            (node as any).motionConfig = parsedMotionConfig;
            attached = true;
            return;
          }
          if ((node as any).children) attachMotion((node as any).children);
        }
      }
    };

    if (Array.isArray(proposedDoc.pages)) {
      for (const page of proposedDoc.pages as any[]) {
        if (page.elements) attachMotion(page.elements);
      }
    } else if (proposedDoc.elements) {
      attachMotion(proposedDoc.elements);
    }

    if (!attached) {
      throw new AppError(`Target element #${input.elementId} not found in website`, 404, "ELEMENT_NOT_FOUND");
    }

    validateDocumentTree(proposedDoc);

    const changeset = await prisma.$transaction(async tx => {
      await settleAiExecutionQuota(tx, execution.id, units, { motionConfig: parsedMotionConfig });

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
            operation: "ANIMATION_GENERATION",
            elementId: input.elementId,
            motionConfig: parsedMotionConfig,
            summary: summaryText,
          },
        },
      });
    });

    return { executionId: execution.id, changesetId: changeset.id, motionConfig: parsedMotionConfig, changeset };
  } catch (error) {
    await releaseAiExecutionQuota(execution.id, "FAILED", error instanceof AppError ? error.code : "AI_ANIMATION_FAILED");
    throw error;
  }
}
