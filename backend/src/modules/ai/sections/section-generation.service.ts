import { randomUUID } from "node:crypto";
import { AppError } from "../../../utils/app-error.js";
import { prisma } from "../../../config/prisma.js";
import { authorizeWebsiteDocumentWrite } from "../../../services/websites/save-document.js";
import { documentObject, validateDocumentTree, type JsonObject } from "../../../services/websites/document-policy.js";
import { siteGenerationProvider } from "../provider-routing.js";
import { encryptPrompt, promptRetentionEnabled, retentionExpiry } from "../prompt-vault.js";

import { reserveWorkspaceAiQuota, releaseAiExecutionQuota, settleAiExecutionQuota } from "../ai-quota.js";

export type SectionType =
  | "hero"
  | "features"
  | "testimonials"
  | "pricing"
  | "faq"
  | "contact"
  | "cta"
  | "footer"
  | "header"
  | "gallery"
  | "stats"
  | "team"
  | "custom";

export interface GenerateSectionInput {
  websiteId: string;
  actorId: string;
  sectionType: SectionType;
  prompt: string;
  expectedVersion: number;
  context?: {
    pageId?: string;
    insertPosition?: "start" | "end" | "after";
    targetElementId?: string;
    theme?: {
      primaryColor?: string;
      backgroundColor?: string;
      fontFamily?: string;
    };
  };
}

