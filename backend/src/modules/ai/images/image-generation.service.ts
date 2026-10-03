import { randomUUID } from "node:crypto";
import { AppError } from "../../../utils/app-error.js";
import { prisma } from "../../../config/prisma.js";
import { createMediaAsset, getMediaAssetById } from "../../../services/media.service.js";
import { authorizeWebsiteDocumentWrite } from "../../../services/websites/save-document.js";
import { documentObject, validateDocumentTree, type JsonObject } from "../../../services/websites/document-policy.js";
import { encryptPrompt, promptRetentionEnabled, retentionExpiry } from "../prompt-vault.js";
import { reserveWorkspaceAiQuota, releaseAiExecutionQuota, settleAiExecutionQuota } from "../ai-quota.js";
import { getImageProvider, getImageCapabilityMatrix, type ImageCapability } from "./image-provider.js";

export interface GenerateImageInput {
  websiteId?: string;
  actorId: string;
  prompt: string;
  aspectRatio?: "1:1" | "16:9" | "4:3" | "9:16";
  style?: "photorealistic" | "minimalist" | "vector" | "editorial" | "3d";
}

export interface EditImageInput {
  assetId: string;
  actorId: string;
  instruction: string;
  websiteId?: string;
}

export interface RemoveBackgroundInput {
  assetId: string;
  actorId: string;
  websiteId?: string;
}

export interface ImageVariationInput {
  assetId: string;
  actorId: string;
  count?: number;
  websiteId?: string;
}

export interface ReplaceImageElementInput {
  websiteId: string;
  actorId: string;
  elementId: string;
  prompt: string;
  expectedVersion: number;
}

const SUPPORTED_IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

/**
 * Resolve workspace ID for an image operation, prioritizing the specified website
 * or falling back to the actor's workspace membership.
 */
async function resolveWorkspaceForImageOp(actorId: string, websiteId?: string): Promise<{ workspaceId: string; website?: any }> {
  let website: any = null;
  if (websiteId) {
    website = await prisma.website.findUnique({ where: { id: websiteId } });
    if (!website) throw new AppError("Website not found", 404, "WEBSITE_NOT_FOUND");
  }

  const workspaceId = website?.workspaceId || (await prisma.workspaceMember.findFirst({ where: { userId: actorId } }))?.workspaceId;
  if (!workspaceId) {
    throw new AppError("User is not associated with an active workspace", 403, "WORKSPACE_REQUIRED");
  }

  return { workspaceId, website };
}

/**
 * Phase 6: Real AI Image Generation
 * Reuses MediaAsset and enforces transactional workspace quota.
 * Never produces synthetic SVGs or fake placeholders.
 */
export async function generateAiImage(input: GenerateImageInput) {
  if (!input.prompt || input.prompt.trim().length < 3) {
    throw new AppError("A descriptive prompt is required for image generation", 400, "INVALID_PROMPT");
  }

  const user = await prisma.user.findUnique({ where: { id: input.actorId } });
  if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

  const { workspaceId, website } = await resolveWorkspaceForImageOp(input.actorId, input.websiteId);
  const units = 2; // Conservative image unit cost
  const retention = promptRetentionEnabled();

  const provider = getImageProvider();
  if (provider.getCapabilityStatus("generate") === "NOT_CONFIGURED") {
    throw new AppError(
      "AI image generation is not configured on the server. Configure OPENAI_API_KEY to enable DALL-E image generation.",
      503,
      "AI_CAPABILITY_NOT_CONFIGURED"
    );
  }

  // 1. Transactionally reserve quota and record execution
  const execution = await prisma.$transaction(async tx => {
    await reserveWorkspaceAiQuota(tx, { workspaceId, actorId: input.actorId, units });

    return tx.aiExecution.create({
      data: {
        websiteId: website?.id ?? (await prisma.website.findFirst({ where: { userId: input.actorId } }))?.id!,
        workspaceId,
        organizationId: website?.organizationId,
        actorId: input.actorId,
        operation: "IMAGE_GENERATION",
        provider: provider.name,
        model: process.env.AI_MODEL_IMAGE || "dall-e-3",
        reservedUnits: units,
        inputSummary: { prompt: input.prompt, aspectRatio: input.aspectRatio, style: input.style },
        promptCiphertext: retention ? encryptPrompt(input.prompt.trim()) : null,
        promptExpiresAt: retention ? retentionExpiry() : null,
      },
    });
  });

  const dimensions = input.aspectRatio === "16:9" ? { width: 1792, height: 1024, sizeStr: "1792x1024" }
    : input.aspectRatio === "9:16" ? { width: 1024, height: 1792, sizeStr: "1024x1792" }
    : { width: 1024, height: 1024, sizeStr: "1024x1024" };

  try {
    const { url, revisedPrompt } = await provider.generate(input.prompt.trim(), dimensions);
    const filename = `ai_${randomUUID().slice(0, 12)}.png`;

    const asset = await createMediaAsset({
      userId: input.actorId,
      websiteId: input.websiteId,
      filename,
      originalName: `${input.prompt.slice(0, 30)}.png`,
      mimeType: "image/png",
      sizeBytes: 1024 * 512,
      url,
      width: dimensions.width,
      height: dimensions.height,
      altText: revisedPrompt || input.prompt,
    });

    await prisma.$transaction(async tx => {
      await settleAiExecutionQuota(tx, execution.id, units, { assetId: asset.id, url: asset.url });
    });

    return { executionId: execution.id, asset };
  } catch (error) {
    await releaseAiExecutionQuota(execution.id, "FAILED", error instanceof AppError ? error.code : "AI_IMAGE_FAILED");
    throw error;
  }
}

