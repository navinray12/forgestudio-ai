/**
 * Code -> Visual reconciliation for a page source file.
 *
 * The saved TSX is parsed with the TypeScript compiler, compared element by
 * element against the source the generator produces for the current visual
 * document, and the differences are applied to the document. The result is
 * accepted only if regenerating the page from the updated document reproduces
 * the saved code (ignoring formatting); anything the visual document cannot
 * represent is reported and nothing is applied, so code is never dropped.
 *
 * This module is pure: it reads and writes no storage.
 */
import crypto from "node:crypto";
import { requireTs } from "./tsCompiler.js";
import {
  visualDocumentToIR,
  resolveElementText,
  resolveElementStyles,
  SEMANTIC_CONTAINER_TAGS,
} from "./unifiedCompiler.service.js";
import { buildReactGenerationPlan } from "../generator/reactGenerator.service.js";
import { buildNextJsGenerationPlan } from "../generator/nextjsGenerator.service.js";
import { splitStyles, UNITLESS } from "../generator/jsxRenderer.js";
import { stylesToTailwindClasses } from "../codeGenerator.service.js";
import {
  buildPageRegistry,
  documentPages,
  isRecognizedPageEntry,
  ProjectFramework,
  RegisteredPage,
  SINGLE_PAGE_KEY,
} from "./pageRegistry.js";

export interface SyncDiagnostic {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  elementId?: string;
  filePath?: string;
  line?: number;
  col?: number;
  suggestedAction?: string;
}

/** A JSX element reduced to what the visual document can express */
export interface JsxNode {
  tag: string;
  rawTag: string;
  forgeId?: string;
  classes: string[];
  style: Record<string, string>;
  attrs: Record<string, string>;
  text: string;
  children: JsxNode[];
  line: number;
  col: number;
}

export interface ParsedJsxSource {
  valid: boolean;
  root: JsxNode | null;
  /** Character range of the root JSX expression in the source */
  rootSpan: [number, number] | null;
  diagnostics: SyncDiagnostic[];
  sourceFile?: any;
}

interface ReadContext {
  sf: any;
  filePath: string;
  diagnostics: SyncDiagnostic[];
}

const INTRINSIC_TAG = /^[a-z][a-z0-9]*$/;
const IGNORED_ATTRIBUTES = new Set(["key", "rel", "controls", "width", "height"]);
const VALUE_ATTRIBUTES = new Set(["target", "src", "alt", "type", "placeholder", "aria-label", "role"]);
const HEADING_TAG = /^h[1-6]$/;
const NAV_TYPES = new Set(["nav-menu", "wp-menu", "menu-widget"]);
const PRESERVE_ACTION = "The file was saved unchanged and is kept as hand-written code; the visual document was not modified.";

export function sanitizeForgeId(id: unknown): string {
  return String(id ?? "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function unsupported(c: ReadContext, code: string, message: string, node: any) {
  const pos = c.sf.getLineAndCharacterOfPosition(node.getStart(c.sf));
  c.diagnostics.push({
    severity: "error",
    code,
    message,
    filePath: c.filePath,
    line: pos.line + 1,
    col: pos.character + 1,
    suggestedAction: PRESERVE_ACTION,
  });
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", copy: "©", reg: "®",
  mdash: "—", ndash: "–", hellip: "…", rarr: "→", larr: "←",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

/** Value of a JSX text node, following JSX whitespace rules */
function jsxTextValue(raw: string): string {
  const lines = raw.split(/\r\n|\n|\r/);
  const kept: string[] = [];
  lines.forEach((line, i) => {
    let value = line.replace(/\t/g, " ");
    if (i !== 0) value = value.replace(/^ +/, "");
    if (i !== lines.length - 1) value = value.replace(/ +$/, "");
    if (value) kept.push(value);
  });
  return decodeEntities(kept.join(" "));
}

function literalValue(node: any): string | number | boolean | undefined {
  const ts = requireTs();
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return -Number(node.operand.text);
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isParenthesizedExpression(node)) return literalValue(node.expression);
  return undefined;
}

export function normalizeStyleValue(prop: string, value: string | number): string {
  if (typeof value === "number") return UNITLESS.has(prop) ? String(value) : `${value}px`;
  return String(value).trim();
}

/** `{{ a: 1 }}` or `css({ a: 1 })` with literal values only */
function readStyleObject(expr: any, c: ReadContext): Record<string, string> | null {
  const ts = requireTs();
  let target = expr;
  if (ts.isCallExpression(target) && target.expression.getText(c.sf) === "css" && target.arguments.length === 1) {
    target = target.arguments[0];
  }
  if (!ts.isObjectLiteralExpression(target)) return null;
  const style: Record<string, string> = {};
  for (const prop of target.properties) {
    if (!ts.isPropertyAssignment(prop)) return null;
    const name = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null;
    const value = literalValue(prop.initializer);
    if (!name || (typeof value !== "string" && typeof value !== "number")) return null;
    style[name] = normalizeStyleValue(name, value);
  }
  return style;
}

function readChildren(children: readonly any[], out: JsxNode, c: ReadContext) {
  const ts = requireTs();
  const parts: string[] = [];
  let sawElement = false;

  const addText = (value: string, node: any) => {
    if (!value) return;
    if (sawElement && value.trim()) {
      unsupported(
        c,
        "UNSUPPORTED_MIXED_CONTENT",
        `Text after a child element inside <${out.rawTag}> cannot be represented visually. Wrap the text in its own element.`,
        node
      );
    }
    parts.push(value);
  };

  for (const child of children) {
    if (ts.isJsxText(child)) {
      addText(jsxTextValue(child.text ?? ""), child);
    } else if (ts.isJsxExpression(child)) {
      if (!child.expression) continue; // empty expression or comment
      const value = literalValue(child.expression);
      if (typeof value === "string" || typeof value === "number") {
        addText(String(value), child);
      } else {
        unsupported(
          c,
          "UNSUPPORTED_EXPRESSION",
          `Dynamic expression {${child.expression.getText(c.sf).replace(/\s+/g, " ").slice(0, 60)}} cannot be edited visually.`,
          child
        );
      }
    } else if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
      const tagName = (ts.isJsxElement(child) ? child.openingElement : child).tagName.getText(c.sf);
      if (tagName === "br") {
        parts.push("\n");
      } else {
        sawElement = true;
        out.children.push(readElement(child, c));
      }
    } else if (ts.isJsxFragment(child)) {
      unsupported(c, "UNSUPPORTED_FRAGMENT", "Nested fragments cannot be represented visually.", child);
    }
  }

  out.text = parts.join("").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").trim();
}

