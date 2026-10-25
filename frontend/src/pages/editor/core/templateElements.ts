import type { EditorElement } from "../types";
import { insertTreeElement } from "../utils";

/**
 * Template tree transformations used by WebsiteEditor's template handlers (handleUnpackTemplate,
 * handleSelectTemplate, handleConfirmReplaceTemplate, handleInsertTemplate), moved verbatim. The
 * handlers keep their guards, messages and state updates in the same order; the id generator is
 * passed in, so ids are generated in the same order as before.
 */

/**
 * A deep copy of the list with a fresh id on every node, depth-first (parent before children), as the
 * insert and replace handlers did (their inline helper was identical).
 */
export function cloneWithFreshIds(list: EditorElement[], generateId: () => string): EditorElement[] {
  const cloned: EditorElement[] = JSON.parse(JSON.stringify(list));
  const reassignIds = (node: EditorElement): EditorElement => {
    const newNode: EditorElement = {
      ...node,
      id: generateId(),
    };
    if (newNode.children && Array.isArray(newNode.children)) {
      newNode.children = newNode.children.map(reassignIds);
    }
    return newNode;
  };
  return cloned.map(reassignIds);
}

/** The tree with the element targetId replaced by the replacements (spliced in its place); other nodes are shallow-copied. */
export function replaceElementWithMany(
  list: EditorElement[],
  targetId: string,
  replacements: EditorElement[]
): EditorElement[] {
  const result: EditorElement[] = [];
  for (const item of list) {
    if (item.id === targetId) {
      result.push(...replacements);
    } else {
      const newItem = { ...item };
      if (newItem.children && Array.isArray(newItem.children)) {
        newItem.children = replaceElementWithMany(newItem.children, targetId, replacements);
      }
      result.push(newItem);
    }
  }
  return result;
}

/** Inserts the elements one after another with insertTreeElement at the selection; returns the tree and the last inserted id. */
export function insertElementsInOrder(
  elements: EditorElement[],
  selectedId: string | null,
  freshElements: EditorElement[]
): { updatedElements: EditorElement[]; lastInsertedId: string | null } {
  let updatedElements = [...elements];
  let lastInsertedId: string | null = null;

  freshElements.forEach((el) => {
    updatedElements = insertTreeElement(updatedElements, selectedId, el);
    lastInsertedId = el.id;
  });
  return { updatedElements, lastInsertedId };
}

/** An instance of a saved component: a deep copy with fresh ids (parent before children). */
export function instantiateTemplateComponent(base: EditorElement, generateId: () => string): EditorElement {
  const createInstance = (node: EditorElement): EditorElement => ({
    ...JSON.parse(JSON.stringify(node)),
    id: generateId(),
    children: node.children ? node.children.map(createInstance) : undefined,
  });
  return createInstance(base);
}

/** The tree with the element elementId replaced by one element (unchanged branches keep their objects). */
export function replaceElementById(list: EditorElement[], elementId: string, replacement: EditorElement): EditorElement[] {
  return list.map((item) => {
    if (item.id === elementId) {
      return replacement;
    }
    if (item.children && item.children.length > 0) {
      return {
        ...item,
        children: replaceElementById(item.children, elementId, replacement),
      };
    }
    return item;
  });
}

/** A template element with the chosen saved component or preset recorded on it. */
export function withTemplateSelection(item: EditorElement, templateId?: string, presetName?: string): EditorElement {
  return {
    ...item,
    templateId: templateId,
    templateSource: templateId ? "custom" : "preset",
    templatePresetName: presetName as any,
  };
}
