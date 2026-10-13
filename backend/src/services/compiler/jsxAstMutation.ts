/**
 * Visual-to-code mutations on TSX source (blueprint §31, WP-04/WP-18).
 *
 * The TypeScript AST locates the element; the change is then applied as a text edit limited to
 * that element, so imports, hooks, comments and every unrelated line stay byte-for-byte the same.
 * A mutation is accepted only when the result parses and the set of data-forge-id values is
 * exactly the one the mutation implies. Anything else is rejected with a code and the original
 * source is returned: `updated` is true only when the source actually changed.
 */
import { ts } from "./tsCompiler.js";
import { parseSyntax } from "./pageSourceSync.js";
import { escapeAttrValue, escapeJsxText, sanitizeHref } from "../generator/jsxRenderer.js";

export type JsxPropValue = string | number | boolean;

export interface NewJsxElement {
  tag: string;
  text?: string;
  classes?: string[];
  props?: Record<string, JsxPropValue>;
  style?: Record<string, string | number>;
}

export type JsxMutation =
  | { type: "SET_TEXT"; text: string }
  /** `value: null` removes the attribute. */
  | { type: "SET_PROP"; name: string; value: JsxPropValue | null }
  /** `classes` replaces the list; otherwise `add`/`remove` adjust it. */
  | { type: "SET_CLASSES"; classes?: string[]; add?: string[]; remove?: string[] }
  /** Merged into the inline style; a `null` value removes that property. */
  | { type: "SET_STYLE"; style: Record<string, string | number | null> }
  /** Adds a new element (the mutation's element ID) as a child of `parentId`. */
  | { type: "INSERT"; parentId: string; index?: number; element: NewJsxElement }
  | { type: "REMOVE" }
  /** Moves the element to `index` among its parent's element children. */
  | { type: "REORDER"; index: number }
  /** Moves the element under another parent. */
  | { type: "MOVE"; parentId: string; index?: number };

export type JsxMutationCode =
  | "TS_UNAVAILABLE"
  | "INVALID_SOURCE"
  | "INVALID_MUTATION"
  | "TARGET_NOT_FOUND"
  | "AMBIGUOUS_TARGET"
  | "SOURCE_OWNED"
  | "UNSUPPORTED"
  | "NO_CHANGE"
  | "INVALID_RESULT";

export interface JsxMutationResult {
  updated: boolean;
  /** The new source when `updated`, otherwise the source exactly as it was passed in. */
  content: string;
  code?: JsxMutationCode;
  diagnostic?: string;
  /** 1-based lines of the new content that differ from the original. */
  changedRange?: { startLine: number; endLine: number };
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

class Rejection extends Error {
  constructor(public readonly code: JsxMutationCode, message: string) {
    super(message);
  }
}

function reject(code: JsxMutationCode, message: string): never {
  throw new Rejection(code, message);
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,120}$/;
const PROP_NAME = /^[A-Za-z][A-Za-z0-9-]*$/;
const STYLE_KEY = /^[a-zA-Z][a-zA-Z0-9]*$/;
const CLASS_TOKEN = /^[^\s"'`{}<>\\]{1,200}$/;
const TAG_NAME = /^[a-z][a-z0-9]*$/;
const RESERVED_PROPS = new Set(["data-forge-id", "key", "ref", "style", "className", "class", "children", "dangerouslySetInnerHTML"]);
const URL_PROPS = new Set(["href", "src", "action", "formAction", "poster", "to"]);
const FORBIDDEN_TAGS = new Set(["script", "style", "iframe", "object", "embed", "link", "meta", "base", "html", "head", "body"]);
const VOID_TAGS = new Set(["img", "input", "br", "hr", "area", "col", "source", "track", "wbr"]);
const PROTECTED_REGION = /\/\/\s*\[forge-protect-start:\s*([\w-]+)\]([\s\S]*?)\/\/\s*\[forge-protect-end:\s*\1\]/g;

// ---------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------

const isElement = (node: any): boolean => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node);
const isContainer = (node: any): boolean => ts.isJsxElement(node) || ts.isJsxFragment(node);
const opening = (node: any): any => (ts.isJsxElement(node) ? node.openingElement : node);
const attributesOf = (node: any): any[] => [...opening(node).attributes.properties];

function attribute(node: any, name: string, sf: any): any | undefined {
  return attributesOf(node).find((attr) => ts.isJsxAttribute(attr) && attr.name.getText(sf) === name);
}

/** The literal a JSX attribute or style property holds, or undefined when it is computed. */
function literalOf(node: any): JsxPropValue | undefined {
  if (!node) return true; // bare attribute
  if (ts.isJsxExpression(node)) return node.expression ? literalOf(node.expression) : undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
    return -Number(node.operand.text);
  }
  return undefined;
}

