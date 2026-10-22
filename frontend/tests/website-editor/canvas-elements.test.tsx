// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Canvas rendering (renderElementTree and its canvas/elements/* renderers). canvas-elements.golden.json
 * was recorded from the editor BEFORE renderElementTree was split into category modules (one element
 * of every type, Date frozen): representative elements' markup in edit, selected and preview states.
 * The behaviour tests cover recursion and order, every element type rendering through its wrapper,
 * selection / hover not reaching the parent, the container toolbar, and preview hiding edit chrome.
 */
import { cleanup, fireEvent, within } from "@testing-library/react";
import golden from "./canvas-elements.golden.json";
import { flush, mountEditor, siteFixture } from "./editor-harness";

vi.setConfig({ testTimeout: 120000 }); // one element of every type: a heavy mount

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

/** Every element type with a renderer slot (as listed in renderElementTree at the time of the split). */
const TYPES: string[] = ["heading","text","video","video-playlist","image","button","posts","loop-grid","share-buttons","portfolio","slides","form","login","nav-menu","animated-headline","price-table","price-list","gallery","flip-box","call-to-action","media-carousel","testimonial-carousel","nested-carousel","loop-carousel","image-carousel","table-of-contents","countdown","facebook-page","facebook-button","facebook-embed","facebook-comments","blockquote","template","reviews","paypal-button","stripe-button","lottie","code-highlight","search-bar","search-form","site-search","breadcrumbs","wp-menu","menu-anchor","post-nav","taxonomy-filter","import-asset","reusable-components","favorite-widgets","basic-media-carousel","basic-gallery","audio-playlist","dynamic-lightbox","custom-svg","icon-library","nested-tabs","nested-accordion","mega-menu","off-canvas","wc-product-title","wc-product-price","wc-product-images","wc-add-to-cart","wc-product-rating","wc-builder","wc-product","wc-product-stock","wc-product-meta","wc-product-content","wc-short-description","wc-product-data-tabs","wc-additional-info","wc-related-products","wc-upsells","wc-products","wc-custom-add-to-cart","wc-product-categories","wc-menu-cart","wc-cart","wc-checkout","wc-my-account","wc-purchase-summary","wc-notices","wc-shop-layouts","wc-product-archive","wc-product-page-templates","wc-product-archive-templates","wc-product-addons","link-in-bio","image-box","icon-box","icon-list","counter","progress-bar","rating","alert","google-maps","divider","spacer","html","shortcode"];
const idOf = (type: string) => `t_${type.replace(/-/g, "_")}`;

async function mountAll() {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-06-01T12:00:00.000Z") });
  const els: any[] = TYPES.map((type) => ({ id: idOf(type), type, content: `Sample ${type}`, styles: {} }));
  els.push({ id: "box_outer", type: "container", styles: {}, children: [{ id: "box_inner", type: "container", styles: {}, children: [{ id: "deep_h", type: "heading", content: "Deep", styles: {} }] }] });
  const editor = await mountEditor(siteFixture({}, [{ id: "home", name: "Home", slug: "/", elements: els }]));
  await flush(10);
  return editor;
}
const node = (id: string) => document.querySelector(`[data-el-id="${id}"]`) as HTMLElement;

describe("renderElementTree: markup recorded before the split", () => {
  it("edit, selected and preview markup of representative elements is unchanged", async () => {
    const editor = await mountAll();
    for (const [id, html] of Object.entries(golden.edit)) expect(node(id).outerHTML, id).toBe(html);
    fireEvent.click(node("t_heading"));
    await flush(3);
    expect(node("t_heading").outerHTML).toBe(golden.selected.t_heading);
    fireEvent.click(node("box_inner"));
    await flush(3);
    expect(node("box_outer").outerHTML).toBe(golden.selected.box_inner);
    await editor.key("p", { ctrlKey: true });
    await flush(6);
    for (const [id, html] of Object.entries(golden.preview)) expect(node(id).outerHTML, id).toBe(html);
  });
});

describe("renderElementTree: structure and interaction", () => {
  it("renders every element type through its wrapper, in document order, and recurses into containers", async () => {
    const { canvasIds } = await mountAll();
    expect(canvasIds()).toEqual([...TYPES.map(idOf), "box_outer", "box_inner", "deep_h"]);
    expect(node("box_outer").contains(node("box_inner"))).toBe(true);
    expect(node("box_inner").contains(node("deep_h"))).toBe(true);
    expect(node("deep_h").textContent).toContain("Deep");
  });

  it("clicking a nested element selects only it; hover marks only it", async () => {
    await mountAll();
    fireEvent.click(node("deep_h"));
    await flush(3);
    expect(within(node("deep_h")).getByTitle("Move Element Up")).toBeTruthy(); // the leaf toolbar
    expect(within(node("box_inner")).queryByTitle("Move Section Up")).toBeNull(); // parents stay unselected
    fireEvent.mouseEnter(node("t_text"));
    await flush(2);
    expect(node("t_text").className).not.toBe(node("t_heading").className);
  });

  it("a selected container shows the section toolbar; Move Section Up reorders it", async () => {
    const { canvasIds } = await mountAll();
    fireEvent.click(node("box_outer"));
    await flush(3);
    const toolbar = within(node("box_outer"));
    expect(toolbar.getAllByTitle("Move Section Up").length).toBeGreaterThan(0);
    fireEvent.click(toolbar.getAllByTitle("Move Section Up")[0]);
    await flush(3);
    expect(canvasIds().slice(-4)).toEqual(["box_outer", "box_inner", "deep_h", idOf(TYPES.at(-1)!)]); // moved above the last element, with its children
  });

  it("preview removes selection chrome and keeps the elements", async () => {
    const editor = await mountAll();
    fireEvent.click(node("t_heading"));
    await flush(3);
    await editor.key("p", { ctrlKey: true });
    await flush(6);
    expect(within(node("t_heading")).queryByTitle("Move Element Up")).toBeNull();
    expect(editor.canvasIds()).toContain("deep_h");
  });
});
