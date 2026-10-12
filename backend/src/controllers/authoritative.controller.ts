/**
 * ForgeStudio Execution Blueprint v2.1 — Point 06: Core Architecture and Six Authoritative Records
 * Authoritative Records & Architecture REST Controller
 */

import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.js";
import { BusinessFactRegisterService } from "../services/authoritative/record1-business-facts.service.js";
import { SiteSpecService } from "../services/authoritative/record2-sitespec.service.js";
import { SourceManifestService } from "../services/authoritative/record3-source-manifest.service.js";
import { ContentSchemaRecordService } from "../services/authoritative/record4-content-schema.service.js";
import { BusinessPolicyLedgerService } from "../services/authoritative/record5-business-ledgers.service.js";
import { ReleaseEvidenceManifestService } from "../services/authoritative/record6-release-manifest.service.js";
import { RelationalChangeImpactGraphService } from "../services/authoritative/relationalChangeImpactGraph.service.js";
import { SecurityPlanesService } from "../services/authoritative/securityPlanes.service.js";
import { CompilerPipelineService } from "../services/authoritative/compilerPipeline.service.js";

// Helper to extract actor and tenant from request
function getActorAndTenant(req: Request) {
  const actorId = (req as any).user?.id || (req as any).actorId || "usr_anonymous";
  const tenantId = (req as any).user?.tenantId || (req as any).tenantId || req.params.websiteId || "tenant_default";
  return { actorId, tenantId };
}

// -------------------------------------------------------------
// Record 1: Business Facts Endpoints
// -------------------------------------------------------------
export async function getBusinessFactsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId } = req.params;
    const { tenantId } = getActorAndTenant(req);
    const publicOnly = req.query.publicOnly === "true";

    const facts = await BusinessFactRegisterService.getApprovedFacts(tenantId, websiteId, { publicOnly });
    res.json({ success: true, count: facts.length, data: facts });
  } catch (err) {
    next(err);
  }
}

export async function proposeBusinessFactHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId } = req.params;
    const { actorId, tenantId } = getActorAndTenant(req);

    const fact = await BusinessFactRegisterService.proposeFact(
      {
        tenantId,
        websiteId,
        category: req.body.category,
        statement: req.body.statement,
        source: req.body.source,
        isPublic: req.body.isPublic,
        internalNotes: req.body.internalNotes,
        pricingAuthority: req.body.pricingAuthority,
        capacityConstraints: req.body.capacityConstraints,
        evidenceReference: req.body.evidenceReference,
      },
      actorId
    );

    res.status(201).json({ success: true, data: fact });
  } catch (err) {
    next(err);
  }
}

export async function approveBusinessFactHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId, factId } = req.params;
    const { actorId, tenantId } = getActorAndTenant(req);

    const approved = await BusinessFactRegisterService.approveFact({
      tenantId,
      websiteId,
      factId,
      actorId,
      notes: req.body.notes,
      pricingApproval: req.body.pricingApproval,
    });

    res.json({ success: true, data: approved });
  } catch (err) {
    next(err);
  }
}

// -------------------------------------------------------------
// Record 2: SiteSpec Endpoints
// -------------------------------------------------------------
export async function getLatestSiteSpecHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId } = req.params;
    const spec = await SiteSpecService.getLatestRevision(websiteId);
    if (!spec) {
      throw new AppError(`No SiteSpec revision found for website ${websiteId}`, 404, "SITESPEC_NOT_FOUND");
    }
    res.json({ success: true, data: spec });
  } catch (err) {
    next(err);
  }
}

export async function createSiteSpecRevisionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId } = req.params;
    const { actorId, tenantId } = getActorAndTenant(req);
    const expectedParentVersion = typeof req.body.expectedParentVersion === "number" ? req.body.expectedParentVersion : undefined;

    const revision = await SiteSpecService.createRevision(
      websiteId,
      tenantId,
      req.body,
      actorId,
      expectedParentVersion
    );

    res.status(201).json({ success: true, data: revision });
  } catch (err) {
    next(err);
  }
}

export async function convertEditorDataToSiteSpecHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId } = req.params;
    const { actorId, tenantId } = getActorAndTenant(req);

    const siteSpec = SiteSpecService.convertEditorDataToSiteSpec(
      websiteId,
      tenantId,
      req.body.editorData || {},
      actorId
    );

    res.json({ success: true, data: siteSpec });
  } catch (err) {
    next(err);
  }
}

