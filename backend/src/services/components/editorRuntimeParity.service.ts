/**
 * Point 08: Shared Editor and Published Runtime Parity Service
 * 
 * Enforces rendering and behavioral fidelity between the visual editor canvas
 * and the published production website:
 * - Shared component interpretation and prop semantics
 * - Clean decoupling of editor overlays (selection, resize handles, node tags)
 * - Zero leakage of editor-only attributes or scripts into production output
 * - Automated parity verification comparing normalized editor output vs production output
 */

export interface RenderContext {
  mode: "EDITOR" | "PRODUCTION";
  nodeId: string;
  isSelected?: boolean;
  isHovered?: boolean;
  viewport?: "desktop" | "tablet" | "mobile";
}

export interface RenderedComponentOutput {
  html: string;
  css: string;
  editorAttributesStripped: boolean;
  mode: "EDITOR" | "PRODUCTION";
}

export class EditorRuntimeParityService {
  private static instance: EditorRuntimeParityService;

  // Editor-only attributes that must NEVER leak into production markup
  private static readonly EDITOR_ONLY_ATTRIBUTES = [
    /data-forge-node-id="[^"]*"/gi,
    /data-forge-selected="[^"]*"/gi,
    /data-forge-hover="[^"]*"/gi,
    /data-forge-editor-[a-zA-Z0-9_-]+="[^"]*"/gi,
    /class="[^"]*forge-editor-overlay[^"]*"/gi
  ];

  private constructor() {}

  public static getInstance(): EditorRuntimeParityService {
    if (!EditorRuntimeParityService.instance) {
      EditorRuntimeParityService.instance = new EditorRuntimeParityService();
    }
    return EditorRuntimeParityService.instance;
  }

  /**
   * Renders component markup for either editor canvas (with non-contaminating overlays)
   * or production release (with all editor artifacts strictly stripped).
   */
  public renderComponent(
    componentId: string,
    props: Record<string, unknown>,
    context: RenderContext
  ): RenderedComponentOutput {
    // 1. Shared core markup generation (identical logic across modes)
    const baseMarkup = this.generateCoreMarkup(componentId, props);

    if (context.mode === "EDITOR") {
      // Inject non-contaminating editor overlays and inspector attributes
      const editorMarkup = baseMarkup.replace(
        /^<([a-zA-Z0-9-]+)/,
        `<$1 data-forge-node-id="${context.nodeId}" data-forge-selected="${context.isSelected ? "true" : "false"}"`
      );

      return {
        html: editorMarkup,
        css: this.generateComponentCss(componentId, props),
        editorAttributesStripped: false,
        mode: "EDITOR"
      };
    }

    // 2. Production mode: strictly strip any editor attributes or overlays
    const productionHtml = this.sanitizeProductionMarkup(baseMarkup);

    return {
      html: productionHtml,
      css: this.generateComponentCss(componentId, props),
      editorAttributesStripped: true,
      mode: "PRODUCTION"
    };
  }

  /**
   * Strips all editor-only tags, attributes, and markers from visitor-facing markup.
   */
  public sanitizeProductionMarkup(rawHtml: string): string {
    let sanitized = rawHtml;
    for (const pattern of EditorRuntimeParityService.EDITOR_ONLY_ATTRIBUTES) {
      sanitized = sanitized.replace(pattern, "");
    }
    // Clean up empty attribute spaces
    return sanitized.replace(/\s{2,}/g, " ").replace(/\s>/g, ">");
  }

  /**
   * Verifies rendering and behavioral parity between editor canvas and production output.
   * Proves that stripped production markup matches the semantic core of the editor canvas.
   */
  public verifyParity(
    componentId: string,
    props: Record<string, unknown>
  ): { hasParity: boolean; discrepancies: string[] } {
    const editorOutput = this.renderComponent(componentId, props, {
      mode: "EDITOR",
      nodeId: "node-test-123",
      isSelected: true
    });

    const productionOutput = this.renderComponent(componentId, props, {
      mode: "PRODUCTION",
      nodeId: "node-test-123"
    });

    const discrepancies: string[] = [];

    // Verify production output contains zero editor artifacts
    for (const pattern of EditorRuntimeParityService.EDITOR_ONLY_ATTRIBUTES) {
      if (pattern.test(productionOutput.html)) {
        discrepancies.push(`Production markup leaked editor attribute matching ${pattern}`);
      }
    }

    // Verify normalized production output matches sanitized editor markup
    const sanitizedEditor = this.sanitizeProductionMarkup(editorOutput.html);
    if (sanitizedEditor !== productionOutput.html) {
      discrepancies.push(
        `Semantic disparity: Sanitized editor markup does not match production markup.\nEditor: ${sanitizedEditor}\nProd: ${productionOutput.html}`
      );
    }

    // Verify CSS is identical across both modes
    if (editorOutput.css !== productionOutput.css) {
      discrepancies.push("Style disparity: CSS generated for editor differs from production CSS.");
    }

    return {
      hasParity: discrepancies.length === 0,
      discrepancies
    };
  }

  private generateCoreMarkup(componentId: string, props: Record<string, unknown>): string {
    switch (componentId) {
      case "Button": {
        const label = props.label || "Click me";
        const variant = props.variant || "primary";
        const disabledAttr = props.disabled ? " disabled" : "";
        return `<button class="btn btn-${variant}"${disabledAttr}>${label}</button>`;
      }
      case "HeroSection": {
        const headline = props.headline || "";
        const subheadline = props.subheadline ? `<p class="hero-sub">${props.subheadline}</p>` : "";
        return `<section class="hero-section"><div class="hero-container"><h1>${headline}</h1>${subheadline}</div></section>`;
      }
      case "ContactForm": {
        const title = props.formTitle || "Contact Us";
        const submitText = props.submitButtonText || "Submit";
        return `<form class="contact-form"><h2>${title}</h2><input type="email" placeholder="Your Email" required /><button type="submit">${submitText}</button></form>`;
      }
      default:
        return `<div class="component-${componentId.toLowerCase()}"></div>`;
    }
  }

  private generateComponentCss(componentId: string, props: Record<string, unknown>): string {
    return `.component-${componentId.toLowerCase()} { box-sizing: border-box; }`;
  }
}

export const editorRuntimeParityService = EditorRuntimeParityService.getInstance();
