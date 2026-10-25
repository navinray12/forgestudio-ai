// @vitest-environment jsdom
/* global describe, it, expect, vi, beforeEach, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Regression guard: rendering and property-update behaviour of existing widget inspectors in
 * src/pages/editor/inspector/DynamicWidgetInspectors.tsx (controlled components: `el` in,
 * `updateProp(key, value)` / `updateStyle(key, value)` out).
 *
 *  - Markup: representative inspectors render byte-identical HTML (structure, classes, attributes) to
 *    inspector-markup.golden.json, captured once from the unmodified source and never regenerated here.
 *  - Interaction: exact callback sequences for Countdown, Image, Gallery (incl. UniversalItemManager
 *    add/delete/reorder/edit), Button and DisplayConditions (incl. clipboard copy/paste and reset).
 *
 * Ids derived from Date.now()/Math.random() are pinned with a fixed clock and random value.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as Inspectors from "../../src/pages/editor/inspector/DynamicWidgetInspectors";
import {
  CountdownWidgetInspector,
  ImageWidgetInspector,
  GalleryWidgetInspector,
  ButtonWidgetInspector,
  DisplayConditionsWidgetInspector,
  validateDisplayConditionsData,
  FS_DISPLAY_CONDITIONS_CLIPBOARD_KEY,
} from "../../src/pages/editor/inspector/DynamicWidgetInspectors";
import golden from "./inspector-markup.golden.json";
import { ELEMENTS, FIXED_NOW, FIXED_RANDOM, GALLERY_IMAGES, MARKUP_CASES, PAGES } from "./inspector.fixtures";

const RANDOM_ID_4 = FIXED_RANDOM.toString(36).substring(2, 6);

function pinClockAndRandom() {
  vi.useFakeTimers({ now: FIXED_NOW, toFake: ["Date"] });
  vi.spyOn(Math, "random").mockReturnValue(FIXED_RANDOM);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const el = (key: string) => structuredClone(ELEMENTS[key]);

describe("runtime exports", () => {
  it("60 runtime values (61 exports minus the DisplayConditionItem interface), functions except two data constants", () => {
    const entries = Object.entries(Inspectors);
    expect(entries).toHaveLength(60);
    expect(entries.filter(([, v]) => typeof v !== "function").map(([k]) => k).sort())
      .toEqual(["FS_DISPLAY_CONDITIONS_CLIPBOARD_KEY", "PRESET_SAMPLE_IMAGES"]);
    expect(FS_DISPLAY_CONDITIONS_CLIPBOARD_KEY).toBe("fs_clipboard_display_conditions");
  });
});

describe("static rendering matches golden markup", () => {
  it("golden file covers exactly the markup cases", () => {
    expect(Object.keys(golden).sort()).toEqual(MARKUP_CASES.map(([name]) => name).sort());
  });

  for (const [name, comp, elKey, extra] of MARKUP_CASES) {
    it(name, () => {
      pinClockAndRandom();
      const C = (Inspectors as any)[comp];
      const { container } = render(<C el={el(elKey)} updateProp={() => {}} updateStyle={() => {}} {...(extra ?? {})} />);
      expect(container.innerHTML).toBe((golden as Record<string, string>)[name]);
    });
  }
});

describe("CountdownWidgetInspector", () => {
  it("shows defaults and emits countdownTargetDate / countdownExpiredMessage", () => {
    const updateProp = vi.fn();
    render(<CountdownWidgetInspector el={el("countdown")} updateProp={updateProp} />);
    const date = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    const message = document.querySelector('input[type="text"]') as HTMLInputElement;
    expect(date.value).toBe("2026-12-31T23:59");
    expect(message.value).toBe("Special Offer Has Ended!");

    fireEvent.change(date, { target: { value: "2027-01-01T10:00" } });
    fireEvent.change(message, { target: { value: "Done" } });
    expect(updateProp.mock.calls).toEqual([
      ["countdownTargetDate", "2027-01-01T10:00"],
      ["countdownExpiredMessage", "Done"],
    ]);
  });

  it("reflects values already on the element", () => {
    render(<CountdownWidgetInspector el={el("countdownSet")} updateProp={vi.fn()} />);
    expect((document.querySelector('input[type="datetime-local"]') as HTMLInputElement).value).toBe("2027-05-01T09:30");
    expect((document.querySelector('input[type="text"]') as HTMLInputElement).value).toBe("Sale over");
  });
});

describe("ImageWidgetInspector", () => {
  it("routes src/alt to updateProp and objectFit to updateStyle", () => {
    const updateProp = vi.fn();
    const updateStyle = vi.fn();
    render(<ImageWidgetInspector el={el("image")} updateProp={updateProp} updateStyle={updateStyle} />);

    fireEvent.change(screen.getByPlaceholderText(/or click select image/), { target: { value: "https://example.com/new.png" } });
    fireEvent.change(screen.getByPlaceholderText("Description..."), { target: { value: "New alt" } });
    fireEvent.click(screen.getByRole("button", { name: /Remove Image/ }));
    fireEvent.change(screen.getByDisplayValue("Contain (Fit)"), { target: { value: "fill" } });

    expect(updateProp.mock.calls).toEqual([["src", "https://example.com/new.png"], ["alt", "New alt"], ["src", ""]]);
    expect(updateStyle.mock.calls).toEqual([["objectFit", "fill"]]);
  });

  it("hides Remove Image when there is no src and defaults objectFit to cover", () => {
    render(<ImageWidgetInspector el={el("imageEmpty")} updateProp={vi.fn()} updateStyle={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Remove Image/ })).toBeNull();
    expect(screen.getByDisplayValue("Cover (Fill)")).toBeTruthy();
  });
});

describe("GalleryWidgetInspector (incl. UniversalItemManager)", () => {
  const imagesUpdate = (calls: any[][]) => calls.filter(([k]) => k === "galleryImages" || k === "basicGalleryImages");

  it("columns write both galleryColumns and basicGalleryColumns as numbers", () => {
    const updateProp = vi.fn();
    render(<GalleryWidgetInspector el={el("gallery")} updateProp={updateProp} />);
    fireEvent.change(screen.getByDisplayValue("3 Columns"), { target: { value: "4" } });
    expect(updateProp.mock.calls).toEqual([["galleryColumns", 4], ["basicGalleryColumns", 4]]);
  });

  it("move down, delete and caption edits update both image lists", () => {
    const updateProp = vi.fn();
    render(<GalleryWidgetInspector el={el("gallery")} updateProp={updateProp} />);
    const [a, b] = GALLERY_IMAGES;

    fireEvent.click(screen.getAllByTitle("Move Down")[0]);
    expect(imagesUpdate(updateProp.mock.calls)).toEqual([["galleryImages", [b, a]], ["basicGalleryImages", [b, a]]]);

    updateProp.mockClear();
    fireEvent.click(screen.getAllByTitle("Delete Item (Safe)")[0]);
    expect(updateProp.mock.calls).toEqual([["galleryImages", [b]], ["basicGalleryImages", [b]]]);

    updateProp.mockClear();
    fireEvent.change(screen.getByDisplayValue("First"), { target: { value: "Renamed" } });
    expect(updateProp.mock.calls).toEqual([
      ["galleryImages", [{ ...a, caption: "Renamed" }, b]],
      ["basicGalleryImages", [{ ...a, caption: "Renamed" }, b]],
    ]);
  });

  it("Add Item appends the default photo with a clock/random-derived id", () => {
    pinClockAndRandom();
    const updateProp = vi.fn();
    render(<GalleryWidgetInspector el={el("gallery")} updateProp={updateProp} />);
    fireEvent.click(screen.getByRole("button", { name: /\+ Add Item/ }));
    const added = {
      id: `gimg_${FIXED_NOW}_${RANDOM_ID_4}`,
      url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80",
      caption: "Photo 3",
      altText: "Gallery Photo",
    };
    expect(updateProp.mock.calls).toEqual([
      ["galleryImages", [...GALLERY_IMAGES, added]],
      ["basicGalleryImages", [...GALLERY_IMAGES, added]],
    ]);
  });
});

describe("ButtonWidgetInspector", () => {
  it("label writes content and buttonText", () => {
    const updateProp = vi.fn();
    render(<ButtonWidgetInspector el={el("button")} updateProp={updateProp} updateStyle={vi.fn()} pages={PAGES as any} activePageId="home" />);
    fireEvent.change(screen.getByPlaceholderText("Click Me"), { target: { value: "Buy now" } });
    expect(updateProp.mock.calls).toEqual([["content", "Buy now"], ["buttonText", "Buy now"]]);
  });

  it("Internal Page links the home page; Custom URL switches destination only", () => {
    const updateProp = vi.fn();
    render(<ButtonWidgetInspector el={el("button")} updateProp={updateProp} updateStyle={vi.fn()} pages={PAGES as any} activePageId="home" />);

    fireEvent.click(screen.getByRole("button", { name: /Internal Page/ }));
    expect(updateProp.mock.calls).toEqual([
      ["destinationType", "page"], ["linkType", "page"], ["pageId", "home"], ["href", "/"], ["linkUrl", "/"],
    ]);

    updateProp.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Custom URL/ }));
    expect(updateProp.mock.calls).toEqual([["destinationType", "url"], ["linkType", "url"]]);
  });
});

describe("DisplayConditionsWidgetInspector", () => {
  let clipboard: { writeText: ReturnType<typeof vi.fn>; readText: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    clipboard = { writeText: vi.fn(async () => {}), readText: vi.fn(async () => "") };
    Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
    localStorage.clear();
  });

  it("Copy writes the current rules to the clipboard and localStorage without updating the element", async () => {
    const updateProp = vi.fn();
    const dc = el("displayConditions");
    render(<DisplayConditionsWidgetInspector el={dc} updateProp={updateProp} />);
    await act(async () => { fireEvent.click(screen.getByTitle("Copy current display conditions to clipboard")); });
    const json = JSON.stringify(dc.displayConditions, null, 2);
    expect(clipboard.writeText.mock.calls).toEqual([[json]]);
    expect(localStorage.getItem(FS_DISPLAY_CONDITIONS_CLIPBOARD_KEY)).toBe(json);
    expect(updateProp).not.toHaveBeenCalled();
  });

  it("Paste validates clipboard rules and writes displayConditions with fresh ids", async () => {
    pinClockAndRandom();
    clipboard.readText.mockResolvedValue(JSON.stringify([
      { type: "INCLUDE", condition: "  PAGE:/pricing  " },
      { type: "BOGUS", condition: "x" },
      { type: "EXCLUDE", condition: "" },
    ]));
    const updateProp = vi.fn();
    render(<DisplayConditionsWidgetInspector el={el("displayConditions")} updateProp={updateProp} />);
    await act(async () => { fireEvent.click(screen.getByTitle("Paste display conditions from clipboard")); });
    expect(updateProp.mock.calls).toEqual([
      ["displayConditions", [{ id: `rule_${FIXED_NOW}_${RANDOM_ID_4}`, type: "INCLUDE", condition: "PAGE:/pricing" }]],
    ]);
  });

  it("Paste with nothing valid does not update the element", async () => {
    clipboard.readText.mockResolvedValue("not json");
    const updateProp = vi.fn();
    render(<DisplayConditionsWidgetInspector el={el("displayConditions")} updateProp={updateProp} />);
    await act(async () => { fireEvent.click(screen.getByTitle("Paste display conditions from clipboard")); });
    expect(updateProp).not.toHaveBeenCalled();
  });

  it("Clear needs a confirming second click, then resets to Entire Site", () => {
    pinClockAndRandom();
    const updateProp = vi.fn();
    render(<DisplayConditionsWidgetInspector el={el("displayConditions")} updateProp={updateProp} />);
    fireEvent.click(screen.getByTitle("Clear all conditions and reset to Entire Website"));
    expect(updateProp).not.toHaveBeenCalled();
    const confirm = screen.getByTitle("Click again to confirm reset");
    expect(within(confirm).getByText("Confirm?")).toBeTruthy();
    fireEvent.click(confirm);
    expect(updateProp.mock.calls).toEqual([
      ["displayConditions", [{ id: `rule_${FIXED_NOW}`, type: "INCLUDE", condition: "ENTIRE_SITE" }]],
    ]);
  });
});

describe("validateDisplayConditionsData", () => {
  it("rejects empty, malformed and rule-less input", () => {
    for (const input of [null, undefined, "", "not json", "[]", "{}", [], [{ type: "MAYBE", condition: "x" }], [{ type: "INCLUDE", condition: "   " }]]) {
      expect(validateDisplayConditionsData(input as any)).toBeNull();
    }
  });

  it("keeps valid rules (trimmed) with fresh ids, from arrays or JSON strings", () => {
    pinClockAndRandom();
    const expected = [
      { id: `rule_${FIXED_NOW}_${RANDOM_ID_4}`, type: "INCLUDE", condition: "ENTIRE_SITE" },
      { id: `rule_${FIXED_NOW}_${RANDOM_ID_4}`, type: "EXCLUDE", condition: "PAGE:/x" },
    ];
    const rules = [{ type: "INCLUDE", condition: "ENTIRE_SITE" }, { type: "EXCLUDE", condition: " PAGE:/x " }, { type: "nope", condition: "y" }];
    expect(validateDisplayConditionsData(rules)).toEqual(expected);
    expect(validateDisplayConditionsData(JSON.stringify(rules))).toEqual(expected);
  });
});
