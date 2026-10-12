/**
 * ForgeStudio Execution Blueprint v2.1 — Point 04: What Every Generated Website Must Contain
 * Website Contract & Baseline Controller
 */

import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.js";
import { getWebsiteById, updateWebsite } from "../services/website.service.js";
import { canUserAccessResource } from "../services/permission.service.js";
import {
  extractContractFromEditorData,
  validateWebsiteOperatingContract,
} from "../services/websites/websiteContract.js";
import { provisionNormalSiteBaseline } from "../services/websites/baselineProvisioner.js";
import {
  auditWebsiteActions,
  executeWorkingAction,
} from "../services/websites/workingActionEngine.js";
import {
  validateClaimsForRelease,
  evaluateClaimStatus,
  createManagedClaim,
  reviewClaim,
} from "../services/websites/claimsEvidence.service.js";
import { createRevision } from "../services/revision.service.js";

/**
 * GET /api/websites/:id/contract
 * Retrieves canonical operating contract for a website.
 */
export async function getWebsiteContractHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id);
    const userId = res.locals.user?.id;

    const canView = await canUserAccessResource(userId, websiteId, "*", "VIEW");
    if (!canView) {
      throw new AppError("Forbidden: Cannot access website operating contract.", 403, "FORBIDDEN");
    }

    const website = await getWebsiteById(websiteId, userId);
    if (!website) {
      throw new AppError("Website not found.", 404, "NOT_FOUND");
    }

    const rawData = typeof website.editorData === "string" ? JSON.parse(website.editorData) : (website.editorData || {});
    const contract = extractContractFromEditorData(rawData, {
      websiteId: website.id,
      websiteName: website.name,
      ownerId: website.userId,
      workspaceId: website.workspaceId || undefined,
      organizationId: website.organizationId || undefined,
    });

    return res.status(200).json({
      success: true,
      contract,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/websites/:id/contract/validate
 * Validates current or proposed candidate editor data against the operating contract.
 */
export async function validateWebsiteContractHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id);
    const userId = res.locals.user?.id;
    const { editorData: candidateData, strictClaimsPolicy } = req.body || {};

    const canView = await canUserAccessResource(userId, websiteId, "*", "VIEW");
    if (!canView) {
      throw new AppError("Forbidden: Cannot validate website contract.", 403, "FORBIDDEN");
    }

    const website = await getWebsiteById(websiteId, userId);
    if (!website) {
      throw new AppError("Website not found.", 404, "NOT_FOUND");
    }

    const rawData = candidateData || (typeof website.editorData === "string" ? JSON.parse(website.editorData) : website.editorData);
    const contract = extractContractFromEditorData(rawData, {
      websiteId: website.id,
      websiteName: website.name,
      ownerId: website.userId,
      workspaceId: website.workspaceId || undefined,
      organizationId: website.organizationId || undefined,
    });

    const validation = validateWebsiteOperatingContract(contract, {
      strictClaimsPolicy: strictClaimsPolicy !== false,
    });

    return res.status(200).json({
      success: true,
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      summary: {
        totalPages: contract.pages.length,
        workingActions: contract.workingActionAudit.workingRoutesCount + contract.workingActionAudit.workingCommandsCount,
        brokenActions: contract.workingActionAudit.deadOrBrokenActionsCount,
        unsupportedClaims: contract.claimsAudit.unsupportedClaimsCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/websites/:id/contract/provision-baseline
 * Provisions the truthful normal-site baseline for the website from approved facts.
 */
export async function provisionBaselineHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id);
    const userId = res.locals.user?.id;
    const {
      industryOrType,
      briefSummary,
      requireBlog,
      requireOfferingsDetail,
      contactEmail,
      verifiedOrganizationFacts,
    } = req.body || {};

    const canEdit = await canUserAccessResource(userId, websiteId, "*", "EDIT");
    if (!canEdit) {
      throw new AppError("Forbidden: Cannot provision baseline on this website.", 403, "FORBIDDEN");
    }

    const website = await getWebsiteById(websiteId, userId);
    if (!website) {
      throw new AppError("Website not found.", 404, "NOT_FOUND");
    }

    if (website.status === "TRASH" || website.deletedAt) {
      throw new AppError("Cannot provision baseline on a trashed website.", 410, "WEBSITE_IN_TRASH");
    }

    const baselineResult = provisionNormalSiteBaseline({
      websiteId: website.id,
      websiteName: website.name,
      ownerId: website.userId,
      workspaceId: website.workspaceId || undefined,
      organizationId: website.organizationId || undefined,
      industryOrType,
      briefSummary,
      requireBlog,
      requireOfferingsDetail,
      contactEmail,
      verifiedOrganizationFacts,
    });

    // Persist new baseline editor data to website
    await updateWebsite(websiteId, userId, {
      editorData: baselineResult.editorData,
    });

    // Create an explicit baseline snapshot revision
    try {
      await createRevision(
        websiteId,
        userId,
        baselineResult.editorData,
        "Baseline provisioned under Point 04 Operating Contract",
        "MANUAL"
      );
    } catch (revErr) {
      // Non-blocking revision recording
    }

    return res.status(200).json({
      success: true,
      contract: baselineResult.contract,
      provisionedPages: baselineResult.contract.pages.map((p) => ({
        id: p.id,
        route: p.route,
        purpose: p.purpose,
        title: p.title,
      })),
      hiddenCollections: ["LMS", "COMMERCE_BOOKING", "EXTERNAL_CRM_SIMULATION"],
      message: "Normal-site baseline provisioned successfully without fake content.",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/websites/:id/actions/audit
 * Audits all visible actions on the website canvas.
 */
export async function auditActionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const websiteId = String(req.params.id);
    const userId = res.locals.user?.id;

    const canView = await canUserAccessResource(userId, websiteId, "*", "VIEW");
    if (!canView) {
      throw new AppError("Forbidden: Cannot audit website actions.", 403, "FORBIDDEN");
    }

    const website = await getWebsiteById(websiteId, userId);
    if (!website) {
      throw new AppError("Website not found.", 404, "NOT_FOUND");
    }

    const rawData = typeof website.editorData === "string" ? JSON.parse(website.editorData) : (website.editorData || {});
    const contract = extractContractFromEditorData(rawData, {
      websiteId: website.id,
      websiteName: website.name,
      ownerId: website.userId,
    });

    const allActions = contract.pages.flatMap((p) => p.actions);
    const availableRoutes = contract.pages.map((p) => p.route);

    const audit = auditWebsiteActions(allActions, availableRoutes);

    return res.status(200).json({
      success: true,
      audit,
    });
  } catch (error) {
    next(error);
  }
}
