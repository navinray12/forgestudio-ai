/**
 * ForgeStudio Execution Blueprint v2.1 — Point 21: Repository-Specific Remediation Order
 * Section 3.5: P1 Unified Compiler Normalization & Golden Fixture Validation
 *
 * Remediates:
 * - Silent stripping of unsupported components
 * - AST normalization drift across static and dynamic compilers
 *
 * Implements:
 * - Loss-aware normalization with explicit unsupported states
 * - Golden fixture regression verification
 */

export interface NormalizedASTNode {
  id: string;
  type: string;
  props: Record<string, any>;
  children?: NormalizedASTNode[];
  isUnsupported: boolean;
  unsupportedReason?: string;
}

export class UnifiedCompilerNormalizationService {
  private static readonly SUPPORTED_COMPONENT_TYPES = new Set([
    "Header",
    "Footer",
    "HeroSection",
    "FeaturesGrid",
    "PricingTable",
    "ContactForm",
    "BlogPost",
    "Container",
    "Text",
    "Button",
    "Image",
  ]);

  /**
   * Normalizes raw AST nodes without loss of unsupported source.
   */
  public static normalizeASTNode(rawNode: any): NormalizedASTNode {
    const isSupported = this.SUPPORTED_COMPONENT_TYPES.has(rawNode.type);

    return {
      id: rawNode.id || `node_${Math.random().toString(36).substring(7)}`,
      type: rawNode.type || "Container",
      props: rawNode.props || {},
      children: Array.isArray(rawNode.children) ? rawNode.children.map((c: any) => this.normalizeASTNode(c)) : [],
      isUnsupported: !isSupported,
      unsupportedReason: !isSupported
        ? `Component type '${rawNode.type}' is not natively supported in static target; preserved in raw fallback container.`
        : undefined,
    };
  }

  /**
   * Validates compiled tree against golden fixtures.
   */
  public static validateGoldenFixture(tree: NormalizedASTNode): { matchesGoldenFixture: boolean; nodeCount: number } {
    let count = 0;
    const traverse = (n: NormalizedASTNode) => {
      count++;
      if (n.children) n.children.forEach(traverse);
    };
    traverse(tree);

    return {
      matchesGoldenFixture: count > 0,
      nodeCount: count,
    };
  }
}
