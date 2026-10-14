/**
 * Plans the element-level source edits that carry a canvas change into a hand-written page file
 * (blueprint §31, WP-04/WP-18).
 *
 * A page whose source is a pure projection of the visual document is simply regenerated when the
 * document is saved. A page that holds hand-written code is held back from regeneration, so a
 * canvas change has to reach it as edits to individual elements. This planner does not edit
 * anything: it renders the page from the document as it was and as it is now with the project
 * generator, compares the two element trees, and returns the mutations that express the
 * difference. The caller applies them through the visual-to-code mutation endpoint, which
 * validates each one against the stored source.
 */
import { AppError } from "../../utils/app-error.js";
import { readFile } from "../project/forgeFilesystem.service.js";
import { heldCodePaths } from "../generator/sourcePreservation.service.js";
import { toProjectFramework, type ProjectFramework } from "./pageRegistry.js";
import { generatePageFile, parseJsxSource, type JsxNode } from "./pageSourceSync.js";
import type { JsxMutation, NewJsxElement } from "./jsxAstMutation.js";

export interface PlannedEdit {
  elementId: string;
  mutation: JsxMutation;
}

export interface PlannedNotice {
  elementId?: string;
  reason: string;
}

export interface PlannedFile {
  filePath: string;
  /** The stored file version the plan was made against; pass it as expectedRevision. */
  version: number;
  edits: PlannedEdit[];
  /** Canvas changes that cannot be expressed as element edits. */
  unsupported: PlannedNotice[];
}

export interface CanvasEditPlan {
  files: PlannedFile[];
  /** Requested paths that are not planned, with the reason. */
  skipped: Array<{ filePath: string; reason: string }>;
}

interface Placed {
  node: JsxNode;
  parent: string | null;
}

function indexTree(root: JsxNode): { nodes: Map<string, Placed>; kids: Map<string, string[]>; opaque: Set<string> } {
  const nodes = new Map<string, Placed>();
  const kids = new Map<string, string[]>();
  const opaque = new Set<string>();
  const walk = (node: JsxNode, parent: string | null) => {
    const id = node.forgeId!;
    nodes.set(id, { node, parent });
    kids.set(id, []);
    for (const child of node.children) {
      // A child without an ID (or with a repeated one) cannot be addressed: the parent's structure is opaque.
      if (!child.forgeId || nodes.has(child.forgeId)) {
        opaque.add(id);
        continue;
      }
      kids.get(id)!.push(child.forgeId);
      walk(child, id);
    }
  };
  walk(root, null);
  return { nodes, kids, opaque };
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((value, i) => value === b[i]);
const unaddressed = (node: JsxNode) => JSON.stringify(node.children.filter((child) => !child.forgeId).map(signature));
function signature(node: JsxNode): unknown {
  return [node.rawTag, node.classes, node.style, node.attrs, node.text, node.children.map(signature)];
}

/**
 * The mutations that turn the `before` element tree into the `after` one. Both trees start at the
 * page root element; elements are matched by data-forge-id.
 */
export function diffElementTrees(
  before: JsxNode,
  after: JsxNode,
  framework: ProjectFramework
): { edits: PlannedEdit[]; unsupported: PlannedNotice[] } {
  const edits: PlannedEdit[] = [];
  const unsupported: PlannedNotice[] = [];
  const b = indexTree(before);
  const a = indexTree(after);
  const propName = (node: JsxNode, name: string) => (name === "href" && node.rawTag === "Link" && framework !== "nextjs" ? "to" : name);

  // 1. Text, classes, style and attributes of elements present on both sides
  for (const [id, { node: next }] of a.nodes) {
    const previous = b.nodes.get(id)?.node;
    if (!previous) continue;
    if (previous.rawTag !== next.rawTag) {
      unsupported.push({ elementId: id, reason: `The element changed from <${previous.rawTag}> to <${next.rawTag}>; that needs the page to be regenerated.` });
      continue;
    }
    if (previous.text !== next.text) {
      if (previous.children.length === 0 && next.children.length === 0) edits.push({ elementId: id, mutation: { type: "SET_TEXT", text: next.text } });
      else unsupported.push({ elementId: id, reason: "The text of an element that also has child elements changed." });
    }
    const add = next.classes.filter((token) => !previous.classes.includes(token));
    const remove = previous.classes.filter((token) => !next.classes.includes(token));
    if (add.length || remove.length) edits.push({ elementId: id, mutation: { type: "SET_CLASSES", add, remove } });

    const style: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(next.style)) if (previous.style[key] !== value) style[key] = value;
    for (const key of Object.keys(previous.style)) if (!(key in next.style)) style[key] = null;
    if (Object.keys(style).length) edits.push({ elementId: id, mutation: { type: "SET_STYLE", style } });

    for (const name of new Set([...Object.keys(previous.attrs), ...Object.keys(next.attrs)])) {
      if (previous.attrs[name] === next.attrs[name]) continue;
      edits.push({ elementId: id, mutation: { type: "SET_PROP", name: propName(next, name), value: next.attrs[name] ?? null } });
    }
    if (unaddressed(previous) !== unaddressed(next)) {
      unsupported.push({ elementId: id, reason: "Content without an element ID changed inside this element." });
    }
  }

  // 2. Removed elements (the top-most one of a removed subtree)
  const removed = [...b.nodes.keys()].filter((id) => !a.nodes.has(id));
  const current = new Map([...b.kids].map(([id, list]) => [id, list.filter((child) => !removed.includes(child))]));
  for (const id of removed) {
    current.delete(id);
    const parent = b.nodes.get(id)!.parent;
    if (parent !== null && !removed.includes(parent)) edits.push({ elementId: id, mutation: { type: "REMOVE" } });
  }

  // 3. Inserted, reordered and re-parented elements, parents before their children
  const parentOf = new Map<string, string>();
  for (const [parent, list] of current) for (const child of list) parentOf.set(child, parent);
  const describe = (node: JsxNode): NewJsxElement => ({
    tag: node.rawTag,
    ...(node.children.length === 0 && node.text ? { text: node.text } : {}),
    ...(node.classes.length ? { classes: node.classes } : {}),
    ...(Object.keys(node.style).length ? { style: node.style } : {}),
    ...(Object.keys(node.attrs).length
      ? { props: Object.fromEntries(Object.entries(node.attrs).map(([name, value]) => [propName(node, name), value])) }
      : {}),
  });

  for (const [parent, desired] of a.kids) {
    const list = current.get(parent) ?? [];
    current.set(parent, list);
    if (a.opaque.has(parent) || b.opaque.has(parent)) {
      if (!sameList(list.filter((id) => desired.includes(id)), desired)) {
        unsupported.push({ elementId: parent, reason: "Children changed inside an element whose content is not fully addressable by element ID." });
      }
      continue;
    }
    desired.forEach((id, index) => {
      // An element in this slot that belongs under another parent is moved out first, so the
      // elements behind it do not need reordering around it.
      while (list[index] !== undefined && list[index] !== id) {
        const leaver = list[index];
        const target = a.nodes.get(leaver)?.parent;
        const targetList = target ? current.get(target) : undefined;
        if (!target || target === parent || !targetList || a.opaque.has(target) || b.opaque.has(target)) break;
        list.splice(index, 1);
        const position = Math.min(a.kids.get(target)!.indexOf(leaver), targetList.length);
        targetList.splice(position, 0, leaver);
        parentOf.set(leaver, target);
        edits.push({ elementId: leaver, mutation: { type: "MOVE", parentId: target, index: position } });
      }
      if (list[index] === id) return;
      if (!b.nodes.has(id)) {
        const node = a.nodes.get(id)!.node;
        if (!/^[a-z][a-z0-9]*$/.test(node.rawTag)) {
          unsupported.push({ elementId: id, reason: `A new <${node.rawTag}> component needs the page to be regenerated.` });
          return;
        }
        edits.push({ elementId: id, mutation: { type: "INSERT", parentId: parent, index: Math.min(index, list.length), element: describe(node) } });
        list.splice(Math.min(index, list.length), 0, id);
        return;
      }
      const from = parentOf.get(id);
      if (from !== undefined) {
        const source = current.get(from)!;
        source.splice(source.indexOf(id), 1);
      }
      const position = Math.min(index, list.length);
      list.splice(position, 0, id);
      parentOf.set(id, parent);
      edits.push({ elementId: id, mutation: from === parent ? { type: "REORDER", index: position } : { type: "MOVE", parentId: parent, index: position } });
    });
  }

  return { edits, unsupported };
}

