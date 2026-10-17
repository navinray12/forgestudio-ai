// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Regression guard for the shared inspector controls (ImagePickerControl + triggerImagePicker,
 * UniversalItemManager, UniversalIconControls), imported through the public DynamicWidgetInspectors path.
 *
 *  - Markup and UniversalIconControls callbacks: byte-for-byte against shared-controls.golden.json,
 *    captured once from the unmodified source and never regenerated here.
 *  - Behaviour: image picking (typed URL, presets, file picker with server upload and FileReader
 *    fallback), item add/duplicate/delete/move/edit, pointer drag reorder including window listener and
 *    cursor cleanup, and HTML5 drag-and-drop including the dataTransfer fallback.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  ImagePickerControl,
  PRESET_SAMPLE_IMAGES,
  UniversalIconControls,
  UniversalItemManager,
  triggerImagePicker,
} from "../../src/pages/editor/inspector/DynamicWidgetInspectors";
import golden from "./shared-controls.golden.json";
import { ICON_ELEMENT, ITEMS, itemManagerProps } from "./shared-controls.fixtures";
import { PROBE_NOW, PROBE_RANDOM, probeInspector } from "./inspector-probe";

const g = golden as Record<string, any>;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.style.cursor = "";
});

describe("golden markup", () => {
  it("ImagePickerControl closed, open and with a custom label", () => {
    const r = render(<ImagePickerControl value="https://example.com/a.png" onChange={() => {}} />);
    expect(r.container.innerHTML).toBe(g["image-picker:closed"]);
    fireEvent.click(screen.getByRole("button", { name: /Sample Gallery/ }));
    expect(r.container.innerHTML).toBe(g["image-picker:open"]);
    cleanup();
    const c = render(<ImagePickerControl value="" onChange={() => {}} label="Custom Label" />);
    expect(c.container.innerHTML).toBe(g["image-picker:custom-label"]);
  });

  it("UniversalItemManager with items and empty", () => {
    expect(render(<UniversalItemManager {...itemManagerProps(ITEMS)} onUpdate={() => {}} />).container.innerHTML).toBe(g["item-manager:items"]);
    cleanup();
    expect(render(<UniversalItemManager {...itemManagerProps(undefined)} onUpdate={() => {}} />).container.innerHTML).toBe(g["item-manager:empty"]);
  });

  it("UniversalIconControls markup and every control's callbacks", () => {
    expect(probeInspector(UniversalIconControls as any, { el: ICON_ELEMENT })).toEqual(g["icon-controls"]);
    expect(probeInspector(UniversalIconControls as any, { el: ICON_ELEMENT, showContainerControls: true })).toEqual(g["icon-controls:container"]);
  }, 30_000);
});

