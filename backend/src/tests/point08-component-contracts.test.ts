/**
 * ForgeStudio Execution Blueprint v2.1 — Point 08: Component Contracts, Design Fidelity and Source Ownership
 * Test Suite 1: Versioned Component Contract Registry
 */

import assert from "node:assert/strict";
import test from "node:test";
import { componentContractRegistry } from "../services/components/componentContractRegistry.service.js";

test("Point 08 — Component Contract Registry Suite", async (t) => {
  t.beforeEach(() => {
    componentContractRegistry.reset();
  });

  await t.test("1. Validates valid props and applies explicit defaults", () => {
    const res = componentContractRegistry.validateInstance("Button", {
      label: "Submit Application",
      variant: "primary"
    });

    assert.equal(res.isValid, true);
    assert.equal(res.errors.length, 0);
    assert.equal(res.normalizedProps.label, "Submit Application");
    assert.equal(res.normalizedProps.variant, "primary");
    // Explicit default applied for optional prop
    assert.equal(res.normalizedProps.disabled, false);
  });

  await t.test("2. Preserves intentional falsy values (false, 0, empty string, null) without converting to generic truthiness", () => {
    const res = componentContractRegistry.validateInstance("Button", {
      label: "Cancel Action",
      disabled: false // Explicit false must remain false
    });

    assert.equal(res.isValid, true);
    assert.strictEqual(res.normalizedProps.disabled, false);

    // HeroSection with explicit empty subheadline and showBadge = false
    const heroRes = componentContractRegistry.validateInstance("HeroSection", {
      headline: "Welcome",
      subheadline: "",
      showBadge: false
    });
    assert.equal(heroRes.isValid, true);
    assert.strictEqual(heroRes.normalizedProps.subheadline, "");
    assert.strictEqual(heroRes.normalizedProps.showBadge, false);
  });

  await t.test("3. Rejects unknown props with structured diagnostic errors", () => {
    const res = componentContractRegistry.validateInstance("Button", {
      label: "Click",
      unknownCustomProp: "injected",
      unauthorizedStyleOverride: "display: none"
    });

    assert.equal(res.isValid, false);
    assert.ok(res.errors.length >= 2);
    assert.ok(res.errors.some(e => e.field === "unknownCustomProp" && e.code === "UNKNOWN_PROP"));
    assert.ok(res.errors.some(e => e.field === "unauthorizedStyleOverride" && e.code === "UNKNOWN_PROP"));
  });

  await t.test("4. Enforces enum allowed values and type matching", () => {
    const res = componentContractRegistry.validateInstance("Button", {
      label: "Click",
      variant: "danger_unsupported_variant" // Not in allowed enum
    });

    assert.equal(res.isValid, false);
    assert.ok(res.errors.some(e => e.field === "variant" && e.code === "TYPE_MISMATCH"));
  });

  await t.test("5. Enforces deployment target compatibility", () => {
    // ContactForm does NOT support STATIC_HTML deployment target
    const res = componentContractRegistry.validateInstance("ContactForm", {
      formTitle: "Contact Us",
      deliveryWebhookUrl: "https://api.example.com/lead"
    }, {
      target: "STATIC_HTML"
    });

    assert.equal(res.isValid, false);
    assert.ok(res.errors.some(e => e.field === "supportedTargets" && e.code === "UNSUPPORTED_TARGET"));
  });

  await t.test("6. Enforces slot child constraints and prevents overflow", () => {
    // HeroSection ctaSlot allows only 'Button' with maxCount = 2
    const validSlotRes = componentContractRegistry.validateInstance("HeroSection", {
      headline: "Great Platform"
    }, {
      slots: {
        ctaSlot: ["Button", "Button"]
      }
    });
    assert.equal(validSlotRes.isValid, true);

    // Disallowed child in slot
    const disallowedChildRes = componentContractRegistry.validateInstance("HeroSection", {
      headline: "Great Platform"
    }, {
      slots: {
        ctaSlot: ["Button", "ContactForm"] // ContactForm not allowed in ctaSlot!
      }
    });
    assert.equal(disallowedChildRes.isValid, false);
    assert.ok(disallowedChildRes.errors.some(e => e.code === "DISALLOWED_SLOT_CHILD"));

    // Slot overflow
    const overflowRes = componentContractRegistry.validateInstance("HeroSection", {
      headline: "Great Platform"
    }, {
      slots: {
        ctaSlot: ["Button", "Button", "Button"] // 3 > maxCount 2
      }
    });
    assert.equal(overflowRes.isValid, false);
    assert.ok(overflowRes.errors.some(e => e.code === "SLOT_OVERFLOW"));
  });
});
