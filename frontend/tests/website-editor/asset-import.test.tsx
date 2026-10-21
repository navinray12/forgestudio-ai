// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * Asset import (handleImportAsset: toolbar "Import Asset / File" and canvas drop), characterised before
 * the core/assetUpload extraction and kept as its contract: the upload request (FormData "image",
 * /api/v1/uploads/image, then /api/uploads/image on 404), the data-URL fallback, the in-flight label,
 * what is updated or inserted and selected, validation before any request, and the imported-asset
 * history in localStorage. No object URLs are used.
 *
 * The image and video inspector panels that call handleImageFileSelect / handleVideoFileSelect, and the
 * only place uploadError is rendered, are inside an inspector branch that cannot be reached
 * (`selectedElementAny ? … : activeSidebarTab === "advanced" && selectedElementAny ? …`), so those
 * handlers and the validation messages are covered through core/assetUpload directly (asset-upload.test.ts).
 */
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { API, flush, heading, mountEditor, siteFixture, type Route_ } from "./editor-harness";

vi.setConfig({ testTimeout: 60000 }); // heavy real-editor mounts; generous under full-suite CPU load

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* ignore */ }
});

const site = () => siteFixture({}, [{ id: "home", name: "Home", slug: "/", elements: [
  heading("elA", "Alpha heading"),
  { id: "img1", type: "image", src: "https://old.example.test/a.png", alt: "Old", styles: {} },
  { id: "vid1", type: "video", src: "", styles: {} },
] }]);
const file = (name: string, type: string, size?: number) => {
  const f = new File(["hello"], name, { type });
  if (size !== undefined) Object.defineProperty(f, "size", { value: size });
  return f;
};
const uploads = (requests: Array<{ method: string; url: string; body: unknown }>) => requests.filter((r) => r.url.includes("/uploads/"));
const uploadOk = (url: string): Route_ => (r) => (r.url.includes("/uploads/") ? { status: 200, body: { url } } : undefined);
const importInput = () => document.querySelector('input[type="file"][accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.json,.svg"]') as HTMLInputElement;
const choose = async (input: HTMLInputElement, f: File) => { await act(async () => { fireEvent.change(input, { target: { files: [f] } }); }); await flush(4); };
async function savedHome(editor: Awaited<ReturnType<typeof mountEditor>>) {
  const before = editor.backend.saves().length;
  await editor.key("s", { ctrlKey: true });
  await waitFor(() => expect(editor.backend.saves().length).toBe(before + 1));
  return (editor.backend.saves().at(-1)!.body as any).editorData.pages[0].elements as any[];
}

describe("handleImportAsset", () => {
  it("uploads to /api/v1/uploads/image, appends the element, selects it and records the history", async () => {
    const editor = await mountEditor(site(), [uploadOk("https://cdn.example.test/new.png")]);
    await choose(importInput(), file("logo.png", "image/png"));
    const [req] = uploads(editor.backend.requests);
    expect(uploads(editor.backend.requests)).toHaveLength(1);
    expect([req.method, req.url]).toEqual(["POST", `${API}/api/v1/uploads/image`]);
    expect(((req.body as FormData).get("image") as File).name).toBe("logo.png");
    const els = await savedHome(editor);
    expect(els).toHaveLength(4);
    const added = els[3];
    expect(added).toEqual({
      id: expect.any(String), type: "image", content: "logo.png", src: "https://cdn.example.test/new.png", href: "https://cdn.example.test/new.png",
      alt: "logo.png", assetType: "image", styles: { width: "100%", borderRadius: "12px", marginTop: "16px", marginBottom: "16px" },
    });
    expect(editor.canvasEl(added.id)).not.toBeNull();
    expect(screen.getAllByText("image").some((n) => n.className.includes("uppercase"))).toBe(true); // the inspector shows the new, selected element
    const history = JSON.parse(localStorage.getItem("forgestudio_imported_assets")!);
    expect(history).toEqual([{ name: "logo.png", url: "https://cdn.example.test/new.png", type: "image/png", date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) }]);
  });

  it("a 404 retries /api/uploads/image; a response without a url falls back to a data URL", async () => {
    const editor = await mountEditor(site(), [(r) => (r.url === `${API}/api/v1/uploads/image` ? { status: 404, body: {} } : r.url === `${API}/api/uploads/image` ? { status: 200, body: {} } : undefined)]);
    await choose(importInput(), file("pic.webp", "image/webp"));
    expect(uploads(editor.backend.requests).map((r) => r.url)).toEqual([`${API}/api/v1/uploads/image`, `${API}/api/uploads/image`]);
    const added = (await savedHome(editor))[3];
    expect(added.src).toMatch(/^data:image\/webp;base64,/);
    expect(added.href).toBe(added.src);
  });

  it("a network failure also falls back to a data URL", async () => {
    const editor = await mountEditor(site(), [(r) => (r.url.includes("/uploads/") ? Promise.reject(new TypeError("Failed to fetch")) as never : undefined)]);
    await choose(importInput(), file("pic.gif", "image/gif"));
    expect((await savedHome(editor))[3].src).toMatch(/^data:image\/gif;base64,/);
  });

  it("data.url is used when the response has no top-level url", async () => {
    const editor = await mountEditor(site(), [(r) => (r.url.includes("/uploads/") ? { status: 200, body: { data: { url: "https://cdn.example.test/nested.png" } } } : undefined)]);
    await choose(importInput(), file("n.png", "image/png"));
    expect((await savedHome(editor))[3].src).toBe("https://cdn.example.test/nested.png");
  });

  it("with an image selected, the import replaces its src and href instead of inserting", async () => {
    const editor = await mountEditor(site(), [uploadOk("https://cdn.example.test/replaced.png")]);
    await editor.select("img1");
    await choose(importInput(), file("r.png", "image/png"));
    const els = await savedHome(editor);
    expect(els).toHaveLength(3);
    expect(els[1]).toMatchObject({ id: "img1", src: "https://cdn.example.test/replaced.png", href: "https://cdn.example.test/replaced.png" });
  });

  it("with another element selected, the asset is still appended at the end", async () => {
    const editor = await mountEditor(site(), [uploadOk("https://cdn.example.test/after.png")]);
    await editor.select("elA");
    await choose(importInput(), file("after.png", "image/png"));
    expect((await savedHome(editor)).map((e) => e.src ?? e.id)).toEqual(["elA", "https://old.example.test/a.png", "", "https://cdn.example.test/after.png"]);
  });

  it("rejects other types and files over 5 MB before any request; nothing is inserted", async () => {
    const editor = await mountEditor(site());
    await choose(importInput(), file("doc.pdf", "application/pdf"));
    await choose(importInput(), file("big.png", "image/png", 5 * 1024 * 1024 + 1));
    expect(uploads(editor.backend.requests)).toHaveLength(0);
    expect((await savedHome(editor)).map((e) => e.id)).toEqual(["elA", "img1", "vid1"]);
    expect(localStorage.getItem("forgestudio_imported_assets")).toBeNull();
  });

  it("shows Importing Asset... while the upload is in flight", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    await mountEditor(site(), [(r) => (r.url.includes("/uploads/") ? gate.then(() => ({ status: 200, body: { url: "https://cdn.example.test/slow.png" } })) : undefined)]);
    await choose(importInput(), file("slow.png", "image/png"));
    expect(screen.getAllByText("Importing Asset...").length).toBeGreaterThan(0);
    await act(async () => { release(); });
    await flush(4);
    expect(screen.queryAllByText("Importing Asset...")).toHaveLength(0);
  });
});
