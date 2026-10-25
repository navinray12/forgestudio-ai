import type { ContainerLayout, ElementStyles } from "../../types";
import { evaluateExpression } from "./expressionScope";
import ts from "typescript";

// JSX AST helpers: root element lookup, attributes, inline styles / layout and text content.
// Moved verbatim from codeImporter.ts (now a compatibility entry point that re-exports the public API).

/**
 * Locate the primary JSX Element or Fragment in the sourceFile
 */
export function findRootJsx(sourceFile: ts.SourceFile): ts.JsxElement | ts.JsxSelfClosingElement | null {
  let rootJsx: ts.JsxElement | ts.JsxSelfClosingElement | null = null;

  function visit(node: ts.Node) {
    if (rootJsx) return;

    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      rootJsx = node;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return rootJsx;
}

/**
 * Extract JSX attributes into an object mapping
 */
export function extractJsxAttributes(
  attributesNode: ts.JsxAttributes,
  scope: Map<string, any>
): Record<string, any> {
  const attrs: Record<string, any> = {};

  for (const prop of attributesNode.properties) {
    if (ts.isJsxAttribute(prop)) {
      const name = ts.isIdentifier(prop.name) ? prop.name.text : prop.name.getText();
      if (!prop.initializer) {
        // Boolean prop: <button disabled />
        attrs[name] = true;
      } else if (ts.isStringLiteral(prop.initializer)) {
        attrs[name] = prop.initializer.text;
      } else if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression) {
        attrs[name] = evaluateExpression(prop.initializer.expression, scope);
      }
    }
  }

  return attrs;
}

/**
 * Extract inline styles and separate layout properties
 */
export function extractStylesAndLayout(styleAttr: any): { styles: ElementStyles; layout?: ContainerLayout } {
  const styles: ElementStyles = {};
  const layout: ContainerLayout = {};

  if (!styleAttr || typeof styleAttr !== "object") {
    return { styles };
  }

  const layoutKeys = new Set(["display", "flexDirection", "justifyContent", "alignItems", "gap", "flexWrap"]);

  for (const [key, val] of Object.entries(styleAttr)) {
    if (val === undefined || val === null) continue;

    // Map layout properties
    if (key === "flexDirection" || key === "direction") {
      layout.direction = val === "row" ? "row" : "column";
    } else if (key === "justifyContent") {
      layout.justifyContent = val as any;
    } else if (key === "alignItems") {
      layout.alignItems = val as any;
    } else if (key === "gap") {
      layout.gap = typeof val === "number" ? val : parseInt(String(val), 10) || 0;
    }

    // Always preserve all styles in the ElementStyles dictionary
    styles[key] = typeof val === "number" && (key.includes("padding") || key.includes("margin") || key.includes("gap") || key.includes("size") || key.includes("width") || key.includes("height"))
      ? `${val}px`
      : String(val);
  }

  return { styles, layout: Object.keys(layout).length > 0 ? layout : undefined };
}

/**
 * Extract plain text content directly from JSX children
 */
export function extractTextContentFromChildren(node: ts.JsxElement | ts.JsxSelfClosingElement): string {
  if (!ts.isJsxElement(node)) return "";

  let text = "";
  for (const child of node.children) {
    if (ts.isJsxText(child)) {
      text += child.text;
    } else if (ts.isJsxExpression(child) && child.expression) {
      if (ts.isStringLiteral(child.expression) || ts.isNoSubstitutionTemplateLiteral(child.expression)) {
        text += child.expression.text;
      } else if (ts.isNumericLiteral(child.expression)) {
        text += child.expression.text;
      }
    }
  }

  return text.trim();
}
