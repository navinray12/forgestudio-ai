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
import { flush, heading, mountEditor, siteFixture, watchForText } from "./editor-harness";

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

const NEW_PAGE_ID = /^page_\d+_[a-z0-9]{1,4}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const nameInput = () => screen.getByPlaceholderText("e.g. About, Services, Contact, Pricing") as HTMLInputElement;
const slugInput = () => screen.getByPlaceholderText("e.g. /about, /services, /contact") as HTMLInputElement;
async function openAddPage() {
  fireEvent.click(screen.getByRole("button", { name: "Add New Page" }));
  await flush(2);
}
async function savedPages(editor: Awaited<ReturnType<typeof mountEditor>>) {
  const before = editor.backend.saves().length;
  await editor.key("s", { ctrlKey: true });
  await waitFor(() => expect(editor.backend.saves().length).toBe(before + 1));
  return (editor.backend.saves().at(-1)!.body as { editorData: { pages: any[] } }).editorData.pages;
}

describe("handleCreateNewPage: page object, validation and messages", () => {
  it("builds the full page object and announces it (no starter match)", async () => {
    const editor = await mountEditor(site());
    const toast = watchForText('Page "Team Roster" created!');
    await openAddPage();
    fireEvent.change(nameInput(), { target: { value: "Team Roster" } });
    await flush(1);
    fireEvent.click(screen.getByRole("button", { name: "Create Page" }));
    await flush(3);
    expect(toast.seen()).toBe(true);
    toast.stop();
    const created = (await savedPages(editor))[2];
    expect(created).toEqual({
      id: expect.stringMatching(NEW_PAGE_ID), name: "Team Roster", slug: "/team-roster", elements: [],
      pageSettings: { title: "Team Roster", path: "/team-roster", description: "", backgroundColor: "#ffffff", isMaintenanceMode: false, siteLanguage: "en" },
      isHome: false, createdAt: expect.stringMatching(ISO), updatedAt: expect.stringMatching(ISO),
    });
    expect(screen.queryByPlaceholderText("e.g. About, Services, Contact, Pricing")).toBeNull(); // modal closed
  });

  it("a starter slug brings the starter's elements and description", async () => {
    const editor = await mountEditor(site());
    await openAddPage();
    fireEvent.change(nameInput(), { target: { value: "Services" } });
    await flush(1);
    fireEvent.click(screen.getByRole("button", { name: "Create Page" }));
    await flush(3);
    const created = (await savedPages(editor))[2];
    expect(created.slug).toBe("/services");
    expect(created.elements.length).toBeGreaterThan(0);
    expect(editor.canvasIds()[0]).toBe(created.elements[0].id); // the canvas also lists nested children
    expect(created.pageSettings.description).toBe("Our core services and solutions.");
  });

  it("a slug already in use is rejected with the validation message; nothing is created", async () => {
    const editor = await mountEditor(site());
    await openAddPage();
    fireEvent.change(nameInput(), { target: { value: "Second About" } });
    fireEvent.change(slugInput(), { target: { value: "/about" } });
    await flush(1);
    fireEvent.click(screen.getByRole("button", { name: "Create Page" }));
    await flush(3);
    expect(screen.getAllByRole("alert").map((n) => n.textContent)).toContain('Slug "/about" is already in use by page "About". Please choose a unique slug.');
    expect(nameInput().value).toBe("Second About"); // modal still open
    fireEvent.click(screen.getByRole("button", { name: "Cancel" })); // shortcuts are ignored while its input has focus
    await flush(2);
    expect((await savedPages(editor)).map((p) => p.id)).toEqual(["home", "about"]);
  });

  it("the slug follows the name until it is edited by hand", async () => {
    await mountEditor(site());
    await openAddPage();
    expect(document.activeElement).toBe(nameInput()); // autoFocus
    fireEvent.change(nameInput(), { target: { value: "Team Roster" } });
    await flush(1);
    expect(document.activeElement).toBe(nameInput()); // the modal is not remounted while typing
    expect(slugInput().value).toBe("/team-roster");
    fireEvent.change(nameInput(), { target: { value: "Team Roster 2026!" } });
    await flush(1);
    expect(slugInput().value).toBe("/team-roster-2026");
    fireEvent.change(slugInput(), { target: { value: "/crew" } });
    fireEvent.change(nameInput(), { target: { value: "Crew" } });
    await flush(1);
    expect(slugInput().value).toBe("/crew");
  });
});

describe("handleQuickCreateOrSwitchPage: page object and messages", () => {
  it("a preset without a starter gets the '<name> page' description and the created message", async () => {
    const editor = await mountEditor(site());
    const toast = watchForText('Created and opened "Pricing" page!');
    await openPageSelector();
    fireEvent.click(screen.getByTitle("Create or switch to Pricing page"));
    await flush(3);
    expect(toast.seen()).toBe(true);
    toast.stop();
    const created = (await savedPages(editor))[2];
    expect(created).toEqual({
      id: expect.stringMatching(NEW_PAGE_ID), name: "Pricing", slug: "/pricing", elements: [],
      pageSettings: { title: "Pricing", path: "/pricing", description: "Pricing page", backgroundColor: "#ffffff", isMaintenanceMode: false, siteLanguage: "en" },
      isHome: false, createdAt: expect.stringMatching(ISO), updatedAt: expect.stringMatching(ISO),
    });
  });

  it("an existing page is switched to with the switched message", async () => {
    await mountEditor(site());
    const toast = watchForText('Switched to "About" page');
    await openPageSelector();
    fireEvent.click(screen.getByTitle("Create or switch to About Us page"));
    await flush(3);
    expect(toast.seen()).toBe(true);
    toast.stop();
  });
});

describe("handlePreviewPageNavigate", () => {
  it("sets ?page= to the page slug, or 'home' for the home page", async () => {
    const editor = await mountEditor(site());
    const push = vi.spyOn(window.history, "pushState");
    await editor.key("p", { ctrlKey: true }); // preview
    const navButton = (label: string) => [...document.querySelectorAll("nav button")].find((b) => b.textContent === label) as HTMLButtonElement;
    fireEvent.click(navButton("About"));
    await flush(2);
    expect(new URL(String(push.mock.calls.at(-1)![2])).searchParams.get("page")).toBe("about");
    fireEvent.click(navButton("Home"));
    await flush(2);
    expect(new URL(String(push.mock.calls.at(-1)![2])).searchParams.get("page")).toBe("home");
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
