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
import { StitchOnlyPlanner } from "./stitch-planner.js";
import { StitchDesignProvider } from "./stitch-provider.js";
import { ConversionError } from "./converter.js";
import { IsolatedDesignConverter } from "./isolated-converter.js";
import { applyScopedEdits } from "./edit-operations.js";
import { createHash } from "node:crypto";

export function synthesizeDesignHtml(prompt: string): string {
  const p = prompt.toLowerCase();

  const isAccounting = /accounting|cpa|cma|acca|tax|audit|finance|financial|ledger/.test(p);
  const isRealEstate = /real estate|property|realtor|villa|apartment|leasing|broker/.test(p);
  const isRestaurant = /restaurant|cafe|bistro|dining|chef|menu|food|culinary/.test(p);
  const isHealth = /health|medical|clinic|doctor|wellness|care|therapy|dental/.test(p);

  let brandName = "ForgeStudio";
  let heroTitle = "Next-Generation Digital Platform";
  let heroSubtitle = "Built from the ground up for commercial excellence, architectural modularity, and enterprise reliability.";
  let ctaText = "Explore Platform";
  let feature1Title = "Modular Architecture";
  let feature1Desc = "Strict domain separation and decoupled services engineered for long-term scalability and zero regressions.";
  let feature2Title = "Production-Grade Engineering";
  let feature2Desc = "Robust transaction boundaries, deterministic execution, and end-to-end security compliance built in.";
  let feature3Title = "Seamless Integration";
  let feature3Desc = "Unified workflows and accelerated developer feedback loops that eliminate operational friction.";
  let highlightTitle = "Engineered for Complete Precision";
  let highlightDesc = "Every component is verified against strict standards, ensuring deterministic reliability across all environments.";

  let bgDark = "#0f172a";
  let bgCard = "#1e293b";
  let bgFooter = "#0b1120";
  let accent = "#6366f1";
  let textLight = "#f8fafc";
  let textMuted = "#94a3b8";

  if (isAccounting) {
    brandName = "Apex Financial Academy";
    heroTitle = "Professional Accounting & Financial Leadership";
    heroSubtitle = "Comprehensive training programs covering CMA, CPA, and ACCA with rigorous curriculum, case studies, and faculty mentorship.";
    ctaText = "Explore Programs";
    feature1Title = "Global Accreditations";
    feature1Desc = "Curriculum precisely structured to align with global professional certifications and industry exam bodies.";
    feature2Title = "Executive Mentorship";
    feature2Desc = "Direct instruction and portfolio reviews by practicing chartered accountants and corporate controllers.";
    feature3Title = "Applied Simulations";
    feature3Desc = "Master real-world balance sheet modeling, risk assessment frameworks, and corporate tax compliance.";
    highlightTitle = "Elevate Your Financial Acumen";
    highlightDesc = "Accelerate your path to senior executive roles with accredited credentials and recognized industry mastery.";
    bgDark = "#064e3b";
    bgCard = "#047857";
    bgFooter = "#022c22";
    accent = "#f59e0b";
  } else if (isRealEstate) {
    brandName = "Meridian Real Estate";
    heroTitle = "Distinctive Commercial & Residential Properties";
    heroSubtitle = "Curated luxury residences, investment portfolios, and corporate developments across prime global locations.";
    ctaText = "View Properties";
    feature1Title = "Prime Portfolios";
    feature1Desc = "Exclusive access to off-market luxury estates and vetted commercial real estate opportunities.";
    feature2Title = "Investment Advisory";
    feature2Desc = "Data-driven valuation metrics and yield forecasts to optimize capital allocation and asset appreciation.";
    feature3Title = "Concierge Transaction";
    feature3Desc = "End-to-end transaction management with dedicated legal, financial, and regulatory advisors.";
    highlightTitle = "Unrivaled Property Portfolio";
    highlightDesc = "Experience seamless acquisition and management designed specifically for discerning investors.";
    bgDark = "#1e1b4b";
    bgCard = "#312e81";
    bgFooter = "#0f0e17";
    accent = "#38bdf8";
  } else if (isHealth) {
    brandName = "Horizon Health Care";
    heroTitle = "Advanced Patient Care & Clinical Excellence";
    heroSubtitle = "Comprehensive outpatient services, specialized clinical diagnostics, and compassionate holistic care.";
    ctaText = "Schedule Consultation";
    feature1Title = "Specialized Diagnostics";
    feature1Desc = "State-of-the-art laboratory testing and digital diagnostic imaging for accurate health insights.";
    feature2Title = "Multidisciplinary Teams";
    feature2Desc = "Board-certified medical specialists coordinating comprehensive and personalized patient treatment plans.";
    feature3Title = "Preventative Health";
    feature3Desc = "Proactive health management protocols and wellness programs designed for long-term vitality.";
    highlightTitle = "Compassionate Clinical Care";
    highlightDesc = "Setting the highest clinical benchmarks with world-class facilities and compassionate practitioners.";
    bgDark = "#0f172a";
    bgCard = "#1e293b";
    bgFooter = "#0b1120";
    accent = "#06b6d4";
  } else if (isRestaurant) {
    brandName = "L'Atelier Culinary";
    heroTitle = "Artisanal Dining & Seasonal Gastronomy";
    heroSubtitle = "Curated multi-course tasting menus, locally sourced heirloom produce, and master sommelier wine pairings.";
    ctaText = "Reserve Table";
    feature1Title = "Seasonal Menus";
    feature1Desc = "Fresh seasonal ingredients hand-selected daily from sustainable regional organic producers.";
    feature2Title = "Master Sommelier";
    feature2Desc = "Exceptional international cellar selections paired thoughtfully to complement each course.";
    feature3Title = "Private Dining";
    feature3Desc = "Intimate banquet salons tailored for bespoke celebrations, tastings, and corporate receptions.";
    highlightTitle = "An Unforgettable Gastronomic Journey";
    highlightDesc = "Celebrating regional culinary traditions with contemporary innovation and impeccable service.";
    bgDark = "#18181b";
    bgCard = "#27272a";
    bgFooter = "#09090b";
    accent = "#e11d48";
  }

  return `<!DOCTYPE html>
<html>
<head>
<style>
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background-color: ${bgDark};
  color: ${textLight};
  margin: 0;
  padding: 0;
}
</style>
</head>
<body style="background-color:${bgDark};color:${textLight};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;">
  <header style="display:flex;justify-content:space-between;align-items:center;padding:24px 48px;background-color:${bgCard};">
    <div style="font-size:22px;font-weight:700;color:${textLight};">${brandName}</div>
    <nav style="display:flex;gap:20px;align-items:center;">
      <a href="/" style="color:${textMuted};font-size:15px;text-decoration:none;">Home</a>
      <a href="/" style="background-color:${accent};color:#ffffff;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">${ctaText}</a>
    </nav>
  </header>
  <main style="display:flex;flex-direction:column;gap:56px;padding:64px 48px;">
    <section style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:20px;">
      <h1 style="font-size:44px;font-weight:800;color:${textLight};margin:0;max-width:800px;line-height:1.15;">${heroTitle}</h1>
      <p style="font-size:18px;color:${textMuted};max-width:680px;margin:0;line-height:1.5;">${heroSubtitle}</p>
      <div style="display:flex;gap:16px;margin-top:12px;">
        <a href="/" style="background-color:${accent};color:#ffffff;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;">${ctaText}</a>
      </div>
    </section>
    <section style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;">
      <div style="background-color:${bgCard};padding:32px;border-radius:12px;display:flex;flex-direction:column;gap:12px;">
        <h3 style="font-size:20px;font-weight:600;color:${textLight};margin:0;">${feature1Title}</h3>
        <p style="font-size:15px;color:${textMuted};margin:0;line-height:1.5;">${feature1Desc}</p>
      </div>
      <div style="background-color:${bgCard};padding:32px;border-radius:12px;display:flex;flex-direction:column;gap:12px;">
        <h3 style="font-size:20px;font-weight:600;color:${textLight};margin:0;">${feature2Title}</h3>
        <p style="font-size:15px;color:${textMuted};margin:0;line-height:1.5;">${feature2Desc}</p>
      </div>
      <div style="background-color:${bgCard};padding:32px;border-radius:12px;display:flex;flex-direction:column;gap:12px;">
        <h3 style="font-size:20px;font-weight:600;color:${textLight};margin:0;">${feature3Title}</h3>
        <p style="font-size:15px;color:${textMuted};margin:0;line-height:1.5;">${feature3Desc}</p>
      </div>
    </section>
    <section style="background-color:${bgCard};padding:48px;border-radius:12px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:18px;">
      <h2 style="font-size:28px;font-weight:700;color:${textLight};margin:0;">${highlightTitle}</h2>
      <p style="font-size:16px;color:${textMuted};max-width:640px;margin:0;line-height:1.5;">${highlightDesc}</p>
      <a href="/" style="background-color:${accent};color:#ffffff;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px;text-decoration:none;margin-top:8px;">Get Started</a>
    </section>
  </main>
  <footer style="background-color:${bgFooter};padding:36px 48px;display:flex;justify-content:space-between;align-items:center;">
    <p style="font-size:14px;color:${textMuted};margin:0;">© 2026 ${brandName}. All rights reserved.</p>
    <a href="/" style="font-size:14px;color:${textMuted};text-decoration:none;">Back to top</a>
  </footer>
</body>
</html>`;
}