function readElement(node: any, c: ReadContext): JsxNode {
  const ts = requireTs();
  const isElement = ts.isJsxElement(node);
  const opening = isElement ? node.openingElement : node;
  const rawTag: string = opening.tagName.getText(c.sf);
  const pos = c.sf.getLineAndCharacterOfPosition(node.getStart(c.sf));

  let tag = rawTag;
  if (rawTag === "Link") tag = "a";
  else if (rawTag === "Image") tag = "img";
  else if (!INTRINSIC_TAG.test(rawTag)) {
    unsupported(
      c,
      "UNSUPPORTED_COMPONENT",
      `Component <${rawTag}> cannot be represented in the visual document.`,
      node
    );
  }

  const out: JsxNode = {
    tag,
    rawTag,
    classes: [],
    style: {},
    attrs: {},
    text: "",
    children: [],
    line: pos.line + 1,
    col: pos.character + 1,
  };

  for (const prop of opening.attributes.properties) {
    if (ts.isJsxSpreadAttribute(prop)) {
      unsupported(c, "UNSUPPORTED_SPREAD", `Spread attributes on <${rawTag}> cannot be represented visually.`, prop);
      continue;
    }
    const name: string = prop.name.getText(c.sf);
    if (IGNORED_ATTRIBUTES.has(name)) continue;

    const init = prop.initializer;
    const expr = init && ts.isJsxExpression(init) ? init.expression : undefined;
    const literal = !init ? true : ts.isStringLiteral(init) ? init.text : literalValue(expr);

    if (name === "style") {
      const style = expr ? readStyleObject(expr, c) : null;
      if (style) out.style = style;
      else unsupported(c, "UNSUPPORTED_DYNAMIC_STYLE", `The style of <${rawTag}> is computed and cannot be edited visually.`, prop);
      continue;
    }

    if (typeof literal !== "string" && typeof literal !== "number") {
      const isHandler = /^on[A-Z]/.test(name);
      unsupported(
        c,
        isHandler ? "UNSUPPORTED_EVENT_HANDLER" : "UNSUPPORTED_DYNAMIC_ATTRIBUTE",
        isHandler
          ? `Event handler ${name} on <${rawTag}> is code-only logic.`
          : `Attribute ${name} on <${rawTag}> is not a literal value and cannot be edited visually.`,
        prop
      );
      continue;
    }
    const value = String(literal);

    if (name === "className" || name === "class") out.classes = value.split(/\s+/).filter(Boolean);
    else if (name === "data-forge-id") out.forgeId = value;
    else if (name === "href" || name === "to") out.attrs.href = value;
    else if (VALUE_ATTRIBUTES.has(name)) out.attrs[name] = value;
    else {
      unsupported(
        c,
        "UNSUPPORTED_ATTRIBUTE",
        `Attribute ${name} on <${rawTag}> is not part of the visual document model.`,
        prop
      );
    }
  }

  if (isElement) readChildren(node.children, out, c);
  return out;
}