// -------------------------------------------------------------
// Record 3: Source Manifest Endpoints
// -------------------------------------------------------------
export async function getSourceManifestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId } = req.params;
    const { tenantId } = getActorAndTenant(req);

    const manifest = SourceManifestService.getOrCreateManifest(websiteId, tenantId);
    res.json({ success: true, data: manifest });
  } catch (err) {
    next(err);
  }
}

export async function registerSourceFileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId } = req.params;
    const { actorId, tenantId } = getActorAndTenant(req);

    const file = await SourceManifestService.registerSourceFile(websiteId, tenantId, {
      path: req.body.path,
      content: req.body.content,
      ownership: req.body.ownership,
      role: req.body.role,
      isProtected: req.body.isProtected,
      license: req.body.license,
      actorId,
    });

    res.status(201).json({ success: true, data: file });
  } catch (err) {
    next(err);
  }
}

// -------------------------------------------------------------
// Record 4: Content / CMS Endpoints
// -------------------------------------------------------------
export async function defineCollectionSchemaHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId } = req.params;
    const { tenantId } = getActorAndTenant(req);

    const result = await ContentSchemaRecordService.defineCollectionSchema({
      collectionId: req.body.collectionId,
      websiteId,
      tenantId,
      name: req.body.name,
      slug: req.body.slug,
      fields: req.body.fields || [],
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// -------------------------------------------------------------
// Record 5: Business Ledgers (Durable Lead Acceptance)
// -------------------------------------------------------------
export async function acceptDurableLeadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId } = req.params;
    const { tenantId } = getActorAndTenant(req);

    const result = await SecurityPlanesService.submitCustomerLeadWithIsolatedAnalytics({
      websiteId,
      tenantId,
      formId: req.body.formId || "default_form",
      idempotencyKey: req.body.idempotencyKey,
      leadData: req.body.payload || req.body.leadData || {},
      analyticsContext: req.body.analyticsContext,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// -------------------------------------------------------------
// Record 6 & Compiler: Release Pipeline Endpoints
// -------------------------------------------------------------
export async function compileVersionedCandidateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId } = req.params;
    const { actorId, tenantId } = getActorAndTenant(req);

    const result = await CompilerPipelineService.compileVersionedCandidate({
      websiteId,
      tenantId,
      siteSpecVersion: req.body.siteSpecVersion,
      environment: req.body.environment,
      actorId,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getActiveReleaseHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId } = req.params;
    const env = (req.query.environment as any) || "PRODUCTION";

    const release = await ReleaseEvidenceManifestService.getActiveRelease(websiteId, env);
    if (!release) {
      throw new AppError(`No active published release found for website ${websiteId}`, 404, "RELEASE_NOT_FOUND");
    }

    res.json({ success: true, data: release });
  } catch (err) {
    next(err);
  }
}

export async function publishCandidateReleaseHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { releaseId } = req.params;
    const { actorId } = getActorAndTenant(req);

    const published = await ReleaseEvidenceManifestService.publishCandidate(
      releaseId,
      actorId,
      req.body.notes
    );

    res.json({ success: true, data: published });
  } catch (err) {
    next(err);
  }
}

export async function rollbackReleaseHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId } = req.params;
    const { actorId } = getActorAndTenant(req);
    const { targetReleaseId, reason } = req.body;

    if (!targetReleaseId) {
      throw new AppError("targetReleaseId is required for rollback", 400, "TARGET_RELEASE_REQUIRED");
    }

    const result = await ReleaseEvidenceManifestService.rollbackRelease(
      websiteId,
      targetReleaseId,
      actorId,
      reason || "Manual owner rollback"
    );

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// -------------------------------------------------------------
// Change-Impact Graph & Security Planes Endpoints
// -------------------------------------------------------------
export async function previewChangeImpactHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId } = req.params;
    const { tenantId } = getActorAndTenant(req);

    const report = RelationalChangeImpactGraphService.computeChangeImpact({
      tenantId,
      websiteId,
      originType: req.body.originType,
      originId: req.body.originId,
      oldVersion: req.body.oldVersion,
      newVersion: req.body.newVersion,
    });

    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function getSecurityPlanesStatusHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const statuses = SecurityPlanesService.getPlanesStatus();
    const analytics = SecurityPlanesService.getAnalyticsMetrics();
    res.json({ success: true, planes: statuses, analytics });
  } catch (err) {
    next(err);
  }
}
