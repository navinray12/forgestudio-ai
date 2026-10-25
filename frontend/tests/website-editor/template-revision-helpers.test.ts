/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * core/templateElements, core/revisionRestore and canvas/elementPresentation vs the inline code they
 * replaced in the editor. Each "inline" function below wraps the ORIGINAL source text of the block
 * (generated from it, verbatim) with recording setters; both sides get the same deterministic id
 * generator. Compared: values, key order, id order and the object references the inline code kept.
 */
import { cloneWithFreshIds, insertElementsInOrder, instantiateTemplateComponent, replaceElementById, replaceElementWithMany, withTemplateSelection } from "../../src/pages/editor/core/templateElements";
import { restoredRevisionState, revisionBaselineArgs } from "../../src/pages/editor/core/revisionRestore";
import { resolveCustomAttrProps } from "../../src/pages/editor/canvas/elementPresentation";
import { insertTreeElement, updateTreeElement } from "../../src/pages/editor/utils";

type El = any;
const ids = () => { let n = 0; return () => `id${n++}`; };
const tree = (): El[] => [
  { id: "a", type: "heading", content: "A", styles: { color: "red" } },
  { id: "box", type: "container", styles: {}, children: [{ id: "b", type: "text", content: "B", styles: {} }, { id: "c", type: "container", styles: {}, children: [{ id: "d", type: "image", styles: {} }] }] },
  { id: "e", type: "button", content: "E", styles: {} },
];
const template = (): El[] => [{ id: "t1", type: "container", styles: { padding: "1px" }, children: [{ id: "t2", type: "heading", content: "T", styles: {} }] }, { id: "t3", type: "text", content: "x", styles: {} }];
const same = (x: unknown, y: unknown) => expect(JSON.stringify(x)).toBe(JSON.stringify(y));

function inlineReplace(templateElements: El[], elements: El[], selectedId: string, generateId: () => string) {
  const cloneAndReassign = (list: EditorElement[]): EditorElement[] => {
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
  };

  const freshElements = cloneAndReassign(templateElements);

  const replaceTreeElement = (
    list: EditorElement[],
    targetId: string,
    replacements: EditorElement[]
  ): EditorElement[] => {
    const result: EditorElement[] = [];
    for (const item of list) {
      if (item.id === targetId) {
        result.push(...replacements);
      } else {
        const newItem = { ...item };
        if (newItem.children && Array.isArray(newItem.children)) {
          newItem.children = replaceTreeElement(newItem.children, targetId, replacements);
        }
        result.push(newItem);
      }
    }
    return result;
  };

  const updatedElements = replaceTreeElement(elements, selectedId, freshElements);
  return updatedElements;
}
function inlineInsert(templateElements: El[], elements: El[], selectedId: string | null, generateId: () => string) {
    const cloneAndReassign = (list: EditorElement[]): EditorElement[] => {
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
  };

  const freshElements = cloneAndReassign(templateElements);
  let updatedElements = [...elements];
  let lastInsertedId: string | null = null;

  freshElements.forEach((el) => {
    updatedElements = insertTreeElement(updatedElements, selectedId, el);
    lastInsertedId = el.id;
  });
  return { updatedElements, lastInsertedId };
}
function inlineInstance(components: Record<string, { element: El }>, el: El, generateId: () => string) {
  let unpackedElements: El = null;
    const comp = components[el.templateId];
    const createInstance = (base: EditorElement): EditorElement => ({
      ...JSON.parse(JSON.stringify(base)),
      id: generateId(),
      children: base.children ? base.children.map(createInstance) : undefined,
    });
    unpackedElements = createInstance(comp.element);
  return unpackedElements;
}
function inlineUnpackReplace(prev: El[], elementId: string, unpackedElements: El) {
  let result: El[] = prev;
  const setElements = (u: (p: El[]) => El[]) => { result = u(prev); };
  setElements((prev) => {
    const replaceInTree = (list: EditorElement[]): EditorElement[] => {
      return list.map((item) => {
        if (item.id === elementId) {
          return unpackedElements!;
        }
        if (item.children && item.children.length > 0) {
          return {
            ...item,
            children: replaceInTree(item.children),
          };
        }
        return item;
      });
    };
    return replaceInTree(prev);
  });
  return result;
}
function inlineSelect(prev: El[], elementId: string, templateId?: string, presetName?: string) {
  return (
      updateTreeElement(prev, elementId, (item) => ({
        ...item,
        templateId: templateId,
        templateSource: templateId ? "custom" : "preset",
        templatePresetName: presetName as any,
      }))
  );
}
function inlineRestoreState(restoredElements: El, restoredPageSettings: El, fullRestoredState: El) {
  const calls: Array<[string, El]> = [];
  const setElements = (v: El) => calls.push(["elements", v]), setPageSettings = (v: El) => calls.push(["pageSettings", v]), setPages = (v: El) => calls.push(["pages", v]), setSiteParts = (v: El) => calls.push(["siteParts", v]);
  if (Array.isArray(restoredElements)) {
    setElements(JSON.parse(JSON.stringify(restoredElements)));
  }
  if (restoredPageSettings) {
    setPageSettings(JSON.parse(JSON.stringify(restoredPageSettings)));
  }
  if (fullRestoredState?.pages && Array.isArray(fullRestoredState.pages)) {
    setPages(JSON.parse(JSON.stringify(fullRestoredState.pages)));
  }
  if (fullRestoredState?.siteParts) {
    setSiteParts(JSON.parse(JSON.stringify(fullRestoredState.siteParts)));
  }
  return calls;
}
function inlineBaseline(restoredElements: El, restoredPageSettings: El, fullRestoredState: El, cur: El) {
  const { pages, homePageId, siteParts, globalSettings, publishing, deployment, breakpoints, popups, pageCss } = cur;
  let args: El[] = [];
  const updateAutosaveBaseline = (...a: El[]) => { args = a; };
  updateAutosaveBaseline(
    restoredElements,
    restoredPageSettings,
    fullRestoredState?.pages || pages,
    fullRestoredState?.homePageId || homePageId,
    fullRestoredState?.siteParts || siteParts,
    fullRestoredState?.globalSettings || globalSettings,
    fullRestoredState?.globalStyles || globalSettings?.globalStyles,
    publishing,
    deployment,
    fullRestoredState?.breakpoints || breakpoints,
    fullRestoredState?.popups || popups,
    fullRestoredState?.pageCss || pageCss
  );
  return args;
}
function inlineCustomAttrs(el: El) {
  const customAttrs = Array.isArray(el.customAttributes) ? el.customAttributes : [];
  const customAttrProps = customAttrs.reduce((acc, curr) => {
    if (curr.name && curr.name.trim()) acc[curr.name.trim()] = curr.value || "";
    return acc;
  }, {} as any);
  return customAttrProps;
}

