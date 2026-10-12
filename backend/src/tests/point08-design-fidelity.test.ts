/**
 * ForgeStudio Execution Blueprint v2.1 — Point 08: Component Contracts, Design Fidelity and Source Ownership
 * Test Suite 3: Design Fidelity & Exact Style Preservation
 */

import assert from "node:assert/strict";
import test from "node:test";
import { designFidelityService, type ComponentStyleDeclaration } from "../services/components/designFidelity.service.js";

test("Point 08 — Design Fidelity & Exact Style Preservation Suite", async () => {
  await test("1. Compiles exact CSS declarations preserving intentional zero values and CSS variables", () => {
    const declaration: ComponentStyleDeclaration = {
      elementSelector: ".custom-card",
      baseStyles: {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 0, // Intentional zero gap must be preserved as 0
        padding: "24px",
        margin: 0, // Intentional zero margin
        color: "var(--forge-color-primary)",
        lineHeight: "1.5"
      },
      pseudoStates: {
        ":hover": {
          transform: "translateY(-4px)"
        }
      },
      responsiveStyles: {
        mobile: {
          gridTemplateColumns: "1fr",
          gap: "12px"
        }
      }
    };

    const compiled = designFidelityService.compileExactCss(declaration);

    assert.ok(compiled.includes("grid-template-columns: repeat(3, 1fr)"));
    assert.ok(compiled.includes("gap: 0;"));
    assert.ok(compiled.includes("margin: 0;"));
    assert.ok(compiled.includes("color: var(--forge-color-primary);"));
    assert.ok(compiled.includes(".custom-card:hover {"));
    assert.ok(compiled.includes("@media (max-width: 640px)"));
  });

  await test("2. Round-trip verification: Editing unrelated property preserves 100% of all other styles without loss", () => {
    const original: ComponentStyleDeclaration = {
      elementSelector: ".hero-container",
      baseStyles: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px",
        gap: 0,
        backgroundColor: "#ffffff",
        zIndex: 10
      },
      responsiveStyles: {
        tablet: {
          padding: "32px",
          gap: "16px"
        }
      }
    };

    // User edits an unrelated property (e.g. backgroundColor)
    const result = designFidelityService.verifyRoundTripFidelity(
      original,
      "backgroundColor",
      "#f3f4f6"
    );

    assert.equal(result.isFidelityPreserved, true);
    assert.equal(result.lossyModifications.length, 0);
  });
});