/**
 * Phase 7: Real AI Image Editing
 * Enforces ownership, valid MIME type, workspace quota, and calls real provider edits endpoint.
 */
export async function editAiImage(input: EditImageInput) {
  if (!input.instruction || input.instruction.trim().length < 3) {
    throw new AppError("Edit instruction is required", 400, "INVALID_INPUT");
  }

  const original = await getMediaAssetById(input.assetId, input.actorId);
  if (!original) throw new AppError("Original media asset not found", 404, "ASSET_NOT_FOUND");

  if (!SUPPORTED_IMAGE_MIMES.has(original.mimeType.toLowerCase())) {
    throw new AppError(`Unsupported image MIME type: ${original.mimeType}. Must be PNG, JPEG, or WebP.`, 400, "INVALID_IMAGE_FORMAT");
  }

  // Cross-workspace protection: If websiteId is provided, verify matching asset context
  if (input.websiteId && original.websiteId && original.websiteId !== input.websiteId) {
    throw new AppError("Asset belongs to a different website", 403, "ASSET_ACCESS_FORBIDDEN");
  }

  const { workspaceId, website } = await resolveWorkspaceForImageOp(input.actorId, input.websiteId || original.websiteId || undefined);
  const units = 2;
  const provider = getImageProvider();

  if (provider.getCapabilityStatus("edit") === "NOT_CONFIGURED") {
    throw new AppError(
      "AI image editing capability is not configured on the server. Image inpainting/editing provider required.",
      503,
      "AI_CAPABILITY_NOT_CONFIGURED"
    );
  }

  const execution = await prisma.$transaction(async tx => {
    await reserveWorkspaceAiQuota(tx, { workspaceId, actorId: input.actorId, units });
    return tx.aiExecution.create({
      data: {
        websiteId: website?.id ?? original.websiteId ?? (await prisma.website.findFirst({ where: { userId: input.actorId } }))?.id!,
        workspaceId,
        organizationId: website?.organizationId,
        actorId: input.actorId,
        operation: "IMAGE_EDIT",
        provider: provider.name,
        model: "dall-e-2",
        reservedUnits: units,
        inputSummary: { assetId: original.id, instruction: input.instruction },
      },
    });
  });

  try {
    const { url } = await provider.edit(original.url, input.instruction.trim());
    const filename = `ai_edit_${randomUUID().slice(0, 12)}.png`;

    const asset = await createMediaAsset({
      userId: input.actorId,
      websiteId: input.websiteId || original.websiteId || undefined,
      filename,
      originalName: `edit_${original.originalName || "image.png"}`,
      mimeType: "image/png",
      sizeBytes: original.sizeBytes || 1024 * 512,
      url,
      width: original.width || 1024,
      height: original.height || 1024,
      altText: `${original.altText || "Image"} (edited: ${input.instruction})`,
    });

    await prisma.$transaction(async tx => {
      await settleAiExecutionQuota(tx, execution.id, units, { assetId: asset.id, url: asset.url });
    });

    return { executionId: execution.id, asset };
  } catch (error) {
    await releaseAiExecutionQuota(execution.id, "FAILED", error instanceof AppError ? error.code : "AI_IMAGE_FAILED");
    throw error;
  }
}