function pageRoot(source: string | null, rootId: string | null, filePath: string): JsxNode | null {
  if (!source || !rootId) return null;
  const parsed = parseJsxSource(source, filePath);
  const find = (node: JsxNode | null): JsxNode | null => {
    if (!node) return null;
    if (node.forgeId === rootId) return node;
    for (const child of node.children) {
      const found = find(child);
      if (found) return found;
    }
    return null;
  };
  return find(parsed.root);
}

/**
 * Plans the source edits for the hand-written (held) pages of a project, given the visual
 * document before and after a canvas change. Pages that are regenerated from the document are
 * not planned: regeneration already carries the change.
 */
export async function planCanvasEdits(
  project: { id: string; name: string; slug: string; framework?: unknown; metadata?: unknown },
  before: unknown,
  after: unknown,
  paths?: string[]
): Promise<CanvasEditPlan> {
  if (!before || typeof before !== "object" || !after || typeof after !== "object") {
    throw new AppError("before and after visual documents are required", 400, "MISSING_DOCUMENTS");
  }
  const framework = toProjectFramework(project.framework);
  const identity = { id: project.id, name: project.name, slug: project.slug };
  const held = heldCodePaths(project.metadata);
  const plan: CanvasEditPlan = { files: [], skipped: [] };

  for (const filePath of paths ?? [...held]) {
    if (!held.has(filePath)) {
      plan.skipped.push({ filePath, reason: "This page is regenerated from the visual document; no element edits are needed." });
      continue;
    }
    const file = await readFile(project.id, filePath);
    const [was, now] = await Promise.all([
      generatePageFile(before, framework, identity, filePath, ""),
      generatePageFile(after, framework, identity, filePath, ""),
    ]);
    const previous = pageRoot(was.content, was.rootId, filePath);
    const next = pageRoot(now.content, now.rootId, filePath);
    if (!previous || !next) {
      plan.files.push({
        filePath,
        version: file.version,
        edits: [],
        unsupported: [{ reason: !next ? "The visual document no longer produces this page." : "This page did not exist in the previous visual document." }],
      });
      continue;
    }
    plan.files.push({ filePath, version: file.version, ...diffElementTrees(previous, next, framework) });
  }
  return plan;
}
