import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../frontend/src/pages/editor/integrations/IntegrationRenderers.tsx", import.meta.url), "utf8");
const branchStart = source.indexOf('if (el.type === "google-maps")');
const hookPattern = /\buse(?:State|Effect)(?:<[^\n>]+>)?\s*\(/g;

test("integration renderer keeps React hooks before all type-based early returns", () => {
  assert.ok(branchStart > 0, "expected renderer branches");
  const hooks = [...source.matchAll(hookPattern)];
  assert.ok(hooks.length >= 10, "expected integration state and effect hooks");
  for (const hook of hooks) {
    assert.ok(hook.index < branchStart, "conditional React hook found after first branch");
  }
});

test("integration side effects are gated to their active element type", () => {
  for (const name of ["dynamic-data", "acf-integration", "toolset-integration", "pods-integration"]) {
    assert.ok(source.includes('if (el.type !== "' + name + '") return;'), name + " must not fetch while inactive");
  }
  assert.ok(source.includes("&jsonPath="), "dynamic proxy query parameter must remain compatible");
  assert.ok(source.includes("?postId="), "ACF API query parameter must remain compatible");
});

test("CRM lead capture does not announce successful sync when backend fails", () => {
  assert.ok(source.includes("if (!res.ok || data?.success !== true)"));
  assert.ok(source.includes("setCrmError("));
  assert.ok(!source.includes("Synced lead data with CRM (Demo Mode)"));
});

test("webhook requires HTTP and application success, retaining failure feedback", () => {
  assert.ok(source.includes("if (!response.ok || result?.success !== true)"));
  assert.ok(source.includes("setWebhookError("));
  assert.ok(source.includes('credentials: "include"'));
  assert.ok(!source.includes("Fallback for demo mode"));
});