function forgeIdsIn(root: any, sf: any): string[] {
  const ids: string[] = [];
  const visit = (node: any) => {
    if (isElement(node)) {
      const attr = attribute(node, "data-forge-id", sf);
      const value = attr ? literalOf(attr.initializer) : undefined;
      if (typeof value === "string") ids.push(value);
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return ids;
}

/** Finds the one element carrying the ID: by data-forge-id, else by a literal `id` attribute. */
function findTarget(sf: any, id: string, role = "Element"): any {
  const byForgeId: any[] = [];
  const byId: any[] = [];
  const visit = (node: any) => {
    if (isElement(node)) {
      const forge = attribute(node, "data-forge-id", sf);
      const plain = attribute(node, "id", sf);
      if (forge && literalOf(forge.initializer) === id) byForgeId.push(node);
      else if (plain && literalOf(plain.initializer) === id) byId.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  const matches = byForgeId.length > 0 ? byForgeId : byId;
  if (matches.length === 0) reject("TARGET_NOT_FOUND", `${role} with id '${id}' not found in AST`);
  if (matches.length > 1) {
    reject("AMBIGUOUS_TARGET", `${role} id '${id}' matches ${matches.length} elements; the edit target is ambiguous.`);
  }
  return matches[0];
}

const elementChildren = (parent: any): any[] =>
  parent.children.filter((child: any) => isElement(child) || ts.isJsxFragment(child));

/** Structural edits need a parent whose children are all written out as elements. */
function assertStaticChildren(parent: any, what: string): void {
  for (const child of parent.children) {
    if (ts.isJsxExpression(child) && child.expression) {
      reject("SOURCE_OWNED", `${what} has children produced by a source-owned code expression; their order is decided in code.`);
    }
    if (ts.isJsxText(child) && child.text.trim() !== "") {
      reject("UNSUPPORTED", `${what} mixes text with elements; child elements cannot be placed reliably.`);
    }
  }
}

function assertPlacedInJsx(node: any, id: string, action: string): any {
  const parent = node.parent;
  if (!parent || !isContainer(parent)) {
    const inExpression = (() => {
      for (let p = node.parent; p; p = p.parent) if (ts.isJsxExpression(p)) return true;
      return false;
    })();
    return inExpression
      ? reject("SOURCE_OWNED", `Element '${id}' is rendered by a source-owned code expression and cannot be ${action} visually.`)
      : reject("UNSUPPORTED", `Element '${id}' is the root element of its component and cannot be ${action}.`);
  }
  return parent;
}

// ---------------------------------------------------------------------------
// Rendering of new source fragments
// ---------------------------------------------------------------------------

function renderProp(name: string, value: JsxPropValue): string {
  if (!PROP_NAME.test(name)) reject("INVALID_MUTATION", `'${name}' is not a valid JSX attribute name.`);
  if (RESERVED_PROPS.has(name)) reject("UNSUPPORTED", `Attribute '${name}' cannot be set as a plain prop.`);
  if (/^on[A-Z]/.test(name)) reject("SOURCE_OWNED", `Event handler '${name}' is code-only logic and cannot be edited visually.`);
  if (typeof value === "string") {
    const isImageData = name === "src" && value.startsWith("data:image/");
    if (URL_PROPS.has(name) && !isImageData && sanitizeHref(value).blocked) {
      reject("INVALID_MUTATION", `The value of '${name}' uses an unsafe URL scheme.`);
    }
    return `${name}="${escapeAttrValue(value)}"`;
  }
  if (typeof value === "number" && Number.isFinite(value)) return `${name}={${value}}`;
  if (value === true) return name;
  if (value === false) return `${name}={false}`;
  return reject("INVALID_MUTATION", `The value of '${name}' must be a string, a finite number or a boolean.`);
}

function normalizeClasses(classes: unknown, label: string): string[] {
  if (!Array.isArray(classes)) return reject("INVALID_MUTATION", `${label} must be an array of class names.`);
  const out: string[] = [];
  for (const token of classes) {
    if (typeof token !== "string" || !CLASS_TOKEN.test(token)) {
      reject("INVALID_MUTATION", `'${String(token)}' is not a valid class name.`);
    }
    if (!out.includes(token)) out.push(token);
  }
  return out;
}

function renderStyleValue(key: string, value: unknown): string {
  if (!STYLE_KEY.test(key)) reject("INVALID_MUTATION", `'${key}' is not a valid camelCase style property.`);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.length <= 500 && !/[\r\n]/.test(value)) return JSON.stringify(value);
  return reject("INVALID_MUTATION", `The value of style property '${key}' must be a single-line string or a finite number.`);
}

function renderNewElement(id: string, element: NewJsxElement): string {
  if (!element || typeof element !== "object") reject("INVALID_MUTATION", "INSERT requires an element description.");
  const tag = String(element.tag ?? "");
  if (!TAG_NAME.test(tag) || FORBIDDEN_TAGS.has(tag)) reject("INVALID_MUTATION", `'${tag}' is not an insertable element tag.`);

  let attrs = "";
  const classes = element.classes ? normalizeClasses(element.classes, "classes") : [];
  if (classes.length > 0) attrs += ` className="${escapeAttrValue(classes.join(" "))}"`;
  const style = Object.entries(element.style ?? {});
  if (style.length > 0) attrs += ` style={{ ${style.map(([k, v]) => `${k}: ${renderStyleValue(k, v)}`).join(", ")} }}`;
  attrs += ` data-forge-id="${id}"`;
  for (const [name, value] of Object.entries(element.props ?? {})) attrs += ` ${renderProp(name, value)}`;

  const text = element.text === undefined ? "" : String(element.text);
  if (VOID_TAGS.has(tag)) {
    if (text) reject("INVALID_MUTATION", `<${tag}> cannot contain text.`);
    return `<${tag}${attrs} />`;
  }
  return `<${tag}${attrs}>${escapeJsxText(text)}</${tag}>`;
}

// ---------------------------------------------------------------------------
// Mutations (each returns the text edits it needs)
// ---------------------------------------------------------------------------

interface Context {
  source: string;
  sf: any;
  eol: string;
}

function setText(c: Context, node: any, id: string, text: unknown): Edit[] {
  if (typeof text !== "string") reject("INVALID_MUTATION", "SET_TEXT requires a string.");
  if (!ts.isJsxElement(node)) reject("UNSUPPORTED", `Element '${id}' is self-closing and has no text content.`);
  for (const child of node.children) {
    if (ts.isJsxExpression(child) && child.expression) {
      reject("SOURCE_OWNED", `Element '${id}' contains source-owned dynamic expressions; preserved without overwrite.`);
    }
    if (!ts.isJsxText(child)) {
      reject("UNSUPPORTED", `Element '${id}' contains child elements or comments; edit the text of the child element instead.`);
    }
  }
  const start = node.openingElement.end;
  const end = node.closingElement.getStart(c.sf);
  const inner = c.source.slice(start, end);
  const escaped = escapeJsxText(text as string);
  // Keep the surrounding line breaks and indentation of multi-line text as they are.
  const lead = inner.trim() ? inner.match(/^\s*/)![0] : "";
  const trail = inner.trim() ? inner.match(/\s*$/)![0] : "";
  return [{ start, end, text: escaped ? lead + escaped + trail : "" }];
}

/** Position and text for adding an attribute after the existing ones. */
function appendAttribute(node: any, rendered: string, first = false): Edit {
  const attrs = attributesOf(node);
  const pos = first || attrs.length === 0 ? opening(node).tagName.end : attrs[attrs.length - 1].end;
  if (opening(node).typeArguments) reject("UNSUPPORTED", "Elements with type arguments cannot receive new attributes visually.");
  return { start: pos, end: pos, text: ` ${rendered}` };
}

/** Removes an attribute together with the whitespace in front of it. */
function removeAttribute(c: Context, node: any, attr: any): Edit {
  const attrs = attributesOf(node);
  const index = attrs.indexOf(attr);
  const start = index > 0 ? attrs[index - 1].end : opening(node).tagName.end;
  return { start, end: attr.end, text: "" };
}

function setProp(c: Context, node: any, id: string, name: unknown, value: unknown): Edit[] {
  if (typeof name !== "string") reject("INVALID_MUTATION", "SET_PROP requires an attribute name.");
  const propName = name as string;
  const existing = attribute(node, propName, c.sf);
  // Validates the name even for a removal.
  const rendered = renderProp(propName, value === null ? "" : (value as JsxPropValue));
  if (existing && literalOf(existing.initializer) === undefined) {
    reject("SOURCE_OWNED", `Attribute '${propName}' of element '${id}' is a source-owned expression; preserved without overwrite.`);
  }
  if (value === null) return existing ? [removeAttribute(c, node, existing)] : [];
  if (!existing) return [appendAttribute(node, rendered)];
  if (literalOf(existing.initializer) === value) return [];
  return [{ start: existing.getStart(c.sf), end: existing.end, text: rendered }];
}

function setClasses(c: Context, node: any, id: string, mutation: { classes?: string[]; add?: string[]; remove?: string[] }): Edit[] {
  const existing = attribute(node, "className", c.sf) ?? attribute(node, "class", c.sf);
  const literal = existing ? literalOf(existing.initializer) : "";
  if (typeof literal !== "string") {
    return reject("SOURCE_OWNED", `The className of element '${id}' is computed in code; preserved without overwrite.`);
  }
  const current = literal.split(/\s+/).filter(Boolean);
  let next: string[];
  if (mutation.classes !== undefined) {
    next = normalizeClasses(mutation.classes, "classes");
  } else {
    if (mutation.add === undefined && mutation.remove === undefined) {
      reject("INVALID_MUTATION", "SET_CLASSES requires classes, add or remove.");
    }
    const add = normalizeClasses(mutation.add ?? [], "add");
    const remove = normalizeClasses(mutation.remove ?? [], "remove");
    next = current.filter((token) => !remove.includes(token));
    for (const token of add) if (!next.includes(token)) next.push(token);
  }
  if (next.join(" ") === current.join(" ")) return [];
  if (next.length === 0) return existing ? [removeAttribute(c, node, existing)] : [];
  const rendered = `className="${escapeAttrValue(next.join(" "))}"`;
  return existing
    ? [{ start: existing.getStart(c.sf), end: existing.end, text: rendered }]
    : [appendAttribute(node, rendered, true)];
}

function setStyle(c: Context, node: any, id: string, style: unknown): Edit[] {
  if (!style || typeof style !== "object" || Array.isArray(style)) reject("INVALID_MUTATION", "SET_STYLE requires a style object.");
  const changes = Object.entries(style as Record<string, unknown>);
  if (changes.length === 0) reject("INVALID_MUTATION", "SET_STYLE requires at least one style property.");
  for (const [key, value] of changes) if (value !== null) renderStyleValue(key, value);
  for (const [key] of changes) if (!STYLE_KEY.test(key)) reject("INVALID_MUTATION", `'${key}' is not a valid camelCase style property.`);

  const existing = attribute(node, "style", c.sf);
  const additions = changes.filter(([, value]) => value !== null);
  if (!existing) {
    if (additions.length === 0) return [];
    return [appendAttribute(node, `style={{ ${additions.map(([k, v]) => `${k}: ${renderStyleValue(k, v)}`).join(", ")} }}`)];
  }

  const owned = () => reject("SOURCE_OWNED", `The style of element '${id}' is computed in code; preserved without overwrite.`);
  let object = existing.initializer && ts.isJsxExpression(existing.initializer) ? existing.initializer.expression : undefined;
  if (object && ts.isCallExpression(object) && object.expression.getText(c.sf) === "css" && object.arguments.length === 1) {
    object = object.arguments[0];
  }
  if (!object || !ts.isObjectLiteralExpression(object)) return owned();

  const props = [...object.properties] as any[];
  const nameOf = (prop: any): string | undefined =>
    ts.isPropertyAssignment(prop) && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) ? prop.name.text : undefined;
  if (props.some((prop) => nameOf(prop) === undefined)) return owned();

  const edits: Edit[] = [];
  const removed = new Set<any>();
  const added: string[] = [];
  for (const [key, value] of changes) {
    const prop = props.find((p) => nameOf(p) === key);
    if (!prop) {
      if (value !== null) added.push(`${key}: ${renderStyleValue(key, value)}`);
      continue;
    }
    const current = literalOf(prop.initializer);
    if (current === undefined || typeof current === "boolean") {
      reject("SOURCE_OWNED", `Style property '${key}' of element '${id}' is a source-owned expression; preserved without overwrite.`);
    }
    if (value === null) removed.add(prop);
    else if (current !== value) edits.push({ start: prop.initializer.getStart(c.sf), end: prop.initializer.end, text: renderStyleValue(key, value) });
  }

  if (removed.size === 0 && added.length === 0) return edits;
  if (removed.size === props.length && added.length === 0) return [removeAttribute(c, node, existing)];

  // Properties are added or removed: rewrite the object literal, keeping each kept property's own text.
  const open = object.getStart(c.sf) + 1;
  const close = object.end - 1;
  const gaps = props.map((prop, i) => c.source.slice(i === 0 ? open : props[i - 1].end, prop.getStart(c.sf))).join("") +
    c.source.slice(props.length ? props[props.length - 1].end : open, close);
  if (/\/[/*]/.test(gaps)) reject("UNSUPPORTED", `The style object of element '${id}' contains comments; edit it in code.`);

  const valueEdits = new Map(edits.map((edit) => [edit.start, edit]));
  const kept = props
    .filter((prop) => !removed.has(prop))
    .map((prop) => {
      const edit = valueEdits.get(prop.initializer.getStart(c.sf));
      return edit ? c.source.slice(prop.getStart(c.sf), edit.start) + edit.text : prop.getText(c.sf);
    });
  const entries = [...kept, ...added];
  const body = c.source.slice(open, close);
  let text: string;
  if (body.includes("\n") && props.length > 0) {
    const indent = lineIndent(c.source, props[0].getStart(c.sf));
    const closeIndent = body.match(/\n([ \t]*)$/)?.[1] ?? "";
    const trailing = object.properties.hasTrailingComma ? "," : "";
    text = c.eol + entries.map((entry) => indent + entry).join("," + c.eol) + trailing + c.eol + closeIndent;
  } else {
    text = ` ${entries.join(", ")} `;
  }
  return [{ start: open, end: close, text }];
}

// --- structural placement ---------------------------------------------------

const lineStart = (source: string, pos: number): number => source.lastIndexOf("\n", pos - 1) + 1;
const lineIndent = (source: string, pos: number): string => source.slice(lineStart(source, pos), pos).match(/^[ \t]*/)![0];
const ownsLineStart = (source: string, pos: number): boolean => source.slice(lineStart(source, pos), pos).trim() === "";

function lineEnd(source: string, pos: number): number {
  const newline = source.indexOf("\n", pos);
  return newline === -1 ? source.length : newline + 1;
}

/** The element's own lines when it has them to itself, otherwise just the element. */
function removalRange(c: Context, node: any): Edit {
  const start = node.getStart(c.sf);
  const end = node.end;
  const alone = ownsLineStart(c.source, start) && c.source.slice(end, lineEnd(c.source, end)).trim() === "";
  return alone ? { start: lineStart(c.source, start), end: lineEnd(c.source, end), text: "" } : { start, end, text: "" };
}

function closingStart(c: Context, parent: any): number {
  return (ts.isJsxElement(parent) ? parent.closingElement : parent.closingFragment).getStart(c.sf);
}

/** Places `jsx` among `parent`'s element children, before `before` or at the end. */
function insertionEdit(c: Context, parent: any, siblings: any[], before: any | undefined, jsx: string): Edit {
  const parentIndent = lineIndent(c.source, parent.getStart(c.sf));
  const model = siblings.find((child) => ownsLineStart(c.source, child.getStart(c.sf)));
  const childIndent = model ? lineIndent(c.source, model.getStart(c.sf)) : parentIndent + "  ";

  if (before) {
    const start = before.getStart(c.sf);
    if (!ownsLineStart(c.source, start)) return { start, end: start, text: jsx };
    const pos = lineStart(c.source, start);
    return { start: pos, end: pos, text: childIndent + jsx + c.eol };
  }
  const close = closingStart(c, parent);
  if (ownsLineStart(c.source, close) && lineStart(c.source, close) > parent.getStart(c.sf)) {
    const pos = lineStart(c.source, close);
    return { start: pos, end: pos, text: childIndent + jsx + c.eol };
  }
  return { start: close, end: close, text: c.eol + childIndent + jsx + c.eol + parentIndent };
}

function resolveIndex(index: unknown, max: number): number {
  if (index === undefined) return max;
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > max) {
    return reject("INVALID_MUTATION", `index must be an integer between 0 and ${max}.`);
  }
  return index;
}

function requireParentElement(c: Context, parentId: unknown): any {
  if (typeof parentId !== "string" || !ID_PATTERN.test(parentId)) reject("INVALID_MUTATION", "parentId is required.");
  const parent = findTarget(c.sf, parentId as string, "Parent element");
  if (!ts.isJsxElement(parent)) reject("UNSUPPORTED", `Parent element '${parentId}' is self-closing and cannot hold children.`);
  assertStaticChildren(parent, `Parent element '${parentId}'`);
  return parent;
}

function insertElement(c: Context, id: string, mutation: { parentId: string; index?: number; element: NewJsxElement }): Edit[] {
  if (forgeIdsIn(c.sf, c.sf).includes(id)) {
    reject("INVALID_MUTATION", `An element with id '${id}' already exists; element identity must stay unique.`);
  }
  const jsx = renderNewElement(id, mutation.element);
  const parent = requireParentElement(c, mutation.parentId);
  const siblings = elementChildren(parent);
  const index = resolveIndex(mutation.index, siblings.length);
  return [insertionEdit(c, parent, siblings, siblings[index], jsx)];
}

function removeElement(c: Context, node: any, id: string): Edit[] {
  assertPlacedInJsx(node, id, "removed");
  const visit = (child: any) => {
    if (ts.isJsxExpression(child) && child.expression && isContainer(child.parent)) {
      reject("SOURCE_OWNED", `Element '${id}' contains source-owned dynamic expressions; remove it in code.`);
    }
    if (ts.isJsxSpreadAttribute(child) || (ts.isJsxAttribute(child) && /^on[A-Z]/.test(child.name.getText(c.sf)))) {
      reject("SOURCE_OWNED", `Element '${id}' carries source-owned handlers or spread props; remove it in code.`);
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return [removalRange(c, node)];
}

function moveElement(c: Context, node: any, id: string, newParent: any | undefined, index: unknown): Edit[] {
  const oldParent = assertPlacedInJsx(node, id, "moved");
  assertStaticChildren(oldParent, `The parent of element '${id}'`);
  const parent = newParent ?? oldParent;
  for (let p = parent; p; p = p.parent) {
    if (p === node) reject("INVALID_MUTATION", `Element '${id}' cannot be moved into itself or one of its descendants.`);
  }
  const siblings = elementChildren(parent).filter((child) => child !== node);
  const target = resolveIndex(index, siblings.length);
  if (parent === oldParent && elementChildren(oldParent).indexOf(node) === target) return [];

  const removal = removalRange(c, node);
  let jsx = c.source.slice(node.getStart(c.sf), node.end);
  const insertion = insertionEdit(c, parent, siblings, siblings[target], "\u0000");
  // Re-indent the continuation lines of a multi-line element to its new depth.
  const oldIndent = lineIndent(c.source, node.getStart(c.sf));
  const newIndent = insertion.text.match(/([ \t]*)\u0000/)![1];
  if (oldIndent !== newIndent && ownsLineStart(c.source, node.getStart(c.sf)) && !jsx.includes("`")) {
    jsx = jsx.split("\n").map((line, i) => (i > 0 && line.startsWith(oldIndent) ? newIndent + line.slice(oldIndent.length) : line)).join("\n");
  }
  insertion.text = insertion.text.replace("\u0000", () => jsx);
  if (insertion.start > removal.start && insertion.start < removal.end) {
    reject("UNSUPPORTED", `Element '${id}' cannot be moved to that position without rewriting surrounding code.`);
  }
  return [removal, insertion];
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function applyEdits(source: string, edits: Edit[]): string {
  const ordered = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].end > ordered[i - 1].start) reject("UNSUPPORTED", "The edit would rewrite overlapping source ranges.");
  }
  let out = source;
  for (const edit of ordered) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return out;
}

function changedLines(before: string, after: string): { startLine: number; endLine: number } {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  const lineOf = (pos: number) => after.slice(0, pos).split("\n").length;
  return { startLine: lineOf(prefix), endLine: lineOf(Math.max(prefix, after.length - suffix)) };
}

/**
 * Applies one visual mutation to TSX source. `elementId` is the data-forge-id of the element being
 * edited (for INSERT: of the element being created).
 */
export function applyJsxMutation(
  sourceCode: string,
  elementId: string,
  mutation: JsxMutation,
  fileName = "component.tsx"
): JsxMutationResult {
  const unchanged = (code: JsxMutationCode, diagnostic: string): JsxMutationResult => ({ updated: false, content: sourceCode, code, diagnostic });
  if (!ts) return unchanged("TS_UNAVAILABLE", "TypeScript compiler unavailable");
  if (typeof sourceCode !== "string") return unchanged("INVALID_SOURCE", "Source must be a string.");
  if (typeof elementId !== "string" || !ID_PATTERN.test(elementId)) return unchanged("INVALID_MUTATION", "A valid element id is required.");
  if (!mutation || typeof mutation !== "object") return unchanged("INVALID_MUTATION", "No mutation supplied.");

  try {
    const parsed = parseSyntax(sourceCode, fileName);
    if (!parsed.sourceFile || parsed.diagnostics.length > 0) {
      const first = parsed.diagnostics[0];
      return unchanged("INVALID_SOURCE", `Source has syntax errors and was left untouched: ${first?.message ?? "parse failure"}${first?.line ? ` (line ${first.line})` : ""}`);
    }
    const c: Context = { source: sourceCode, sf: parsed.sourceFile, eol: sourceCode.includes("\r\n") ? "\r\n" : "\n" };
    const idsBefore = forgeIdsIn(c.sf, c.sf);
    const expectedIds = [...idsBefore];

    let edits: Edit[];
    if (mutation.type === "INSERT") {
      edits = insertElement(c, elementId, mutation);
      expectedIds.push(elementId);
    } else {
      const node = findTarget(c.sf, elementId);
      switch (mutation.type) {
        case "SET_TEXT": edits = setText(c, node, elementId, mutation.text); break;
        case "SET_PROP": edits = setProp(c, node, elementId, mutation.name, mutation.value); break;
        case "SET_CLASSES": edits = setClasses(c, node, elementId, mutation); break;
        case "SET_STYLE": edits = setStyle(c, node, elementId, mutation.style); break;
        case "REMOVE":
          edits = removeElement(c, node, elementId);
          for (const id of forgeIdsIn(node, c.sf)) expectedIds.splice(expectedIds.indexOf(id), 1);
          break;
        case "REORDER": edits = moveElement(c, node, elementId, undefined, mutation.index ?? null); break;
        case "MOVE": edits = moveElement(c, node, elementId, requireParentElement(c, mutation.parentId), mutation.index); break;
        default:
          return unchanged("UNSUPPORTED", `Mutation type '${String((mutation as any).type)}' is not supported.`);
      }
    }

    for (const region of sourceCode.matchAll(PROTECTED_REGION)) {
      const start = region.index!;
      const end = start + region[0].length;
      if (edits.some((edit) => edit.start < end && edit.end > start)) {
        reject("SOURCE_OWNED", `The edit falls inside protected region '${region[1]}'; preserved without overwrite.`);
      }
    }

    const content = applyEdits(sourceCode, edits);
    if (content === sourceCode) return unchanged("NO_CHANGE", "The source already matches the requested edit.");

    const result = parseSyntax(content, fileName);
    if (!result.sourceFile || result.diagnostics.length > 0) {
      return unchanged("INVALID_RESULT", `The edit would produce invalid syntax and was not applied: ${result.diagnostics[0]?.message ?? "parse failure"}`);
    }
    const idsAfter = forgeIdsIn(result.sourceFile, result.sourceFile);
    if ([...idsAfter].sort().join("\n") !== [...expectedIds].sort().join("\n")) {
      return unchanged("INVALID_RESULT", "The edit would change element identities and was not applied.");
    }
    return { updated: true, content, changedRange: changedLines(sourceCode, content) };
  } catch (err: any) {
    if (err instanceof Rejection) return unchanged(err.code, err.message);
    return unchanged("INVALID_SOURCE", err?.message || "AST parse error");
  }
}
