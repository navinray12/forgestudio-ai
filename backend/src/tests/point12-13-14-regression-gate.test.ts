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
import { evaluateContentModelEvolution } from "../services/cms/contentModelEvolution.service.js";
import { protectSourceRecord } from "../services/cms/protectedSourceLifecycle.service.js";

// Point 11 Imports
import {
  SYSTEM_PERMISSIONS,
  BUILTIN_ROLES,
} from "../services/ownerExperience/dynamicPermissionEngine.service.js";
import { resolveWorkspaceView } from "../services/ownerExperience/progressiveDisclosure.service.js";
import { getOrCreateEditorSession } from "../services/ownerExperience/truthfulEditorState.service.js";

describe("Points 12, 13, 14 — Regression Gate for Points 05 to 11", () => {
  it("should preserve Point 05 & 06 Authoritative Foundation", () => {
    assert.ok(CAPABILITY_REGISTRY["CAP-101"], "CAP-101 Lead Gen must exist");
    assert.ok(CAPABILITY_REGISTRY["CAP-102"], "CAP-102 CMS must exist");
    assert.ok(CAPABILITY_REGISTRY["CAP-105"], "CAP-105 Growth must exist");

    const facts = getBusinessFacts("regress-all-1");
    assert.ok(facts, "Record 1 Business Facts must resolve");
    const spec = getSiteSpec("regress-all-1");
    assert.ok(spec, "Record 2 SiteSpec must resolve");
  });

  it("should preserve Point 07 Generation & Point 08 Component Contracts", () => {
    const session = createGenerationSession({
      siteId: "regress-all-1",
      tenantId: "tenant-1",
      profile: "lead_generation",
      unitsBudget: 250,
    });
    assert.equal(session.state, "PROPOSED");

    const contract = validateComponentContract({
      componentId: "cmp:lead:form",
      version: "1.0.0",
      propsSchema: { type: "object", properties: { formId: { type: "string" } }, required: ["formId"] },
      supportState: "FULL",
    });
    assert.equal(contract.valid, true);
  });

  it("should preserve Point 09 Recipe Engine & Point 10 Protected Source Lifecycle", () => {
    const manifest = generateRecipeManifest({
      siteId: "regress-all-1",
      tenantId: "tenant-1",
      profile: "lead_generation",
      businessBrief: { siteTitle: "Lead Gen Site" },
    });
    assert.ok(manifest.recipeId);

    const evolution = evaluateContentModelEvolution({
      collectionSlug: "inquiries",
      currentSchemaVersion: 1,
      proposedSchema: { fields: [{ name: "notes", type: "string" }] },
    });
    assert.equal(evolution.strategy, "EXPAND_FORWARD_COMPATIBLE");

    const protectedItem = protectSourceRecord({
      resourceType: "post",
      resourceId: "post-p10-1",
      websiteId: "regress-all-1",
      tenantId: "tenant-1",
    });
    assert.equal(protectedItem.isProtected, true);
  });

  it("should preserve Point 11 Dynamic Permissions & Progressive Disclosure Workspace", () => {
    assert.ok(SYSTEM_PERMISSIONS["perm:content:edit"]);
    assert.ok(SYSTEM_PERMISSIONS["perm:content:publish"]);
    assert.ok(SYSTEM_PERMISSIONS["perm:pii:export"]);
    assert.ok(BUILTIN_ROLES["OWNER"]);
    assert.ok(BUILTIN_ROLES["ADMIN"]);

    const view = resolveWorkspaceView({
      userRole: "ADMIN",
      requestedLevel: "DESIGN_DEVELOPER",
    });
    assert.equal(view.experienceLevel, "DESIGN_DEVELOPER");
    assert.ok(view.navigation.leads_conversations.length > 0);

    const editorSession = getOrCreateEditorSession("regress-all-1", 1);
    assert.equal(editorSession.currentState, "DRAFT_ACKNOWLEDGED");
  });
});
