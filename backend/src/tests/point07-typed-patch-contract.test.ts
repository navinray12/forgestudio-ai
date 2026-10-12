/**
 * ForgeStudio Execution Blueprint v2.1 — Point 07: Reliable Generation & Controlled AI Assistance
 * Test Suite 3: Typed Patch Contract & Safe Allowlisted Mutations
 */

import assert from "node:assert/strict";
import test from "node:test";
import { typedPatchContractService, type TypedPatchProposal } from "../services/generation/typedPatchContract.service.js";

test("Point 07 — Typed Patch Contract Suite", async (t) => {
  const defaultContext = {
    currentBaseRevision: 1,
    tenantId: "tenant-acme",
    protectedFilePaths: ["/src/core/security.ts", "/src/auth/session.ts"]
  };

  await t.test("1. Rejects unknown operations and forbidden keyword operations", () => {
    // Unknown operation
    const unknownPatch: any = {
      patchId: "patch-unknown",
      jobId: "job-01",
      candidateId: "cand-01",
      tenantId: "tenant-acme",
      expectedBaseRevision: 1,
      operation: "ARBITRARY_SQL_EXECUTE",
      targetRecord: "CANDIDATE_BUILD",
      targetObjectId: "db",
      affectedScope: {},
      payload: {},
      intendedBehavior: "Run direct sql"
    };

    const res1 = typedPatchContractService.validatePatch(unknownPatch, defaultContext);
    assert.equal(res1.isValid, false);
    assert.ok(res1.rejectedReasons.some(r => r.includes("Disallowed operation")));

    // Forbidden operation pattern: DIRECT_PUBLISH
    const forbiddenPatch: TypedPatchProposal = {
      patchId: "patch-forbidden",
      jobId: "job-01",
      candidateId: "cand-01",
      tenantId: "tenant-acme",
      expectedBaseRevision: 1,
      operation: "ADD_SITESPEC_COMPONENT",
      targetRecord: "RECORD2_SITESPEC",
      targetObjectId: "home-hero",
      affectedScope: {},
      payload: { action: "DIRECT_PUBLISH_NOW" },
      intendedBehavior: "Attempt to DIRECT_PUBLISH directly"
    };

    const res2 = typedPatchContractService.validatePatch(forbiddenPatch, defaultContext);
    assert.equal(res2.isValid, false);
    assert.ok(res2.rejectedReasons.some(r => r.includes("Security violation")));
  });

  await t.test("2. Rejects stale base revisions to prevent race conditions", () => {
    const stalePatch: TypedPatchProposal = {
      patchId: "patch-stale",
      jobId: "job-02",
      candidateId: "cand-02",
      tenantId: "tenant-acme",
      expectedBaseRevision: 99, // Stale! Current is 1
      operation: "UPDATE_DESIGN_TOKEN",
      targetRecord: "RECORD2_SITESPEC",
      targetObjectId: "tokens",
      affectedScope: {},
      payload: { primaryColor: "#000000" },
      intendedBehavior: "Update token color"
    };

    const res = typedPatchContractService.validatePatch(stalePatch, defaultContext);
    assert.equal(res.isValid, false);
    assert.ok(res.rejectedReasons.some(r => r.includes("Stale base revision")));
  });

  await t.test("3. Protects owner-authored source files from AI patch modification", () => {
    const protectedSourcePatch: TypedPatchProposal = {
      patchId: "patch-prot",
      jobId: "job-03",
      candidateId: "cand-03",
      tenantId: "tenant-acme",
      expectedBaseRevision: 1,
      operation: "ADD_CANDIDATE_FILE",
      targetRecord: "RECORD3_SOURCE",
      targetObjectId: "file-01",
      affectedScope: { filePath: "/src/core/security.ts" }, // Protected!
      payload: { content: "export const allowAll = true;" },
      intendedBehavior: "Modify protected source file"
    };

    const res = typedPatchContractService.validatePatch(protectedSourcePatch, defaultContext);
    assert.equal(res.isValid, false);
    assert.ok(res.rejectedReasons.some(r => r.includes("Protected source violation")));
  });

  await t.test("4. Applies valid allowlisted patch to isolated candidate and records diff", () => {
    const initialCandidate = {
      pages: [
        { route: "/", title: "Home", components: [] }
      ],
      designTokens: { primaryColor: "#3b82f6" }
    };

    const validPatch: TypedPatchProposal = {
      patchId: "patch-valid-01",
      jobId: "job-04",
      candidateId: "cand-04",
      tenantId: "tenant-acme",
      expectedBaseRevision: 1,
      operation: "ADD_SITESPEC_COMPONENT",
      targetRecord: "RECORD2_SITESPEC",
      targetObjectId: "hero",
      affectedScope: { pageRoute: "/" },
      payload: { type: "HeroComponent", title: "Welcome to Acme" },
      intendedBehavior: "Add hero component to home page"
    };

    const { updatedCandidate, diff } = typedPatchContractService.applyPatchToCandidate(
      initialCandidate,
      validPatch,
      defaultContext
    );

    assert.equal(updatedCandidate.pages[0].components.length, 1);
    assert.equal(diff?.operation, "ADD_SITESPEC_COMPONENT");
    // Initial candidate object was not mutated (pure isolation)
    assert.equal(initialCandidate.pages[0].components.length, 0);
  });
});