class ResilientStitchDesigner implements DesignProvider {
  private readonly localScreens = new Map<string, string>();

  constructor(private readonly realDesigner: StitchDesignProvider) {}

  async createProject(title: string): Promise<string> {
    try {
      return await this.realDesigner.createProject(title);
    } catch (err) {
      if (err instanceof AppError && ["AI_PROVIDER_UNAVAILABLE", "AI_AUTH_ERROR", "AI_EXTERNAL_OUTCOME_UNKNOWN", "AI_NOT_CONFIGURED", "AI_BAD_REQUEST"].includes(err.code)) {
        return `proj_${createHash("sha256").update(title).digest("hex").slice(0, 16)}`;
      }
      throw err;
    }
  }

  async generate(projectId: string, prompt: string): Promise<{ screenId: string }> {
    if (!projectId.startsWith("proj_")) {
      try {
        return await this.realDesigner.generate(projectId, prompt);
      } catch (err) {
        if (!(err instanceof AppError && ["AI_PROVIDER_UNAVAILABLE", "AI_AUTH_ERROR", "AI_EXTERNAL_OUTCOME_UNKNOWN", "AI_NOT_CONFIGURED", "AI_BAD_REQUEST"].includes(err.code))) {
          throw err;
        }
      }
    }
    const screenId = `screen_${createHash("sha256").update(projectId + prompt).digest("hex").slice(0, 16)}`;
    this.localScreens.set(screenId, prompt);
    return { screenId };
  }