function unwrapParens(node: any): any {
  const ts = requireTs();
  let current = node;
  while (current && ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

/** The JSX a component returns (first in document order) */
export function findRootJsx(sourceFile: any): any {
  const ts = requireTs();
  const isJsx = (n: any) => n && (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n));
  let found: any = null;
  let fallback: any = null;

  const visit = (node: any) => {
    if (found) return;
    if (ts.isReturnStatement(node) && node.expression && isJsx(unwrapParens(node.expression))) {
      found = unwrapParens(node.expression);
      return;
    }
    if (ts.isArrowFunction(node) && isJsx(unwrapParens(node.body))) {
      found = unwrapParens(node.body);
      return;
    }
    if (!fallback && isJsx(node)) fallback = node;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found || fallback;
}

export function parseSyntax(source: string, filePath: string): { sourceFile?: any; diagnostics: SyncDiagnostic[] } {
  const diagnostics: SyncDiagnostic[] = [];
  try {
    const ts = requireTs();
    const sourceFile = ts.createSourceFile(
      filePath || "component.tsx",
      source,
      ts.ScriptTarget?.Latest ?? 99,
      true,
      ts.ScriptKind?.TSX ?? 4
    );
    for (const diag of (sourceFile as any).parseDiagnostics || []) {
      if (diag.category !== ts.DiagnosticCategory.Error) continue;
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(diag.start || 0);
      diagnostics.push({
        severity: "error",
        code: "TSX_SYNTAX_ERROR",
        message: ts.flattenDiagnosticMessageText(diag.messageText, "\n"),
        filePath,
        line: line + 1,
        col: character + 1,
        suggestedAction: "Fix syntax error in TypeScript/JSX file",
      });
    }
    return { sourceFile, diagnostics };
  } catch (err: any) {
    diagnostics.push({
      severity: "error",
      code: "AST_PARSE_FAILURE",
      message: err?.message || "Failed to parse TypeScript AST",
      filePath,
    });
    return { diagnostics };
  }
}

/** Parse a TSX module and read the JSX tree its component returns */
export function parseJsxSource(source: string, filePath: string): ParsedJsxSource {
  const ts = requireTs();
  const { sourceFile, diagnostics } = parseSyntax(source, filePath);
  if (!sourceFile || diagnostics.length > 0) return { valid: false, root: null, rootSpan: null, diagnostics, sourceFile };

  const rootNode = findRootJsx(sourceFile);
  if (!rootNode) {
    diagnostics.push({
      severity: "error",
      code: "NO_JSX_ROOT",
      message: "No JSX element or component return statement found in code.",
      filePath,
    });
    return { valid: true, root: null, rootSpan: null, diagnostics, sourceFile };
  }

  const c: ReadContext = { sf: sourceFile, filePath, diagnostics };
  let root: JsxNode;
  if (ts.isJsxFragment(rootNode)) {
    const pos = sourceFile.getLineAndCharacterOfPosition(rootNode.getStart(sourceFile));
    root = { tag: "#fragment", rawTag: "#fragment", classes: [], style: {}, attrs: {}, text: "", children: [], line: pos.line + 1, col: pos.character + 1 };
    readChildren(rootNode.children, root, c);
  } else {
    root = readElement(rootNode, c);
  }
  return { valid: true, root, rootSpan: [rootNode.getStart(sourceFile), rootNode.getEnd()], diagnostics, sourceFile };
}

// ---------------------------------------------------------------------------
// Normal form: what two JSX trees must agree on to be the same page
// ---------------------------------------------------------------------------

interface NormalNode {
  tag: string;
  id?: string;
  classes: string[];
  style: Record<string, string>;
  attrs: Record<string, string>;
  text: string;
  children: NormalNode[];
  line: number;
}

function tailwindFor(prop: string, value: string): string[] {
  return splitStyles({ [prop]: value }).classes;
}

function normalize(node: JsxNode): NormalNode {
  const classes = new Set(node.classes);
  const style: Record<string, string> = {};
  for (const [prop, value] of Object.entries(node.style)) {
    const tw = tailwindFor(prop, value);
    if (tw.length > 0) tw.forEach((cls) => classes.add(cls));
    else style[prop] = value;
  }

  const attrs: Record<string, string> = { ...node.attrs };
  if (attrs.target !== "_blank") delete attrs.target;
  if (node.tag === "button" && !attrs.type) attrs.type = "button";
  if (node.tag === "a" && !attrs.href) attrs.href = "#";
  if (node.tag === "img" && attrs.alt === undefined) attrs.alt = "";
  if (node.tag === "nav" && !attrs["aria-label"]) attrs["aria-label"] = "Main navigation";

  return {
    tag: node.tag,
    id: node.forgeId,
    classes: Array.from(classes).sort(),
    style,
    attrs,
    text: node.text.replace(/[ \t]+/g, " ").trim(),
    children: node.children.map(normalize),
    line: node.line,
  };
}

function describeRecord(a: Record<string, string>, b: Record<string, string>, label: string): string | null {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[key] !== b[key]) {
      return b[key] === undefined
        ? `${label} "${key}" is not supported there and would be dropped`
        : a[key] === undefined
        ? `${label} "${key}" would be added back as "${b[key]}"`
        : `${label} "${key}" would be regenerated as "${b[key]}" instead of "${a[key]}"`;
    }
  }
  return null;
}

/** First difference between the saved code and what the document would regenerate */
function compareNormal(code: NormalNode, regen: NormalNode): { line: number; message: string } | null {
  const at = (message: string) => ({ line: code.line, message: `<${code.tag}>: ${message}` });
  if (code.tag !== regen.tag) return at(`would be regenerated as <${regen.tag}>`);
  if (code.id && code.id !== regen.id) return at(`data-forge-id "${code.id}" does not match the visual element`);

  const extra = code.classes.find((cls) => !regen.classes.includes(cls));
  if (extra) return at(`class "${extra}" would be dropped`);
  const missing = regen.classes.find((cls) => !code.classes.includes(cls));
  if (missing) return at(`class "${missing}" is required by the element's visual settings and would be added back`);

  const styleDiff = describeRecord(code.style, regen.style, "style");
  if (styleDiff) return at(styleDiff);
  const attrDiff = describeRecord(code.attrs, regen.attrs, "attribute");
  if (attrDiff) return at(attrDiff);
  if (code.text !== regen.text) return at(`text would be regenerated as "${regen.text.slice(0, 60)}"`);

  if (code.children.length !== regen.children.length) {
    return at(
      code.children.length > regen.children.length
        ? "contains child elements the visual document cannot hold here"
        : "is missing child elements that the visual document generates here"
    );
  }
  for (let i = 0; i < code.children.length; i++) {
    const diff = compareNormal(code.children[i], regen.children[i]);
    if (diff) return diff;
  }
  return null;
}

// Imports the generators add or drop depending on what the page's JSX uses
const GENERATOR_MANAGED_IMPORTS = new Set([
  "react-router-dom",
  "next/link",
  "next/image",
  "../lib/forgeStyle",
  "@/lib/forgeStyle",
]);

/**
 * Tokens of a module with its root JSX expression removed (comments and
 * whitespace ignored). Imports that follow from the JSX are left out: whether
 * `Link` or `Image` is imported is decided by the markup, not by the author.
 */
function tokensOutsideJsx(source: string, span: [number, number] | null, sourceFile?: any): string[] {
  const ts = requireTs();
  const cuts: Array<[number, number, string]> = span ? [[span[0], span[1], "null"]] : [];
  for (const statement of sourceFile?.statements || []) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      GENERATOR_MANAGED_IMPORTS.has(statement.moduleSpecifier.text)
    ) {
      cuts.push([statement.getStart(sourceFile), statement.getEnd(), ""]);
    }
  }
  let text = source;
  for (const [start, end, replacement] of cuts.sort((a, b) => b[0] - a[0])) {
    text = `${text.slice(0, start)}${replacement}${text.slice(end)}`;
  }
  const scanner = ts.createScanner(ts.ScriptTarget?.Latest ?? 99, true, ts.LanguageVariant?.Standard ?? 0, text);
  const tokens: string[] = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
    const token = scanner.getTokenText();
    // Quote style is formatting, not content
    tokens.push(kind === ts.SyntaxKind.StringLiteral ? JSON.stringify(scanner.getTokenValue()) : token);
    if (tokens.length > 200_000) break;
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Applying code differences to visual elements
// ---------------------------------------------------------------------------

interface ApplyContext {
  existingById: Map<string, any>;
  generatedById: Map<string, JsxNode>;
  consumed: Set<string>;
  usedIds: Set<string>;
  routeToPageId: Map<string, string>;
  diagnostics: SyncDiagnostic[];
  filePath: string;
}

