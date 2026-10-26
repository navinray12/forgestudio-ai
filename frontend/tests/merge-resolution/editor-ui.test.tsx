// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { flush, mountEditor, siteFixture } from "../website-editor/editor-harness";

vi.setConfig({ testTimeout: 60000 });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

it("keeps Pages as the default and exposes the extracted panels through the redesigned rail", async () => {
  const editor = await mountEditor(siteFixture(), [], { initialPanel: "pages" });
  expect(screen.queryByPlaceholderText("Search active widgets...")).toBeNull();
  expect(screen.getByRole("button", { name: "Navigator" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Atomic" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Elements" }));
  await flush(2);
  expect(screen.getByPlaceholderText("Search active widgets...")).toBeTruthy();
  expect(editor.canvasIds()).toEqual(["elA", "elB"]);
});

it("keeps global Design Tokens out of the content-only inspector", async () => {
  const editor = await mountEditor(siteFixture({ userPermission: "CONTENT_EDITOR" }));
  await editor.select("elA");
  expect(screen.getByText("CONTENT-ONLY SANDBOX")).toBeTruthy();
  expect(screen.queryByText(/Design Tokens/)).toBeNull();
  fireEvent.click(screen.getByTitle("More Editor Tools & Actions"));
  expect(screen.queryByRole("button", { name: "Replace Template" })).toBeNull();
});
