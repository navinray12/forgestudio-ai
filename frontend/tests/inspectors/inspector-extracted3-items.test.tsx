// @vitest-environment jsdom
/* global describe, it, expect -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Item-level characterization for the item-manager inspectors of groups E-H. The golden was captured
 * from the Phase 3A checkpoint source (not from moved code): for each inspector, two default items were
 * added under a pinned clock/random and that populated state was probed, so per-item controls (field
 * edits, move up/down, duplicate, delete) and their exact callbacks are pinned. The stored props are
 * used as input here; they are never re-derived from the code under test.
 */
import * as Inspectors from "../../src/pages/editor/inspector/DynamicWidgetInspectors";
import golden from "./inspector-extracted3-items.golden.json";
import { probeInspector } from "./inspector-probe";

const g = golden as Record<string, { props: Record<string, unknown>; extra: string[]; probe: { markup: string; trace: unknown[] } }>;
const COMPONENT: Record<string, string> = {
  slides: "SlidesWidgetInspector", reviews: "ReviewsWidgetInspector", "video-playlist": "VideoPlaylistInspector",
  portfolio: "PortfolioWidgetInspector", "audio-playlist": "AudioPlaylistInspector", "price-list": "PriceListWidgetInspector",
  "media-carousel": "MediaCarouselWidgetInspector", "testimonial-carousel": "TestimonialCarouselWidgetInspector",
  "loop-carousel": "LoopCarouselWidgetInspector", "link-in-bio": "LinkInBioWidgetInspector", form: "FormWidgetInspector",
  "nav-menu": "NavMenuWidgetInspector", "display-conditions": "DisplayConditionsWidgetInspector", "share-buttons": "ShareButtonsInspector",
};

describe("item-state golden file", () => {
  it("covers all 14 item-manager inspectors", () => {
    expect(Object.keys(g).sort()).toEqual(Object.keys(COMPONENT).sort());
  });
});

describe("populated item managers: markup and per-item callbacks unchanged", () => {
  for (const [name, comp] of Object.entries(COMPONENT)) {
    it(`${comp} (${name}) with two items`, () => {
      const C = (Inspectors as any)[comp];
      const result = JSON.parse(JSON.stringify(probeInspector(C, g[name].props, g[name].extra)));
      expect(result.markup).toBe(g[name].probe.markup);
      expect(result.trace).toEqual(g[name].probe.trace);
    }, 120_000);
  }
});
