import { AppError } from "../../../utils/app-error.js";
import { prisma } from "../../../config/prisma.js";
import { authorizeWebsiteDocumentWrite } from "../../../services/websites/save-document.js";
import { documentObject, type JsonObject } from "../../../services/websites/document-policy.js";
import { siteGenerationProvider } from "../provider-routing.js";
import { reserveWorkspaceAiQuota, releaseAiExecutionQuota, settleAiExecutionQuota } from "../ai-quota.js";

export type AnalysisType = "accessibility" | "performance" | "design" | "all";

export interface AnalyzeSiteInput {
  websiteId: string;
  actorId: string;
  type: AnalysisType;
}

export interface AnalysisFinding {
  category: "accessibility" | "performance" | "design" | "seo";
  severity: "critical" | "warning" | "info";
  elementId?: string;
  finding: string;
  reason: string;
  recommendation: string;
  deterministic: boolean;
  measurement?: string;
}

/**
 * Parses hex (#fff, #ffffff), rgb(r, g, b), or rgba(r, g, b, a) into normalized [0, 1] RGB tuple.
 * Returns null if string cannot be parsed deterministically.
 */
function parseCssColor(colorStr: unknown): [number, number, number] | null {
  if (typeof colorStr !== "string") return null;
  const s = colorStr.trim().toLowerCase();

  // Hex color #rgb or #rrggbb
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16) / 255;
      const g = parseInt(hex[1] + hex[1], 16) / 255;
      const b = parseInt(hex[2] + hex[2], 16) / 255;
      return [r, g, b];
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      return [r, g, b];
    }
    return null;
  }

  // rgb(r, g, b)
  const rgbMatch = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s);
  if (rgbMatch) {
    const r = Math.min(255, parseInt(rgbMatch[1], 10)) / 255;
    const g = Math.min(255, parseInt(rgbMatch[2], 10)) / 255;
    const b = Math.min(255, parseInt(rgbMatch[3], 10)) / 255;
    return [r, g, b];
  }

  return null;
}

/**
 * Calculates WCAG 2.1 relative luminance:
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 * where each channel is converted from sRGB to linear.
 */
function calculateRelativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Computes WCAG 2.1 contrast ratio: (L1 + 0.05) / (L2 + 0.05)
 */
