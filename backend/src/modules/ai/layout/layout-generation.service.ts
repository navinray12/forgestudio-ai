import { randomUUID } from "node:crypto";
import { AppError } from "../../../utils/app-error.js";
import { prisma } from "../../../config/prisma.js";
import { authorizeWebsiteDocumentWrite } from "../../../services/websites/save-document.js";
import { documentObject, validateDocumentTree, type JsonObject } from "../../../services/websites/document-policy.js";
import { siteGenerationProvider } from "../provider-routing.js";
import { encryptPrompt, promptRetentionEnabled, retentionExpiry } from "../prompt-vault.js";
import { reserveWorkspaceAiQuota, releaseAiExecutionQuota, settleAiExecutionQuota } from "../ai-quota.js";

export type ContainerLayoutType = "flex-row" | "flex-column" | "grid-2-col" | "grid-3-col" | "grid-4-col" | "split-screen" | "card-grid" | "custom";

export interface GenerateContainerInput {
  websiteId: string;
  actorId: string;
  layoutType: ContainerLayoutType;
  prompt: string;
  expectedVersion: number;
  context?: {
    pageId?: string;
    parentContainerId?: string;
    columns?: number;
    gap?: string;
    padding?: string;
    alignItems?: string;
    justifyContent?: string;
  };
}

export interface GenerateLayoutInput {
  websiteId: string;
  actorId: string;
  prompt: string;
  expectedVersion: number;
  context?: {
    pageId?: string;
    targetSectionId?: string;
    responsiveGoal?: "mobile-first" | "desktop-primary" | "adaptive";
  };
}

export async function generateContainer(input: GenerateContainerInput) {
  const website = await prisma.$transaction(async tx => {
    const scope = await authorizeWebsiteDocumentWrite(tx, input.websiteId, input.actorId);
    if (!scope.can("EDIT_DESIGN")) throw new AppError("Container generation requires design editing permission", 403, "DOCUMENT_EDIT_FORBIDDEN");
    return scope.website;
  });

  if (website.documentVersion !== input.expectedVersion) {
    throw new AppError("Website changed before container generation. Reload to continue.", 412, "DOCUMENT_VERSION_CONFLICT");
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
        operation: "CONTAINER_GENERATION",
        provider: provider.name,
        model: provider.model,
        reservedUnits: units,
        expectedDocumentVersion: input.expectedVersion,
        inputSummary: {
          layoutType: input.layoutType,
          prompt: input.prompt,
          context: input.context ?? {},
        },
        promptCiphertext: retention ? encryptPrompt(input.prompt.trim()) : null,
        promptExpiresAt: retention ? retentionExpiry() : null,
        scope: input.context as unknown as JsonObject,
      },
    });
  });

  const systemPrompt = `You are a CSS Flexbox & CSS Grid specialist for the ForgeStudio visual builder.
Generate a container AST for layout: "${input.layoutType}".
User specifications: "${input.prompt}"

Container requirements:
- Root is a container element: {"id": "cnt-...", "type": "container", "styles": {...}, "responsiveStyles": {"mobile": {...}, "tablet": {...}}, "children": [...]}
- Styles MUST specify: display ("flex" or "grid"), flexDirection/gridTemplateColumns, gap, padding, margin, width, height, alignItems, justifyContent.
- Provide responsive mobile adjustments (e.g., flex-direction: column or grid-template-columns: 1fr on mobile).
- Return ONLY valid JSON: { "container": <container_node>, "summary": "brief description of layout" }`;

  let rawResult: { text: string };
  try {
    rawResult = await provider.generate({
      operation: "CONTAINER_GENERATION",
      prompt: input.prompt,
      context: { layoutType: input.layoutType, ...input.context },
      systemPrompt,
    });
  } catch (error) {
    await releaseAiExecutionQuota(execution.id, "FAILED", error instanceof AppError ? error.code : "AI_PROVIDER_UNAVAILABLE");
    throw error;
  }

  let containerNode: any;
  let summary = `${input.layoutType} container`;
  try {
    const textToParse = rawResult.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(textToParse);
    containerNode = parsed.container || parsed;
    if (parsed.summary) summary = parsed.summary;
  } catch {
    throw new AppError("AI provider returned invalid container structure", 502, "AI_INVALID_OUTPUT");
  }

  // Ensure unique ID
  containerNode.id = `cnt-${randomUUID().slice(0, 8)}`;
  if (!containerNode.styles) containerNode.styles = {};
  if (!containerNode.responsiveStyles) containerNode.responsiveStyles = {};
  if (!Array.isArray(containerNode.children)) containerNode.children = [];

  const currentDoc = documentObject(typeof website.editorData === "string" ? JSON.parse(website.editorData) : website.editorData);
  const proposedDoc = JSON.parse(JSON.stringify(currentDoc)) as JsonObject;

  const targetPageId = input.context?.pageId || proposedDoc.homePageId || (Array.isArray(proposedDoc.pages) ? (proposedDoc.pages[0] as any)?.id : null);
  if (Array.isArray(proposedDoc.pages) && targetPageId) {
    const page = (proposedDoc.pages as any[]).find(p => p.id === targetPageId);
    if (page) {
      if (!Array.isArray(page.elements)) page.elements = [];
      page.elements.push(containerNode);
    }
  }

  if (Array.isArray(proposedDoc.pages)) {
    const home = (proposedDoc.pages as any[]).find(p => p.id === proposedDoc.homePageId) || (proposedDoc.pages as any[])[0];
    if (home) proposedDoc.elements = home.elements;
  }

  validateDocumentTree(proposedDoc);

  const changeset = await prisma.$transaction(async tx => {
    await settleAiExecutionQuota(tx, execution.id, units, { containerId: containerNode.id, layoutType: input.layoutType });

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
          operation: "CONTAINER_GENERATION",
          layoutType: input.layoutType,
          containerId: containerNode.id,
          summary,
        },
      },
    });
  });

  return { executionId: execution.id, changesetId: changeset.id, container: containerNode, summary, changeset };
}

