/**
 * Runs the helper input matrix against an implementation. The golden was produced by running this
 * against the helpers exactly as they were declared inside WebsiteEditor (before extraction).
 */
import { attempt } from "./editor-golden-encode";
import { API_URLS, BACKGROUND_STYLES, FIND_TARGETS, POSITION_STYLES, SEARCH_QUERIES, TREES, VIDEO_URLS } from "./editor-helpers.fixtures";

export interface HelperImpl {
  findTreeElement: (tree: any, targetId: any) => any;
  getAllElementIds: (list: any) => any;
  flattenAndSearchElements: (nodes: any, query: any, parentPath?: any) => any;
  getYouTubeId: (url: any) => any;
  getVimeoId: (url: any) => any;
  backgroundCompilerFor: (apiUrl: string) => (mergedStyles: any) => any;
  compilePositioningStyles: (mergedStyles: any) => any;
}

/** Every node object reachable in the input, so results can be checked for reference identity. */
function nodesOf(tree: unknown, seen = new Set<unknown>()) {
  if (Array.isArray(tree)) for (const n of tree) {
    if (n && typeof n === "object") { seen.add(n); nodesOf((n as { children?: unknown }).children, seen); }
  }
  return seen;
}

export function computeHelpers(impl: HelperImpl) {
  const out: Record<string, unknown> = {};
  for (const [label, make] of TREES) {
    for (const target of FIND_TARGETS) {
      const tree = make();
      const nodes = nodesOf(tree);
      out[`findTreeElement ${label} ${JSON.stringify(target)}`] = attempt(() => {
        const found = impl.findTreeElement(tree, target);
        return { found, fromInput: found === null ? null : nodes.has(found) };
      });
    }
    out[`getAllElementIds ${label}`] = attempt(() => impl.getAllElementIds(make()));
    for (const query of SEARCH_QUERIES) {
      const tree = make();
      const nodes = nodesOf(tree);
      out[`flattenAndSearchElements ${label} ${JSON.stringify(query)}`] = attempt(() =>
        impl.flattenAndSearchElements(tree, query).map((r: { element: unknown; path: string }) => ({ id: (r.element as { id?: unknown })?.id, path: r.path, fromInput: nodes.has(r.element), keys: Object.keys(r) })));
    }
  }
  out["flattenAndSearchElements explicit parentPath"] = attempt(() => impl.flattenAndSearchElements(TREES[1][1](), "deep", ["page", "section"]).map((r: { path: string }) => r.path));
  for (const url of VIDEO_URLS) {
    out[`getYouTubeId ${JSON.stringify(url) ?? "undefined"}`] = attempt(() => impl.getYouTubeId(url));
    out[`getVimeoId ${JSON.stringify(url) ?? "undefined"}`] = attempt(() => impl.getVimeoId(url));
  }
  for (const apiUrl of API_URLS) {
    const compile = impl.backgroundCompilerFor(apiUrl);
    BACKGROUND_STYLES.forEach((styles, i) => { out[`compileBackgroundAndBorderStyles ${apiUrl} #${i}`] = attempt(() => compile(styles)); });
    out[`compileBackgroundAndBorderStyles ${apiUrl} null`] = attempt(() => compile(null));
  }
  POSITION_STYLES.forEach((styles, i) => { out[`compilePositioningStyles #${i}`] = attempt(() => impl.compilePositioningStyles(styles)); });
  out["compilePositioningStyles undefined"] = attempt(() => impl.compilePositioningStyles(undefined));
  return out;
}
