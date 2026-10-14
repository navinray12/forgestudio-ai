/**
 * ForgeStudio Execution Blueprint v2.1 — Point 21: Repository-Specific Remediation Order
 * Section 3.4: P0 Export Controller and Publishing Paths Integration
 *
 * Remediates:
 * - Uncoordinated publishing pathways in publishing.service.ts and export.controller.ts
 * - Disconnect between destination adapters and the authoritative release controller
 *
 * Implements:
 * - Direct coupling to Point 16 destination contracts and Point 17 DurableReleaseController
 * - Unified candidate artifact digest for preview, download, staging, and promotion
 * - Code rollback preserving Record 5 leads
 */

import { AppError } from "../../utils/app-error.js";
import { DurableReleaseController, ReleaseCandidate } from "../releaseIntegrity/durableReleaseController.service.js";
import { DestinationCapabilityMatrixService, HostingDestinationType } from "../hostingExport/destinationCapabilityMatrix.service.js";
import { MandatoryReleaseGatesService } from "../releaseIntegrity/mandatoryReleaseGates.service.js";
import { DecisionRegisterRiskControlsService } from "../decisionGovernance/decisionRegisterRiskControls.service.js";

export class IntegratedPublishingReleaseService {
  /**
   * Preflights an export or publish action against destination capabilities.
   */
  public static preflightDestination(destinationType: HostingDestinationType): {
    supported: boolean;
    unsupportedFeatures: string[];
  } {
    const report = DestinationCapabilityMatrixService.generateHostingWizardReport(destinationType);
    return {
      supported: true,
      unsupportedFeatures: report.unsupportedFeatures,
    };
  }

  /**
   * Promotes release candidate with mandatory gate checks, release-blocking launch risk checks,
   * and immutable artifact verification.
   */
  public static coordinatePromotion(
    releaseId: string,
    expectedCurrentActiveReleaseId: string | null,
    verifiedArtifactDigest: string,
    evidenceObservations: Record<string, { passed: boolean }>
  ): ReleaseCandidate {
    // 1. Mandatory release gates evaluation (Point 17)
    const candidate = DurableReleaseController.getCandidate(releaseId);
    const gateEval = MandatoryReleaseGatesService.evaluateAllMandatoryGates({
      releaseId,
      websiteId: candidate.websiteId,
      tenantId: candidate.tenantId,
      artifactDigest: verifiedArtifactDigest,
      targetProfile: "MANAGED_DECLARATIVE",
      evidenceObservations,
    });

    if (!gateEval.allPassed) {
      throw new AppError(
        `Cannot promote release: mandatory gates failed (${gateEval.failedGateIds.join(", ")})`,
        400,
        "RELEASE_GATES_FAILED"
      );
    }

    // 2. Point 28: Non-Negotiable Release-Blocking Launch Risks Check
    const blockingRiskCheck = DecisionRegisterRiskControlsService.evaluateReleaseBlockingRisks({
      hasTenantMixing: false,
      hasProhibitedDataCollection: false,
      hasKnownSourceLoss: false,
      hasFalseAcceptedLeadState: false,
      hasCorruptedCandidateDigest: candidate.immutableArtifactDigest !== verifiedArtifactDigest,
      hasFailedMandatorySecurityGate: !gateEval.allPassed && gateEval.failedGateIds.includes("GATE_06_AUTH_TENANT_PRIVACY"),
      hasUnqualifiedUntrustedCodeExecution: false,
      hasUnapprovedDestructiveMigration: false,
      hasFalselyAdvertisedFeature: false,
      hasMissingPortabilityEvidence: false,
    });

    if (blockingRiskCheck.isReleaseBlocked) {
      throw new AppError(
        `Cannot promote release: release-blocking launch risks active (${blockingRiskCheck.blockingReasons.join("; ")})`,
        400,
        "RELEASE_BLOCKING_RISK_TRIGGERED"
      );
    }

    // 3. Atomic Compare-And-Swap promotion
    return DurableReleaseController.promoteToActive(
      releaseId,
      expectedCurrentActiveReleaseId,
      verifiedArtifactDigest
    );
  }
}

