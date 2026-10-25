// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Navigator tree items (renderNavigatorTreeItem), characterised before the extraction and kept as its
 * contract: nested order, labels, icons, branch connectors and indentation; selection (event does not
 * reach the parent item), shift-click range selection, hover, collapse / expand (without selecting),
 * and the Copy / Duplicate / Move / Delete buttons.
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

const site = () => siteFixture({}, [{ id: "home", name: "Home", slug: "/", elements: [
  { id: "box1", type: "container", styles: {}, children: [heading("inner1", "Inner heading"), { id: "txt1", type: "text", content: "Some text here and more", styles: {} }] },
  heading("top1", "Top heading"),
  { id: "img1", type: "image", src: "https://x.example.test/a.png", alt: "Logo", styles: {} },
] }]);

async function openNavigator() {
  const editor = await mountEditor(site());
  fireEvent.click(screen.getByRole("button", { name: "Navigator" }));
  await flush(2);
  return editor;
}
/** The row element of a navigator item, found by its label. */
const row = (label: string) => {
  const labelSpan = [...document.querySelectorAll("span.truncate.capitalize")].find((n) => n.textContent === label);
  if (!labelSpan) throw new Error("no navigator item " + label);
  return labelSpan.closest("div.group") as HTMLElement;
};
const labels = () => [...document.querySelectorAll("div.select-none > div.group span.truncate.capitalize")].map((n) => n.textContent);
/** The collapse toggle (the row's first button; Move Down also shows ▼). */
const toggle = (label: string) => row(label).querySelector("button") as HTMLButtonElement;
const isSelectedRow = (label: string) => row(label).className.includes("bg-blue-600");

describe("navigator tree: structure", () => {
  it("lists elements depth-first with labels, icons, connectors and indentation", async () => {
    await openNavigator();
    expect(labels()).toEqual(["Container", '"Inner heading"', '"Some text here "', '"Top heading"', "Image (Logo)"]);
    expect(row("Container").style.paddingLeft).toBe("4px");
    expect(row('"Inner heading"').style.paddingLeft).toBe("18px");
    expect(within(row('"Inner heading"')).getByText("├──")).toBeTruthy();
    expect(within(row('"Some text here "')).getByText("└──")).toBeTruthy();
    expect(within(row("Container")).queryByText(/──/)).toBeNull();
    expect(within(row("Container")).getByText("📦")).toBeTruthy();
    expect(within(row("Image (Logo)")).getByText("🖼️")).toBeTruthy();
    expect(toggle("Container").textContent).toBe("▼");
  });
});

describe("navigator tree: selection and hover", () => {
  it("clicking a child selects only the child (the click does not reach the parent row)", async () => {
    await openNavigator();
    fireEvent.click(row('"Inner heading"'));
    await flush(2);
    expect(isSelectedRow('"Inner heading"')).toBe(true);
    expect(isSelectedRow("Container")).toBe(false);
  });

  it("shift-click selects the range between two items", async () => {
    await openNavigator();
    fireEvent.click(row('"Top heading"'));
    await flush(2);
    fireEvent.click(row("Image (Logo)"), { shiftKey: true });
    await flush(2);
    expect(isSelectedRow('"Top heading"')).toBe(true);
    expect(isSelectedRow("Image (Logo)")).toBe(true);
    expect(screen.getByText("Multi-Select (2 elements selected)")).toBeTruthy();
  });

  it("hovering highlights the row; leaving clears it", async () => {
    await openNavigator();
    fireEvent.mouseEnter(row('"Top heading"'));
    await flush(1);
    expect(row('"Top heading"').className).toContain("bg-blue-50");
    fireEvent.mouseLeave(row('"Top heading"'));
    await flush(1);
    expect(row('"Top heading"').className).not.toContain("bg-blue-50");
  });
});

describe("navigator tree: collapse and actions", () => {
  it("the container toggle collapses and expands its children without selecting it", async () => {
    await openNavigator();
    fireEvent.click(toggle("Container"));
    await flush(2);
    expect(labels()).toEqual(["Container", '"Top heading"', "Image (Logo)"]);
    expect(toggle("Container").textContent).toBe("▶");
    expect(isSelectedRow("Container")).toBe(false);
    fireEvent.click(toggle("Container"));
    await flush(2);
    expect(labels()).toHaveLength(5);
  });

  it("Duplicate, Move Down, Move Up and Delete act on that item", async () => {
    const { canvasIds } = await openNavigator();
    const before = canvasIds();
    fireEvent.click(within(row('"Top heading"')).getByTitle("Move Down"));
    await flush(2);
    expect(labels().slice(3)).toEqual(["Image (Logo)", '"Top heading"']);
    fireEvent.click(within(row('"Top heading"')).getByTitle("Move Up"));
    await flush(2);
    expect(labels().slice(3)).toEqual(['"Top heading"', "Image (Logo)"]);
    fireEvent.click(within(row("Image (Logo)")).getByTitle("Duplicate"));
    await flush(2);
    expect(labels().filter((l) => l === "Image (Logo)")).toHaveLength(2);
    expect(canvasIds()).toHaveLength(before.length + 1);
    fireEvent.click(within(row('"Top heading"')).getByTitle("Delete"));
    await flush(2);
    expect(labels()).not.toContain('"Top heading"');
    expect(canvasIds()).not.toContain("top1");
  });

  it("Copy then Ctrl+V pastes a copy of that item", async () => {
    const editor = await openNavigator();
    fireEvent.click(within(row('"Top heading"')).getByTitle("Copy"));
    await flush(2);
    await editor.select("img1");
    const before = editor.canvasIds().length;
    await editor.key("v", { ctrlKey: true });
    expect(editor.canvasIds().length).toBe(before + 1);
    expect(labels().filter((l) => l === '"Top heading"')).toHaveLength(2);
  });
});
