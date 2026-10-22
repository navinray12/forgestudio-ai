import ts from "typescript";

// Static evaluation of literal expressions and collection of top-level / props-default constants.
// Moved verbatim from codeImporter.ts (now a compatibility entry point that re-exports the public API).

/**
 * Evaluate an AST Expression node into JavaScript primitives, arrays, or objects
 */
export function evaluateExpression(node: ts.Node, scope: Map<string, any>): any {
  if (!node) return undefined;

  // String literals
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  // Numeric literals
  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }

  // Boolean & Null
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;

  // Unary expressions (e.g. -10)
  if (ts.isPrefixUnaryExpression(node)) {
    const operand = evaluateExpression(node.operand, scope);
    if (node.operator === ts.SyntaxKind.MinusToken && typeof operand === "number") {
      return -operand;
    }
    if (node.operator === ts.SyntaxKind.ExclamationToken) {
      return !operand;
    }
  }

  // Identifier lookup in scope
  if (ts.isIdentifier(node)) {
    if (scope.has(node.text)) {
      return scope.get(node.text);
    }
    return undefined;
  }

  // Array literals: [a, b, c]
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((el) => evaluateExpression(el, scope));
  }

  // Object literals: { key: value, ... }
  if (ts.isObjectLiteralExpression(node)) {
    const obj: Record<string, any> = {};
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        let key = "";
        if (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) {
          key = prop.name.text;
        }
        if (key) {
          obj[key] = evaluateExpression(prop.initializer, scope);
        }
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        const key = prop.name.text;
        obj[key] = scope.get(key);
      }
    }
    return obj;
  }

  // Parenthesized expression
  if (ts.isParenthesizedExpression(node)) {
    return evaluateExpression(node.expression, scope);
  }

  // Template string expression: `prefix ${val} suffix`
  if (ts.isTemplateExpression(node)) {
    let result = node.head.text;
    for (const span of node.templateSpans) {
      const val = evaluateExpression(span.expression, scope);
      result += (val !== undefined ? String(val) : "") + span.literal.text;
    }
    return result;
  }

  return undefined;
}

/**
 * Scan sourceFile to collect top-level const declarations and function parameter defaults into a scope map
 */
export function collectScopeVariables(sourceFile: ts.SourceFile): Map<string, any> {
  const scope = new Map<string, any>();

  function visit(node: ts.Node) {
    // Variable statements: const x = ...
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          const val = evaluateExpression(decl.initializer, scope);
          if (val !== undefined) {
            scope.set(decl.name.text, val);
          }
        }
      }
    }

    // Function parameter destructuring defaults: const { posts = [...], columns = 3 } = props;
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)) {
      for (const elem of node.name.elements) {
        if (ts.isIdentifier(elem.name) && elem.initializer) {
          const val = evaluateExpression(elem.initializer, scope);
          if (val !== undefined) {
            scope.set(elem.name.text, val);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return scope;
}
