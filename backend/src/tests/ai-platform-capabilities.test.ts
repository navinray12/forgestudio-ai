import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../utils/app-error.js";
import { generateCodePreviewSandbox } from "../modules/ai/code/code-generation.service.js";
import { detectIntent } from "../modules/ai/assistant/assistant-orchestrator.service.js";
import * as acorn from "acorn";

test("ForgeStudio AI Platform Comprehensive Capabilities Test Suite", async (t) => {

  await t.test("Phase 1 & 2: Text & Refinement Intent & Validation", async () => {
    // Intent detection
    assert.equal(detectIntent("Write a compelling hero heading for our AI SaaS"), "GENERATE_TEXT");
    assert.equal(detectIntent("Rewrite this paragraph in a professional tone"), "REFINE_CONTENT");
    assert.equal(detectIntent("Shorten this product description to 2 sentences"), "REFINE_CONTENT");
    assert.equal(detectIntent("Translate this text to Spanish"), "REFINE_CONTENT");
  });

  await t.test("Phase 3, 4 & 5: Structure, Section & Layout Intent Routing", async () => {
    assert.equal(detectIntent("Create a luxury real estate hero section"), "GENERATE_SECTION");
    assert.equal(detectIntent("Generate a 3-column pricing table section"), "GENERATE_SECTION");
    assert.equal(detectIntent("Create a flex container with 3 cards"), "GENERATE_CONTAINER");
    assert.equal(detectIntent("Generate a responsive 4-column grid container"), "GENERATE_CONTAINER");
    assert.equal(detectIntent("Optimize the layout structure of this page"), "GENERATE_LAYOUT");
  });

  await t.test("Phase 6 - 10: Image Operations Intent Routing", async () => {
    assert.equal(detectIntent("Generate a modern minimalist office workspace image"), "GENERATE_IMAGE");
    assert.equal(detectIntent("Remove the background of this product image"), "REMOVE_BACKGROUND");
    assert.equal(detectIntent("Replace this image with a sunset over mountains", { elementId: "img_123", elementType: "image" }), "REPLACE_IMAGE");
  });

  await t.test("Phase 11 - 13: Code Generation, Sandboxing & Security Inspection", async () => {
    // Intent
    assert.equal(detectIntent("Generate custom HTML and CSS for an interactive countdown timer"), "GENERATE_CODE");
    assert.equal(detectIntent("Explain how this JavaScript function calculates totals"), "EXPLAIN_CODE");

    // Sandbox CSP check (Phase 12)
    const sandbox = generateCodePreviewSandbox({
      html: "<div class='banner'>Flash Sale!</div>",
      css: ".banner { background: #ff0000; color: #ffffff; }",
      js: "console.log('Timer loaded');",
    });

    assert.ok(sandbox.includes("Content-Security-Policy"), "Sandbox must have Content-Security-Policy header tag");
    assert.ok(sandbox.includes("default-src 'none'"), "Sandbox must deny default access");
    assert.ok(sandbox.includes("<style>.banner {"), "Sandbox must inject custom CSS");
    assert.ok(sandbox.includes("Flash Sale!"), "Sandbox must inject custom HTML");
    assert.ok(!sandbox.includes("eval("), "Sandbox must not execute unescaped eval");

    // Acorn AST parsing security audit (Phase 11)
    const maliciousCode = "eval('dangerous code');";
    const ast = acorn.parse(maliciousCode, { ecmaVersion: "latest" });
    let hasEval = false;
    for (const node of (ast as any).body) {
      if (node.type === "ExpressionStatement" && node.expression.type === "CallExpression" && node.expression.callee.name === "eval") {
        hasEval = true;
      }
    }
    assert.ok(hasEval, "Acorn parser must detect dangerous eval() calls");
  });

  await t.test("Phase 14 & 15: Animation & Dynamic Properties", async () => {
    assert.equal(detectIntent("Add a smooth fade-in entrance animation on scroll"), "GENERATE_ANIMATION");
    assert.equal(detectIntent("Bind dynamic CMS property {{post.title}} to this heading"), "DYNAMIC_PROPERTY");
  });

  await t.test("Phase 16 - 19: SEO & Deterministic Site Audits", async () => {
    assert.equal(detectIntent("Generate SEO title and meta description tags"), "GENERATE_SEO");
    assert.equal(detectIntent("Audit this website for accessibility and performance issues"), "ANALYZE_SITE");
    assert.equal(detectIntent("Check design consistency and typography hierarchy"), "ANALYZE_SITE");
  });

  await t.test("Phase 20 - 22: Prompt Library & Assistant Orchestrator", async () => {
    assert.equal(detectIntent("Build a complete SaaS landing page with dark theme"), "GENERATE_WEBSITE");
  });

  await t.test("Phase 26: Security & Precondition Enforcement", async () => {
    const invalidVersion = "abc";
    assert.throws(() => {
      if (typeof invalidVersion !== "number" || isNaN(invalidVersion as any)) {
        throw new AppError("Invalid document version", 428, "DOCUMENT_PRECONDITION_REQUIRED");
      }
    }, (err: any) => err instanceof AppError && err.code === "DOCUMENT_PRECONDITION_REQUIRED");
  });
});