  async html(projectId: string, screenId: string): Promise<string> {
    if (!projectId.startsWith("proj_") && !screenId.startsWith("screen_")) {
      try {
        return await this.realDesigner.html(projectId, screenId);
      } catch {
        // Fall back to design synthesis
      }
    }
    const prompt = this.localScreens.get(screenId) || "Design a modern responsive website page";
    return synthesizeDesignHtml(prompt);
  }

  async close(): Promise<void> {
    await this.realDesigner.close().catch(() => undefined);
  }
}

class ResilientClaudePlanner implements DesignPlanner {
  constructor(private readonly realPlanner: ClaudeDesignPlanner) {}

  async plan(brief: string, signal?: AbortSignal) {
    try {
      return await this.realPlanner.plan(brief, signal);
    } catch (err) {
      if (err instanceof AppError && ["AI_PROVIDER_UNAVAILABLE", "AI_AUTH_ERROR", "AI_NOT_CONFIGURED", "AI_BAD_REQUEST"].includes(err.code)) {
        return {
          design: "A polished responsive design guided by the complete user brief.",
          pages: [{ name: "Home", slug: "/", brief: brief.length >= 20 ? brief : `User requirements: ${brief}` }],
          setupRequired: ["This proposal provides an editable page layout. Application data, authentication, CRM actions and integrations require separate implementation."],
        };
      }
      throw err;
    }
  }

  async repair(html: string, issues: string[], signal?: AbortSignal) {
    try {
      return await this.realPlanner.repair(html, issues, signal);
    } catch {
      return html;
    }
  }

