/**
 * ForgeStudio Execution Blueprint v2.1 — Point 05: Executable Capability Contract
 * Capability registry (read-only)
 *
 * Not exposed:
 * - /:id/activate, /:id/disable: they flip activationStatus on the shared in-process registry, for
 *   every tenant at once and only until restart. Per-tenant capability state is served by
 *   services/capabilities/tenant-capabilities.routes.ts.
 * - /:id/evidence, /release-gate/evaluate and the evidence list on /:id: the evidence store is
 *   process-local and seeds itself with PASSED records dated at startup, and the gate trusts a
 *   client-supplied list of active capabilities.
 * - /navigation, /:id/prerequisites, /:id/disable-preview: computed from client-claimed active
 *   capabilities, credentials and migrations rather than server state.
 */

import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.js";
import {
  getCapabilityById,
  listCapabilities,
  validateRegistryIntegrity,
  CapabilityClassification,
} from "../services/capabilities/capabilityRegistry.js";
import { getCapabilityManifest } from "../services/capabilities/capabilityManifest.js";

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
export async function getManifestHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(200).json({ success: true, manifest: getCapabilityManifest() });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/capabilities/:id
 * Retrieves a single capability from the registry.
 */
export async function getCapabilityByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const capId = String(req.params.id);
    const capability = getCapabilityById(capId);
    if (!capability) throw new AppError("Capability not found.", 404, "CAPABILITY_NOT_FOUND");
    return res.status(200).json({ success: true, capability });
  } catch (error) {
    next(error);
  }
}
