import { AppError } from "../../utils/app-error.js";
import { prisma } from "../../config/prisma.js";
import { saveWebsiteDocument, type DocumentWriteContext } from "../../services/websites/save-document.js";
import { getWebsiteById } from "../../services/website.service.js";
import { siteGenerationProvider } from "./provider-routing.js";
import { canonicalSiteFromBlueprint } from "./site-blueprint.js";
import { decryptPrompt, encryptPrompt, promptRetentionEnabled, retentionExpiry } from "./prompt-vault.js";

export async function generateSiteDraft(input: { websiteId: string; actorId: string; prompt: string; expectedVersion: number }) {
  if (typeof input.prompt !== "string" || input.prompt.trim().length < 12 || input.prompt.length > 4000) throw new AppError("Provide a concise website brief", 422, "AI_PROMPT_INVALID");
  const website = await getWebsiteById(input.websiteId, input.actorId);
  if (website.documentVersion !== input.expectedVersion) throw new AppError("Reload before generating a changeset", 412, "DOCUMENT_VERSION_CONFLICT");
  const provider = siteGenerationProvider();
  const retention = promptRetentionEnabled();
  const execution = await prisma.aiExecution.create({ data: { websiteId: website.id, workspaceId: website.workspaceId, organizationId: website.organizationId, actorId: input.actorId, operation: "SITE_GENERATION", provider: provider.name, model: provider.model, inputSummary: { promptLength: input.prompt.trim().length, retryAvailable: retention }, promptCiphertext: retention ? encryptPrompt(input.prompt.trim()) : null, promptExpiresAt: retention ? retentionExpiry() : null } });
  let result: Awaited<ReturnType<typeof provider.generate>>;
  let draft: ReturnType<typeof canonicalSiteFromBlueprint>;
  try {
    result = await provider.generate({ operation: "SITE_GENERATION", prompt: input.prompt.trim(), context: { websiteName: website.name } });
    let parsed: unknown;
    try { parsed = JSON.parse(result.text); } catch { throw new AppError("AI provider returned an invalid website draft", 502, "AI_INVALID_OUTPUT"); }
    draft = canonicalSiteFromBlueprint(parsed);
  } catch (error) {
    await prisma.aiExecution.update({ where: { id: execution.id }, data: { status: "FAILED", errorCode: error instanceof AppError ? error.code : "AI_PROVIDER_UNAVAILABLE", completedAt: new Date() } });
    throw error;
  }
  const { editorData, pageNames, sectionCount } = draft;
  const changeset = await prisma.$transaction(async tx => {
    await tx.aiExecution.update({ where: { id: execution.id }, data: { status: "COMPLETED", outputSummary: { requestId: result.requestId ?? null, pageCount: pageNames.length, sectionCount }, completedAt: new Date() } });
    return tx.aiChangeset.create({ data: { executionId: execution.id, websiteId: website.id, workspaceId: website.workspaceId, organizationId: website.organizationId, actorId: input.actorId, expectedDocumentVersion: input.expectedVersion, proposedDocument: editorData, summary: { provider: result.provider, model: result.model, pageNames, pageCount: pageNames.length, sectionCount } } });
  });
  return { changeset };
}

export async function getAiChangeset(id: string, actorId: string) { const row = await prisma.aiChangeset.findUnique({ where: { id } }); if (!row) throw new AppError("Changeset not found", 404, "AI_CHANGESET_NOT_FOUND"); await getWebsiteById(row.websiteId, actorId); return row; }
export async function cancelAiChangeset(id: string, actorId: string) { const row = await getAiChangeset(id, actorId); if (row.status !== "PENDING_REVIEW") throw new AppError("Changeset cannot be cancelled", 409, "AI_CHANGESET_STATE"); return prisma.aiChangeset.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() } }); }
export async function applyAiChangeset(id: string, actorId: string, write: DocumentWriteContext) {
  const row = await getAiChangeset(id, actorId);
  if (row.status !== "PENDING_REVIEW") throw new AppError("Changeset is not awaiting review", 409, "AI_CHANGESET_STATE");
  if (write.expectedVersion !== row.expectedDocumentVersion) throw new AppError("Changeset version does not match the reviewed document", 412, "DOCUMENT_VERSION_CONFLICT");
  const website = await getWebsiteById(row.websiteId, actorId);
  if (website.documentVersion !== row.expectedDocumentVersion) throw new AppError("The website changed; regenerate or review again", 412, "DOCUMENT_VERSION_CONFLICT");
  const saved = await saveWebsiteDocument(row.websiteId, actorId, { editorData: row.proposedDocument }, write);
  await prisma.aiChangeset.update({ where: { id }, data: { status: "APPLIED", approvedAt: new Date(), appliedAt: new Date() } });
  return saved;
}
export async function retryAiChangeset(id:string, actorId:string, expectedVersion:number) {
  const row=await getAiChangeset(id,actorId); const execution=await prisma.aiExecution.findUnique({where:{id:row.executionId}});
  if(!execution?.promptCiphertext||!execution.promptExpiresAt||execution.promptExpiresAt<=new Date()) throw new AppError("This prompt has expired and cannot be retried",409,"AI_PROMPT_EXPIRED");
  return generateSiteDraft({websiteId:row.websiteId,actorId,prompt:decryptPrompt(execution.promptCiphertext),expectedVersion});
}
