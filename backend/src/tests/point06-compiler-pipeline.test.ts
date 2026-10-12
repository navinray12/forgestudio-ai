/**
 * ForgeStudio Execution Blueprint v2.1 — Point 06: Core Architecture and Six Authoritative Records
 * Test Suite 4: Compiler Pipeline Integration with Versioned Records
 */

import assert from "node:assert/strict";
import test from "node:test";
import { CompilerPipelineService } from "../services/authoritative/compilerPipeline.service.js";
import { BusinessFactRegisterService } from "../services/authoritative/record1-business-facts.service.js";
import { SiteSpecService } from "../services/authoritative/record2-sitespec.service.js";
import { SourceManifestService } from "../services/authoritative/record3-source-manifest.service.js";
import { ContentSchemaRecordService } from "../services/authoritative/record4-content-schema.service.js";
import { ReleaseEvidenceManifestService } from "../services/authoritative/record6-release-manifest.service.js";

test("Point 06 — Compiler Pipeline & Versioned Inputs Suite", async (t) => {
  t.beforeEach(() => {
    BusinessFactRegisterService.clearMemory();
    SiteSpecService.clearMemory();
    SourceManifestService.clearMemory();
    ContentSchemaRecordService.clearMemory();
    ReleaseEvidenceManifestService.clearMemory();
  });

  await t.test("1. 12-Pass Compiler Pipeline: Consumes pinned versioned inputs and produces deterministic artifacts", async () => {
    const websiteId = "site-compiler-test";
    const tenantId = "tenant-acme";

    // 1. Setup Record 1: Approved Business Fact
    const fact = await BusinessFactRegisterService.proposeFact(
      {
        tenantId,
        websiteId,
        category: "OFFER_AND_SERVICE",
        statement: "Custom Software Architecture Consulting",
        isPublic: true,
      },
      "architect_alice"
    );
    await BusinessFactRegisterService.approveFact({
      tenantId,
      websiteId,
      factId: fact.id,
      actorId: "owner_bob",
    });

    // 2. Setup Record 2: SiteSpec
    const siteSpec = await SiteSpecService.createRevision(
      websiteId,
      tenantId,
      {
        parentVersion: 0,
        routes: [
          {
            path: "/",
            pageId: "page_home",
            purpose: "HOME",
            seo: { title: "Acme Consulting", description: "Architecture experts", indexingPolicy: "INDEX_FOLLOW" },
          },
        ],
        pages: [
          {
            id: "page_home",
            name: "Home",
            slug: "/",
            purpose: "HOME",
            rootComponentId: "comp_root",
            componentTree: [
              { id: "comp_root", elementId: "el_h1", type: "heading", tag: "h1" },
            ],
          },
        ],
        designTokens: { colors: { primary: "#0b2238" } },
        contentBindings: [
          {
            componentId: "comp_root",
            elementId: "el_h1",
            targetProperty: "heading",
            sourceType: "BUSINESS_FACT",
            sourceRefId: fact.id,
          },
        ],
        actionBindings: [],
        capabilitySelection: {
          profile: "PROFESSIONAL_SERVICES",
          activeCapabilities: ["CAP-001", "CAP-002", "CAP-003", "CAP-006", "CAP-043"],
          profileVersion: "1.0.0",
        },
        sourceOwnershipRefs: [],
        provenance: {
          createdBy: "owner_bob",
          createdAt: new Date().toISOString(),
          changeReason: "Initial baseline compile",
        },
      },
      "owner_bob"
    );

    // 3. Run Compilation Pass 1 to 12
    const output1 = await CompilerPipelineService.compileVersionedCandidate({
      websiteId,
      tenantId,
      siteSpecVersion: siteSpec.version,
      actorId: "build_bot",
    });

    assert.equal(output1.success, true);
    assert.equal(output1.diagnostics.length, 12, "Must execute all 12 sequential passes");
    assert.equal(output1.pinnedInputsSummary.siteSpecVersion, 1);
    assert.ok(output1.artifacts.checksums.overallDeployHash.length > 0);
    assert.ok(output1.releaseManifest);
    assert.equal(output1.releaseManifest.status, "CANDIDATE");

    // 4. Determinism & Semantic Reproducibility:
    // Compiling identical pinned inputs must produce IDENTICAL artifact checksums
    const output2 = await CompilerPipelineService.compileVersionedCandidate({
      websiteId,
      tenantId,
      siteSpecVersion: siteSpec.version,
      actorId: "build_bot",
    });

    assert.equal(
      output2.artifacts.checksums.htmlHash,
      output1.artifacts.checksums.htmlHash,
      "Identical pinned inputs must produce identical HTML checksum"
    );
    assert.equal(
      output2.artifacts.checksums.cssHash,
      output1.artifacts.checksums.cssHash,
      "Identical pinned inputs must produce identical CSS checksum"
    );
  });

  await t.test("2. Compiler Fail-Closed: Fails with actionable diagnostics when SiteSpec revision is missing", async () => {
    await assert.rejects(
      async () => {
        await CompilerPipelineService.compileVersionedCandidate({
          websiteId: "nonexistent-site",
          tenantId: "tenant-acme",
          siteSpecVersion: 99,
          actorId: "build_bot",
        });
      },
      /SiteSpec revision not found/,
      "Compiler must fail closed when requested SiteSpec revision is missing"
    );
  });
});