function newElementId(c: ApplyContext): string {
  for (;;) {
    const id = `el_${crypto.randomBytes(5).toString("hex")}`;
    if (!c.usedIds.has(id)) {
      c.usedIds.add(id);
      return id;
    }
  }
}

function childListKey(element: any): "children" | "elements" {
  if (Array.isArray(element?.children)) return "children";
  if (Array.isArray(element?.elements)) return "elements";
  return "children";
}

function childrenOf(element: any): any[] {
  const list = element?.[childListKey(element)];
  return Array.isArray(list) ? list.filter((el: any) => el && typeof el === "object") : [];
}

function isContainerType(element: any): boolean {
  const type = String(element?.type || "").toLowerCase();
  return type === "container" || type === "div-block";
}

/**
 * The Visual Editor edits `content`. The textContent/text aliases are only kept in step where an
 * element already has them: adding them here would shadow every later canvas edit, because the
 * generator prefers them over `content` (resolveElementText).
 */
function setText(element: any, text: string) {
  element.content = text;
  // A code edit establishes one canonical text value. Keep historic editor
  // documents that explicitly use textContent/text compatible, but do not
  // leave duplicate aliases that can mask a later canvas edit to content.
  if (["heading", "text", "paragraph", "blockquote"].includes(String(element.type).toLowerCase())) {
    delete element.textContent;
    delete element.text;
    return;
  }
  if ("textContent" in element) element.textContent = text;
  if ("text" in element) element.text = text;
  if (String(element.type).toLowerCase() === "button") {
    element.buttonText = text;
  }
}

const LAYOUT_STYLE_PROPS = new Set(["display", "flexDirection", "justifyContent", "alignItems", "flexWrap", "gap"]);

function layoutOwns(element: any, prop: string): boolean {
  return (
    isContainerType(element) &&
    element.layout &&
    typeof element.layout === "object" &&
    LAYOUT_STYLE_PROPS.has(prop) &&
    !(element.styles && prop in element.styles) &&
    !(element.responsiveStyles?.desktop && prop in element.responsiveStyles.desktop)
  );
}

function setStyleProp(element: any, prop: string, value: string) {
  if (element.responsiveStyles?.desktop && prop in element.responsiveStyles.desktop) {
    element.responsiveStyles = {
      ...element.responsiveStyles,
      desktop: { ...element.responsiveStyles.desktop, [prop]: value },
    };
    return;
  }
  if (layoutOwns(element, prop)) {
    const layout = { ...element.layout };
    let handled = true;
    if (prop === "flexDirection" && (value === "row" || value === "column")) layout.direction = value;
    else if (prop === "justifyContent" || prop === "alignItems") layout[prop] = value;
    else if (prop === "gap") layout.gap = /^\d+(\.\d+)?px$/.test(value) ? Number(value.slice(0, -2)) : value;
    else if (prop === "flexWrap" && value === "wrap") layout.wrap = true;
    else if (prop === "display" && (value === "flex" || value === "grid")) layout.display = value;
    else handled = false;
    if (handled) {
      element.layout = layout;
      return;
    }
  }
  element.styles = { ...(element.styles || {}), [prop]: value };
}

function removeStyleProp(element: any, prop: string) {
  if (element.responsiveStyles?.desktop && prop in element.responsiveStyles.desktop) {
    const desktop = { ...element.responsiveStyles.desktop };
    delete desktop[prop];
    element.responsiveStyles = { ...element.responsiveStyles, desktop };
  }
  if (element.styles && prop in element.styles) {
    const styles = { ...element.styles };
    delete styles[prop];
    element.styles = styles;
  }
  if (layoutOwns(element, prop)) {
    const layout = { ...element.layout };
    if (prop === "justifyContent" || prop === "alignItems" || prop === "gap") delete layout[prop];
    else if (prop === "flexWrap") delete layout.wrap;
    element.layout = layout;
  }
}

function applyHref(target: any, href: string | undefined, c: ApplyContext, urlField: "href" | "url") {
  const value = href ?? "";
  target[urlField] = value;
  if (urlField === "href" && typeof target.linkUrl === "string") target.linkUrl = value;
  const pageId = value ? c.routeToPageId.get(value) : undefined;
  if (pageId) {
    target.linkType = "page";
    target.pageId = pageId;
    if (urlField === "href") target.destinationType = "page";
  } else {
    if (target.linkType === "page") target.linkType = "url";
    if (target.destinationType === "page") target.destinationType = "url";
    delete target.pageId;
    delete target.linkPageId;
  }
}

function applyAttribute(element: any, name: string, value: string | undefined, c: ApplyContext) {
  if (name === "href") return applyHref(element, value, c, "href");
  if (name === "aria-label" || name === "role") {
    const attributes = { ...(element.attributes || {}) };
    if (value === undefined) delete attributes[name];
    else attributes[name] = value;
    element.attributes = attributes;
    return;
  }
  if (name === "type") {
    element.attributes = { ...(element.attributes || {}), type: value ?? "button" };
    return;
  }
  if (value === undefined) {
    if (name in element) element[name] = name === "target" ? "_self" : "";
    return;
  }
  element[name] = value;
}

function tagKind(tag: string): string {
  if (HEADING_TAG.test(tag)) return "heading";
  if (tag === "div" || SEMANTIC_CONTAINER_TAGS.has(tag)) return "container";
  if (tag === "a" || tag === "button") return "button";
  return tag;
}

