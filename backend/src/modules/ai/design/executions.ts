import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import { workspaceCommand } from "../../../services/workspaces/command.js";
import { authorizeWebsiteDocumentWrite, type DocumentWriteContext } from "../../../services/websites/save-document.js";
import { getScopedWebsiteInTransaction } from "../../../services/websites/scoped-access.js";
import { decryptPrompt, encryptPrompt, retentionExpiry } from "../prompt-vault.js";
import { validateSiteBrief } from "../site-brief.js";
import { designConfig, designConfigSchema } from "./config.js";

export const executionRequestSchema = z.object({
  prompt: z.string().min(12).max(64000), operation: z.enum(["GENERATE_SITE", "EDIT_DOCUMENT"]),
  workflow: z.enum(["stitch", "stitch-claude"]),
  scope: z.object({ type: z.enum(["site", "page", "selection"]), pageId: z.string().max(200).optional(), elementId: z.string().max(200).optional() }).strict().default({ type: "site" }),
}).strict();
export type ExecutionRequest = z.infer<typeof executionRequestSchema>;

export async function startDesignExecution(websiteId: string, actorId: string, raw: unknown, write: DocumentWriteContext, parentId?: string) {
  const input = executionRequestSchema.parse(raw); validateSiteBrief(input.prompt);
  const parent = parentId ? await authorizedExecution(parentId, actorId) : null;
  if (parent && parent.websiteId !== websiteId) throw new AppError("Execution not found", 404, "AI_EXECUTION_NOT_FOUND");
  const hash = createHash("sha256").update(input.prompt).digest("hex");
  return workspaceCommand({ actorId, operation: "AI_DESIGN_REQUESTED", key: write.key,
    payload: { websiteId, promptHash: hash, operation: input.operation, scope: input.scope, expectedVersion: write.expectedVersion, parentId: parentId ?? null },
    authorize: async tx => {
      const scope = await authorizeWebsiteDocumentWrite(tx, websiteId, actorId);
      if (!scope.can("EDIT_DESIGN")) throw new AppError("Design editing is not permitted", 403, "DOCUMENT_EDIT_FORBIDDEN");
      return scope;
    },
    execute: async (tx, { website }) => {
      const config = parent ? designConfigSchema.parse(parent.providerSnapshot) : designConfig();
      if (config.provider === "stitch" && input.operation === "EDIT_DOCUMENT") throw new AppError("Stitch-only mode supports page generation", 422, "AI_UNSUPPORTED_OPERATION");
      if (website.documentVersion !== write.expectedVersion) throw new AppError("Save or reload the website before generation", 412, "DOCUMENT_VERSION_CONFLICT");
      // Serialize workspace admission, bounding concurrent requests and reserved
      // provider calls. Reservations are conservative and not a claim of dollar cost.
      await tx.$queryRaw`SELECT id FROM workspaces WHERE id=${website.workspaceId}::uuid FOR UPDATE`;
      const start = new Date(); start.setUTCHours(0, 0, 0, 0);
      const units = input.operation === "EDIT_DOCUMENT" ? 1 : 2 + 3 * config.maxPages;
      const usage = await tx.aiExecution.aggregate({
        where: {
          workspaceId: website.workspaceId,
          createdAt: { gte: start },
          status: { notIn: ["FAILED", "CANCELLED", "RECONCILIATION_REQUIRED"] },
        },
        _sum: { reservedUnits: true }
      });
      if ((usage._sum.reservedUnits ?? 0) + units > config.dailyUnits) throw new AppError("Workspace design generation quota reached", 429, "AI_QUOTA_EXCEEDED");
      // Clean up any stale or crashed executions for this website whose job is already dead
      const activeCandidates = await tx.aiExecution.findMany({
        where: { websiteId, status: { in: ["QUEUED", "RUNNING"] }, provider: { in: ["stitch", "stitch-claude"] } },
        select: { id: true }
      });
      for (const candidate of activeCandidates) {
        const job = await tx.backgroundJob.findFirst({
          where: { idempotencyKey: `ai:${candidate.id}` }
        });
        if (!job || ["FAILED", "CANCELLED", "COMPLETED"].includes(job.status)) {
          const isUnknown = job?.lastError === "JOB_OUTCOME_UNKNOWN";
          const sanitizedErrorCode = (job?.lastError || "AI_DESIGN_FAILED").slice(0, 100);
          await tx.aiExecution.update({
            where: { id: candidate.id },
            data: {
              status: job?.status === "FAILED" ? (isUnknown ? "RECONCILIATION_REQUIRED" : "FAILED") : (job?.status ?? "FAILED"),
              errorCode: sanitizedErrorCode,
              outputSummary: job?.lastError ? { error: job.lastError } : undefined,
              completedAt: new Date(),
              reservedUnits: 0,
            }
          });
        }
      }
      if (await tx.aiExecution.count({ where: { websiteId, status: { in: ["QUEUED", "RUNNING"] }, provider: { in: ["stitch", "stitch-claude"] } } })) throw new AppError("A design execution is already active for this website", 409, "AI_EXECUTION_ACTIVE");
      const execution = await tx.aiExecution.create({ data: { id: randomUUID(), websiteId, workspaceId: website.workspaceId, organizationId: website.organizationId, actorId,
        provider: config.provider, model: config.provider === "stitch" ? config.stitchModel : config.claudeModel, promptVersion: "design-pipeline-v1", operation: input.operation, status: "QUEUED", stage: "QUEUED",
        promptCiphertext: encryptPrompt(input.prompt), promptExpiresAt: retentionExpiry(), expectedDocumentVersion: write.expectedVersion,
        inputSummary: { promptLength: input.prompt.length }, scope: input.scope, providerSnapshot: config, parentExecutionId: parentId, reservedUnits: units,
      } });
      // Same transaction as execution, authorization, journal, audit and outbox.
      await tx.backgroundJob.create({ data: { type: "AI_DESIGN_EXECUTION", organizationId: website.organizationId,
        payload: { executionId: execution.id }, idempotencyKey: `ai:${execution.id}`, maxAttempts: 1 } });
      return { resourceId: websiteId, executionId: execution.id };
    },
  });
}

