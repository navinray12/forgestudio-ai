import { AppError } from "../../../utils/app-error.js";
import { prisma } from "../../../config/prisma.js";
import { authorizeWebsiteDocumentWrite } from "../../../services/websites/save-document.js";
import { documentObject, validateDocumentTree, type JsonObject } from "../../../services/websites/document-policy.js";
import { siteGenerationProvider } from "../provider-routing.js";
import { reserveWorkspaceAiQuota, releaseAiExecutionQuota, settleAiExecutionQuota } from "../ai-quota.js";

export interface GenerateDynamicPropertyInput {
  websiteId: string;
  actorId: string;
  elementId: string;
  targetField: "content" | "imageUrl" | "href" | "title" | "customField";
  prompt: string;
  expectedVersion: number;
}

/**
 * Valid canonical tokens recognized by backend/src/services/website.service.ts
 */
export const CANONICAL_DYNAMIC_TOKENS = [
  "{{site.name}}",
  "{{site.title}}",
  "{{site.slug}}",
  "{{site.language}}",
  "{{current.year}}",
  "{{current.date}}",
  "{{page.title}}",
  "{{page.name}}",
  "{{page.slug}}",
  "{{post.title}}",
  "{{post.excerpt}}",
  "{{post.date}}",
  "{{post.author}}",
  "{{post.featuredImage}}",
  "{{post.slug}}",
  "{{entry.title}}",
  "{{entry.slug}}",
  "{{cpt.title}}",
] as const;

export function isValidDynamicToken(token: string): boolean {
  if (!token.startsWith("{{") || !token.endsWith("}}")) return false;
  const inner = token.slice(2, -2).trim();
  if (
    inner.startsWith("site.") ||
    inner.startsWith("current.") ||
    inner.startsWith("page.") ||
    inner.startsWith("post.") ||
    inner.startsWith("entry.") ||
    inner.startsWith("cpt.") ||
    inner.startsWith("query.") ||
    inner.startsWith("request.") ||
    inner.startsWith("custom.")
  ) {
    return /^[a-zA-Z0-9_.-]+$/.test(inner);
  }
  return false;
}

export async function generateDynamicProperty(input: GenerateDynamicPropertyInput) {
  if (!input.prompt || input.prompt.trim().length === 0) {
    throw new AppError("Prompt is required for dynamic property generation", 400, "INVALID_INPUT");
  }

  const website = await prisma.$transaction(async tx => {
    const scope = await authorizeWebsiteDocumentWrite(tx, input.websiteId, input.actorId);
    if (!scope.can("EDIT_DESIGN")) throw new AppError("Design editing is not permitted", 403, "DOCUMENT_EDIT_FORBIDDEN");
    return scope.website;
  });

  if (website.documentVersion !== input.expectedVersion) {
    throw new AppError("Website changed before dynamic binding. Reload to continue.", 412, "DOCUMENT_VERSION_CONFLICT");
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
        operation: "DYNAMIC_PROPERTY",
        provider: "site-generation-provider",
        model: "canonical",
        reservedUnits: units,
        expectedDocumentVersion: input.expectedVersion,
        inputSummary: { elementId: input.elementId, targetField: input.targetField, prompt: input.prompt },
      },
    });
  });

  const provider = siteGenerationProvider();
  const systemPrompt = `You are a CMS and Dynamic Data specialist for ForgeStudio.
Convert the user request into valid dynamic token bindings supported by the ForgeStudio token resolver.

Supported token patterns:
- Site: {{site.name}}, {{site.slug}}, {{site.language}}
- System: {{current.year}}, {{current.date}}
- Page: {{page.title}}, {{page.name}}, {{page.slug}}
- Posts / Blog: {{post.title}}, {{post.excerpt}}, {{post.date}}, {{post.author}}, {{post.featuredImage}}, {{post.slug}}
- Custom Post Types / CMS: {{entry.<fieldName>}}, {{cpt.<fieldName>}}
- Query Parameters: {{query.<paramName>}}, {{request.<paramName>}}
- Custom Dictionary: {{custom.<key>}}

Return ONLY valid JSON:
{
  "token": "{{...}}",
  "fallback": "fallback value if dynamic data is empty",
  "explanation": "what this token binds to"
}`;

  try {
    const rawResult = await provider.generate({
      operation: "DYNAMIC_PROPERTY",
      prompt: input.prompt,
      context: { targetField: input.targetField },
      systemPrompt,
    });

    let token = "{{site.name}}";
    let fallback = website.name || "Default Value";
    let explanation = "Site name binding";

    try {
      const cleaned = rawResult.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
      const json = JSON.parse(cleaned);
      if (json.token && isValidDynamicToken(json.token)) {
        token = json.token;
      } else {
        // Fallback map based on prompt
        const p = input.prompt.toLowerCase();
        if (p.includes("year")) token = "{{current.year}}";
        else if (p.includes("post title") || p.includes("blog title")) token = "{{post.title}}";
        else if (p.includes("page title")) token = "{{page.title}}";
        else if (p.includes("author")) token = "{{post.author}}";
        else if (p.includes("date")) token = "{{current.date}}";
      }
      if (json.fallback) fallback = json.fallback;
      if (json.explanation) explanation = json.explanation;
    } catch {
      // Keep canonical fallback
    }

    const currentDoc = documentObject(typeof website.editorData === "string" ? JSON.parse(website.editorData) : website.editorData);
    const proposedDoc = JSON.parse(JSON.stringify(currentDoc)) as JsonObject;

    let updated = false;
    const bindElement = (nodes: unknown) => {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (node && typeof node === "object") {
          if ((node as any).id === input.elementId) {
            if (input.targetField === "imageUrl") {
              (node as any).imageUrl = token;
              (node as any).src = token;
            } else if (input.targetField === "href") {
              (node as any).href = token;
            } else {
              (node as any).content = token;
              (node as any).text = token;
            }
            if (!(node as any).dynamicBindings) (node as any).dynamicBindings = {};
            (node as any).dynamicBindings[input.targetField] = { token, fallback };
            updated = true;
            return;
          }
          if ((node as any).children) bindElement((node as any).children);
        }
      }
    };

    if (Array.isArray(proposedDoc.pages)) {
      for (const page of proposedDoc.pages as any[]) {
        if (page.elements) bindElement(page.elements);
      }
    } else if (proposedDoc.elements) {
      bindElement(proposedDoc.elements);
    }

    if (!updated) {
      throw new AppError(`Target element #${input.elementId} not found in website`, 404, "ELEMENT_NOT_FOUND");
    }

    validateDocumentTree(proposedDoc);

    const changeset = await prisma.$transaction(async tx => {
      await settleAiExecutionQuota(tx, execution.id, units, { token, fallback });

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
            operation: "DYNAMIC_PROPERTY",
            elementId: input.elementId,
            targetField: input.targetField,
            token,
            fallback,
            explanation,
          },
        },
      });
    });

    return { executionId: execution.id, changesetId: changeset.id, token, fallback, explanation, changeset };
  } catch (error) {
    await releaseAiExecutionQuota(execution.id, "FAILED", error instanceof AppError ? error.code : "AI_DYNAMIC_FAILED");
    throw error;
  }
}