export function calculateContrastRatio(color1: [number, number, number], color2: [number, number, number]): number {
  const lum1 = calculateRelativeLuminance(color1);
  const lum2 = calculateRelativeLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Perform strictly deterministic AST inspection.
 */
export function auditDocumentAst(document: JsonObject, type: AnalysisType): { findings: AnalysisFinding[]; metrics: Record<string, any> } {
  const findings: AnalysisFinding[] = [];
  let maxDepth = 0;
  let totalNodes = 0;
  let headingCounts: Record<string, number> = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  let imageCount = 0;
  let animationCount = 0;
  let measuredContrastPairs = 0;

  const traverse = (nodes: unknown, currentDepth: number, parentBg?: [number, number, number]) => {
    if (!Array.isArray(nodes)) return;
    if (currentDepth > maxDepth) maxDepth = currentDepth;

    for (const node of nodes) {
      if (node && typeof node === "object") {
        totalNodes++;
        const n = node as any;
        const currentBg = parseCssColor(n.styles?.backgroundColor) || parentBg;

        // 1. Accessibility Checks
        if (type === "accessibility" || type === "all") {
          // Missing alt text
          if ((n.type === "image" || n.type === "img") && (!n.imageAlt && !n.alt)) {
            findings.push({
              category: "accessibility",
              severity: "warning",
              elementId: n.id,
              finding: "Image missing alternative text",
              reason: "Screen readers require alt text to convey image content to visually impaired users.",
              recommendation: "Add descriptive alt text describing the image subject and function.",
              deterministic: true,
              measurement: "alt: undefined",
            });
          }

          // Empty button
          if (n.type === "button" && (!n.content || String(n.content).trim() === "")) {
            findings.push({
              category: "accessibility",
              severity: "critical",
              elementId: n.id,
              finding: "Button element is empty without accessible label",
              reason: "Interactive buttons must announce an action to assistive technologies.",
              recommendation: "Provide text content or an aria-label for this button.",
              deterministic: true,
              measurement: "content: empty",
            });
          }

          // Heading hierarchy
          if (n.type === "heading" && n.headingLevel) {
            headingCounts[n.headingLevel] = (headingCounts[n.headingLevel] || 0) + 1;
          }

          // Real WCAG Contrast calculation
          const textColor = parseCssColor(n.styles?.color);
          if (textColor && currentBg) {
            measuredContrastPairs++;
            const ratio = calculateContrastRatio(textColor, currentBg);
            const fontSizePx = parseInt(n.styles?.fontSize, 10) || 16;
            const isBold = n.styles?.fontWeight === "bold" || parseInt(n.styles?.fontWeight, 10) >= 700;
            const isLargeText = fontSizePx >= 24 || (fontSizePx >= 18.66 && isBold);
            const minRequiredRatio = isLargeText ? 3.0 : 4.5;

            if (ratio < minRequiredRatio) {
              findings.push({
                category: "accessibility",
                severity: "warning",
                elementId: n.id,
                finding: `Low text contrast ratio (${ratio.toFixed(2)}:1)`,
                reason: `WCAG 2.1 AA requires at least ${minRequiredRatio}:1 contrast for ${isLargeText ? "large" : "normal"} text.`,
                recommendation: "Darken text color or lighten the background to improve readability.",
                deterministic: true,
                measurement: `${ratio.toFixed(2)}:1 (required ${minRequiredRatio}:1)`,
              });
            }
          }
        }

        // 2. Performance Checks
        if (type === "performance" || type === "all") {
          if (n.type === "image" || n.type === "img") imageCount++;
          if (n.motionConfig) animationCount++;
        }

        // 3. Design Checks
        if (type === "design" || type === "all") {
          if (n.styles && n.styles.fontSize && parseInt(n.styles.fontSize, 10) < 12) {
            findings.push({
              category: "design",
              severity: "warning",
              elementId: n.id,
              finding: "Typography font size smaller than 12px",
              reason: "Small fonts impair legibility across mobile and desktop devices.",
              recommendation: "Increase font size to at least 14px or 16px for body copy.",
              deterministic: true,
              measurement: `fontSize: ${n.styles.fontSize}`,
            });
          }
        }

        if (n.children) traverse(n.children, currentDepth + 1, currentBg);
      }
    }
  };

  if (Array.isArray(document.pages)) {
    for (const page of document.pages as any[]) {
      if (page.elements) traverse(page.elements, 1);
    }
  } else if (document.elements) {
    traverse(document.elements, 1);
  }

  // Heading structure audit
  if (type === "accessibility" || type === "all") {
    if (headingCounts.h1 === 0) {
      findings.push({
        category: "accessibility",
        severity: "warning",
        finding: "Page has no H1 heading",
        reason: "Every webpage requires a single top-level H1 for semantic structure and SEO.",
        recommendation: "Promote the main hero title to an H1 heading.",
        deterministic: true,
      });
    } else if (headingCounts.h1 > 1) {
      findings.push({
        category: "accessibility",
        severity: "info",
        finding: `Multiple H1 headings detected (${headingCounts.h1})`,
        reason: "Having more than one H1 can confuse document outline navigation for screen readers.",
        recommendation: "Keep one H1 for page topic and use H2-H4 for subsections.",
        deterministic: true,
      });
    }
  }

  // Performance depth & density audit
  if (type === "performance" || type === "all") {
    if (maxDepth > 10) {
      findings.push({
        category: "performance",
        severity: "warning",
        finding: `Deeply nested DOM structure (${maxDepth} levels)`,
        reason: "Excessive DOM depth increases layout reflow and paint calculation times.",
        recommendation: "Flatten container nesting where possible.",
        deterministic: true,
        measurement: `maxDepth: ${maxDepth}`,
      });
    }
    if (imageCount > 15) {
      findings.push({
        category: "performance",
        severity: "info",
        finding: `High image count (${imageCount} images)`,
        reason: "Many images require significant network transfer and GPU memory for decoding.",
        recommendation: "Ensure lazy loading is enabled for below-the-fold assets.",
        deterministic: true,
        measurement: `imageCount: ${imageCount}`,
      });
    }
    if (animationCount > 8) {
      findings.push({
        category: "performance",
        severity: "info",
        finding: `High quantity of motion triggers (${animationCount} animated elements)`,
        reason: "Simultaneous animations can drop frames on lower-end mobile devices.",
        recommendation: "Limit entrance animations to key above-the-fold elements.",
        deterministic: true,
        measurement: `animationCount: ${animationCount}`,
      });
    }
  }

  return {
    findings,
    metrics: {
      maxDepth,
      totalNodes,
      imageCount,
      animationCount,
      measuredContrastPairs,
      runtimeMeasurementStatus: "RUNTIME_MEASUREMENT_NOT_AVAILABLE",
    },
  };
}

export async function analyzeSite(input: AnalyzeSiteInput) {
  const website = await prisma.$transaction(async tx => {
    const scope = await authorizeWebsiteDocumentWrite(tx, input.websiteId, input.actorId);
    return scope.website;
  });

  const units = 1;
  const execution = await prisma.$transaction(async tx => {
    await reserveWorkspaceAiQuota(tx, { workspaceId: website.workspaceId, actorId: input.actorId, units });
    return tx.aiExecution.create({
      data: {
        websiteId: website.id,
        workspaceId: website.workspaceId,
        organizationId: website.organizationId,
        actorId: input.actorId,
        operation: input.type === "accessibility" ? "ACCESSIBILITY_ANALYSIS" : input.type === "performance" ? "PERFORMANCE_ANALYSIS" : "DESIGN_ANALYSIS",
        provider: "site-auditor",
        model: "deterministic-ast",
        reservedUnits: units,
        inputSummary: { type: input.type },
      },
    });
  });

  const currentDoc = documentObject(typeof website.editorData === "string" ? JSON.parse(website.editorData) : website.editorData);
  const { findings, metrics } = auditDocumentAst(currentDoc, input.type);

  // Optional qualitative AI recommendations (clearly separated from deterministic findings)
  const provider = siteGenerationProvider();
  const systemPrompt = `You are a web accessibility and design auditor.
Provide actionable qualitative suggestions based on the structural audit findings.
Do not invent numerical scores or claim runtime Core Web Vitals.
Return ONLY valid JSON:
{
  "qualitativeSummary": "executive overview of site quality",
  "recommendations": ["suggestion 1", "suggestion 2"]
}`;

  let qualitative: { qualitativeSummary: string; recommendations: string[] } = {
    qualitativeSummary: "Deterministic AST inspection complete. Review findings below.",
    recommendations: [],
  };

  try {
    const rawResult = await provider.generate({
      operation: input.type === "accessibility" ? "ACCESSIBILITY_ANALYSIS" : input.type === "performance" ? "PERFORMANCE_ANALYSIS" : "DESIGN_ANALYSIS",
      prompt: `Audit context for ${website.name}. Deterministic findings: ${findings.length}`,
      context: { findingsCount: findings.length },
      systemPrompt,
    });
    const cleaned = rawResult.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(cleaned);
    if (parsed.qualitativeSummary) qualitative.qualitativeSummary = parsed.qualitativeSummary;
    if (Array.isArray(parsed.recommendations)) qualitative.recommendations = parsed.recommendations;
  } catch {
    // Keep deterministic defaults
  }

  await prisma.$transaction(async tx => {
    await settleAiExecutionQuota(tx, execution.id, units, { findingsCount: findings.length, metrics });
  });

  return {
    type: input.type,
    deterministicMetrics: metrics,
    findings,
    qualitativeSummary: qualitative.qualitativeSummary,
    qualitativeRecommendations: qualitative.recommendations,
  };
}
