/**
 * ForgeStudio Execution Blueprint v2.1 — Point 08: Component Contracts, Design Fidelity and Source Ownership
 * Test Suite 5: Base-Aware Three-Way Source Reconciliation
 */

import assert from "node:assert/strict";
import test from "node:test";
import { threeWaySourceReconciliationService } from "../services/components/threeWaySourceReconciliation.service.js";

test("Point 08 — Three-Way Source Reconciliation Suite", async (t) => {
  t.beforeEach(() => {
    threeWaySourceReconciliationService.reset();
  });

  await t.test("1. Generated-only changes: automatically applies proposal when user did not edit", () => {
    const websiteId = "site-recon-01";
    const filePath = "src/components/Header.tsx";
    const baseline = 'export const Header = () => <header><h1>Original</h1></header>;';
    const proposal = 'export const Header = () => <header><h1>Updated by AI</h1></header>;';

    // Register baseline (user content matches baseline)
    threeWaySourceReconciliationService.registerSourceUnit({
      websiteId,
      tenantId: "tenant-01",
      filePath,
      ownership: "GENERATED",
      baselineContent: baseline,
      currentUserContent: baseline
    });

    const result = threeWaySourceReconciliationService.reconcileProposal({
      websiteId,
      filePath,
      proposedContent: proposal
    });

    assert.equal(result.outcome, "GENERATED_ONLY_CHANGED");
    assert.equal(result.mergedContent, proposal);
    assert.equal(result.regenerationLocked, false);
  });

  await t.test("2. User-only changes: preserves user edits when generated proposal matches baseline", () => {
    const websiteId = "site-recon-02";
    const filePath = "src/components/Footer.tsx";
    const baseline = 'export const Footer = () => <footer>Default</footer>;';
    const userEdit = 'export const Footer = () => <footer>Custom User Edit</footer>;';

    threeWaySourceReconciliationService.registerSourceUnit({
      websiteId,
      tenantId: "tenant-01",
      filePath,
      ownership: "USER_OWNED",
      baselineContent: baseline,
      currentUserContent: userEdit
    });

    // Generated proposal is identical to baseline (no AI change)
    const result = threeWaySourceReconciliationService.reconcileProposal({
      websiteId,
      filePath,
      proposedContent: baseline
    });

    assert.equal(result.outcome, "USER_ONLY_CHANGED");
    assert.equal(result.mergedContent, userEdit); // User edit strictly preserved!
    assert.equal(result.regenerationLocked, false);
  });

  await t.test("3. Clean three-way merge: non-overlapping edits merge cleanly without conflict", () => {
    const websiteId = "site-recon-03";
    const filePath = "src/components/Layout.tsx";

    const baseline = [
      'import React from "react";',
      'export const Layout = () => {',
      '  const header = "BaseHeader";',
      '  const footer = "BaseFooter";',
      '  return <div>{header}{footer}</div>;',
      '};'
    ].join("\n");

    // User modified line 3 (header)
    const userEdit = [
      'import React from "react";',
      'export const Layout = () => {',
      '  const header = "UserCustomHeader";',
      '  const footer = "BaseFooter";',
      '  return <div>{header}{footer}</div>;',
      '};'
    ].join("\n");

    // Proposed modified line 4 (footer)
    const proposal = [
      'import React from "react";',
      'export const Layout = () => {',
      '  const header = "BaseHeader";',
      '  const footer = "ProposedNewFooter";',
      '  return <div>{header}{footer}</div>;',
      '};'
    ].join("\n");

    threeWaySourceReconciliationService.registerSourceUnit({
      websiteId,
      tenantId: "tenant-01",
      filePath,
      ownership: "HYBRID",
      baselineContent: baseline,
      currentUserContent: userEdit
    });

    const result = threeWaySourceReconciliationService.reconcileProposal({
      websiteId,
      filePath,
      proposedContent: proposal
    });

    assert.equal(result.outcome, "CLEAN_THREE_WAY_MERGE");
    assert.ok(result.mergedContent?.includes('"UserCustomHeader"'));
    assert.ok(result.mergedContent?.includes('"ProposedNewFooter"'));
    assert.equal(result.regenerationLocked, false);
  });

  await t.test("4. Overlapping edits: locks regeneration and records structured conflict", () => {
    const websiteId = "site-recon-04";
    const filePath = "src/components/Hero.tsx";

    const baseline = 'const title = "Original Title";';
    const userEdit = 'const title = "User Title";';
    const proposal = 'const title = "AI Generated Title";';

    threeWaySourceReconciliationService.registerSourceUnit({
      websiteId,
      tenantId: "tenant-01",
      filePath,
      ownership: "HYBRID",
      baselineContent: baseline,
      currentUserContent: userEdit
    });

    const result = threeWaySourceReconciliationService.reconcileProposal({
      websiteId,
      filePath,
      proposedContent: proposal
    });

    assert.equal(result.outcome, "OVERLAPPING_CONFLICT");
    assert.equal(result.regenerationLocked, true);
    assert.ok(result.conflictRecord);
    assert.equal(result.conflictRecord?.isResolved, false);

    // Active conflicts query returns this file
    const activeConflicts = threeWaySourceReconciliationService.getActiveConflictsForWebsite(websiteId);
    assert.equal(activeConflicts.length, 1);
    assert.equal(activeConflicts[0].conflictId, result.conflictRecord.conflictId);

    // Explicit conflict resolution releases regeneration lock
    const resolved = threeWaySourceReconciliationService.resolveConflict({
      conflictId: result.conflictRecord.conflictId,
      choice: "KEEP_USER",
      resolvedBy: "admin-alice"
    });

    assert.equal(resolved.isResolved, true);
    assert.equal(resolved.resolutionChoice, "KEEP_USER");

    const updatedUnit = threeWaySourceReconciliationService.getSourceUnit(websiteId, filePath);
    assert.equal(updatedUnit?.isLockedForRegeneration, false);
    assert.equal(updatedUnit?.currentUserContent, userEdit);
  });
});