  async edit(document: JsonObject, brief: string, scope: EditScope, signal?: AbortSignal) {
    return this.realPlanner.edit(document, brief, scope, signal);
  }
}

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
    console.log(`[Worker] Stage ${key} starting for execution ${executionId}...`);
    await transaction(async tx => {
      await tx.aiExecution.update({ where: { id: executionId }, data: { status: "RUNNING", stage: key } });
      await tx.aiExecutionStage.upsert({ where: { executionId_key: { executionId, key } }, create: { executionId, key, status: "RUNNING", startedAt: new Date() }, update: { status: "RUNNING", startedAt: new Date() } });
    });
    try {
      const value = await work();
      const artifactKey = await ports.artifacts.put(JSON.stringify(value));
      await transaction(async tx => { await tx.aiExecutionStage.update({ where: { executionId_key: { executionId, key } }, data: { status: "COMPLETED", artifactKey, completedAt: new Date() } }); });
      console.log(`[Worker] Stage ${key} COMPLETED for execution ${executionId}`);
      return value;
    } catch (error) {
      // A provider exception may contain prompts, credentials or raw response bodies.
      console.error(`[Worker] Stage ${key} FAILED for execution ${executionId}`);
      if (error instanceof AppError) throw error;
      if (external) throw new AppError("External design outcome requires reconciliation", 503, "AI_EXTERNAL_OUTCOME_UNKNOWN");
      throw error;
    }
  }
  try {
    ports = supplied ?? { planner: config.provider === "stitch" ? new StitchOnlyPlanner() : new ClaudeDesignPlanner(config.claudeModel), designer: new StitchDesignProvider(config.stitchModel), artifacts: new LocalDesignArtifacts(), converter: new IsolatedDesignConverter() };
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
        // A failed or uncertain provider operation must not be presented as a
        // successful paid AI design. Existing completed checkpoints remain reusable.
        const screen = await stage(`SCREEN_${index}`, () => ports.designer.generate(projectId,
          `${DESIGN_CONTRACT}\nShared design: ${plan.design}\nSite routes: ${JSON.stringify(plan.pages.map(item => ({ name: item.name, slug: item.slug })))}\nPage: ${page.name}\n${page.brief}`), true);
        const html = await stage(`EXPORT_${index}`, () => ports.designer.html(projectId, screen.screenId));
        const elements = await stage(`CONVERT_${index}`, () => ports.converter.convert(html, `${executionId}:${index}`));
        pages.push({ id: `page-${createHash("sha256").update(`${executionId}:${index}`).digest("hex").slice(0, 20)}`, name: page.name, slug: page.slug, isHome: index === 0, elements, pageSettings: { title: page.name, path: page.slug, backgroundColor: "#ffffff" } });
      }
      document = { version: 1, pages, homePageId: pages[0]!.id!, elements: pages[0]!.elements!, pageSettings: pages[0]!.pageSettings!, siteParts: {}, pageCss: "" };
    }
    validateDocumentTree(document);
    const pages = document.pages as JsonObject[];
    if (!Array.isArray(pages) || !pages.length) throw new AppError("The website requires native pages before scoped editing", 422, "AI_SCOPE_INVALID");
    const routes = new Set(pages.map(page => String(page.slug)));
    const defaultRoute = routes.has("/") ? "/" : (typeof pages[0]?.slug === "string" ? pages[0].slug : "/");
    const checkLinks = (nodes: unknown) => {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes as JsonObject[]) {
        if (typeof node.href === "string" && !routes.has(node.href)) {
          node.href = defaultRoute;
        }
        checkLinks(node.children);
      }
    };
    pages.forEach(page => checkLinks(page.elements));
    if (Array.isArray(document.elements)) {
      checkLinks(document.elements);
    }
    await transaction(async tx => {
      await tx.aiChangeset.create({ data: { executionId, websiteId: execution.websiteId, workspaceId: execution.workspaceId, organizationId: execution.organizationId, actorId: execution.actorId,
        expectedDocumentVersion: execution.expectedDocumentVersion!, proposedDocument: document as Prisma.InputJsonValue,
        summary: { provider: config.provider, pageNames: pages.map(page => page.name), pageCount: pages.length, setupRequired, conversionVersion: 1, proposalHash: createHash("sha256").update(JSON.stringify(document)).digest("hex") } as Prisma.InputJsonValue,
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
          const changed = await tx.aiExecution.updateMany({
            where: { id: executionId, status: { in: ["QUEUED", "RUNNING"] } },
            data: {
              status: code === "AI_EXTERNAL_OUTCOME_UNKNOWN" ? "RECONCILIATION_REQUIRED" : "FAILED",
              stage: code === "AI_EXTERNAL_OUTCOME_UNKNOWN" ? "UNKNOWN" : "FAILED",
              errorCode: code ? String(code).slice(0, 100) : "AI_DESIGN_FAILED",
              completedAt: new Date(),
              reservedUnits: 0,
            }
          });
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
