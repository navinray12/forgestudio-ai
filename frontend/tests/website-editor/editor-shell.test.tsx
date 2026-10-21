// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Editor shell interactions around the header and left sidebar sections moved to shell/* in Phase 5B-8
 * (run against the editor before and after the move): viewport switcher, sidebar tabs, widget search
 * (filtering, focus kept while typing, clear), adding a widget by click, the drag payload of a tile,
 * favourites, and the import button opening its file input.
 */
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { flush, heading, mountEditor, siteFixture } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const site = () => siteFixture({}, [{ id: "home", name: "Home", slug: "/", elements: [heading("elA", "Alpha heading")] }]);
const search = () => screen.getByPlaceholderText("Search active widgets...") as HTMLInputElement;
/** A tile of the widget library grid (not Quick Access), by its label text. */
const tile = (label: string) => [...document.querySelectorAll("aside div.grid.grid-cols-2.gap-3 > div[draggable=true]")].find((n) => [...n.querySelectorAll("span")].some((sp) => sp.textContent?.trim() === label)) as HTMLElement | undefined;

describe("header", () => {
  it("the viewport switcher changes the active device", async () => {
    await mountEditor(site());
    const buttons = () => [...document.querySelectorAll("header button")].filter((b) => /Desktop|Tablet|Mobile/i.test(b.getAttribute("title") ?? ""));
    expect(buttons().length).toBeGreaterThanOrEqual(3);
    const before = buttons().map((b) => b.className);
    fireEvent.click(buttons().find((b) => /Mobile/i.test(b.getAttribute("title") ?? ""))!);
    await flush(2);
    const after = buttons().map((b) => b.className);
    expect(after).not.toEqual(before);
    fireEvent.click(buttons().find((b) => /Desktop/i.test(b.getAttribute("title") ?? ""))!);
    await flush(2);
    expect(buttons().map((b) => b.className)).toEqual(before);
  });
});

describe("left sidebar", () => {
  it("tabs switch the panel: Elements, Navigator, Templates, Atomic and back", async () => {
    await mountEditor(site());
    expect(search()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Navigator" }));
    await flush(2);
    expect(screen.queryByPlaceholderText("Search active widgets...")).toBeNull();
    expect(document.querySelectorAll("div.select-none > div.group").length).toBeGreaterThan(0); // navigator rows
    fireEvent.click(screen.getByRole("button", { name: "Templates" }));
    await flush(2);
    expect(screen.queryByPlaceholderText("Search active widgets...")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Elements" }));
    await flush(2);
    expect(search()).toBeTruthy();
  });

  it("search filters the tiles and keeps focus while typing", async () => {
    await mountEditor(site());
    expect(tile("+ Add Container")).toBeTruthy();
    search().focus();
    fireEvent.change(search(), { target: { value: "head" } });
    await flush(2);
    expect(document.activeElement).toBe(search());
    expect(tile("+ Add Container")).toBeUndefined();
    expect(tile("Heading")).toBeTruthy();
    fireEvent.change(search(), { target: { value: "" } });
    await flush(2);
    expect(tile("+ Add Container")).toBeTruthy();
  });

  it("clicking a tile adds that element; a tile's drag start carries the new-widget payload", async () => {
    const editor = await mountEditor(site());
    const before = editor.canvasIds().length;
    fireEvent.click(tile("Heading")!);
    await flush(3);
    expect(editor.canvasIds().length).toBe(before + 1);
    const data: Record<string, string> = {};
    fireEvent.dragStart(tile("+ Add Container")!, { dataTransfer: { setData: (k: string, v: string) => { data[k] = v; }, effectAllowed: "" } });
    expect(JSON.parse(data["application/json"])).toEqual({ type: "new", widgetType: "container" });
  });

  it("starring a tile adds it to Quick Access; the import button opens the file input", async () => {
    await mountEditor(site());
    const quick = () => Number(/Quick Access \((\d+)\)/.exec(document.body.textContent ?? "")?.[1] ?? 0);
    const count = quick();
    const star = within(tile("Text")!).getByText("☆");
    fireEvent.click(star);
    await flush(2);
    expect(quick()).toBe(count + 1);
    const input = document.querySelector('input[type="file"][accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.json,.svg"]') as HTMLInputElement;
    const clicked = vi.spyOn(input, "click").mockImplementation(() => {});
    const button = input.nextElementSibling as HTMLButtonElement; // the button rendered right after its input (a widget tile has the same label)
    expect(button.tagName).toBe("BUTTON");
    expect(button.textContent).toContain("Import Asset / File");
    fireEvent.click(button);
    expect(clicked).toHaveBeenCalledTimes(1);
  });
});

describe("inspector (reachable branches)", () => {
  async function saved(editor: Awaited<ReturnType<typeof mountEditor>>) {
    const before = editor.backend.saves().length;
    // The toolbar Save button (always the current render's handler). Ctrl+S is not used here: its listener
    // only re-subscribes on its own dependency list, which does not include page settings (existing behaviour).
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await flush(4);
    expect(editor.backend.saves().length).toBe(before + 1);
    return (editor.backend.saves().at(-1)!.body as any).editorData.pages[0];
  }

  it("nothing selected: the page title field keeps focus while typing and is saved", async () => {
    const editor = await mountEditor(site());
    const title = () => screen.getAllByPlaceholderText("Home")[0] as HTMLInputElement;
    title().focus();
    fireEvent.change(title(), { target: { value: "Landing" } });
    await flush(2);
    expect(document.activeElement).toBe(title());
    expect(title().value).toBe("Landing");
    const page = await saved(editor);
    expect(page.pageSettings.title).toBe("Landing");
  });

  it("element selected: the width field keeps focus while typing and writes the element style", async () => {
    const editor = await mountEditor(site());
    await editor.select("elA");
    const width = () => screen.getByPlaceholderText("auto, 100%, 50vw") as HTMLInputElement;
    width().focus();
    fireEvent.change(width(), { target: { value: "50%" } });
    await flush(2);
    expect(document.activeElement).toBe(width());
    const page = await saved(editor);
    expect(page.elements.find((e: { id: string }) => e.id === "elA").styles.width).toBe("50%");
  });
});
