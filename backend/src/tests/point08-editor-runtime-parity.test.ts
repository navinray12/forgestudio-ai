/**
 * ForgeStudio Execution Blueprint v2.1 — Point 08: Component Contracts, Design Fidelity and Source Ownership
 * Test Suite 2: Editor and Published Runtime Parity
 */

import assert from "node:assert/strict";
import test from "node:test";
import { editorRuntimeParityService } from "../services/components/editorRuntimeParity.service.js";

test("Point 08 — Editor and Published Runtime Parity Suite", async () => {
  await test("1. Editor rendering contains non-contaminating overlays and inspection tags", () => {
    const editorOutput = editorRuntimeParityService.renderComponent("Button", {
      label: "Click Here",
      variant: "primary"
    }, {
      mode: "EDITOR",
      nodeId: "btn-editor-node-01",
      isSelected: true
    });

    assert.equal(editorOutput.mode, "EDITOR");
    assert.ok(editorOutput.html.includes('data-forge-node-id="btn-editor-node-01"'));
    assert.ok(editorOutput.html.includes('data-forge-selected="true"'));
    assert.equal(editorOutput.editorAttributesStripped, false);
  });

  await test("2. Production rendering strictly strips all editor-only attributes and scripts", () => {
    const prodOutput = editorRuntimeParityService.renderComponent("Button", {
      label: "Click Here",
      variant: "primary"
    }, {
      mode: "PRODUCTION",
      nodeId: "btn-editor-node-01"
    });

    assert.equal(prodOutput.mode, "PRODUCTION");
    assert.ok(!prodOutput.html.includes("data-forge-node-id"));
    assert.ok(!prodOutput.html.includes("data-forge-selected"));
    assert.ok(!prodOutput.html.includes("data-forge-editor"));
    assert.equal(prodOutput.editorAttributesStripped, true);
    assert.equal(prodOutput.html, '<button class="btn btn-primary">Click Here</button>');
  });

  await test("3. Automated parity verification proves semantic parity between sanitized editor and production output", () => {
    const parityResult = editorRuntimeParityService.verifyParity("Button", {
      label: "Get Started",
      variant: "secondary"
    });

    assert.equal(parityResult.hasParity, true);
    assert.equal(parityResult.discrepancies.length, 0);

    const heroParity = editorRuntimeParityService.verifyParity("HeroSection", {
      headline: "Scalable Cloud Infrastructure",
      subheadline: "Deploy globally in seconds"
    });

    assert.equal(heroParity.hasParity, true);
    assert.equal(heroParity.discrepancies.length, 0);
  });
});
