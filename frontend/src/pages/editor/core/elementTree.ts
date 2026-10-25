import type { EditorElement } from "../types";

/** Depth-first lookup by id. Unlike utils/findTreeElement it does not skip null items. Moved verbatim from WebsiteEditor.tsx, which imports it from here. */
export const findTreeElement = (tree: EditorElement[], targetId: string): EditorElement | null => {
  for (const item of tree) {
    if (item.id === targetId) return item;
    if (item.children && item.children.length > 0) {
      const found = findTreeElement(item.children, targetId);
      if (found) return found;
    }
  }
  return null;
};

/** Ids of every element in the tree, depth-first. Moved verbatim from WebsiteEditor.tsx, which imports it from here. */
export const getAllElementIds = (list: EditorElement[]): string[] => {
  let ids: string[] = [];
  for (const item of list) {
    ids.push(item.id);
    if (item.children && item.children.length > 0) {
      ids = ids.concat(getAllElementIds(item.children));
    }
  }
  return ids;
};

/** Navigator search over type, content, alt and id, with a " › " type path. Moved verbatim from WebsiteEditor.tsx, which imports it from here. */
export const flattenAndSearchElements = (
  nodes: EditorElement[],
  query: string,
  parentPath: string[] = []
): { element: EditorElement; path: string }[] => {
  let results: { element: EditorElement; path: string }[] = [];
  if (!Array.isArray(nodes)) return results;
  const q = query.toLowerCase().trim();

  for (const node of nodes) {
    if (!node || !node.id) continue;
    const nodeType = node.type || "container";
    const currentPath = [...parentPath, nodeType];
    const pathStr = currentPath.join(" › ");
    const matchesType = nodeType.toLowerCase().includes(q);
    const matchesContent = node.content?.toLowerCase().includes(q) ?? false;
    const matchesAlt = node.alt?.toLowerCase().includes(q) ?? false;
    const matchesId = node.id.toLowerCase().includes(q);

    if (matchesType || matchesContent || matchesAlt || matchesId) {
      results.push({ element: node, path: pathStr });
    }

    if (node.children && Array.isArray(node.children) && node.children.length > 0) {
      results = results.concat(flattenAndSearchElements(node.children, q, currentPath));
    }
  }

  return results;
};
