import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Point 05 Imports
import { CAPABILITY_REGISTRY } from "../services/capabilities/capabilityRegistry.js";

// Point 06 Imports
import { getBusinessFacts } from "../services/authoritative/record1-business-facts.service.js";
import { getSiteSpec } from "../services/authoritative/record2-sitespec.service.js";

// Point 07 Imports
import {
  createGenerationSession,
  getGenerationSession,
} from "../services/generation/generationStateMachine.service.js";

// Point 08 Imports
import {
  validateComponentContract,
  reconcileSourceVersions,
} from "../services/components/componentContract.service.js";

// Point 09 & 10 Imports
import { generateRecipeManifest } from "../services/cms/recipeEngine.service.js";
import {
  evaluateContentModelEvolution,
  createContentRevision,
} from "../services/cms/contentModelEvolution.service.js";
import {
  protectSourceRecord,
  trashSourceRecord,
} from "../services/cms/protectedSourceLifecycle.service.js";

describe("Point 11 — Regression Gate for Points 05 to 10", () => {
  it("should preserve Point 05 Capability Registry definitions", () => {
    assert.ok(CAPABILITY_REGISTRY["CAP-101"], "CAP-101 Lead Generation capability must exist");
    assert.ok(CAPABILITY_REGISTRY["CAP-102"], "CAP-102 CMS / Blog capability must exist");
    assert.ok(CAPABILITY_REGISTRY["CAP-103"], "CAP-103 E-commerce capability must exist");
    assert.ok(CAPABILITY_REGISTRY["CAP-104"], "CAP-104 Custom Code capability must exist");
  });

  it("should preserve Point 06 Authoritative Records (Records 1 & 2)", () => {
    const facts = getBusinessFacts("regress-site-1");
    assert.ok(facts, "Record 1 Business Facts must resolve");
    const spec = getSiteSpec("regress-site-1");
    assert.ok(spec, "Record 2 SiteSpec must resolve");
  });

  it("should preserve Point 07 Generation State Machine", () => {
    const session = createGenerationSession({
      siteId: "regress-site-1",
      tenantId: "tenant-1",
      profile: "lead_generation",
      unitsBudget: 100,
    });
    assert.equal(session.state, "PROPOSED");
    const retrieved = getGenerationSession(session.id);
    assert.equal(retrieved?.id, session.id);
  });

  it("should preserve Point 08 Component Contracts & 3-Way Reconciliation", () => {
    const validation = validateComponentContract({
      componentId: "cmp:hero:header",
      version: "1.0.0",
      propsSchema: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
      supportState: "FULL",
    });
    assert.equal(validation.valid, true);

    const merge = reconcileSourceVersions({
      baseCode: "export const Header = () => <h1>Old</h1>;",
      generatedCode: "export const Header = () => <h1>Generated</h1>;",
      userCode: "export const Header = () => <h1>User Edit</h1>;",
    });
    assert.ok(merge.mergedCode || merge.hasConflicts);
  });

  it("should preserve Point 09 Recipe Engine and Manifest Determinism", () => {
    const manifest = generateRecipeManifest({
      siteId: "regress-site-1",
      tenantId: "tenant-1",
      profile: "content_led",
      businessBrief: { siteTitle: "Regression Test Site" },
    });
    assert.ok(manifest.recipeId);
    assert.ok(manifest.manifestHash);
    assert.ok(manifest.collections.some((c) => c.slug === "posts"));
  });

  it("should preserve Point 10 Content Model Evolution & Protected Source Lifecycle", () => {
    // Schema evolution
    const evolution = evaluateContentModelEvolution({
      collectionSlug: "articles",
      currentSchemaVersion: 1,
      proposedSchema: { fields: [{ name: "readTime", type: "number", required: false }] },
    });
    assert.equal(evolution.strategy, "EXPAND_FORWARD_COMPATIBLE");

    // Content revision
    const rev = createContentRevision({
      entryId: "entry-regress-1",
      revisionNumber: 1,
      data: { title: "Regression Draft" },
    });
    assert.equal(rev.revisionNumber, 1);

    // Protected source trash
    const record = protectSourceRecord({
      resourceType: "post",
      resourceId: "post-regress-1",
      websiteId: "regress-site-1",
      tenantId: "tenant-1",
    });
    assert.equal(record.isProtected, true);

    const trashed = trashSourceRecord({
      resourceId: "post-regress-1",
      actorId: "actor-1",
      reason: "Regression cleanup",
    });
    assert.equal(trashed.status, "TRASHED");
  });
});