export async function generateSection(input: GenerateSectionInput) {
  if (!input.prompt || input.prompt.trim().length < 5) {
    throw new AppError("A descriptive prompt is required for section generation", 400, "INVALID_PROMPT");
  }

  const website = await prisma.$transaction(async tx => {
    const scope = await authorizeWebsiteDocumentWrite(tx, input.websiteId, input.actorId);
    if (!scope.can("EDIT_DESIGN")) {
      throw new AppError("Section creation requires design editing permission", 403, "DOCUMENT_EDIT_FORBIDDEN");
    }
    return scope.website;
  });

  if (website.documentVersion !== input.expectedVersion) {
    throw new AppError("The website changed before section generation started. Reload to continue.", 412, "DOCUMENT_VERSION_CONFLICT");
  }

  const provider = siteGenerationProvider();
  const retention = promptRetentionEnabled();
  const units = 2; // Sections contain multiple elements

  const execution = await prisma.$transaction(async tx => {
    await reserveWorkspaceAiQuota(tx, { workspaceId: website.workspaceId, actorId: input.actorId, units });
    return tx.aiExecution.create({
      data: {
        websiteId: website.id,
        workspaceId: website.workspaceId,
        organizationId: website.organizationId,
        actorId: input.actorId,
        operation: "SECTION_GENERATION",
        provider: provider.name,
        model: provider.model,
        reservedUnits: units,
        expectedDocumentVersion: input.expectedVersion,
        inputSummary: {
          sectionType: input.sectionType,
          promptLength: input.prompt.length,
          context: input.context ?? {},
        },
        promptCiphertext: retention ? encryptPrompt(input.prompt.trim()) : null,
        promptExpiresAt: retention ? retentionExpiry() : null,
        scope: input.context as unknown as JsonObject,
      },
    });
  });

  const systemPrompt = `You are an elite web architect and UI designer for ForgeStudio.
Generate a complete, responsive section AST for section type: "${input.sectionType}".
Brief: "${input.prompt}"
Website: "${website.name}"

The section must be a clean JSON object adhering strictly to the ForgeStudio element contract:
- Root must have "id": string (unique ID like "sec-..."), "type": "container" or "section", "styles": object, "responsiveStyles": object, "children": array of elements.
- Child elements can be:
  - Container: {"id": "...", "type": "container", "styles": {"display": "flex"|"grid", ...}, "children": [...]}
  - Heading: {"id": "...", "type": "heading", "headingLevel": "h1"|"h2"|"h3", "content": "...", "styles": {...}}
  - Text: {"id": "...", "type": "text", "content": "...", "styles": {...}}
  - Button/CTA: {"id": "...", "type": "button", "content": "...", "href": "...", "styles": {...}}
- Use harmonious colors (primary: ${input.context?.theme?.primaryColor || "#2563eb"}, bg: ${input.context?.theme?.backgroundColor || "#ffffff"}).
- Return ONLY a raw JSON object with { "section": <section_node>, "summary": "brief summary of section" }.`;

  let rawResult: { text: string };
  try {
    rawResult = await provider.generate({
      operation: "SECTION_GENERATION",
      prompt: input.prompt.trim(),
      context: {
        websiteName: website.name,
        sectionType: input.sectionType,
        ...input.context,
      },
      systemPrompt,
    });
  } catch (error) {
    await releaseAiExecutionQuota(execution.id, "FAILED", error instanceof AppError ? error.code : "AI_PROVIDER_UNAVAILABLE");
    throw error;
  }

  let generatedSectionNode: any;
  let sectionSummary = `${input.sectionType} section`;
  try {
    const textToParse = rawResult.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(textToParse);
    generatedSectionNode = parsed.section || parsed;
    if (parsed.summary) sectionSummary = parsed.summary;
  } catch {
    throw new AppError("AI provider returned invalid section structure", 502, "AI_INVALID_OUTPUT");
  }

  // Ensure unique IDs across all nodes
  const ensureUniqueIds = (node: any, prefix = "sec") => {
    if (!node || typeof node !== "object") return;
    node.id = `${prefix}-${randomUUID().slice(0, 8)}`;
    if (!node.styles) node.styles = {};
    if (!node.responsiveStyles) node.responsiveStyles = {};
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        ensureUniqueIds(child, "elem");
      }
    } else {
      node.children = [];
    }
  };
  ensureUniqueIds(generatedSectionNode, `sec-${input.sectionType}`);

  // Construct proposed document
  const currentDoc = documentObject(typeof website.editorData === "string" ? JSON.parse(website.editorData) : website.editorData);
  const proposedDoc = JSON.parse(JSON.stringify(currentDoc)) as JsonObject;

  // Insert into target page
  let inserted = false;
  const targetPageId = input.context?.pageId || proposedDoc.homePageId || (Array.isArray(proposedDoc.pages) ? (proposedDoc.pages[0] as any)?.id : null);

  if (Array.isArray(proposedDoc.pages) && targetPageId) {
    const page = (proposedDoc.pages as any[]).find(p => p.id === targetPageId);
    if (page) {
      if (!Array.isArray(page.elements)) page.elements = [];
      if (input.context?.insertPosition === "start") {
        page.elements.unshift(generatedSectionNode);
      } else if (input.context?.insertPosition === "after" && input.context?.targetElementId) {
        const idx = page.elements.findIndex((e: any) => e.id === input.context!.targetElementId);
        if (idx >= 0) page.elements.splice(idx + 1, 0, generatedSectionNode);
        else page.elements.push(generatedSectionNode);
      } else {
        page.elements.push(generatedSectionNode);
      }
      inserted = true;
    }
  }

  if (!inserted) {
    if (!Array.isArray(proposedDoc.elements)) proposedDoc.elements = [];
    (proposedDoc.elements as any[]).push(generatedSectionNode);
  }

  // Mirror elements to root if target page is home page
  if (Array.isArray(proposedDoc.pages)) {
    const home = (proposedDoc.pages as any[]).find(p => p.id === proposedDoc.homePageId) || (proposedDoc.pages as any[])[0];
    if (home) proposedDoc.elements = home.elements;
  }

  validateDocumentTree(proposedDoc);

  const changeset = await prisma.$transaction(async tx => {
    await settleAiExecutionQuota(tx, execution.id, units, {
      sectionType: input.sectionType,
      sectionId: generatedSectionNode.id,
      elementsCount: (generatedSectionNode.children || []).length + 1,
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
          operation: "SECTION_GENERATION",
          sectionType: input.sectionType,
          sectionId: generatedSectionNode.id,
          summary: sectionSummary,
          targetPageId,
        },
      },
    });
  });

  return {
    executionId: execution.id,
    changesetId: changeset.id,
    section: generatedSectionNode,
    summary: sectionSummary,
    changeset,
  };
}
