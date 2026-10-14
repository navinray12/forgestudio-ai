/**
 * ForgeStudio Execution Blueprint v2.1 — Point 06: Core Architecture and Six Authoritative Records
 * Record 6: Release and Evidence Manifest
 *
 * Authority: The exact set of inputs, dependencies, policies, runtime requirements,
 * targets, and test observations belonging to a release.
 *
 * Rules:
 * 1. A release must refer to exact pinned versions, never "latest" mutable records.
 * 2. Release metadata must not be silently rewritten after publication.
 * 3. Build inputs and output artifacts must be traceable to the exact candidate.
 * 4. Failed candidates cannot replace the working release.
 * 5. Rollback must point to an existing known-good release and compatible dependencies.
 * 6. Integrates with Point 05 evidence registry and profile-aware release gate.
 */

import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";
import { evaluateProfileReleaseGate } from "../capabilities/releaseGate.js";

export type ReleaseEnvironment = "PRODUCTION" | "STAGING" | "PREVIEW";
export type ReleaseStatus = "CANDIDATE" | "PUBLISHED" | "SUPERSEDED" | "ROLLED_BACK" | "FAILED";

export interface ReleaseTestObservation {
  testId: string;
  capId?: string;
  name: string;
  result: "PASSED" | "FAILED" | "SKIPPED";
  executedAt: string;
  evidenceRef?: string;
}

export interface ArtifactChecksums {
  bundleHash: string;
  cssHash: string;
  htmlHash: string;
  overallDeployHash: string;
}

export interface ReleaseEvidenceManifest {
  releaseId: string;
  websiteId: string;
  tenantId: string;
  version: number;
  environment: ReleaseEnvironment;
  status: ReleaseStatus;

  // Exact Pinned Inputs (The Six Authoritative Records)
  pinnedInputs: {
    siteSpecVersion: number;
    siteSpecDigest: string;
    businessFactRevision: number;
    businessFactDigest: string;
    sourceManifestRevision: number;
    sourceManifestHash: string;
    contentSchemaVersions: Record<string, number>;
    contentSnapshotHash: string;
    capabilityManifestVersion: string;
    profile: string;
    policyLedgerVersion: number;
    compilerVersion: string;
  };

  // Runtime dependencies & deployment target
  runtime: {
    target: "STATIC_CDN" | "NODE_SSR" | "WORDPRESS_BRIDGE";
    dependencies: string[];
    isolatedSandboxProfile: string;
  };

  // Build Output Checksums
  artifacts: ArtifactChecksums;

  // Quality & Evidence Verification
  verification: {
    releaseGateDecision: "PASSED" | "BLOCKED" | "CONDITIONAL";
    observations: ReleaseTestObservation[];
    evidenceReferences: string[];
    verifiedAt: string;
  };

  // Governance & Rollback
  governance: {
    createdBy: string;
    approvedBy?: string;
    approvedAt?: string;
    publishedAt?: string;
    notes?: string;
    previousReleaseId?: string;
    rollbackTargetId?: string;
  };

  manifestDigest: string;
  createdAt: string;
}

// In-memory store for release manifests
const RELEASE_MANIFESTS = new Map<string, ReleaseEvidenceManifest>();
const ACTIVE_RELEASES = new Map<string, string>(); // websiteId:environment -> releaseId