/**
 * Phase 8: Real AI Background Removal
 * Validates asset, enforces workspace boundary, reserves quota, and invokes real segmentation provider.
 * Never outputs fake SVG mockups.
 */
export async function removeImageBackground(input: RemoveBackgroundInput) {
  const original = await getMediaAssetById(input.assetId, input.actorId);
  if (!original) throw new AppError("Original media asset not found", 404, "ASSET_NOT_FOUND");

  if (!SUPPORTED_IMAGE_MIMES.has(original.mimeType.toLowerCase())) {
    throw new AppError(`Unsupported image format: ${original.mimeType}`, 400, "INVALID_IMAGE_FORMAT");
  }

  if (input.websiteId && original.websiteId && original.websiteId !== input.websiteId) {
    throw new AppError("Asset belongs to a different website", 403, "ASSET_ACCESS_FORBIDDEN");
  }

  const { workspaceId, website } = await resolveWorkspaceForImageOp(input.actorId, input.websiteId || original.websiteId || undefined);
  const units = 2;
  const provider = getImageProvider();

  if (provider.getCapabilityStatus("removeBackground") === "NOT_CONFIGURED") {
    throw new AppError(
      "AI background removal capability is not configured on the server. Dedicated segmentation service (REMOVE_BG_API_KEY) required.",
      503,
      "AI_CAPABILITY_NOT_CONFIGURED"
    );
  }

  const execution = await prisma.$transaction(async tx => {
    await reserveWorkspaceAiQuota(tx, { workspaceId, actorId: input.actorId, units });
    return tx.aiExecution.create({
      data: {
        websiteId: website?.id ?? original.websiteId ?? (await prisma.website.findFirst({ where: { userId: input.actorId } }))?.id!,
        workspaceId,
        organizationId: website?.organizationId,
        actorId: input.actorId,
        operation: "BACKGROUND_REMOVAL",
        provider: "segmentation-provider",
        model: "rembg",
        reservedUnits: units,
        inputSummary: { assetId: original.id },
      },
    });
  });

  try {
    const { url } = await provider.removeBackground(original.url, original.mimeType);
    const filename = `ai_nobg_${randomUUID().slice(0, 12)}.png`;

    const asset = await createMediaAsset({
      userId: input.actorId,
      websiteId: input.websiteId || original.websiteId || undefined,
      filename,
      originalName: `nobg_${original.originalName || "image.png"}`,
      mimeType: "image/png",
      sizeBytes: original.sizeBytes || 1024 * 512,
      url,
      width: original.width || 1024,
      height: original.height || 1024,
      altText: `${original.altText || "Image"} (transparent background)`,
    });

    await prisma.$transaction(async tx => {
      await settleAiExecutionQuota(tx, execution.id, units, { assetId: asset.id, url: asset.url });
    });

    return { executionId: execution.id, asset };
  } catch (error) {
    await releaseAiExecutionQuota(execution.id, "FAILED", error instanceof AppError ? error.code : "AI_IMAGE_FAILED");
    throw error;
  }
}

/**
 * Phase 9: Real AI Image Variations
 * Never generates fake gradients; calls real variation provider or returns explicit unsupported capability.
 */
