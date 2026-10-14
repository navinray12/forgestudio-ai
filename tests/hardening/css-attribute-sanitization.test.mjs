import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";

test("CSS sanitizer keeps valid class names and hyphens", async () => {
  const module = await loadTypeScript("frontend/src/features/blocks/engine/attributeSanitizer.ts");
  const valid = module.validateAndCleanCssClasses("hero-card button_primary nav--active");
  assert.equal(valid.cleaned, "hero-card button_primary nav--active");
  assert.deepEqual(Array.from(valid.errors), []);

  const invalid = module.validateAndCleanCssClasses("safe-class weird<script> ok");
  assert.equal(invalid.cleaned, "safe-class weirdscript ok");
  assert.equal(invalid.errors.length, 1);
});

test("anchor normalizer removes invalid characters but retains safe hyphens", async () => {
  const module = await loadTypeScript("frontend/src/features/blocks/engine/attributeSanitizer.ts");
  assert.equal(module.normalizeHtmlAnchor("###Pricing & Plans!"), "pricing-plans-");
  assert.equal(module.normalizeHtmlAnchor("section-2_main"), "section-2_main");
});