export async function generateLayout(input: GenerateLayoutInput) {
  const website = await prisma.$transaction(async tx => {
    const scope = await authorizeWebsiteDocumentWrite(tx, input.websiteId, input.actorId);
    if (!scope.can("EDIT_DESIGN")) throw new AppError("Layout generation requires design editing permission", 403, "DOCUMENT_EDIT_FORBIDDEN");
    return scope.website;
  });

  if (website.documentVersion !== input.expectedVersion) {
    throw new AppError("Website changed before layout generation. Reload to continue.", 412, "DOCUMENT_VERSION_CONFLICT");
  }

  const provider = siteGenerationProvider();
  const retention = promptRetentionEnabled();
  const units = 2;

  const execution = await prisma.$transaction(async tx => {
    await reserveWorkspaceAiQuota(tx, { workspaceId: website.workspaceId, actorId: input.actorId, units });
    return tx.aiExecution.create({
      data: {
        websiteId: website.id,
        workspaceId: website.workspaceId,
        organizationId: website.organizationId,
        actorId: input.actorId,
        operation: "LAYOUT_GENERATION",
        provider: provider.name,
        model: provider.model,
        reservedUnits: units,
        expectedDocumentVersion: input.expectedVersion,
        inputSummary: {
          prompt: input.prompt,
          context: input.context ?? {},
        },
        promptCiphertext: retention ? encryptPrompt(input.prompt.trim()) : null,
        promptExpiresAt: retention ? retentionExpiry() : null,
        scope: input.context as unknown as JsonObject,
      },
    });
  });

  const systemPrompt = `You are a responsive web layout architect for ForgeStudio.
Create or reorganize the structural layout based on: "${input.prompt}".
Goal: Design an exquisite, balanced visual hierarchy across desktop, tablet, and mobile.
Return a structured array of top-level layout containers or sections conforming to ForgeStudio document nodes.
Return ONLY valid JSON: { "elements": [ ... ], "summary": "description of layout structure" }`;

  let rawResult: { text: string };
  try {
    rawResult = await provider.generate({
      operation: "LAYOUT_GENERATION",
      prompt: input.prompt,
      context: { websiteName: website.name, ...input.context },
      systemPrompt,
    });
  } catch (error) {
    await releaseAiExecutionQuota(execution.id, "FAILED", error instanceof AppError ? error.code : "AI_PROVIDER_UNAVAILABLE");
    throw error;
  }

  let layoutElements: any[];
  let summary = "AI Layout";
  try {
    const textToParse = rawResult.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(textToParse);
    layoutElements = Array.isArray(parsed.elements) ? parsed.elements : (Array.isArray(parsed) ? parsed : [parsed]);
    if (parsed.summary) summary = parsed.summary;
  } catch {
    throw new AppError("AI provider returned invalid layout structure", 502, "AI_INVALID_OUTPUT");
  }

  const assignIds = (nodes: any[]) => {
    for (const node of nodes) {
      if (node && typeof node === "object") {
        node.id = `lay-${randomUUID().slice(0, 8)}`;
        if (!node.styles) node.styles = {};
        if (!node.responsiveStyles) node.responsiveStyles = {};
        if (Array.isArray(node.children)) assignIds(node.children);
      }
    }
  };
  assignIds(layoutElements);

  const currentDoc = documentObject(typeof website.editorData === "string" ? JSON.parse(website.editorData) : website.editorData);
  const proposedDoc = JSON.parse(JSON.stringify(currentDoc)) as JsonObject;

  const targetPageId = input.context?.pageId || proposedDoc.homePageId || (Array.isArray(proposedDoc.pages) ? (proposedDoc.pages[0] as any)?.id : null);
  if (Array.isArray(proposedDoc.pages) && targetPageId) {
    const page = (proposedDoc.pages as any[]).find(p => p.id === targetPageId);
    if (page) {
      page.elements = layoutElements;
    }
  }
  if (Array.isArray(proposedDoc.pages)) {
    const home = (proposedDoc.pages as any[]).find(p => p.id === proposedDoc.homePageId) || (proposedDoc.pages as any[])[0];
    if (home) proposedDoc.elements = home.elements;
  }

  validateDocumentTree(proposedDoc);

  const changeset = await prisma.$transaction(async tx => {
    await settleAiExecutionQuota(tx, execution.id, units, { elementCount: layoutElements.length });

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
          operation: "LAYOUT_GENERATION",
          elementCount: layoutElements.length,
          summary,
        },
      },
    });
  });

  return { executionId: execution.id, changesetId: changeset.id, elements: layoutElements, summary, changeset };
}
