import * as acorn from "acorn";
import { AppError } from "../../../utils/app-error.js";
import { prisma } from "../../../config/prisma.js";
import { authorizeWebsiteDocumentWrite } from "../../../services/websites/save-document.js";
import { siteGenerationProvider } from "../provider-routing.js";
import { encryptPrompt, promptRetentionEnabled, retentionExpiry } from "../prompt-vault.js";
import { reserveWorkspaceAiQuota, releaseAiExecutionQuota, settleAiExecutionQuota } from "../ai-quota.js";

export type CodeLanguage = "HTML" | "CSS" | "JS";

export interface GenerateCodeInput {
  websiteId: string;
  actorId: string;
  language: CodeLanguage;
  prompt: string;
  context?: {
    title?: string;
    placement?: "HEADER" | "FOOTER" | "BODY_START" | "BODY_END";
    framework?: string;
  };
}

export interface PreviewCodeInput {
  html?: string;
  css?: string;
  js?: string;
}

export interface ExplainCodeInput {
  code: string;
  language: CodeLanguage;
  websiteId?: string;
  actorId: string;
}

const PROHIBITED_PROPERTIES = new Set([
  "cookie",
  "localstorage",
  "sessionstorage",
  "indexeddb",
  "serviceworker",
  "sharedworker",
  "parent",
  "top",
  "postmessage",
  "xmlhttprequest",
  "websocket",
  "eventsource",
]);

const PROHIBITED_CALLS = new Set([
  "eval",
  "function",
  "fetch",
  "websocket",
  "eventsource",
  "xmlhttprequest",
  "postmessage",
  "open",
]);

/**
 * Perform deep recursive AST walk on the Acorn parse tree.
 * Detects direct calls, constructor invocations, frame escape, network exfiltration,
 * dynamic imports, and computed sensitive property lookups.
 */
function inspectAstForSecurity(code: string): string[] {
  const issues: string[] = [];
  let ast: any;
  try {
    ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module" });
  } catch {
    try {
      ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "script" });
    } catch (syntaxErr: any) {
      issues.push(`JavaScript Syntax Error: ${syntaxErr.message}`);
      return issues;
    }
  }

  function walk(node: any) {
    if (!node || typeof node !== "object") return;

    // 1. Direct Call Expressions: eval(...), Function(...), fetch(...)
    if (node.type === "CallExpression") {
      if (node.callee.type === "Identifier" && PROHIBITED_CALLS.has(node.callee.name.toLowerCase())) {
        issues.push(`Prohibited execution of ${node.callee.name}()`);
      }
      if (node.callee.type === "MemberExpression") {
        const propName = node.callee.property.name || node.callee.property.value;
        if (typeof propName === "string" && PROHIBITED_CALLS.has(propName.toLowerCase())) {
          issues.push(`Prohibited dynamic invocation of .${propName}()`);
        }
      }
    }

    // 2. New Expression: new Function(...), new WebSocket(...), new XMLHttpRequest(...)
    if (node.type === "NewExpression") {
      if (node.callee.type === "Identifier" && PROHIBITED_CALLS.has(node.callee.name.toLowerCase())) {
        issues.push(`Prohibited constructor instantiation: new ${node.callee.name}()`);
      }
    }

    // 3. Dynamic Import Expression: import(...)
    if (node.type === "ImportExpression") {
      issues.push("Prohibited dynamic module import: import(...)");
    }

    // 4. Member Expressions: window["document"]["cookie"], parent, top, localStorage, etc.
    if (node.type === "MemberExpression") {
      let propName: string | undefined;
      if (node.property.type === "Identifier") {
        propName = node.property.name;
      } else if (node.property.type === "Literal" && typeof node.property.value === "string") {
        propName = node.property.value;
      }

      if (propName && PROHIBITED_PROPERTIES.has(propName.toLowerCase())) {
        issues.push(`Prohibited access to sensitive API: .${propName}`);
      }
    }

    // Recurse into all object keys of the AST node
    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const c of child) walk(c);
      } else if (child && typeof child === "object") {
        walk(child);
      }
    }
  }

  walk(ast);
  return issues;
}

/**
 * Phase 11: AI Code Generation with strict Acorn AST inspection
 */