export class ReleaseEvidenceManifestService {
  /**
   * Assemble an immutable release candidate manifest from exact pinned inputs.
   */
  static async assembleCandidateManifest(params: {
    websiteId: string;
    tenantId: string;
    environment: ReleaseEnvironment;
    siteSpecVersion: number;
    siteSpecDigest: string;
    businessFactRevision: number;
    businessFactDigest: string;
    sourceManifestRevision: number;
    sourceManifestHash: string;
    contentSchemaVersions: Record<string, number>;
    contentSnapshotHash: string;
    capabilityManifestVersion: string;
    profile: string;
    policyLedgerVersion?: number;
    compilerVersion?: string;
    artifacts: ArtifactChecksums;
    observations?: ReleaseTestObservation[];
    actorId: string;
    notes?: string;
  }): Promise<ReleaseEvidenceManifest> {
    const activeReleaseId = ACTIVE_RELEASES.get(`${params.websiteId}:${params.environment}`);
    const activeRelease = activeReleaseId ? RELEASE_MANIFESTS.get(activeReleaseId) : null;
    const nextVersion = activeRelease ? activeRelease.version + 1 : 1;

    // Evaluate Point 05 Profile Release Gate
    const gateResult = evaluateProfileReleaseGate(params.websiteId, params.profile, []);
    const gateDecision = gateResult.canPublish ? "PASSED" : "BLOCKED";

    const releaseId = `rel_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
    const now = new Date().toISOString();

    const pinnedInputs = {
      siteSpecVersion: params.siteSpecVersion,
      siteSpecDigest: params.siteSpecDigest,
      businessFactRevision: params.businessFactRevision,
      businessFactDigest: params.businessFactDigest,
      sourceManifestRevision: params.sourceManifestRevision,
      sourceManifestHash: params.sourceManifestHash,
      contentSchemaVersions: params.contentSchemaVersions,
      contentSnapshotHash: params.contentSnapshotHash,
      capabilityManifestVersion: params.capabilityManifestVersion,
      profile: params.profile,
      policyLedgerVersion: params.policyLedgerVersion || 1,
      compilerVersion: params.compilerVersion || "forge-compiler-2.1.0",
    };

    const observations: ReleaseTestObservation[] = params.observations || [
      {
        testId: "test_gate_profile",
        name: `Mandatory profile gate check for ${params.profile}`,
        result: gateResult.canPublish ? "PASSED" : "FAILED",
        executedAt: now,
      },
    ];

    const digestPayload = JSON.stringify({
      releaseId,
      websiteId: params.websiteId,
      version: nextVersion,
      pinnedInputs,
      artifacts: params.artifacts,
      gateDecision,
    });
    const manifestDigest = crypto.createHash("sha256").update(digestPayload).digest("hex");

    const candidate: ReleaseEvidenceManifest = {
      releaseId,
      websiteId: params.websiteId,
      tenantId: params.tenantId,
      version: nextVersion,
      environment: params.environment,
      status: "CANDIDATE",
      pinnedInputs,
      runtime: {
        target: "STATIC_CDN",
        dependencies: ["static-hosting", "durable-leads"],
        isolatedSandboxProfile: "SANDBOX_TIER_1",
      },
      artifacts: params.artifacts,
      verification: {
        releaseGateDecision: gateDecision,
        observations,
        evidenceReferences: [`evidence_${manifestDigest.substring(0, 12)}`],
        verifiedAt: now,
      },
      governance: {
        createdBy: params.actorId,
        previousReleaseId: activeReleaseId,
        notes: params.notes,
      },
      manifestDigest,
      createdAt: now,
    };

    RELEASE_MANIFESTS.set(releaseId, candidate);
    return candidate;
  }

  /**
   * Promote a candidate manifest to PUBLISHED status.
   * Strict Rule: A candidate with a BLOCKED release gate CANNOT be published.
   */
  static async publishCandidate(
    releaseId: string,
    approverId: string,
    notes?: string
  ): Promise<ReleaseEvidenceManifest> {
    const candidate = RELEASE_MANIFESTS.get(releaseId);
    if (!candidate) {
      throw new AppError(`Release candidate not found: ${releaseId}`, 404, "RELEASE_NOT_FOUND");
    }

    if (candidate.verification.releaseGateDecision === "BLOCKED") {
      throw new AppError(
        "Publishing rejected: Candidate release has BLOCKED mandatory capability release gates",
        412,
        "RELEASE_GATE_BLOCKED"
      );
    }

    const envKey = `${candidate.websiteId}:${candidate.environment}`;
    const previousReleaseId = ACTIVE_RELEASES.get(envKey);

    // Supersede previous active release
    if (previousReleaseId) {
      const prev = RELEASE_MANIFESTS.get(previousReleaseId);
      if (prev) {
        prev.status = "SUPERSEDED";
      }
    }

    const now = new Date().toISOString();
    candidate.status = "PUBLISHED";
    candidate.governance.approvedBy = approverId;
    candidate.governance.approvedAt = now;
    candidate.governance.publishedAt = now;
    if (notes) candidate.governance.notes = notes;

    ACTIVE_RELEASES.set(envKey, releaseId);
    return candidate;
  }

  /**
   * Rollback to a previous known-good published release snapshot.
   */
  static async rollbackRelease(
    websiteId: string,
    targetReleaseId: string,
    actorId: string,
    reason: string
  ): Promise<{ success: boolean; activeRelease: ReleaseEvidenceManifest }> {
    const target = RELEASE_MANIFESTS.get(targetReleaseId);
    if (!target) {
      throw new AppError(`Target rollback release not found: ${targetReleaseId}`, 404, "RELEASE_NOT_FOUND");
    }
    if (target.websiteId !== websiteId) {
      throw new AppError("Cross-website rollback forbidden", 403, "TENANT_VIOLATION");
    }

    const envKey = `${websiteId}:${target.environment}`;
    const currentActiveId = ACTIVE_RELEASES.get(envKey);

    if (currentActiveId) {
      const current = RELEASE_MANIFESTS.get(currentActiveId);
      if (current) {
        current.status = "ROLLED_BACK";
        current.governance.notes = `Rolled back to ${targetReleaseId}: ${reason}`;
      }
    }

    target.status = "PUBLISHED";
    ACTIVE_RELEASES.set(envKey, targetReleaseId);

    return {
      success: true,
      activeRelease: target,
    };
  }

  /**
   * Get active published release manifest.
   */
  static async getActiveRelease(websiteId: string, environment: ReleaseEnvironment = "PRODUCTION"): Promise<ReleaseEvidenceManifest | null> {
    const releaseId = ACTIVE_RELEASES.get(`${websiteId}:${environment}`);
    if (!releaseId) return null;
    return RELEASE_MANIFESTS.get(releaseId) || null;
  }

  /**
   * Get release by ID.
   */
  static async getReleaseById(releaseId: string): Promise<ReleaseEvidenceManifest | null> {
    return RELEASE_MANIFESTS.get(releaseId) || null;
  }

  /**
   * Clear in-memory release manifests (for tests).
   */
  static clearMemory(): void {
    RELEASE_MANIFESTS.clear();
    ACTIVE_RELEASES.clear();
  }
}