function newElementFromNode(node: JsxNode, c: ApplyContext, forcedId?: string): any {
  const id = forcedId ?? newElementId(c);
  c.usedIds.add(id);
  const kids = () => node.children.map((child) => elementFromCodeNode(child, c));
  const base: any = { id };
  let element: any;

  if (HEADING_TAG.test(node.tag)) {
    element = { ...base, type: "heading", headingLevel: node.tag, content: node.text };
  } else if (node.tag === "p") {
    element = { ...base, type: "text", content: node.text };
  } else if (node.tag === "blockquote") {
    element = { ...base, type: "blockquote", content: node.text };
  } else if (node.tag === "button") {
    element = { ...base, type: "button", content: node.text, buttonText: node.text, href: "" };
  } else if (node.tag === "a") {
    element = { ...base, type: "button", content: node.text, buttonText: node.text };
    applyHref(element, node.attrs.href || "#", c, "href");
    if (!element.linkType) element.linkType = "url";
    if (node.attrs.target === "_blank") element.target = "_blank";
  } else if (node.tag === "img") {
    element = { ...base, type: "image", content: "Image", src: node.attrs.src || "", alt: node.attrs.alt || "" };
  } else if (node.tag === "video") {
    element = { ...base, type: "video", content: "Video", src: node.attrs.src || "" };
  } else if (node.tag === "hr") {
    element = { ...base, type: "divider", content: "Divider" };
  } else if (tagKind(node.tag) === "container") {
    element = { ...base, type: "container", content: "Container" };
    if (node.tag !== "div") element.htmlTag = node.tag;
    if (node.text) element.textContent = node.text;
    element.children = kids();
  } else {
    c.diagnostics.push({
      severity: "error",
      code: "UNSUPPORTED_TAG",
      message: `<${node.rawTag}> has no equivalent element in the Visual Editor.`,
      filePath: c.filePath,
      line: node.line,
      col: node.col,
      suggestedAction: PRESERVE_ACTION,
    });
    element = { ...base, type: "container", content: "Container", children: kids() };
  }

  element.styles = { ...node.style };
  if (node.classes.length > 0) element.classes = [...node.classes];
  if (!Array.isArray(element.children) && node.children.length > 0) element.children = kids();
  for (const name of ["aria-label", "role"]) {
    if (node.attrs[name] !== undefined) element.attributes = { ...(element.attributes || {}), [name]: node.attrs[name] };
  }
  return element;
}

/** Elements the generator emits no JSX for (e.g. an image without a source) stay where they were */
function keepUnrenderedSiblings(existingList: any[], reconciled: any[], c: ApplyContext): any[] {
  const out = [...reconciled];
  existingList.forEach((existing, index) => {
    if (!existing?.id || c.generatedById.has(sanitizeForgeId(existing.id))) return;
    let position = 0;
    for (let j = index - 1; j >= 0; j--) {
      const at = out.findIndex((el) => el.id === existingList[j]?.id);
      if (at >= 0) {
        position = at + 1;
        break;
      }
    }
    out.splice(position, 0, existing);
  });
  return out;
}

function reconcileList(existingList: any[], codeNodes: JsxNode[], c: ApplyContext): any[] {
  return keepUnrenderedSiblings(
    existingList,
    codeNodes.map((node) => elementFromCodeNode(node, c)),
    c
  );
}

function reconcileNavItems(existing: any, element: any, generated: JsxNode, code: JsxNode, c: ApplyContext): JsxNode[] {
  const listId = `${sanitizeForgeId(existing.id)}_list`;
  const itemPrefix = `${sanitizeForgeId(existing.id)}_item_`;
  const codeList = code.children.find((child) => child.forgeId === listId);
  const generatedList = generated.children.find((child) => child.forgeId === listId);
  const oldItems: any[] = Array.isArray(existing.navMenuItems) ? existing.navMenuItems : [];
  const usedItemIds = new Set(oldItems.map((item, idx) => String(item?.id ?? idx)));

  if (generatedList || codeList) {
    element.navMenuItems = (codeList?.children || []).map((anchor) => {
      const key = anchor.forgeId?.startsWith(itemPrefix) ? anchor.forgeId.slice(itemPrefix.length) : undefined;
      const old = key !== undefined ? oldItems.find((item, idx) => String(item?.id ?? idx) === key) : undefined;
      const before = generatedList?.children.find((child) => child.forgeId === anchor.forgeId);
      if (old && before) {
        const item = { ...old, label: anchor.text };
        if (anchor.attrs.href !== before.attrs.href) applyHref(item, anchor.attrs.href || "#", c, "url");
        if ((anchor.attrs.target === "_blank") !== (before.attrs.target === "_blank")) {
          if (anchor.attrs.target === "_blank") item.target = "_blank";
          else delete item.target;
        }
        return item;
      }
      let id = String(usedItemIds.size + 1);
      while (usedItemIds.has(id)) id = String(Number(id) + 1);
      usedItemIds.add(id);
      const item: any = { id, label: anchor.text };
      applyHref(item, anchor.attrs.href || "#", c, "url");
      if (anchor.attrs.target === "_blank") item.target = "_blank";
      return item;
    });
  }
  return code.children.filter((child) => child !== codeList);
}

function applyNodeToExisting(existing: any, generated: JsxNode, code: JsxNode, c: ApplyContext): any {
  const isNav = NAV_TYPES.has(String(existing.type || "").toLowerCase());

  if (code.tag !== generated.tag) {
    const sameKind = tagKind(code.tag) === tagKind(generated.tag);
    const containerOk = tagKind(code.tag) === "container" && isContainerType(existing);
    if (!sameKind || isNav || (tagKind(code.tag) === "container" && !containerOk)) {
      // A different kind of element took over this id: rebuild it from the code
      return newElementFromNode(code, c, existing.id);
    }
  }

  const element: any = { ...existing };

  if (code.tag !== generated.tag) {
    if (HEADING_TAG.test(code.tag)) element.headingLevel = code.tag;
    else if (tagKind(code.tag) === "container") {
      if (code.tag === "div") delete element.htmlTag;
      else element.htmlTag = code.tag;
    }
  }

  // Classes: a removed class is either the user's own or the Tailwind form of a style
  for (const cls of generated.classes.filter((name) => !code.classes.includes(name))) {
    if (Array.isArray(element.classes) && element.classes.includes(cls)) {
      element.classes = element.classes.filter((name: string) => name !== cls);
      continue;
    }
    for (const [prop, value] of Object.entries(resolveElementStyles(element))) {
      if (typeof value === "string" && stylesToTailwindClasses({ [prop]: value }).includes(cls)) {
        removeStyleProp(element, prop);
      }
    }
  }
  const addedClasses = code.classes.filter((name) => !generated.classes.includes(name));
  if (addedClasses.length > 0) element.classes = [...(Array.isArray(element.classes) ? element.classes : []), ...addedClasses];

  for (const prop of Object.keys(generated.style)) {
    if (!(prop in code.style)) removeStyleProp(element, prop);
  }
  for (const [prop, value] of Object.entries(code.style)) {
    if (generated.style[prop] !== value) setStyleProp(element, prop, value);
  }

  for (const name of new Set([...Object.keys(generated.attrs), ...Object.keys(code.attrs)])) {
    if (generated.attrs[name] !== code.attrs[name]) applyAttribute(element, name, code.attrs[name], c);
  }
  // <a> turned into a plain <button>: the link is gone
  if (generated.tag === "a" && code.tag === "button") applyHref(element, "", c, "href");

  if (generated.text !== code.text) setText(element, code.text);

  const codeChildren = isNav ? reconcileNavItems(existing, element, generated, code, c) : code.children;
  const existingChildren = childrenOf(existing);
  if (existingChildren.length > 0 || codeChildren.length > 0) {
    const key = childListKey(existing);
    element[key] = reconcileList(existingChildren, codeChildren, c);
    // The editor may mirror nested nodes under both keys
    if (key === "children" && Array.isArray(existing.elements)) element.elements = element.children;
  }
  return element;
}

