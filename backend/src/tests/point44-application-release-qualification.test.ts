/**
 * ForgeStudio Test Suite — Blueprint Point 44:
 * End-to-End Application/Database Release Qualification
 */

import { describe, it, expect } from "vitest";
import { applicationReleaseQualificationService } from "../services/qualification/applicationReleaseQualification.service.js";

describe("Point 44 — End-to-End Application/Database Release Qualification", () => {
  const projectId = "proj_test_qual_44";
  const baseRunRequest = {
    projectId,
    applicationSpecId: "spec_app_v1",
    sourceCheckpointId: "chk_091823ab",
    sourceCodeHash: "sha256:7b11d3fae498c8e",
    apiContractHash: "sha256:88bcde123498afe",
    schemaMigrationSetHash: "sha256:9900aabbccddeef",
    environmentBindingId: "env_staging_bind",
    credentialReferenceVersion: "cred_ref_v3",
    runtimeImageTag: "forgestudio/runtime:1.4.2",
    verifierIdentity: "verifier_bot_alpha@forgestudio.io",
    targetEnvironment: "staging" as const,
    isProductionSmokeTest: false,
    useSyntheticNamespace: true,
  };

  it("44.1 Successfully completes qualification run across all 9 required layers", async () => {
    const record = await applicationReleaseQualificationService.executeReleaseQualificationRun(baseRunRequest);

    expect(record).toBeDefined();
    expect(record.projectId).toBe(projectId);
    expect(record.overallStatus).toBe("PASSED");
    expect(record.evidenceChainDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(record.layers.length).toBe(9);

    const layerTypes = record.layers.map((l) => l.layer);
    expect(layerTypes).toContain("SCHEMA");
    expect(layerTypes).toContain("API");
    expect(layerTypes).toContain("DOMAIN");
    expect(layerTypes).toContain("FRONTEND");
    expect(layerTypes).toContain("PERSISTENCE");
    expect(layerTypes).toContain("ENVIRONMENT_ISOLATION");
    expect(layerTypes).toContain("EDITING");
    expect(layerTypes).toContain("UPGRADE");
    expect(layerTypes).toContain("PORTABILITY");

    for (const layer of record.layers) {
      expect(layer.passed).toBe(true);
      expect(layer.evidence.length).toBeGreaterThan(0);
    }
  });

  it("44.2 Distinguishes 5 levels of evidence observation quality", async () => {
    const record = await applicationReleaseQualificationService.executeReleaseQualificationRun(baseRunRequest);

    const allEvidence = record.layers.flatMap((l) => l.evidence);
    const observationLevels = new Set(allEvidence.map((e) => e.observationLevel));

    expect(observationLevels.has("DB_PING")).toBe(true);
    expect(observationLevels.has("ACCEPTED_API_REQUEST")).toBe(true);
    expect(observationLevels.has("COMMITTED_DB_ROW")).toBe(true);
    expect(observationLevels.has("INDEPENDENTLY_OBSERVED_PERSISTED_RESULT")).toBe(true);
    expect(observationLevels.has("SUCCESSFULLY_RENDERED_FRONTEND_STATE")).toBe(true);
  });

  it("44.3 Strict secret hygiene guard rejects raw credentials or connection strings", async () => {
    const compromisedRequest = {
      ...baseRunRequest,
      credentialReferenceVersion: "postgres://admin:superSecret123@db.prod.internal:5432/main",
    };

    await expect(
      applicationReleaseQualificationService.executeReleaseQualificationRun(compromisedRequest)
    ).rejects.toThrow("RAW_SECRETS_FORBIDDEN");
  });

  it("44.4 Enforces synthetic test markers and policy documentation for production smoke runs", async () => {
    const unapprovedProdRun = {
      ...baseRunRequest,
      targetEnvironment: "production" as const,
      isProductionSmokeTest: true,
      productionExplicitApprovalToken: undefined,
    };

    await expect(
      applicationReleaseQualificationService.executeReleaseQualificationRun(unapprovedProdRun)
    ).rejects.toThrow("PRODUCTION_SMOKE_REQUIRES_APPROVAL_AND_SYNTHETIC_MARKERS");

    const approvedProdRun = {
      ...baseRunRequest,
      targetEnvironment: "production" as const,
      isProductionSmokeTest: true,
      productionExplicitApprovalToken: "appr_tok_secops_992",
      productionSyntheticMarker: "SYNTHETIC_TEST_CANARY_20261012",
      productionRetentionPolicy: "RETENTION_HOURS_24_AUTO_PURGE",
    };

    const record = await applicationReleaseQualificationService.executeReleaseQualificationRun(approvedProdRun);
    expect(record.overallStatus).toBe("PASSED");
    expect(record.targetEnvironment).toBe("production");
  });

  it("44.5 Verifies and retrieves tamper-evident qualification records", async () => {
    const record = await applicationReleaseQualificationService.executeReleaseQualificationRun(baseRunRequest);
    const fetched = applicationReleaseQualificationService.getQualificationRecord(record.id);

    expect(fetched).toBeDefined();
    expect(fetched?.id).toBe(record.id);
    expect(fetched?.evidenceChainDigest).toBe(record.evidenceChainDigest);

    const isDigestValid = applicationReleaseQualificationService.verifyEvidenceChainDigest(record);
    expect(isDigestValid).toBe(true);
  });
});