export async function authorizedExecution(id: string, actorId: string) {
  return prisma.$transaction(async tx => {
    const row = await tx.aiExecution.findUnique({ where: { id } });
    if (!row) throw new AppError("Execution not found", 404, "AI_EXECUTION_NOT_FOUND");
    const website = await getScopedWebsiteInTransaction(tx, row.websiteId, actorId);
    if (row.organizationId !== website.organizationId || row.workspaceId !== website.workspaceId) throw new AppError("Execution not found", 404, "AI_EXECUTION_NOT_FOUND");
    return row;
  });
}

export async function getDesignExecution(id: string, actorId: string) {
  let row = await authorizedExecution(id, actorId);
  if (["QUEUED", "RUNNING"].includes(row.status)) {
    const job = await prisma.backgroundJob.findFirst({ where: { idempotencyKey: `ai:${id}`, organizationId: row.organizationId, type: "AI_DESIGN_EXECUTION" } });
    if (job?.status === "FAILED") {
      const isUnknown = job.lastError === "JOB_OUTCOME_UNKNOWN";
      const sanitizedErrorCode = (job.lastError || "AI_DESIGN_FAILED").slice(0, 100);
      await prisma.aiExecution.updateMany({
        where: { id, status: { in: ["QUEUED", "RUNNING"] } },
        data: {
          status: isUnknown ? "RECONCILIATION_REQUIRED" : "FAILED",
          errorCode: sanitizedErrorCode,
          outputSummary: job.lastError ? { error: job.lastError } : undefined,
          completedAt: new Date(),
          reservedUnits: 0,
        }
      });
      row = await authorizedExecution(id, actorId);
    }
  }
  const stages = await prisma.aiExecutionStage.findMany({ where: { executionId: id }, orderBy: { startedAt: "asc" }, select: { key: true, status: true, startedAt: true, completedAt: true } });
  const proposal = await prisma.aiChangeset.findUnique({ where: { executionId: id }, select: { id: true } });
  return { id: row.id, websiteId: row.websiteId, provider: row.provider, status: row.status, stage: row.stage, errorCode: row.errorCode, expectedDocumentVersion: row.expectedDocumentVersion,
    stages, changesetId: proposal?.id ?? null, retryAvailable: !!row.promptCiphertext && !!row.promptExpiresAt && row.promptExpiresAt > new Date() && (row.status === "FAILED" || row.status === "CANCELLED"),
    reservedProviderCalls: row.reservedUnits, createdAt: row.createdAt, completedAt: row.completedAt };
}

export async function cancelDesignExecution(id: string, actorId: string, key: string) {
  const row = await authorizedExecution(id, actorId);
  return workspaceCommand({ actorId, operation: "AI_DESIGN_CANCELLED", key, payload: { id },
    authorize: async tx => { const scope = await authorizeWebsiteDocumentWrite(tx, row.websiteId, actorId); if (!scope.can("EDIT_DESIGN")) throw new AppError("Design editing is not permitted", 403, "DOCUMENT_EDIT_FORBIDDEN"); return scope; },
    execute: async tx => {
      // Match worker checkpoint lock order: job first, then execution.
      await tx.$queryRaw`SELECT id FROM background_jobs WHERE "idempotencyKey"=${`ai:${id}`} AND "organizationId"=${row.organizationId}::uuid FOR UPDATE`;
      const changed = await tx.aiExecution.updateMany({ where: { id, status: { in: ["QUEUED", "RUNNING"] } }, data: { status: "CANCELLED", cancelRequestedAt: new Date(), completedAt: new Date() } });
      if (changed.count !== 1) throw new AppError("Execution cannot be cancelled in its current state", 409, "AI_EXECUTION_STATE");
      await tx.backgroundJob.updateMany({ where: { type: "AI_DESIGN_EXECUTION", organizationId: row.organizationId, idempotencyKey: `ai:${id}`, status: { in: ["QUEUED", "RUNNING"] } }, data: { status: "CANCELLED", completedAt: new Date() } });
      return { resourceId: row.websiteId, executionId: id };
    },
  });
}

export async function retryDesignExecution(id: string, actorId: string, write: DocumentWriteContext) {
  const row = await authorizedExecution(id, actorId);
  await prisma.$transaction(async tx => { const scope = await authorizeWebsiteDocumentWrite(tx, row.websiteId, actorId); if (!scope.can("EDIT_DESIGN")) throw new AppError("Design editing is not permitted", 403, "DOCUMENT_EDIT_FORBIDDEN"); });
  if (row.status !== "FAILED" && row.status !== "CANCELLED") throw new AppError("Only failed, reconciled executions can be retried", 409, "AI_EXECUTION_STATE");
  if (!row.promptCiphertext || !row.promptExpiresAt || row.promptExpiresAt <= new Date()) throw new AppError("The retained brief expired", 409, "AI_PROMPT_EXPIRED");
  return startDesignExecution(row.websiteId, actorId, { workflow: "stitch-claude", prompt: decryptPrompt(row.promptCiphertext), operation: row.operation, scope: row.scope }, write, id);
}