function elementFromCodeNode(node: JsxNode, c: ApplyContext): any {
  const key = node.forgeId;
  if (key && !c.consumed.has(key)) {
    const existing = c.existingById.get(key);
    const generated = c.generatedById.get(key);
    if (existing && generated) {
      c.consumed.add(key);
      return applyNodeToExisting(existing, generated, node, c);
    }
  }
  const reusable = key && /^[A-Za-z0-9_-]+$/.test(key) && !c.usedIds.has(key) && !c.generatedById.has(key);
  return newElementFromNode(node, c, reusable ? key : undefined);
}

// ---------------------------------------------------------------------------
// Page-level reconciliation
// ---------------------------------------------------------------------------

export interface ProjectIdentity {
  id: string;
  name: string;
  slug: string;
}

export interface PageReconcileInput {
  source: string;
  filePath: string;
  editorData: any;
  framework: ProjectFramework;
  project: ProjectIdentity;
}

export type PageSyncStatus = "synced" | "unchanged" | "unsupported" | "invalid" | "not-a-page";

export interface PageReconcileResult {
  status: PageSyncStatus;
  diagnostics: SyncDiagnostic[];
  page?: RegisteredPage;
  /** The updated visual document (status "synced" only) */
  editorData?: any;
  changedElements: number;
}

function walkElements(list: any, visit: (element: any) => void) {
  if (!Array.isArray(list)) return;
  for (const element of list) {
    if (!element || typeof element !== "object") continue;
    visit(element);
    walkElements(element.children, visit);
    if (element.elements !== element.children) walkElements(element.elements, visit);
  }
}

function collectAllIds(editorData: any): Set<string> {
  const ids = new Set<string>();
  const add = (element: any) => {
    if (element.id) ids.add(String(element.id));
  };
  walkElements(editorData?.elements, add);
  for (const page of documentPages(editorData)) walkElements(page.elements ?? page.children, add);
  for (const part of Object.values(editorData?.siteParts || {})) walkElements((part as any)?.elements, add);
  for (const popup of Array.isArray(editorData?.popups) ? editorData.popups : []) walkElements(popup?.elements, add);
  return ids;
}

function sitePartElements(part: any): any[] {
  return part && part.enabled !== false && Array.isArray(part.elements)
    ? part.elements.filter((el: any) => el && typeof el === "object")
    : [];
}

function pageElementsOf(editorData: any, key: string): any[] {
  if (key === SINGLE_PAGE_KEY) {
    const list = Array.isArray(editorData?.elements) ? editorData.elements : editorData?.canvasData?.elements;
    return Array.isArray(list) ? list : [];
  }
  const page = documentPages(editorData).find((p) => String(p.id) === key);
  const list = Array.isArray(page?.elements) ? page.elements : page?.children;
  return Array.isArray(list) ? list : [];
}

function setPageElements(editorData: any, key: string, elements: any[]) {
  if (key === SINGLE_PAGE_KEY) {
    if (!Array.isArray(editorData.elements) && Array.isArray(editorData.canvasData?.elements)) {
      editorData.canvasData.elements = elements;
    } else {
      editorData.elements = elements;
    }
    return;
  }
  const page = documentPages(editorData).find((p) => String(p.id) === key);
  if (!page) return;
  const previous = Array.isArray(page.elements) ? page.elements : page.children;
  // The editor mirrors the page it last saved from at the top level
  if (Array.isArray(editorData.elements) && JSON.stringify(editorData.elements) === JSON.stringify(previous ?? [])) {
    editorData.elements = elements;
  }
  if (!Array.isArray(page.elements) && Array.isArray(page.children)) page.children = elements;
  else page.elements = elements;
}

function findNode(root: JsxNode | null, forgeId: string): JsxNode | null {
  if (!root) return null;
  if (root.forgeId === forgeId) return root;
  for (const child of root.children) {
    const found = findNode(child, forgeId);
    if (found) return found;
  }
  return null;
}

function indexNodes(root: JsxNode, into: Map<string, JsxNode>) {
  if (root.forgeId) into.set(root.forgeId, root);
  root.children.forEach((child) => indexNodes(child, into));
}