describe("template transformations equal the inline code", () => {
  it("replace: clone with fresh ids, splice into the selected element's place", () => {
    for (const target of ["a", "b", "d", "e", "missing"]) {
      const g1 = ids(), g2 = ids();
      const a = tree(), b = tree();
      same(replaceElementWithMany(a, target, cloneWithFreshIds(template(), g1)), inlineReplace(template(), b, target, g2));
    }
  });
  it("insert: clone with fresh ids and insert one by one at the selection", () => {
    for (const sel of [null, "a", "box", "c", "e"]) {
      const g1 = ids(), g2 = ids();
      const fresh = cloneWithFreshIds(template(), g1);
      same(insertElementsInOrder(tree(), sel, fresh), inlineInsert(template(), tree(), sel, g2));
    }
  });
  it("unpack: component instance with fresh ids, then replaced in place (unchanged branches keep their objects)", () => {
    const comp = { element: template()[0] };
    const g1 = ids(), g2 = ids();
    const inst = instantiateTemplateComponent(comp.element, g1);
    same(inst, inlineInstance({ c1: comp }, { templateId: "c1" }, g2));
    expect(Object.keys(inst)).toEqual(Object.keys(inlineInstance({ c1: comp }, { templateId: "c1" }, ids())));
    for (const target of ["a", "b", "d", "missing"]) {
      const prev = tree();
      const x = replaceElementById(prev, target, inst), y = inlineUnpackReplace(prev, target, inst);
      same(x, y);
      x.forEach((item, i) => expect(item === prev[i]).toBe(y[i] === prev[i]));
    }
  });
  it("select: records the saved component or preset", () => {
    for (const [tid, preset] of [["c1", undefined], [undefined, "hero"], [undefined, undefined]] as Array<[string | undefined, string | undefined]>) {
      const prev = tree();
      same(updateTreeElement(prev, "b", (item: El) => withTemplateSelection(item, tid, preset)), inlineSelect(prev, "b", tid, preset));
      expect(Object.keys(withTemplateSelection(prev[0], tid, preset))).toEqual(Object.keys(inlineSelect([prev[0]], "a", tid, preset)[0]));
    }
  });
});

describe("revision restore helpers equal the inline code", () => {
  const cases: Array<[El, El, El]> = [
    [tree(), { title: "T" }, undefined],
    [tree(), undefined, { pages: [{ id: "p" }], siteParts: { header: { enabled: true } }, homePageId: "p", pageCss: ".x{}" }],
    ["not an array", null, { pages: "nope", siteParts: null }],
    [[], { title: "" }, { globalSettings: { a: 1 }, globalStyles: { b: 2 }, breakpoints: [1], popups: [2] }],
  ];
  const cur = { pages: [{ id: "home" }], homePageId: "home", siteParts: { footer: {} }, globalSettings: { globalStyles: { c: 3 } }, publishing: { status: "DRAFT" }, deployment: { provider: "static" }, breakpoints: [], popups: [], pageCss: "" };
  it("restored state: the same pieces, deep-copied, in the same order", () => {
    for (const [els, ps, full] of cases) {
      const r = restoredRevisionState(els, ps, full);
      const fromHelper: Array<[string, El]> = [];
      if (r.elements !== undefined) fromHelper.push(["elements", r.elements]);
      if (r.pageSettings !== undefined) fromHelper.push(["pageSettings", r.pageSettings]);
      if (r.pages !== undefined) fromHelper.push(["pages", r.pages]);
      if (r.siteParts !== undefined) fromHelper.push(["siteParts", r.siteParts]);
      same(fromHelper, inlineRestoreState(els, ps, full));
      if (Array.isArray(els)) expect(r.elements).not.toBe(els); // deep copy
    }
  });
  it("baseline arguments: the same twelve values, same references", () => {
    for (const [els, ps, full] of cases) {
      const a = revisionBaselineArgs(els, ps, full, cur), b = inlineBaseline(els, ps, full, cur);
      expect(a).toHaveLength(12);
      a.forEach((v, i) => expect(v).toBe(b[i]));
    }
  });
});

describe("custom attribute props equal the inline code", () => {
  it("non-blank names, trimmed; value or empty string; later entries win", () => {
    for (const customAttributes of [undefined, [], [{ name: " data-x ", value: "1" }, { name: "", value: "no" }, { name: "  ", value: "no" }, { name: "aria-label", value: "" }, { name: "data-x", value: "2" }], "bad"]) {
      const el = { id: "z", type: "heading", styles: {}, customAttributes } as El;
      expect(resolveCustomAttrProps(el)).toEqual(inlineCustomAttrs(el));
    }
  });
});
