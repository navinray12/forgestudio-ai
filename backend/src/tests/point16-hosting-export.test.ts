/**
 * ForgeStudio Execution Blueprint v2.1 — Point 16 Automated Test Suite
 * Hosting, Export and WordPress Compatibility
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DestinationCapabilityMatrixService } from "../services/hostingExport/destinationCapabilityMatrix.service.ts";
import { HostingProfilesEngine } from "../services/hostingExport/hostingProfilesEngine.service.ts";
import { PortableExportPackageService } from "../services/hostingExport/portableExportPackage.service.ts";
import { WordPressCompatibilityAdapterService } from "../services/hostingExport/wordPressCompatibilityAdapter.service.ts";

describe("Point 16 — Hosting, Export and WordPress Compatibility", () => {
  it("should generate destination capability matrix and honest wizard reports", () => {
    // 1. Managed Declarative
    const reportA = DestinationCapabilityMatrixService.generateHostingWizardReport("MANAGED_DECLARATIVE");
    assert.equal(reportA.destination.supportsAtomicSwitching, true);
    assert.equal(reportA.destination.supportsInstantRollback, true);

    // 2. Static Snapshot: discloses lack of dynamic forms & rollback
    const reportD = DestinationCapabilityMatrixService.generateHostingWizardReport("STATIC_SNAPSHOT");
    assert.equal(reportD.destination.supportsDynamicFormsCms, false);
    assert.equal(reportD.destination.supportsInstantRollback, false);
    assert.ok(reportD.unsupportedFeatures.includes("Native dynamic CMS forms backend"));
    assert.ok(reportD.unsupportedFeatures.includes("One-click instantaneous rollback"));
  });

  it("should enforce fail-closed behavior for Managed Custom Runtime when container isolation is absent", () => {
    // Unqualified environment (e.g. standard Node VM or uncontained child process)
    const unqualified = HostingProfilesEngine.qualifyManagedCustomRuntime("tenant_alpha", "web_01", {
      hasKernelContainerIsolation: false,
      hasRestrictedEgress: false,
    });
    assert.equal(unqualified.qualified, false);
    assert.ok(unqualified.blockers.length >= 2);
    assert.equal(unqualified.evidence.sandboxBoundary, "BLOCKED_FAIL_CLOSED");

    // Qualified environment with gVisor / cgroups
    const qualified = HostingProfilesEngine.qualifyManagedCustomRuntime("tenant_alpha", "web_01", {
      hasKernelContainerIsolation: true,
      hasRestrictedEgress: true,
    });
    assert.equal(qualified.qualified, true);
    assert.equal(qualified.blockers.length, 0);
    assert.equal(qualified.evidence.sandboxBoundary, "QUALIFIED_GVISOR_CONTAINER");
  });

  it("should qualify portable full stack and static snapshot profiles", () => {
    // 1. Portable Full Stack
    const fullStack = HostingProfilesEngine.qualifyPortableFullStack("web_01");
    assert.equal(fullStack.qualified, true);
    assert.equal(fullStack.evidence.smokeTestsPassed.installWithoutPlatformCredentials, true);
    assert.equal(fullStack.evidence.smokeTestsPassed.acceptAndPersistLead, true);

    // 2. Static Snapshot
    const staticSnapshot = HostingProfilesEngine.qualifyStaticSnapshot("web_01");
    assert.equal(staticSnapshot.qualified, true);
    assert.ok(staticSnapshot.evidence.excludedDynamicDependencies.length >= 2);
  });

  it("should generate reproducible export manifests, verify package hash integrity, and exclude platform secrets", () => {
    const manifest = PortableExportPackageService.generateExportManifest("tenant_alpha", "web_01", "PORTABLE_FULL_STACK");
    assert.equal(manifest.tenantId, "tenant_alpha");
    assert.ok(manifest.fileManifest.length > 0);
    assert.ok(manifest.overallPackageHash);

    // Check integrity verification
    const isValid = PortableExportPackageService.verifyPackageIntegrity(manifest);
    assert.equal(isValid, true);

    // Platform secrets excluded
    assert.ok(manifest.excludedPlatformSecrets.includes("FORGE_MASTER_API_KEY"));
    assert.ok(manifest.excludedPlatformSecrets.includes("AI_GATEWAY_SERVICE_TOKEN"));
    // Env schema present without actual secret values
    assert.ok(manifest.environmentVariableSchema.some((e) => e.key === "DATABASE_URL"));
  });

  it("should preserve native WordPress post semantics and unsupported React server components without false conversion", () => {
    const articles = [
      { id: "art_01", title: "Standard Article", slug: "/standard", status: "PUBLISHED", rawContent: "<p>Hello</p>" },
      { id: "art_02", title: "React Component Article", slug: "/interactive", status: "DRAFT", rawContent: "'use server'; export async function action() {}" },
    ];

    const result = WordPressCompatibilityAdapterService.mapToWordPressFormat(articles);
    assert.equal(result.mappedPosts.length, 2);
    assert.equal(result.mappedPosts[0].postStatus, "publish");
    assert.equal(result.mappedPosts[1].postStatus, "draft");

    // Unsupported React Server Action is preserved, NOT falsely converted to PHP
    assert.equal(result.unsupportedReactComponentsPreserved.length, 1);
    assert.equal(result.unsupportedReactComponentsPreserved[0].componentId, "art_02");
    assert.ok(result.mappedPosts[1].unsupportedReactFeatures.length > 0);
  });

  it("should assess SFTP destinations and truthfully disclose missing managed guarantees", () => {
    const sftpAssessment = WordPressCompatibilityAdapterService.assessSftpDestination({
      host: "ftp.example.com",
      user: "deployer",
      remoteDir: "/public_html",
    });
    assert.equal(sftpAssessment.sftpReady, true);
    assert.ok(sftpAssessment.missingManagedGuarantees.includes("Atomic zero-downtime symlink switching"));
    assert.ok(sftpAssessment.missingManagedGuarantees.includes("Instant one-click rollback"));
    assert.equal(sftpAssessment.capabilities.serverSideExecution, false);
  });
});
