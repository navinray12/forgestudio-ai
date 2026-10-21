// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * The three page handlers that merge the active page before changing pages (handleSwitchEditingPage,
 * handleCreateNewPage, handleQuickCreateOrSwitchPage), driven through the real UI and observed through
 * the next manual save: page order and ids, names / slugs, the edited page's elements and settings,
 * the appended page and the active page. Captured before they were changed to call
 * buildCanonicalPages and kept as their contract (page-merge-equivalence covers the merge itself).
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { flush, heading, mountEditor, siteFixture } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const site = () => siteFixture({}, [
  { id: "home", name: "Home", slug: "/", elements: [heading("elA", "Alpha heading"), heading("elB", "Bravo heading")], pageSettings: { title: "Home", path: "/", description: "home page" } },
  { id: "about", name: "About", slug: "/about", elements: [heading("elC", "Charlie heading")] },
]);
type SavedPage = { id: string; name: string; slug: string; elements: Array<{ id: string }>; pageSettings?: Record<string, unknown> };
const summary = (pages: SavedPage[]) => pages.map((p) => ({ id: p.id, name: p.name, slug: p.slug, elements: p.elements.map((e) => e.id), title: p.pageSettings?.title, path: p.pageSettings?.path }));

async function editHomeThenSave(act: () => Promise<void>) {
  const editor = await mountEditor(site());
  await editor.select("elA");
  await editor.key("Delete"); // an unsaved edit on the active page
  await act();
  await editor.key("s", { ctrlKey: true });
  await waitFor(() => expect(editor.backend.saves().length).toBeGreaterThan(0));
  const body = editor.backend.saves().at(-1)!.body as { editorData: { pages: SavedPage[]; homePageId: string } };
  return { ...editor, pages: body.editorData.pages, homePageId: body.editorData.homePageId };
}
async function openPageSelector() {
  fireEvent.click(screen.getByTitle(/Switch Active Page/));
  await flush(2);
}

describe("handleSwitchEditingPage", () => {
  it("keeps the unsaved edit of the page left, in order, and opens the target page", async () => {
    const { pages, canvasIds, homePageId } = await editHomeThenSave(async () => {
      await openPageSelector();
      const option = screen.getAllByText("About").map((n) => n.closest("button")).find(Boolean) as HTMLButtonElement;
      fireEvent.click(option);
      await flush(3);
    });
    expect(canvasIds()).toEqual(["elC"]);
    expect(homePageId).toBe("home");
    expect(summary(pages)).toEqual([
      { id: "home", name: "Home", slug: "/", elements: ["elB"], title: "Home", path: "/" },
      { id: "about", name: "About", slug: "/about", elements: ["elC"], title: "About", path: "/about" },
    ]);
  });

  it("quick-adding a page that exists switches to it the same way", async () => {
    const { pages, canvasIds } = await editHomeThenSave(async () => {
      await openPageSelector();
      fireEvent.click(screen.getByTitle("Create or switch to About Us page")); // slug /about exists
      await flush(3);
    });
    expect(canvasIds()).toEqual(["elC"]);
    expect(summary(pages).map((p) => [p.id, p.elements])).toEqual([["home", ["elB"]], ["about", ["elC"]]]);
  });
});

describe("handleCreateNewPage", () => {
  it("appends the new page after the edited pages and opens it", async () => {
    const { pages, canvasIds } = await editHomeThenSave(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add New Page" }));
      await flush(2);
      fireEvent.change(screen.getByPlaceholderText("e.g. About, Services, Contact, Pricing"), { target: { value: "Team Roster" } });
      await flush(1);
      fireEvent.click(screen.getByRole("button", { name: "Create Page" }));
      await flush(3);
    });
    expect(canvasIds()).toEqual([]);
    const s = summary(pages);
    expect(s.slice(0, 2)).toEqual([
      { id: "home", name: "Home", slug: "/", elements: ["elB"], title: "Home", path: "/" },
      { id: "about", name: "About", slug: "/about", elements: ["elC"], title: "About", path: "/about" },
    ]);
    expect(s).toHaveLength(3);
    expect(s[2]).toEqual({ id: expect.stringMatching(/^page_\d+_[a-z0-9]{1,4}$/), name: "Team Roster", slug: "/team-roster", elements: [], title: "Team Roster", path: "/team-roster" });
    expect(screen.getByTitle(/Switch Active Page/).textContent).toContain("Team Roster"); // the new page is active
  });
});

describe("handleQuickCreateOrSwitchPage", () => {
  it("creates the preset page after the edited pages and opens it", async () => {
    const { pages, canvasIds } = await editHomeThenSave(async () => {
      await openPageSelector();
      fireEvent.click(screen.getByTitle("Create or switch to Pricing page"));
      await flush(3);
    });
    const s = summary(pages);
    expect(s.slice(0, 2).map((p) => [p.id, p.name, p.slug, p.elements])).toEqual([["home", "Home", "/", ["elB"]], ["about", "About", "/about", ["elC"]]]);
    expect(s).toHaveLength(3);
    expect(s[2]).toMatchObject({ id: expect.stringMatching(/^page_\d+_[a-z0-9]{1,4}$/), name: "Pricing", slug: "/pricing", title: "Pricing", path: "/pricing" });
    expect(s[2].elements).toEqual(canvasIds()); // the new page's elements are what the canvas shows
    expect(screen.getByTitle(/Switch Active Page/).textContent).toContain("Pricing");
  });
});