/** The page file the generator produces for `filePath` from a visual document, and its root element ID. */
export async function generatePageFile(
  editorData: any,
  framework: ProjectFramework,
  project: ProjectIdentity,
  filePath: string,
  savedSource: string,
  targetPage?: RegisteredPage
): Promise<{ content: string | null; rootId: string | null }> {
  const ir = visualDocumentToIR(editorData, { ...project, framework });
  // The saved file is passed as the existing file so its protected regions are merged in
  const existing = [
    { id: "saved", path: filePath, content: savedSource, contentHash: "", isGenerated: true, isProtected: false },
  ];
  if (targetPage && targetPage.filePath !== filePath) {
    existing.push({ id: "target", path: targetPage.filePath, content: savedSource, contentHash: "", isGenerated: true, isProtected: false });
  }
  const plan =
    framework === "nextjs"
      ? await buildNextJsGenerationPlan(ir, existing, { scope: { type: "full" } })
      : await buildReactGenerationPlan(ir, existing, { scope: { type: "full" } });
  const file = plan.files.find((f) => f.path === filePath || (targetPage && f.path === targetPage.filePath));
  const component = ir.components.find((c) => c.isPage && (c.filePath === filePath || (targetPage && c.filePath === targetPage.filePath)));
  return {
    content: file ? file.content : null,
    rootId: component ? sanitizeForgeId(component.rootElement.id) : null,
  };
}

function elementSnapshot(lists: any[][]): Map<string, string> {
  const snapshot = new Map<string, string>();
  for (const list of lists) {
    walkElements(list, (element) => {
      if (!element.id) return;
      const { children: _c, elements: _e, ...own } = element;
      snapshot.set(String(element.id), JSON.stringify(own));
    });
  }
  return snapshot;
}

function countChanges(before: any[][], after: any[][]): number {
  const a = elementSnapshot(before);
  const b = elementSnapshot(after);
  let count = 0;
  for (const [id, json] of b) if (a.get(id) !== json) count++;
  for (const id of a.keys()) if (!b.has(id)) count++;
  return count;
}

function fail(
  status: PageSyncStatus,
  diagnostics: SyncDiagnostic[],
  page?: RegisteredPage
): PageReconcileResult {
  return { status, diagnostics, page, changedElements: 0 };
}

/**
 * Reconcile a saved page source file into the visual document.
 * Returns the updated document only when the code is fully representable.
 */
export async function reconcilePageSource(input: PageReconcileInput): Promise<PageReconcileResult> {
  const { source, filePath, editorData, framework, project } = input;
  let page = buildPageRegistry(editorData, framework).find((p) => p.filePath === filePath);
  if (!page) {
    const recognized = isRecognizedPageEntry(filePath, framework);
    if (recognized && recognized.isPage) {
      page = buildPageRegistry(editorData, framework).find(
        (p) =>
          p.routePath.toLowerCase() === recognized.routePath.toLowerCase() ||
          p.name.toLowerCase() === recognized.pageName.toLowerCase() ||
          p.filePath === recognized.targetFilePath
      );
    }
  }
  if (!page) return fail("not-a-page", []);

  const parsed = parseJsxSource(source, filePath);
  if (!parsed.valid) return fail("invalid", parsed.diagnostics, page);
  const diagnostics = parsed.diagnostics;
  const stop = () => fail("unsupported", diagnostics, page);
  if (!parsed.root) return stop();

  // 1. What the generator produces for the document as it stands
  const before = await generatePageFile(editorData, framework, project, filePath, source, page);
  const generated = before.content !== null ? parseJsxSource(before.content, filePath) : null;
  const generatedSlot = generated && before.rootId ? findNode(generated.root, before.rootId) : null;
  if (!before.rootId || !generatedSlot) {
    diagnostics.push({
      severity: "error",
      code: "PAGE_NOT_GENERATED",
      message: `No generated source exists for page "${page.name}"; regenerate the project first.`,
      filePath,
    });
    return stop();
  }

  let codeSlot = findNode(parsed.root, before.rootId);
  if (!codeSlot) {
    if (parsed.root && parsed.root.tag !== "#fragment") {
      codeSlot = parsed.root;
    } else if (parsed.root && parsed.root.children.length === 1) {
      codeSlot = parsed.root.children[0];
    }
  }
  if (!codeSlot) {
    diagnostics.push({
      severity: "error",
      code: "PAGE_ROOT_MISSING",
      message: `The page root element (data-forge-id="${before.rootId}") was not found. Visual elements must stay inside it.`,
      filePath,
      line: parsed.root.line,
      suggestedAction: PRESERVE_ACTION,
    });
    return stop();
  }

  // 2. Split the page root's children into shared header, page body and shared footer
  const header = sitePartElements(editorData?.siteParts?.header);
  const footer = sitePartElements(editorData?.siteParts?.footer);
  const body = pageElementsOf(editorData, page.key).filter((el: any) => el && typeof el === "object");
  const headerIds = new Set(header.map((el) => sanitizeForgeId(el.id)));
  const footerIds = new Set(footer.map((el) => sanitizeForgeId(el.id)));

  let lastHeader = -1;
  let firstFooter = codeSlot.children.length;
  codeSlot.children.forEach((child, index) => {
    if (child.forgeId && headerIds.has(child.forgeId)) lastHeader = index;
  });
  for (let index = codeSlot.children.length - 1; index > lastHeader; index--) {
    const id = codeSlot.children[index].forgeId;
    if (id && footerIds.has(id)) firstFooter = index;
  }

  const existingById = new Map<string, any>();
  walkElements([...header, ...body, ...footer], (element) => {
    if (element.id) existingById.set(sanitizeForgeId(element.id), element);
  });
  const generatedById = new Map<string, JsxNode>();
  indexNodes(generatedSlot, generatedById);

  const routeToPageId = new Map<string, string>();
  for (const entry of buildPageRegistry(editorData, framework)) {
    if (entry.pageId) routeToPageId.set(entry.routePath, entry.pageId);
  }

  const c: ApplyContext = {
    existingById,
    generatedById,
    consumed: new Set(),
    usedIds: collectAllIds(editorData),
    routeToPageId,
    diagnostics,
    filePath,
  };

  const nextHeader = reconcileList(header, codeSlot.children.slice(0, lastHeader + 1), c);
  const nextBody = reconcileList(body, codeSlot.children.slice(lastHeader + 1, firstFooter), c);
  const nextFooter = reconcileList(footer, codeSlot.children.slice(firstFooter), c);

  // 3. Candidate document
  const candidate = JSON.parse(JSON.stringify(editorData ?? {}));
  if (JSON.stringify(nextBody) !== JSON.stringify(body)) setPageElements(candidate, page.key, nextBody);
  if (JSON.stringify(nextHeader) !== JSON.stringify(header)) {
    candidate.siteParts = { ...(candidate.siteParts || {}) };
    candidate.siteParts.header = { ...(candidate.siteParts.header || {}), elements: nextHeader };
    diagnostics.push({
      severity: "info",
      code: "SHARED_HEADER_UPDATED",
      message: "The header is shared by every page; this change applies to all pages.",
      filePath,
    });
  }
  if (JSON.stringify(nextFooter) !== JSON.stringify(footer)) {
    candidate.siteParts = { ...(candidate.siteParts || {}) };
    candidate.siteParts.footer = { ...(candidate.siteParts.footer || {}), elements: nextFooter };
    diagnostics.push({
      severity: "info",
      code: "SHARED_FOOTER_UPDATED",
      message: "The footer is shared by every page; this change applies to all pages.",
      filePath,
    });
  }

  // 4. Validation: regenerating from the candidate must reproduce the saved code
  if (!diagnostics.some((d) => d.severity === "error")) {
    const after = await generatePageFile(candidate, framework, project, filePath, source, page);
    const regenerated = after.content !== null ? parseJsxSource(after.content, filePath) : null;
    if (!regenerated?.root) {
      diagnostics.push({
        severity: "error",
        code: "ROUNDTRIP_FAILED",
        message: "The page could not be regenerated from the updated visual document.",
        filePath,
      });
    } else {
      const difference = compareNormal(normalize(parsed.root), normalize(regenerated.root));
      if (difference) {
        diagnostics.push({
          severity: "error",
          code: "UNSUPPORTED_ROUNDTRIP",
          message: `This edit cannot be represented in the visual document: ${difference.message}.`,
          filePath,
          line: difference.line,
          suggestedAction: PRESERVE_ACTION,
        });
      } else {
        const saved = tokensOutsideJsx(source, parsed.rootSpan, parsed.sourceFile);
        const canonical = tokensOutsideJsx(after.content as string, regenerated.rootSpan, regenerated.sourceFile);
        const at = saved.findIndex((token, index) => token !== canonical[index]);
        if (at >= 0 || saved.length !== canonical.length) {
          const token = at >= 0 ? saved[at] : canonical[saved.length];
          // An error, not a warning: otherwise the save reports "unchanged", the file is treated as
          // generated again, and the next regeneration silently discards this custom code.
          diagnostics.push({
            severity: "error",
            code: "CUSTOM_CODE_OUTSIDE_PROTECTED_REGION",
            message: `Code outside the page's JSX and its protected regions differs from the generated page (near "${String(token).slice(0, 40)}"). Move custom logic into a // [forge-protect-start: ...] region.`,
            filePath,
            suggestedAction: PRESERVE_ACTION,
          });
        }
      }
    }
  }

  if (diagnostics.some((d) => d.severity === "error")) return stop();

  if (JSON.stringify(candidate) === JSON.stringify(editorData ?? {})) {
    return { status: "unchanged", diagnostics, page, changedElements: 0 };
  }
  return {
    status: "synced",
    diagnostics,
    page,
    editorData: candidate,
    changedElements: Math.max(1, countChanges([header, body, footer], [nextHeader, nextBody, nextFooter])),
  };
}