export async function generateImageVariations(input: ImageVariationInput) {
  const original = await getMediaAssetById(input.assetId, input.actorId);
  if (!original) throw new AppError("Original media asset not found", 404, "ASSET_NOT_FOUND");

  if (!SUPPORTED_IMAGE_MIMES.has(original.mimeType.toLowerCase())) {
    throw new AppError(`Unsupported image format: ${original.mimeType}`, 400, "INVALID_IMAGE_FORMAT");
  }

  if (input.websiteId && original.websiteId && original.websiteId !== input.websiteId) {
    throw new AppError("Asset belongs to a different website", 403, "ASSET_ACCESS_FORBIDDEN");
  }

  const { workspaceId, website } = await resolveWorkspaceForImageOp(input.actorId, input.websiteId || original.websiteId || undefined);
  const count = Math.min(Math.max(input.count || 2, 1), 4);
  const units = count;
  const provider = getImageProvider();

  if (provider.getCapabilityStatus("variations") === "NOT_CONFIGURED") {
    throw new AppError(
      "AI image variations capability is not configured on the server. DALL-E variations API required.",
      503,
      "AI_CAPABILITY_NOT_CONFIGURED"
    );
  }

  const execution = await prisma.$transaction(async tx => {
    await reserveWorkspaceAiQuota(tx, { workspaceId, actorId: input.actorId, units });
    return tx.aiExecution.create({
      data: {
        websiteId: website?.id ?? original.websiteId ?? (await prisma.website.findFirst({ where: { userId: input.actorId } }))?.id!,
        workspaceId,
        organizationId: website?.organizationId,
        actorId: input.actorId,
        operation: "IMAGE_VARIATIONS",
        provider: provider.name,
        model: "dall-e-2",
        reservedUnits: units,
        inputSummary: { assetId: original.id, count },
      },
    });
  });

  try {
    const variationUrls = await provider.variations(original.url, count);
    const createdAssets: any[] = [];

    for (let i = 0; i < variationUrls.length; i++) {
      const item = variationUrls[i];
      const filename = `ai_var_${i + 1}_${randomUUID().slice(0, 10)}.png`;
      const asset = await createMediaAsset({
        userId: input.actorId,
        websiteId: input.websiteId || original.websiteId || undefined,
        filename,
        originalName: `var_${i + 1}_${original.originalName || "image.png"}`,
        mimeType: "image/png",
        sizeBytes: original.sizeBytes || 1024 * 512,
        url: item.url,
        width: original.width || 1024,
        height: original.height || 1024,
        altText: `${original.altText || "Image"} (variation ${i + 1})`,
      });
      createdAssets.push(asset);
    }

    await prisma.$transaction(async tx => {
      await settleAiExecutionQuota(tx, execution.id, units, {
        assetCount: createdAssets.length,
        assetIds: createdAssets.map(a => a.id),
      });
    });

    return { executionId: execution.id, assets: createdAssets };
  } catch (error) {
    await releaseAiExecutionQuota(execution.id, "FAILED", error instanceof AppError ? error.code : "AI_IMAGE_FAILED");
    throw error;
  }
}

/**
 * Phase 10: AI Image Element Replacement in Canvas Document
 * Uses real generated asset, preserves original node configuration and undo history via AiChangeset.
 */
export async function replaceImageElement(input: ReplaceImageElementInput) {
  const website = await prisma.$transaction(async tx => {
    const scope = await authorizeWebsiteDocumentWrite(tx, input.websiteId, input.actorId);
    if (!scope.can("EDIT_DESIGN")) throw new AppError("Image replacement requires design editing permission", 403, "DOCUMENT_EDIT_FORBIDDEN");
    return scope.website;
  });

  if (website.documentVersion !== input.expectedVersion) {
    throw new AppError("Website changed before image replacement. Reload to continue.", 412, "DOCUMENT_VERSION_CONFLICT");
  }

  // Generate the new asset using the real image generation pipeline
  const { asset, executionId } = await generateAiImage({
    websiteId: input.websiteId,
    actorId: input.actorId,
    prompt: input.prompt,
  });

  const currentDoc = documentObject(typeof website.editorData === "string" ? JSON.parse(website.editorData) : website.editorData);
  const proposedDoc = JSON.parse(JSON.stringify(currentDoc)) as JsonObject;

  let replaced = false;
  const updateElement = (nodes: unknown) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (node && typeof node === "object") {
        if ((node as any).id === input.elementId) {
          (node as any).imageUrl = asset.url;
          (node as any).src = asset.url;
          (node as any).imageAlt = asset.altText || input.prompt;
          (node as any).alt = asset.altText || input.prompt;
          replaced = true;
          return;
        }
        if ((node as any).children) updateElement((node as any).children);
      }
    }
  };

  if (Array.isArray(proposedDoc.pages)) {
    for (const page of proposedDoc.pages as any[]) {
      if (page.elements) updateElement(page.elements);
    }
  } else if (proposedDoc.elements) {
    updateElement(proposedDoc.elements);
  }

  if (!replaced) {
    throw new AppError(`Target image element #${input.elementId} not found in website`, 404, "ELEMENT_NOT_FOUND");
  }

  validateDocumentTree(proposedDoc);

  const changeset = await prisma.aiChangeset.create({
    data: {
      executionId,
      websiteId: website.id,
      workspaceId: website.workspaceId,
      organizationId: website.organizationId,
      actorId: input.actorId,
      expectedDocumentVersion: input.expectedVersion,
      proposedDocument: proposedDoc,
      summary: {
        operation: "IMAGE_REPLACEMENT",
        elementId: input.elementId,
        newAssetId: asset.id,
        newUrl: asset.url,
      },
    },
  });

  return { executionId, changesetId: changeset.id, asset, changeset };
}

export { getImageCapabilityMatrix };
