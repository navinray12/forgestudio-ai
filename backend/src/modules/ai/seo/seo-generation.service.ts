import { AppError } from "../../../utils/app-error.js";
import { prisma } from "../../../config/prisma.js";
import { authorizeWebsiteDocumentWrite } from "../../../services/websites/save-document.js";
import { documentObject, validateDocumentTree, type JsonObject } from "../../../services/websites/document-policy.js";
import { siteGenerationProvider } from "../provider-routing.js";
import { reserveWorkspaceAiQuota, releaseAiExecutionQuota, settleAiExecutionQuota } from "../ai-quota.js";

export interface GenerateSeoInput {
  websiteId: string;
  actorId: string;
  pageId?: string;
  keywords?: string[];
  expectedVersion: number;
}

export async function generateSeoMetadata(input: GenerateSeoInput) {
  const website = await prisma.$transaction(async tx => {
    const scope = await authorizeWebsiteDocumentWrite(tx, input.websiteId, input.actorId);
    if (!scope.can("EDIT_DESIGN") && !scope.can("EDIT_CONTENT")) {
      throw new AppError("SEO generation requires editing permissions", 403, "DOCUMENT_EDIT_FORBIDDEN");
    }
    return scope.website;
  });

  if (website.documentVersion !== input.expectedVersion) {
    throw new AppError("Website changed before SEO generation. Reload to continue.", 412, "DOCUMENT_VERSION_CONFLICT");
  }

  const currentDoc = documentObject(typeof website.editorData === "string" ? JSON.parse(website.editorData) : website.editorData);
  const targetPage = Array.isArray(currentDoc.pages)
    ? (currentDoc.pages as any[]).find(p => p.id === (input.pageId || currentDoc.homePageId)) || (currentDoc.pages as any[])[0]
    : null;

  const pageName = targetPage?.name || "Home";
  const provider = siteGenerationProvider();
  const units = 1;

  const execution = await prisma.$transaction(async tx => {
    await reserveWorkspaceAiQuota(tx, { workspaceId: website.workspaceId, actorId: input.actorId, units });
    return tx.aiExecution.create({
      data: {
        websiteId: website.id,
        workspaceId: website.workspaceId,
        organizationId: website.organizationId,
        actorId: input.actorId,
        operation: "SEO_GENERATION",
        provider: provider.name,
        model: provider.model,
        reservedUnits: units,
        expectedDocumentVersion: input.expectedVersion,
        inputSummary: { pageName, keywords: input.keywords || [] },
      },
    });
  });

  const systemPrompt = `You are an elite SEO strategist and metadata specialist.
Generate production-ready SEO metadata for a webpage.
Page Name: "${pageName}"
Website Name: "${website.name}"
Keywords: ${input.keywords?.join(", ") || "General business"}

Requirements:
- title: 50-60 characters, engaging and keyword-rich.
- description: 140-160 characters, actionable with clear value proposition.
- keywords: array of 5-8 relevant search terms.
- ogTitle: optimized for social sharing.
- ogDescription: social snippet.

Return ONLY valid JSON:
{
  "title": "...",
  "description": "...",
  "keywords": ["..."],
  "ogTitle": "...",
  "ogDescription": "...",
  "headingSuggestions": ["H1: ...", "H2: ..."],
  "summary": "SEO strategy summary"
}`;

  let rawResult: { text: string };
  try {
    rawResult = await provider.generate({
      operation: "SEO_GENERATION",
      prompt: `Generate SEO metadata for ${pageName} on ${website.name}`,
      context: { pageName, websiteName: website.name },
      systemPrompt,
    });
  } catch (error) {
    await releaseAiExecutionQuota(execution.id, "FAILED", error instanceof AppError ? error.code : "AI_PROVIDER_UNAVAILABLE");
    throw error;
  }

  let parsed: any;
  try {
    const cleaned = rawResult.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {
      title: `${pageName} | ${website.name}`,
      description: `Welcome to ${pageName} on ${website.name}. Discover our premier solutions and services.`,
      keywords: [website.name, pageName],
      ogTitle: `${pageName} | ${website.name}`,
      ogDescription: `Explore ${pageName} on ${website.name}.`,
      headingSuggestions: [],
      summary: "Default SEO metadata",
    };
  }

  const proposedDoc = JSON.parse(JSON.stringify(currentDoc)) as JsonObject;
  if (Array.isArray(proposedDoc.pages) && targetPage) {
    const p = (proposedDoc.pages as any[]).find(page => page.id === targetPage.id);
    if (p) {
      if (!p.pageSettings) p.pageSettings = {};
      p.pageSettings.seoTitle = parsed.title;
      p.pageSettings.seoDescription = parsed.description;
      p.pageSettings.keywords = parsed.keywords;
      p.pageSettings.ogTitle = parsed.ogTitle;
      p.pageSettings.ogDescription = parsed.ogDescription;
    }
  }

  validateDocumentTree(proposedDoc);

  const changeset = await prisma.$transaction(async tx => {
    await settleAiExecutionQuota(tx, execution.id, units, { title: parsed.title, pageId: targetPage?.id });

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
          operation: "SEO_GENERATION",
          targetPageId: targetPage?.id,
          seoMetadata: parsed,
        },
      },
    });
  });

  return { executionId: execution.id, changesetId: changeset.id, metadata: parsed, changeset };
}