export async function generateCode(input: GenerateCodeInput) {
  if (!input.prompt || input.prompt.trim().length < 5) {
    throw new AppError("A descriptive prompt is required for code generation", 400, "INVALID_PROMPT");
  }

  const website = await prisma.$transaction(async tx => {
    const scope = await authorizeWebsiteDocumentWrite(tx, input.websiteId, input.actorId);
    if (!scope.can("EDIT_DESIGN")) throw new AppError("Code generation requires design permissions", 403, "DOCUMENT_EDIT_FORBIDDEN");
    return scope.website;
  });

  const units = 1;
  const execution = await prisma.$transaction(async tx => {
    await reserveWorkspaceAiQuota(tx, { workspaceId: website.workspaceId, actorId: input.actorId, units });
    const retention = promptRetentionEnabled();
    return tx.aiExecution.create({
      data: {
        websiteId: website.id,
        workspaceId: website.workspaceId,
        organizationId: website.organizationId,
        actorId: input.actorId,
        operation: "CODE_GENERATION",
        provider: "site-generation-provider",
        model: "canonical",
        reservedUnits: units,
        inputSummary: { language: input.language, promptLength: input.prompt.length },
        promptCiphertext: retention ? encryptPrompt(input.prompt.trim()) : null,
        promptExpiresAt: retention ? retentionExpiry() : null,
      },
    });
  });

  const provider = siteGenerationProvider();
  const systemPrompt = `You are a principal frontend engineer.
Generate clean, production-ready ${input.language} code for ForgeStudio.
Requirements:
- Never use eval(), new Function(), or document.cookie.
- Never attempt to read localStorage, sessionStorage, or indexedDB.
- Write modern, maintainable code with inline comments explaining key logic.
- Return ONLY valid JSON:
{
  "title": "short component title",
  "code": "executable code content",
  "explanation": "high-level summary"
}`;

  try {
    const rawResult = await provider.generate({
      operation: "CODE_GENERATION",
      prompt: input.prompt,
      context: { language: input.language, websiteName: website.name },
      systemPrompt,
    });

    let parsed: { title: string; code: string; explanation: string };
    try {
      const cleaned = rawResult.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
      parsed = JSON.parse(cleaned);
      if (!parsed.code) throw new Error("No code in response");
    } catch {
      parsed = {
        title: input.context?.title || `${input.language} Snippet`,
        code: rawResult.text.trim(),
        explanation: "AI generated snippet",
      };
    }

    // Comprehensive AST security inspection for JavaScript code
    const issues: string[] = [];
    if (input.language === "JS") {
      const astIssues = inspectAstForSecurity(parsed.code);
      issues.push(...astIssues);
    }

    if (issues.length > 0) {
      await releaseAiExecutionQuota(execution.id, "FAILED", "UNSAFE_CODE_REJECTED");
      throw new AppError(`Code failed security audit: ${issues.join("; ")}`, 422, "UNSAFE_CODE_REJECTED");
    }

    await prisma.$transaction(async tx => {
      await settleAiExecutionQuota(tx, execution.id, units, { language: input.language, safe: true });
    });

    return {
      executionId: execution.id,
      title: parsed.title || input.context?.title || "Custom Code",
      language: input.language,
      code: parsed.code,
      explanation: parsed.explanation,
      securityAudit: {
        safe: true,
        issues: [],
      },
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "UNSAFE_CODE_REJECTED") {
      throw error;
    }
    await releaseAiExecutionQuota(execution.id, "FAILED", error instanceof AppError ? error.code : "AI_CODE_FAILED");
    throw error;
  }
}

/**
 * Phase 12: AI Code Preview Sandbox Generator
 * Generates an isolated document with strict zero-trust Content-Security-Policy.
 */
export function generateCodePreviewSandbox(input: PreviewCodeInput): string {
  const htmlContent = input.html || "";
  const cssContent = input.css ? `<style>${input.css}</style>` : "";
  const jsContent = input.js ? `<script>
    (function() {
      try {
        ${input.js}
      } catch (err) {
        console.error("Preview runtime error:", err.message);
      }
    })();
  <\/script>` : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: https:; connect-src 'none'; frame-src 'none'; object-src 'none';">
  ${cssContent}
</head>
<body>
  ${htmlContent}
  ${jsContent}
</body>
</html>`;
}

/**
 * Phase 13: AI Code Explanation
 * Read-only analysis that never mutates or executes code.
 */
export async function explainCode(input: ExplainCodeInput) {
  if (!input.code || input.code.trim().length === 0) {
    throw new AppError("Code is required for explanation", 400, "INVALID_INPUT");
  }

  const provider = siteGenerationProvider();
  const systemPrompt = `You are a principal frontend engineer and security auditor.
Analyze this ${input.language} code thoroughly.
Provide:
1. Overview of purpose.
2. Step-by-step breakdown.
3. Dependencies / prerequisites.
4. Potential bugs or edge cases.
5. Security considerations.
6. Optimization and maintainability suggestions.

Return ONLY a clean JSON object:
{
  "overview": "...",
  "breakdown": ["step 1", "step 2"],
  "dependencies": ["item 1"],
  "potentialBugs": ["bug 1"],
  "securityAudit": ["finding 1"],
  "optimizations": ["suggestion 1"]
}`;

  const result = await provider.generate({
    operation: "CODE_EXPLANATION",
    prompt: input.code,
    context: { language: input.language },
    systemPrompt,
  });

  try {
    const cleaned = result.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    return JSON.parse(cleaned);
  } catch {
    return {
      overview: result.text.trim(),
      breakdown: [],
      dependencies: [],
      potentialBugs: [],
      securityAudit: [],
      optimizations: [],
    };
  }
}