describe("ImagePickerControl", () => {
  it("typed URL and preset selection call onChange; choosing a preset closes the panel", () => {
    const onChange = vi.fn();
    render(<ImagePickerControl value="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/or click select image/), { target: { value: "https://x/y.png" } });
    fireEvent.click(screen.getByRole("button", { name: /Sample Gallery/ }));
    const presets = screen.getAllByRole("img");
    expect(presets.map((img) => img.getAttribute("src"))).toEqual(PRESET_SAMPLE_IMAGES.map((p) => p.url));
    fireEvent.click(presets[1].closest("button")!);
    expect(onChange.mock.calls).toEqual([["https://x/y.png"], [PRESET_SAMPLE_IMAGES[1].url]]);
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /Sample Gallery/ })).toBeTruthy();
  });

  it("Select Image opens a file input and prefers the server upload URL", async () => {
    const created: HTMLInputElement[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string, opts?: ElementCreationOptions) => {
      const node = realCreate(tag, opts);
      if (tag === "input") { created.push(node as HTMLInputElement); vi.spyOn(node as HTMLInputElement, "click").mockImplementation(() => {}); }
      return node;
    }) as typeof document.createElement);
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ url: "https://cdn.example.com/up.png" }) }));
    vi.stubGlobal("fetch", fetchMock);

    const onChange = vi.fn();
    render(<ImagePickerControl value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Select Image/ }));
    const input = created.at(-1)!;
    expect(input.type).toBe("file");
    expect(input.accept).toBe("image/*,video/*,application/json,.json");
    expect(input.click).toHaveBeenCalledOnce();

    const file = new File(["png-bytes"], "pic.png", { type: "image/png" });
    Object.defineProperty(input, "files", { value: [file] });
    await act(async () => { await (input.onchange as any)({ target: input }); });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/upload");
    expect(init.method).toBe("POST");
    expect((init.body as FormData).get("file")).toBe(file);
    expect(onChange.mock.calls).toEqual([["https://cdn.example.com/up.png"]]);
  });

  it("falls back to a local data URL when the upload fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const onChange = vi.fn();
    const realCreate = document.createElement.bind(document);
    let input!: HTMLInputElement;
    vi.spyOn(document, "createElement").mockImplementation(((tag: string, opts?: ElementCreationOptions) => {
      const node = realCreate(tag, opts);
      if (tag === "input") { input = node as HTMLInputElement; vi.spyOn(input, "click").mockImplementation(() => {}); }
      return node;
    }) as typeof document.createElement);
    triggerImagePicker(onChange);
    Object.defineProperty(input, "files", { value: [new File(["hi"], "a.txt", { type: "text/plain" })] });
    await act(async () => { await (input.onchange as any)({ target: input }); });
    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange.mock.calls[0][0]).toBe("data:text/plain;base64,aGk=");
  });

  it("does nothing when no file is chosen", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const realCreate = document.createElement.bind(document);
    let input!: HTMLInputElement;
    vi.spyOn(document, "createElement").mockImplementation(((tag: string, opts?: ElementCreationOptions) => {
      const node = realCreate(tag, opts);
      if (tag === "input") { input = node as HTMLInputElement; vi.spyOn(input, "click").mockImplementation(() => {}); }
      return node;
    }) as typeof document.createElement);
    const onChange = vi.fn();
    triggerImagePicker(onChange);
    Object.defineProperty(input, "files", { value: [] });
    await act(async () => { await (input.onchange as any)({ target: input }); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("UniversalItemManager", () => {
  const [a, b, c] = ITEMS;
  const renderManager = (items = ITEMS) => {
    const onUpdate = vi.fn();
    const view = render(<UniversalItemManager {...itemManagerProps(items)} onUpdate={onUpdate} />);
    return { onUpdate, view };
  };
  const cards = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>("[data-item-index]"));

  it("add, delete, move up/down (bounded) and field edits", () => {
    const { onUpdate } = renderManager();
    fireEvent.click(screen.getByRole("button", { name: /\+ Add Item/ }));
    fireEvent.click(screen.getAllByTitle("Delete Item (Safe)")[1]);
    fireEvent.click(screen.getAllByTitle("Move Up")[0]);
    fireEvent.click(screen.getAllByTitle("Move Up")[2]);
    fireEvent.click(screen.getAllByTitle("Move Down")[2]);
    fireEvent.click(screen.getAllByTitle("Move Down")[0]);
    fireEvent.change(screen.getByLabelText("label-c"), { target: { value: "Charles" } });
    expect(onUpdate.mock.calls).toEqual([
      [[a, b, c, { id: "new-item", label: "New" }]],
      [[a, c]],
      [[a, c, b]],
      [[b, a, c]],
      [[a, b, { id: "c", label: "Charles" }]],
    ]);
  });

  it("duplicate inserts a copy after the item with a clock/random-derived id", () => {
    vi.useFakeTimers({ now: PROBE_NOW, toFake: ["Date"] });
    vi.spyOn(Math, "random").mockReturnValue(PROBE_RANDOM);
    const { onUpdate } = renderManager();
    fireEvent.click(screen.getAllByTitle("Duplicate Item")[0]);
    const id = "item_" + PROBE_NOW + "_" + PROBE_RANDOM.toString(36).substring(2, 7);
    expect(onUpdate.mock.calls).toEqual([[[a, { ...a, id }, b, c]]]);
  });

  it("pointer drag reorders on mouseup and removes its window listeners and cursor", () => {
    const { onUpdate, view } = renderManager();
    const added: Array<[string, unknown]> = [];
    const removed: Array<[string, unknown]> = [];
    const realAdd = window.addEventListener.bind(window);
    const realRemove = window.removeEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation(((t: string, l: any, o?: any) => { added.push([t, l]); realAdd(t, l, o); }) as any);
    vi.spyOn(window, "removeEventListener").mockImplementation(((t: string, l: any, o?: any) => { removed.push([t, l]); realRemove(t, l, o); }) as any);
    const target = cards(view.container)[2];
    (document as any).elementFromPoint = vi.fn(() => target.querySelector("span") ?? target);

    fireEvent.mouseDown(screen.getAllByTitle("Click & Drag mouse to reorder item")[0]);
    expect(document.body.style.cursor).toBe("grabbing");
    expect(added.map(([t]) => t)).toEqual(["mousemove", "mouseup"]);
    act(() => { window.dispatchEvent(new MouseEvent("mousemove", { clientX: 10, clientY: 20 })); });
    expect((document as any).elementFromPoint).toHaveBeenCalledWith(10, 20);
    act(() => { window.dispatchEvent(new MouseEvent("mouseup")); });

    expect(onUpdate.mock.calls).toEqual([[[b, c, a]]]);
    expect(document.body.style.cursor).toBe("");
    expect(removed).toEqual(added);
    // Listeners are gone: further events change nothing.
    act(() => { window.dispatchEvent(new MouseEvent("mousemove")); window.dispatchEvent(new MouseEvent("mouseup")); });
    expect(onUpdate).toHaveBeenCalledOnce();
    delete (document as any).elementFromPoint;
  });

  it("pointer drag released over the same item does not update", () => {
    const { onUpdate, view } = renderManager();
    (document as any).elementFromPoint = vi.fn(() => cards(view.container)[0]);
    fireEvent.mouseDown(screen.getAllByTitle("Click & Drag mouse to reorder item")[0]);
    act(() => { window.dispatchEvent(new MouseEvent("mousemove")); window.dispatchEvent(new MouseEvent("mouseup")); });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(document.body.style.cursor).toBe("");
    delete (document as any).elementFromPoint;
  });

  it("HTML5 drag-and-drop moves the dragged item to the drop target", () => {
    const { onUpdate, view } = renderManager();
    const data = new Map<string, string>();
    const dataTransfer = { setData: (k: string, v: string) => data.set(k, v), getData: (k: string) => data.get(k) ?? "", effectAllowed: "", dropEffect: "" };
    const [card0, , card2] = cards(view.container);
    fireEvent.dragStart(card0, { dataTransfer });
    expect(data.get("text/plain")).toBe("0");
    fireEvent.dragOver(card2, { dataTransfer });
    fireEvent.drop(card2, { dataTransfer });
    expect(onUpdate.mock.calls).toEqual([[[b, c, a]]]);
  });

  it("drop without a drag ref falls back to dataTransfer text", () => {
    const { onUpdate, view } = renderManager();
    const [, card1, card2] = cards(view.container);
    fireEvent.drop(card1, { dataTransfer: { getData: () => "2", dropEffect: "" } });
    fireEvent.drop(card2, { dataTransfer: { getData: () => "", dropEffect: "" } });
    expect(onUpdate.mock.calls).toEqual([[[a, c, b]]]);
  });
});
