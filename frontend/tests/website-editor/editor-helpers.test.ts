/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * The helpers moved out of WebsiteEditor (core/elementTree, core/videoEmbed, core/styleCompilers)
 * must reproduce editor-helpers.golden.json, which was recorded from the same code while it was still
 * declared inside the component: return values, reference identity and thrown errors.
 */
import golden from "./editor-helpers.golden.json";
import { computeHelpers } from "./editor-helpers.compute";
import { findTreeElement, getAllElementIds, flattenAndSearchElements } from "../../src/pages/editor/core/elementTree";
import { getYouTubeId, getVimeoId } from "../../src/pages/editor/core/videoEmbed";
import { createBackgroundAndBorderStylesCompiler, compilePositioningStyles } from "../../src/pages/editor/core/styleCompilers";
import { findTreeElement as utilsFindTreeElement } from "../../src/pages/editor/utils";
import { makeTree } from "./editor-helpers.fixtures";

const impl = {
  findTreeElement, getAllElementIds, flattenAndSearchElements, getYouTubeId, getVimeoId,
  backgroundCompilerFor: createBackgroundAndBorderStylesCompiler, compilePositioningStyles,
};

describe("extracted WebsiteEditor helpers", () => {
  it("match the golden recorded from the in-component originals", () => {
    expect(computeHelpers(impl)).toEqual(golden);
  });

  it("findTreeElement returns the first depth-first match by reference and throws on null items", () => {
    const tree = makeTree();
    expect(findTreeElement(tree, "childA")).toBe(tree[0].children[0]);
    expect(findTreeElement(tree, "deep2")).toBe(tree[0].children[1].children[1]);
    expect(findTreeElement(tree, "missing")).toBeNull();
    expect(() => findTreeElement([null as any], "x")).toThrow(TypeError);
  });

  it("is deliberately not the null-tolerant utils/findTreeElement (the editor always used its own)", () => {
    expect(utilsFindTreeElement([null as any, { id: "x" } as any], "x")).toEqual({ id: "x" });
    expect(() => findTreeElement([null as any, { id: "x" } as any], "x")).toThrow(TypeError);
  });

  it("getAllElementIds and flattenAndSearchElements walk depth-first", () => {
    expect(getAllElementIds(makeTree())).toEqual(["root1", "childA", "childB", "deep1", "deep2", "childC", "root2", "childA"]);
    expect(flattenAndSearchElements(makeTree(), "  PRICING ").map((r) => [r.element.id, r.path])).toEqual([["deep2", "container › container › text"]]);
    expect(flattenAndSearchElements(null as any, "x")).toEqual([]);
  });

  it("video ids: 11-character YouTube ids only; numeric Vimeo ids", () => {
    expect(getYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(getYouTubeId("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(getVimeoId("https://player.vimeo.com/video/76979871")).toBe("76979871");
    expect(getVimeoId("https://vimeo.com/abc")).toBeNull();
  });

  it("style compilers resolve relative backgrounds against the bound apiUrl and coerce numbers", () => {
    expect(createBackgroundAndBorderStylesCompiler("https://api.example.test")({ backgroundImage: "/uploads/bg.png" } as any).backgroundImage).toBe("url('https://api.example.test/uploads/bg.png')");
    expect(createBackgroundAndBorderStylesCompiler("https://api.example.test")({ borderStyle: "solid" } as any)).toEqual({ borderStyle: "solid", borderWidth: "1px", borderColor: "#cbd5e1" });
    expect(compilePositioningStyles({ position: "absolute", zIndex: "7", opacity: "0" } as any)).toEqual({ position: "absolute", zIndex: 7, opacity: 0 });
  });
});
