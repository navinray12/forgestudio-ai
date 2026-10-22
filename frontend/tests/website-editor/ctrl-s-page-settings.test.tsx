// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Phase 7C regression test for known issue #1 (phase5b11-known-issues.md): after changing only page
 * settings, Ctrl+S saved the previous settings, because the window keydown listener (useEditorShortcuts)
 * is re-registered only when its own dependency list changes, and page settings are not in it, so it
 * called the handleSave of an older render. The toolbar Save button always used the current values.
 */
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { flush, heading, mountEditor, siteFixture } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const site = () => siteFixture({}, [{ id: "home", name: "Home", slug: "/", elements: [heading("elA", "Alpha")], pageSettings: { title: "Home", path: "/", description: "original description" } }]);
const description = () => screen.getAllByPlaceholderText("Page SEO description...")[0] as HTMLTextAreaElement;
const savedHome = (body: any) => body.editorData.pages.find((p: { id: string }) => p.id === "home");

async function editDescription(value: string) {
  fireEvent.change(description(), { target: { value } });
  await flush(2);
  (document.activeElement as HTMLElement | null)?.blur?.(); // shortcuts are ignored while typing in a field
  expect(description().value).toBe(value);
}

describe("Ctrl+S saves the current page settings", () => {
  it("after editing only page settings, Ctrl+S sends the new value", async () => {
    const editor = await mountEditor(site());
    await editDescription("edited description");
    await editor.key("s", { ctrlKey: true });
    await flush(6);
    const put = editor.backend.saves().at(-1)!;
    expect(savedHome(put.body).pageSettings.description).toBe("edited description");
  });

  it("toolbar Save and Ctrl+S send the same page settings", async () => {
    const editor = await mountEditor(site());
    await editDescription("first edit");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save" })); });
    await flush(6);
    await editDescription("second edit");
    await editor.key("s", { ctrlKey: true });
    await flush(6);
    const [byButton, byShortcut] = editor.backend.saves().slice(-2);
    expect(savedHome(byButton.body).pageSettings.description).toBe("first edit");
    expect(savedHome(byShortcut.body).pageSettings.description).toBe("second edit");
  });

  it("Ctrl+S with nothing changed still saves once, with the loaded settings", async () => {
    const editor = await mountEditor(site());
    const before = editor.backend.saves().length;
    await editor.key("s", { ctrlKey: true });
    await flush(6);
    expect(editor.backend.saves()).toHaveLength(before + 1);
    expect(savedHome(editor.backend.saves().at(-1)!.body).pageSettings.description).toBe("original description");
  });
});
