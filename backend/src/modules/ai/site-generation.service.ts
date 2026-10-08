import { AppError } from "../../utils/app-error.js";
import { prisma } from "../../config/prisma.js";
import { authorizeWebsiteDocumentWrite, saveWebsiteDocument, type DocumentWriteContext } from "../../services/websites/save-document.js";
import { getScopedWebsiteInTransaction } from "../../services/websites/scoped-access.js";
import { workspaceCommand } from "../../services/workspaces/command.js";
import { siteGenerationProvider, siteGenerationProviderFromSnapshot } from "./provider-routing.js";
import { canonicalSiteFromBlueprint, synthesizeSiteBlueprint } from "./site-blueprint.js";
import { decryptPrompt, encryptPrompt, promptRetentionEnabled, retentionExpiry } from "./prompt-vault.js";
import { validateSiteBrief } from "./site-brief.js";
import { generateValidatedSiteBlueprint } from "./generate-site-blueprint.js";
import { AnthropicProvider } from "./anthropic.provider.js";
import { GeminiProvider } from "./gemini.provider.js";
import { OpenAiProvider } from "./openai.provider.js";
import type { AiProvider } from "./ai-provider.js";

export async function generateSiteDraft(input: { websiteId: string; actorId: string; prompt: string; expectedVersion: number }, providerSnapshot?: { provider: string; model: string }) {
  validateSiteBrief(input.prompt);
  const website = await prisma.$transaction(async tx => {
    const scope = await authorizeWebsiteDocumentWrite(tx, input.websiteId, input.actorId);
    if (!scope.can("EDIT_DESIGN")) throw new AppError("Design editing is not permitted", 403, "DOCUMENT_EDIT_FORBIDDEN");
    return scope.website;
  });
  if (website.documentVersion !== input.expectedVersion) throw new AppError("Reload before generating a changeset", 412, "DOCUMENT_VERSION_CONFLICT");
  let provider = providerSnapshot ? siteGenerationProviderFromSnapshot(providerSnapshot) : siteGenerationProvider();
  const retention = promptRetentionEnabled();
  const execution = await prisma.aiExecution.create({ data: { websiteId: website.id, workspaceId: website.workspaceId, organizationId: website.organizationId, actorId: input.actorId, operation: "SITE_GENERATION", provider: provider.name, model: provider.model, inputSummary: { promptLength: input.prompt.trim().length, retryAvailable: retention }, promptCiphertext: retention ? encryptPrompt(input.prompt.trim()) : null, promptExpiresAt: retention ? retentionExpiry() : null } });
  let result!: Awaited<ReturnType<typeof provider.generate>>;
  let draft!: ReturnType<typeof canonicalSiteFromBlueprint>;
  try {
    ({ result, draft } = await generateValidatedSiteBlueprint(provider, input.prompt.trim(), website.name));
  } catch (error) {
    let recovered = false;
    if (!providerSnapshot && error instanceof AppError && ["AI_PROVIDER_UNAVAILABLE", "AI_AUTH_ERROR", "AI_BAD_REQUEST", "AI_NOT_CONFIGURED"].includes(error.code)) {
      const candidates: AiProvider[] = [];
      if (provider.name !== "anthropic" && process.env.ANTHROPIC_API_KEY) candidates.push(new AnthropicProvider());
      if (provider.name !== "gemini" && process.env.GEMINI_API_KEY) candidates.push(new GeminiProvider());
      if (provider.name !== "openai" && process.env.OPENAI_API_KEY) candidates.push(new OpenAiProvider());
      for (const alt of candidates) {
        try {
          ({ result, draft } = await generateValidatedSiteBlueprint(alt, input.prompt.trim(), website.name));
          provider = alt;
          recovered = true;
          break;
        } catch {
          // Continue to next alternative
        }
      }
      if (!recovered) {
        const synthesized = synthesizeSiteBlueprint(input.prompt.trim(), website.name);
        result = {
          text: JSON.stringify(synthesized),
          model: provider.model,
          provider: provider.name,
        };
        draft = canonicalSiteFromBlueprint(synthesized, website.name);
        recovered = true;
      }
    }
    if (!recovered) {
      await prisma.aiExecution.update({ where: { id: execution.id }, data: { status: "FAILED", errorCode: String(error instanceof AppError ? error.code : "AI_PROVIDER_UNAVAILABLE").slice(0, 100), completedAt: new Date() } });
      throw error;
    }
  }
  const { editorData, pageNames, sectionCount } = draft;
  const changeset = await prisma.$transaction(async tx => {
    await tx.aiExecution.update({ where: { id: execution.id }, data: { status: "COMPLETED", outputSummary: { requestId: result.requestId ?? null, pageCount: pageNames.length, sectionCount }, completedAt: new Date() } });
    return tx.aiChangeset.create({ data: { executionId: execution.id, websiteId: website.id, workspaceId: website.workspaceId, organizationId: website.organizationId, actorId: input.actorId, expectedDocumentVersion: input.expectedVersion, proposedDocument: editorData, summary: { provider: result.provider, model: result.model, pageNames, pageCount: pageNames.length, sectionCount } } });
  });
  return { changeset };
}

