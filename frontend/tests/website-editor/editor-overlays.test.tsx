// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Shell overlays moved to shell/overlays/* in Phase 5B-8. The element context menu is exercised in the
 * mounted editor (run against the editor before and after the move): positioning at the pointer and the
 * Duplicate / Move Down / Delete actions, each closing the menu. The Element Manager overlay cannot be
 * opened from the current UI (nothing sets isElementManagerOpen to true), so it is rendered directly.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { flush, heading, mountEditor, siteFixture } from "./editor-harness";
import { renderElementManagerOverlay } from "../../src/pages/editor/shell/overlays/elementManagerOverlay";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const site = () => siteFixture({}, [{ id: "home", name: "Home", slug: "/", elements: [heading("elA", "Alpha heading"), heading("elB", "Bravo heading")] }]);
const menu = () => [...document.querySelectorAll("div[style]")].find((d) => /top: \d+px/.test(d.getAttribute("style") ?? "") && /Duplicate/.test(d.textContent ?? "")) as HTMLElement | undefined;
const openMenu = async (editor: Awaited<ReturnType<typeof mountEditor>>, id: string) => {
  fireEvent.contextMenu(editor.canvasEl(id)!, { clientX: 120, clientY: 140 });
  await flush(2);
};

describe("element context menu", () => {
  it("opens at the pointer for the right-clicked element", async () => {
    const editor = await mountEditor(site());
    expect(menu()).toBeUndefined();
    await openMenu(editor, "elB");
    const m = menu()!;
    expect(m).toBeTruthy();
    expect(m.style.top).toBe("140px");
    expect(m.style.left).toBe("120px");
  });

  it("Duplicate, Move Down and Delete act on the target element and close the menu", async () => {
    const editor = await mountEditor(site());
    await openMenu(editor, "elA");
    fireEvent.click(within(menu()!).getByText("Duplicate"));
    await flush(2);
    expect(menu()).toBeUndefined();
    expect(editor.canvasIds()).toHaveLength(3);
    expect(editor.canvasIds()[0]).toBe("elA");
    await openMenu(editor, "elA");
    fireEvent.click(within(menu()!).getByText("Move Down"));
    await flush(2);
    expect(editor.canvasIds()[1]).toBe("elA");
    await openMenu(editor, "elB");
    fireEvent.click(within(menu()!).getByText("Delete"));
    await flush(2);
    expect(menu()).toBeUndefined();
    expect(editor.canvasIds()).not.toContain("elB");
  });
});

describe("element manager overlay (rendered directly)", () => {
  function Harness({ calls, initialOpen = true }: { calls: string[]; initialOpen?: boolean }) {
    const [open, setOpen] = useState(initialOpen);
    const [search, setSearch] = useState("");
    const [cat, setCat] = useState("All"); // the overlay's categories are "All", "Layout", ...
    return (
      <div data-testid="host">
        {renderElementManagerOverlay({
          disabledWidgets: ["countdown"] as any,
          enableAllWidgets: () => calls.push("enableAll"),
          isElementManagerOpen: open,
          managerCategoryFilter: cat,
          managerSearchQuery: search,
          resetWidgetsToDefault: () => calls.push("reset"),
          setIsElementManagerOpen: (v: any) => { calls.push(`open:${v}`); setOpen(v); },
          setManagerCategoryFilter: (v: any) => { calls.push(`cat:${v}`); setCat(v); },
          setManagerSearchQuery: (v: any) => { calls.push(`search:${v}`); setSearch(v); },
          toggleWidgetAvailability: (t: any) => calls.push(`toggle:${t}`),
        })}
      </div>
    );
  }

  it("renders nothing while closed", () => {
    render(<Harness calls={[]} initialOpen={false} />);
    expect(screen.getByTestId("host").innerHTML).toBe("");
  });

  it("Done closes it", () => {
    const calls: string[] = [];
    render(<Harness calls={calls} />);
    fireEvent.click(screen.getByText("Done"));
    expect(calls).toEqual(["open:false"]);
  });

  it("backdrop click closes it; clicks inside do not reach the backdrop", () => {
    const calls: string[] = [];
    render(<Harness calls={calls} />);
    const backdrop = screen.getByTestId("host").firstElementChild as HTMLElement;
    fireEvent.click(backdrop.firstElementChild as HTMLElement); // the dialog panel
    expect(calls).not.toContain("open:false");
    fireEvent.click(backdrop);
    expect(calls).toContain("open:false");
    expect(screen.getByTestId("host").innerHTML).toBe("");
  });

  it("search, category, enable all, reset and per-widget toggles call their handlers", () => {
    const calls: string[] = [];
    render(<Harness calls={calls} />);
    const input = screen.getByTestId("host").querySelector("input") as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: "count" } });
    expect(calls).toContain("search:count");
    expect(document.activeElement).toBe(screen.getByTestId("host").querySelector("input"));
    const host = screen.getByTestId("host");
    const byText = (re: RegExp) => [...host.querySelectorAll("button")].find((b) => re.test(b.textContent?.trim() ?? "")) as HTMLButtonElement;
    const before = calls.length;
    fireEvent.click(byText(/^Enable All/));
    fireEvent.click(byText(/^Reset Default/));
    fireEvent.click(host.querySelector('button[title="Enable Countdown in Widget Library"]') as HTMLButtonElement);
    fireEvent.click(byText(/^Media$/)); // after the toggle: a category can hide the Countdown row
    const after = calls.slice(before);
    expect(after).toEqual(["enableAll", "reset", "toggle:countdown", "cat:Media"]);
    expect(calls).not.toContain("open:false");
  });
});