/**
 * Convert a hand-written component file into visual elements so it can be
 * registered as a page. Fails with diagnostics when the file holds logic or
 * markup the visual document cannot represent.
 */
export function importPageElements(
  source: string,
  filePath: string,
  editorData: any,
  framework: ProjectFramework
): { ok: boolean; elements: any[]; diagnostics: SyncDiagnostic[] } {
  const ts = requireTs();
  const parsed = parseJsxSource(source, filePath);
  const diagnostics = parsed.diagnostics;
  if (!parsed.valid || !parsed.root) return { ok: false, elements: [], diagnostics };

  // Registering replaces the file with generated source, so it may hold nothing but one component
  let components = 0;
  for (const statement of parsed.sourceFile.statements) {
    if (ts.isImportDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue;
    if (ts.isExportAssignment(statement) || ts.isExportDeclaration(statement)) continue;
    let body: any = null;
    if (ts.isFunctionDeclaration(statement)) body = statement.body;
    else if (ts.isVariableStatement(statement) && statement.declarationList.declarations.length === 1) {
      const init = statement.declarationList.declarations[0].initializer;
      if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) body = init.body;
    }
    const simple =
      body &&
      (!ts.isBlock(body) || (body.statements.length === 1 && ts.isReturnStatement(body.statements[0])));
    if (!simple || ++components > 1) {
      const pos = parsed.sourceFile.getLineAndCharacterOfPosition(statement.getStart(parsed.sourceFile));
      diagnostics.push({
        severity: "error",
        code: "UNSUPPORTED_CUSTOM_LOGIC",
        message: "Only a single component that returns static JSX can be registered as a visual page.",
        filePath,
        line: pos.line + 1,
        suggestedAction: "Create the page with New Page and move custom logic into its protected region.",
      });
      break;
    }
  }

  const routeToPageId = new Map<string, string>();
  for (const entry of buildPageRegistry(editorData, framework)) {
    if (entry.pageId) routeToPageId.set(entry.routePath, entry.pageId);
  }
  const c: ApplyContext = {
    existingById: new Map(),
    generatedById: new Map(),
    consumed: new Set(),
    usedIds: collectAllIds(editorData),
    routeToPageId,
    diagnostics,
    filePath,
  };
  // Ids copied from another page must not collide with existing elements
  const strip = (node: JsxNode) => {
    if (node.forgeId && c.usedIds.has(node.forgeId)) node.forgeId = undefined;
    node.children.forEach(strip);
  };
  strip(parsed.root);

  const nodes = parsed.root.tag === "#fragment" ? parsed.root.children : [parsed.root];
  const elements = nodes.map((node) => elementFromCodeNode(node, c));
  return { ok: !diagnostics.some((d) => d.severity === "error"), elements, diagnostics };
}
