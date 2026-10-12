/**
 * ForgeStudio Execution Blueprint v2.1 — Point 05: Executable Capability Contract
 * Capability & Evidence Controller
 */

import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.js";
import {
  CAPABILITY_REGISTRY,
  getCapabilityById,
  listCapabilities,
  validateRegistryIntegrity,
  CapabilityClassification,
} from "../services/capabilities/capabilityRegistry.js";
import {
  getEvidenceForCapability,
  recordEvidence,
  evaluateEvidenceFreshness,
  invalidateCapabilityEvidence,
  getEvidenceStoreMetrics,
} from "../services/capabilities/evidenceRegistry.js";
import {
  getCapabilityManifest,
  generateAdminNavigation,
  resolveProfileCapabilities,
} from "../services/capabilities/capabilityManifest.js";
import {
  evaluateActivationPrerequisites,
  previewDisableImpact,
  executeGovernedActivation,
  executeGovernedDisable,
  getTransitionHistory,
} from "../services/capabilities/lifecycleGovernor.js";
import {
  evaluateProfileReleaseGate,
  registerReleaseException,
} from "../services/capabilities/releaseGate.js";

/**
 * GET /api/capabilities
 * Lists capabilities with optional domain, classification (F/G/B), and status filters.
 */
export async function listCapabilitiesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { domain, classification, implementationStatus, activationStatus, verificationStatus } = req.query;

    const capabilities = listCapabilities({
      domain: domain ? String(domain) : undefined,
      classification: classification ? (String(classification) as CapabilityClassification) : undefined,
      implementationStatus: implementationStatus ? (String(implementationStatus) as any) : undefined,
      activationStatus: activationStatus ? (String(activationStatus) as any) : undefined,
      verificationStatus: verificationStatus ? (String(verificationStatus) as any) : undefined,
    });

    const integrity = validateRegistryIntegrity();

    return res.status(200).json({
      success: true,
      total: capabilities.length,
      integrity: {
        isValid: integrity.valid,
        foundationCount: integrity.foundationCount,
        growthCount: integrity.growthCount,
        businessCount: integrity.businessCount,
      },
      capabilities,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/capabilities/manifest
 * Returns versioned, executable capability manifest.
 */
export async function getManifestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const manifest = getCapabilityManifest();
    return res.status(200).json({
      success: true,
      manifest,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/capabilities/navigation
 * Generates dynamic admin navigation driven by server capability state.
 */
export async function getAdminNavigationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const activeCaps = req.query.activeCaps ? String(req.query.activeCaps).split(",") : [];
    const navigation = generateAdminNavigation(activeCaps);

    return res.status(200).json({
      success: true,
      navigation,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/capabilities/:id
 * Retrieves single capability with its evidence history.
 */
export async function getCapabilityByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const capId = String(req.params.id);
    const capability = getCapabilityById(capId);

    if (!capability) {
      throw new AppError(404, `Capability '${capId}' not found.`);
    }

    const evidence = getEvidenceForCapability(capability.id).map((e) => ({
      ...e,
      freshness: evaluateEvidenceFreshness(e),
    }));

    return res.status(200).json({
      success: true,
      capability,
      evidence,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/capabilities/:id/prerequisites
 * Evaluates activation prerequisites report.
 */
export async function getPrerequisitesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const capId = String(req.params.id);
    const activeCapabilities = req.query.activeCapabilities
      ? String(req.query.activeCapabilities).split(",")
      : [];

    const report = evaluateActivationPrerequisites(capId, { activeCapabilities });

    return res.status(200).json({
      success: true,
      report,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/capabilities/:id/activate
 * Executes governed activation transition.
 */
export async function activateCapabilityHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const capId = String(req.params.id);
    const actorId = res.locals.user?.id || "admin-system";
    const { configuredCredentials, approvedDataPurposes, availableMigrations, activeCapabilities } = req.body || {};

    const transition = executeGovernedActivation(capId, actorId, {
      configuredCredentials,
      approvedDataPurposes,
      availableMigrations,
      activeCapabilities,
    });

    return res.status(200).json({
      success: true,
      transition,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/capabilities/:id/disable-preview
 * Previews impact of disabling a capability.
 */
export async function previewDisableHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const capId = String(req.params.id);
    const activeCapabilities = req.query.activeCapabilities
      ? String(req.query.activeCapabilities).split(",")
      : [];

    const preview = previewDisableImpact(capId, { activeCapabilities });

    return res.status(200).json({
      success: true,
      preview,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/capabilities/:id/disable
 * Executes governed disable transition.
 */
export async function disableCapabilityHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const capId = String(req.params.id);
    const actorId = res.locals.user?.id || "admin-system";
    const { force, inFlightJobsToDrain } = req.body || {};

    const transition = executeGovernedDisable(capId, actorId, { force, inFlightJobsToDrain });

    return res.status(200).json({
      success: true,
      transition,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/capabilities/:id/evidence
 * Records verification evidence for a capability.
 */
export async function recordEvidenceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const capId = String(req.params.id);
    const reviewer = res.locals.user?.email || res.locals.user?.id;
    const { type, artifactReference, verificationScope, environment, result, limitations, freshnessDaysLimit } = req.body || {};

    if (!type || !artifactReference || !verificationScope || !result) {
      throw new AppError(400, "Missing required evidence fields (type, artifactReference, verificationScope, result).");
    }

    const evidence = recordEvidence({
      capId,
      type,
      artifactReference,
      verificationScope,
      environment: environment || "TEST_RUNNER",
      reviewer,
      result,
      limitations,
      freshnessDaysLimit,
    });

    return res.status(201).json({
      success: true,
      evidence,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/capabilities/release-gate/evaluate
 * Evaluates website release gate against its profile recipe.
 */
export async function evaluateReleaseGateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { websiteId, profileId, activeCapabilities } = req.body || {};

    if (!websiteId || !profileId) {
      throw new AppError(400, "websiteId and profileId are required.");
    }

    const assessment = evaluateProfileReleaseGate(websiteId, profileId, activeCapabilities || []);

    return res.status(200).json({
      success: true,
      assessment,
    });
  } catch (error) {
    next(error);
  }
}