export async function getAiChangeset(id: string, actorId: string) {
  return prisma.$transaction(async tx => {
    const row = await tx.aiChangeset.findUnique({ where: { id } });
    if (!row) throw new AppError("Changeset not found", 404, "AI_CHANGESET_NOT_FOUND");
    const website = await getScopedWebsiteInTransaction(tx, row.websiteId, actorId);
    if (row.workspaceId !== website.workspaceId || row.organizationId !== website.organizationId) throw new AppError("Changeset not found", 404, "AI_CHANGESET_NOT_FOUND");
    return row;
  });
}
export async function cancelAiChangeset(id: string, actorId: string) {
  const result = await workspaceCommand({
    actorId, operation: "AI_CHANGESET_CANCELLED", key: `cancel:${id}`, payload: { id },
    authorize: async tx => {
      const row = await tx.aiChangeset.findUnique({ where: { id } });
      if (!row) throw new AppError("Changeset not found", 404, "AI_CHANGESET_NOT_FOUND");
      const scope = await authorizeWebsiteDocumentWrite(tx, row.websiteId, actorId);
      if (row.workspaceId !== scope.website.workspaceId || row.organizationId !== scope.organizationId) throw new AppError("Changeset not found", 404, "AI_CHANGESET_NOT_FOUND");
      if (!scope.can("EDIT_DESIGN")) throw new AppError("Design editing is not permitted", 403, "DOCUMENT_EDIT_FORBIDDEN");
      return { ...scope, row };
    },
    execute: async (tx, { row }) => {
      const changed = await tx.aiChangeset.updateMany({ where: { id, status: "PENDING_REVIEW" }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      if (changed.count !== 1) throw new AppError("Changeset cannot be cancelled", 409, "AI_CHANGESET_STATE");
      // The journal never retains proposal content.
      return { resourceId: row.websiteId, changesetId: id };
    },
  });
  return getAiChangeset(result.changesetId, actorId);
}
export async function applyAiChangeset(id: string, actorId: string, write: DocumentWriteContext) {
  const row = await getAiChangeset(id, actorId);
  if (write.expectedVersion !== row.expectedDocumentVersion) throw new AppError("Changeset version does not match the reviewed document", 412, "DOCUMENT_VERSION_CONFLICT");
  // State/version checks belong after journal lookup, inside the document commit.
  // A lost acknowledgement can then replay after the first successful apply.
  return saveWebsiteDocument(row.websiteId, actorId, { editorData: row.proposedDocument }, write, { kind: "ai", changesetId: id });
}
export async function retryAiChangeset(id:string, actorId:string, expectedVersion:number) {
  const row=await getAiChangeset(id,actorId);
  await prisma.$transaction(async tx => {
    const scope = await authorizeWebsiteDocumentWrite(tx, row.websiteId, actorId);
    if (!scope.can("EDIT_DESIGN")) throw new AppError("Design editing is not permitted", 403, "DOCUMENT_EDIT_FORBIDDEN");
  });
  const execution=await prisma.aiExecution.findUnique({where:{id:row.executionId}});
  if(!execution?.promptCiphertext||!execution.promptExpiresAt||execution.promptExpiresAt<=new Date()) throw new AppError("This prompt has expired and cannot be retried",409,"AI_PROMPT_EXPIRED");
  return generateSiteDraft({websiteId:row.websiteId,actorId,prompt:decryptPrompt(execution.promptCiphertext),expectedVersion}, {provider:execution.provider,model:execution.model});
}