describe("edit page modal (rendered directly)", () => {
  // Only openEditPageModal opens this modal and nothing references that handler today, so it is pinned here.
  async function load() { return (await import("../../src/pages/editor/shell/modals/editPageModal")).renderEditPageModal; }
  function Harness({ render: renderModal, calls, initialOpen = true }: { render: (d: any) => React.ReactNode; calls: string[]; initialOpen?: boolean }) {
    const [open, setOpen] = useState(initialOpen);
    const [name, setName] = useState("About");
    const [slug, setSlug] = useState("/about");
    return <div data-testid="host">{renderModal({
      editPageName: name, editPageSlug: slug, isEditPageModalOpen: open,
      handleSaveEditPage: () => calls.push(`save:${name}:${slug}`),
      setEditPageName: (v: any) => { calls.push(`name:${v}`); setName(v); },
      setEditPageSlug: (v: any) => { calls.push(`slug:${v}`); setSlug(v); },
      setIsEditPageModalOpen: (v: any) => { calls.push(`open:${v}`); setOpen(v); },
    })}</div>;
  }

  it("renders nothing while closed; shows the current name and slug when open", async () => {
    const renderModal = await load();
    render(<Harness render={renderModal} calls={[]} initialOpen={false} />);
    expect(screen.getByTestId("host").innerHTML).toBe("");
    cleanup();
    render(<Harness render={renderModal} calls={[]} />);
    expect(screen.getByText("Edit Page Settings")).toBeTruthy();
    expect((screen.getByPlaceholderText("e.g. About Us, Our Services, Contact") as HTMLInputElement).value).toBe("About");
    expect((screen.getByPlaceholderText("e.g. /about, /services, /contact") as HTMLInputElement).value).toBe("/about");
  });

  it("editing keeps focus and updates both fields; Save submits them; the close buttons close it", async () => {
    const renderModal = await load();
    const calls: string[] = [];
    render(<Harness render={renderModal} calls={calls} />);
    const name = screen.getByPlaceholderText("e.g. About Us, Our Services, Contact") as HTMLInputElement;
    name.focus();
    fireEvent.change(name, { target: { value: "About Us" } });
    expect(document.activeElement).toBe(screen.getByPlaceholderText("e.g. About Us, Our Services, Contact"));
    fireEvent.change(screen.getByPlaceholderText("e.g. /about, /services, /contact"), { target: { value: "/about-us" } });
    const buttons = [...screen.getByTestId("host").querySelectorAll("button")];
    const save = buttons.find((b) => /Save/.test(b.textContent ?? ""))!;
    fireEvent.click(save);
    expect(calls).toEqual(["name:About Us", "slug:/about-us", "save:About Us:/about-us"]);
    const closers = buttons.filter((b) => b !== save);
    expect(closers.length).toBeGreaterThan(0);
    fireEvent.click(closers[0]);
    expect(calls.at(-1)).toBe("open:false");
    expect(screen.getByTestId("host").innerHTML).toBe("");
  });
});
