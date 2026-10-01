import { prisma } from "../../../config/prisma.js";
import type { Prisma } from "../../../generated/prisma/index.js";
import { AppError } from "../../../utils/app-error.js";
import { authorizeWebsiteDocumentWrite } from "../../../services/websites/save-document.js";
import { documentObject, validateDocumentTree, type JsonObject } from "../../../services/websites/document-policy.js";
import { decryptPrompt } from "../prompt-vault.js";
import { designConfigSchema } from "./config.js";
import { DESIGN_CONTRACT, sitePlanSchema, type ArtifactStore, type DesignConverter, type DesignPlanner, type DesignProvider, type EditScope } from "./contracts.js";
import { LocalDesignArtifacts } from "./artifacts.js";
import { ClaudeDesignPlanner } from "./claude-planner.js";
import { StitchDesignProvider } from "./stitch-provider.js";
import { ConversionError } from "./converter.js";
import { IsolatedDesignConverter } from "./isolated-converter.js";
import { applyScopedEdits } from "./edit-operations.js";
import { createHash } from "node:crypto";

type Ports = { planner: DesignPlanner; designer: DesignProvider; artifacts: ArtifactStore; converter: DesignConverter };
export async function runDesignExecution(executionId: string, job: { id: string; lockToken: string }, supplied?: Ports) {
  const execution = await prisma.aiExecution.findUniqueOrThrow({ where: { id: executionId } });
  if (["COMPLETED", "CANCELLED", "FAILED", "RECONCILIATION_REQUIRED"].includes(execution.status)) return { executionId, status: execution.status };
  const config = designConfigSchema.parse(execution.providerSnapshot);
  let ports: Ports;
  async function transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>, authorize = true) {
    return prisma.$transaction(async tx => {
      const lease = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM background_jobs WHERE id=${job.id}::uuid AND "lockToken"=${job.lockToken}::uuid AND payload->>'executionId'=${executionId} AND status='RUNNING' AND "lockedUntil">now() FOR UPDATE`;
      if (!lease.length) throw new AppError("Execution lease is no longer current", 409, "AI_JOB_LEASE_LOST");
      const active = await tx.aiExecution.findUniqueOrThrow({ where: { id: executionId } });
      if (active.cancelRequestedAt || active.status === "CANCELLED") throw new AppError("Execution cancelled", 409, "AI_CANCELLED");
      if (authorize) {
        const scope = await authorizeWebsiteDocumentWrite(tx, execution.websiteId, execution.actorId);
        if (!scope.can("EDIT_DESIGN")) throw new AppError("Design editing is not permitted", 403, "DOCUMENT_EDIT_FORBIDDEN");
      }
      return work(tx);
    });
  }
  async function stage<T>(key: string, work: () => Promise<T>, external = false): Promise<T> {
    const existing = await prisma.aiExecutionStage.findUnique({ where: { executionId_key: { executionId, key } } });
    if (existing?.status === "COMPLETED" && existing.artifactKey) return JSON.parse(await ports.artifacts.get(existing.artifactKey)) as T;
    if (existing?.status === "RUNNING" || existing?.status === "UNKNOWN") throw new AppError("A prior provider attempt requires reconciliation", 409, "AI_EXTERNAL_OUTCOME_UNKNOWN");
    if (!execution.promptExpiresAt || execution.promptExpiresAt <= new Date()) throw new AppError("Retained brief expired", 409, "AI_PROMPT_EXPIRED");
    await transaction(async tx => {
      await tx.aiExecution.update({ where: { id: executionId }, data: { status: "RUNNING", stage: key } });
      await tx.aiExecutionStage.upsert({ where: { executionId_key: { executionId, key } }, create: { executionId, key, status: "RUNNING", startedAt: new Date() }, update: { status: "RUNNING", startedAt: new Date() } });
    });
    try {
      const value = await work();
      const artifactKey = await ports.artifacts.put(JSON.stringify(value));
      await transaction(async tx => { await tx.aiExecutionStage.update({ where: { executionId_key: { executionId, key } }, data: { status: "COMPLETED", artifactKey, completedAt: new Date() } }); });
      return value;
    } catch (error) {
      // Provider screen/project creation may have succeeded remotely even if its
      // reply was lost. Never blindly retry that stage or erase its attempt.
      if (external) throw new AppError("External design outcome requires reconciliation", 503, "AI_EXTERNAL_OUTCOME_UNKNOWN");
      throw error;
    }
  }
  try {
    ports = supplied ?? { planner: new ClaudeDesignPlanner(config.claudeModel), designer: new StitchDesignProvider(config.stitchModel), artifacts: new LocalDesignArtifacts(), converter: new IsolatedDesignConverter() };
    if (!execution.promptCiphertext || !execution.promptExpiresAt || execution.promptExpiresAt <= new Date()) throw new AppError("Retained brief expired", 409, "AI_PROMPT_EXPIRED");
    const prompt = decryptPrompt(execution.promptCiphertext);
    const website = await transaction(tx => tx.website.findUniqueOrThrow({ where: { id: execution.websiteId } }));
    if (website.documentVersion !== execution.expectedDocumentVersion) throw new AppError("The website changed before this execution started", 412, "DOCUMENT_VERSION_CONFLICT");
    // A linked retry can reuse only completed checkpoints at the same base version.
    if (execution.parentExecutionId) {
      const parent = await prisma.aiExecution.findUniqueOrThrow({ where: { id: execution.parentExecutionId } });
      if (parent.websiteId === execution.websiteId && parent.expectedDocumentVersion === execution.expectedDocumentVersion && parent.provider === execution.provider) {
        const checkpoints = await prisma.aiExecutionStage.findMany({ where: { executionId: parent.id, status: "COMPLETED" } });
        await transaction(async tx => {
          for (const checkpoint of checkpoints) await tx.aiExecutionStage.upsert({ where: { executionId_key: { executionId, key: checkpoint.key } }, create: { executionId, key: checkpoint.key, status: "COMPLETED", artifactKey: checkpoint.artifactKey, startedAt: checkpoint.startedAt, completedAt: checkpoint.completedAt }, update: {} });
        });
      }
    }
    let document: JsonObject;
    let setupRequired: string[] = [];
    if (execution.operation === "EDIT_DOCUMENT") {
      const base = documentObject(typeof website.editorData === "string" ? JSON.parse(website.editorData) : website.editorData);
      const scope = execution.scope as unknown as EditScope;
      const operations = await stage("EDIT", () => ports.planner.edit(base, prompt, scope));
      document = applyScopedEdits(base, operations, scope);
    } else {
      const plan = sitePlanSchema.parse(await stage("PLAN", () => ports.planner.plan(prompt)));
      if (plan.pages.length > config.maxPages) throw new AppError("Plan exceeds the configured page limit", 422, "AI_PAGE_LIMIT");
      setupRequired = plan.setupRequired;
      const projectId = await stage("PROJECT", () => ports.designer.createProject(`Forge ${executionId}`), true);
      const pages: JsonObject[] = [];
      for (let index = 0; index < plan.pages.length; index++) {
        const page = plan.pages[index]!;
        const screen = await stage(`SCREEN_${index}`, () => ports.designer.generate(projectId,
          `${DESIGN_CONTRACT}\nShared design: ${plan.design}\nSite routes: ${JSON.stringify(plan.pages.map(item => ({ name: item.name, slug: item.slug })))}\nPage: ${page.name}\n${page.brief}`), true);
        const html = await stage(`EXPORT_${index}`, () => ports.designer.html(projectId, screen.screenId));
        const elements = await stage(`CONVERT_${index}`, async () => {
          try { return await ports.converter.convert(html, `${executionId}:${index}`); }
          catch (error) {
            if (!(error instanceof ConversionError)) throw error;
            const repaired = await stage(`REPAIR_${index}`, () => ports.planner.repair(html, error.issues));
            return ports.converter.convert(repaired, `${executionId}:${index}`);
          }
        });
        pages.push({ id: `page-${createHash("sha256").update(`${executionId}:${index}`).digest("hex").slice(0, 20)}`, name: page.name, slug: page.slug, isHome: index === 0, elements, pageSettings: { title: page.name, path: page.slug, backgroundColor: "#ffffff" } });
      }
      document = { version: 1, pages, homePageId: pages[0]!.id!, elements: pages[0]!.elements!, pageSettings: pages[0]!.pageSettings!, siteParts: {}, pageCss: "" };
    }
    validateDocumentTree(document);
    const pages = document.pages as JsonObject[];
    if (!Array.isArray(pages) || !pages.length) throw new AppError("The website requires native pages before scoped editing", 422, "AI_SCOPE_INVALID");
    const routes = new Set(pages.map(page => String(page.slug)));
    const checkLinks = (nodes: unknown) => { if (!Array.isArray(nodes)) return; for (const node of nodes as JsonObject[]) { if (typeof node.href === "string" && !routes.has(node.href)) throw new ConversionError(["UNRESOLVED_LINK"]); checkLinks(node.children); } };
    pages.forEach(page => checkLinks(page.elements));
    await transaction(async tx => {
      await tx.aiChangeset.create({ data: { executionId, websiteId: execution.websiteId, workspaceId: execution.workspaceId, organizationId: execution.organizationId, actorId: execution.actorId,
        expectedDocumentVersion: execution.expectedDocumentVersion!, proposedDocument: document as Prisma.InputJsonValue,
        summary: { provider: "stitch-claude", pageNames: pages.map(page => page.name), pageCount: pages.length, setupRequired, conversionVersion: 1, proposalHash: createHash("sha256").update(JSON.stringify(document)).digest("hex") } as Prisma.InputJsonValue,
      } });
      await tx.aiExecution.update({ where: { id: executionId }, data: { status: "COMPLETED", stage: "PENDING_REVIEW", completedAt: new Date(), outputSummary: { pageCount: pages.length } } });
      await tx.auditLog.create({ data: { userId: execution.actorId, action: "AI_DESIGN_READY", targetResource: `ai-execution:${executionId}`, details: { pageCount: pages.length } } });
      await tx.$executeRaw`INSERT INTO workspace_outbox ("organizationId","actorId",operation,"resourceId") VALUES (${execution.organizationId}::uuid,${execution.actorId}::uuid,'AI_DESIGN_READY',${execution.websiteId}::uuid)`;
    });
    return { executionId, status: "COMPLETED" };
  } catch (error) {
    const code = error instanceof AppError ? error.code : "AI_DESIGN_FAILED";
    if (code !== "AI_JOB_LEASE_LOST" && code !== "AI_CANCELLED") {
      try {
        await transaction(async tx => {
          const changed = await tx.aiExecution.updateMany({ where: { id: executionId, status: { in: ["QUEUED", "RUNNING"] } }, data: { status: code === "AI_EXTERNAL_OUTCOME_UNKNOWN" ? "RECONCILIATION_REQUIRED" : "FAILED", errorCode: code, completedAt: new Date() } });
          if (!changed.count) return;
          await tx.aiExecutionStage.updateMany({ where: { executionId, status: "RUNNING" }, data: { status: code === "AI_EXTERNAL_OUTCOME_UNKNOWN" ? "UNKNOWN" : "FAILED", completedAt: new Date() } });
          await tx.auditLog.create({ data: { userId: execution.actorId, action: "AI_DESIGN_FAILED", targetResource: `ai-execution:${executionId}`, details: { code } } });
          await tx.$executeRaw`INSERT INTO workspace_outbox ("organizationId","actorId",operation,"resourceId") VALUES (${execution.organizationId}::uuid,${execution.actorId}::uuid,'AI_DESIGN_FAILED',${execution.websiteId}::uuid)`;
        }, false);
      } catch (failure) {
        if (!(failure instanceof AppError) || !["AI_JOB_LEASE_LOST", "AI_CANCELLED"].includes(failure.code)) throw failure;
      }
    }
    return { executionId, status: "NOT_COMPLETED", code };
  } finally { if (ports!) await ports.designer.close(); }
}
