// @vitest-environment jsdom
/* global describe, it, expect, vi, afterEach -- vitest globals (globals: true); declared for `eslint .` */
/**
 * core/assetUpload: validation rules and messages (image panel, video panel, import), the upload with
 * its legacy-route retry and data-URL fallback, the import history and the imported element. The image
 * and video panels are unreachable in the current UI, so this is where those handlers' behaviour is
 * pinned; the import flow is also covered end to end in asset-import.
 */
import { assetFileError, buildImportedAssetElement, IMAGE_UPLOAD_RULE, IMPORT_ASSET_RULE, recordImportedAsset, uploadOrReadAsDataUrl, VIDEO_UPLOAD_RULE } from "../../src/pages/editor/core/assetUpload";

const API_URL = "http://api.test";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); try { localStorage.clear(); } catch { /* ignore */ } });

const file = (name: string, type: string, size?: number) => {
  const f = new File(["hello"], name, { type });
  if (size !== undefined) Object.defineProperty(f, "size", { value: size });
  return f;
};
function stubFetch(replies: Array<{ status: number; body?: unknown } | Error>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = replies[calls.length - 1];
    if (r instanceof Error) throw r;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body } as Response;
  }));
  return calls;
}

describe("assetFileError", () => {
  it("image panel: the five image types up to 5 MB", () => {
    for (const t of ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]) expect(assetFileError(file("a", t, 5 * 1024 * 1024), IMAGE_UPLOAD_RULE)).toBeNull();
    expect(assetFileError(file("a", "image/bmp"), IMAGE_UPLOAD_RULE)).toBe("Please select a valid image file (JPG, PNG, WEBP, GIF, SVG).");
    expect(assetFileError(file("a", "image/png", 5 * 1024 * 1024 + 1), IMAGE_UPLOAD_RULE)).toBe("Image size must be less than 5 MB.");
    expect(assetFileError(file("a", "text/plain", 99 * 1024 * 1024), IMAGE_UPLOAD_RULE)).toBe("Please select a valid image file (JPG, PNG, WEBP, GIF, SVG)."); // type before size
  });

  it("video panel: the listed types or any video/*, up to 50 MB", () => {
    for (const t of ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-matroska"]) expect(assetFileError(file("v", t, 50 * 1024 * 1024), VIDEO_UPLOAD_RULE)).toBeNull();
    expect(assetFileError(file("v", "audio/mpeg"), VIDEO_UPLOAD_RULE)).toBe("Please select a valid video file (MP4, WEBM, OGG, MOV).");
    expect(assetFileError(file("v", "video/mp4", 50 * 1024 * 1024 + 1), VIDEO_UPLOAD_RULE)).toBe("Video file size must be less than 50 MB.");
  });

  it("import: image types up to 5 MB, with the import messages", () => {
    expect(assetFileError(file("i", "image/png"), IMPORT_ASSET_RULE)).toBeNull();
    expect(assetFileError(file("i", "video/mp4"), IMPORT_ASSET_RULE)).toBe("Invalid file type. Supported: JPG, PNG, WEBP, GIF, SVG.");
    expect(assetFileError(file("i", "image/png", 5 * 1024 * 1024 + 1), IMPORT_ASSET_RULE)).toBe("Imported asset size must be less than 5 MB.");
  });
});

describe("uploadOrReadAsDataUrl", () => {
  it("posts the file as the rule's field with credentials and returns url, then data.url", async () => {
    const calls = stubFetch([{ status: 200, body: { url: "https://cdn/a.mp4" } }]);
    const f = file("clip.mp4", "video/mp4");
    expect(await uploadOrReadAsDataUrl(API_URL, f, VIDEO_UPLOAD_RULE)).toBe("https://cdn/a.mp4");
    expect(calls.map((c) => c.url)).toEqual([`${API_URL}/api/v1/uploads/video`]);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.credentials).toBe("include");
    expect((calls[0].init.body as FormData).get("video")).toBe(f);
    stubFetch([{ status: 200, body: { data: { url: "https://cdn/nested.png" } } }]);
    expect(await uploadOrReadAsDataUrl(API_URL, file("a.png", "image/png"), IMAGE_UPLOAD_RULE)).toBe("https://cdn/nested.png");
  });

  it("retries the legacy route once on 404 only, reusing the same FormData", async () => {
    const calls = stubFetch([{ status: 404 }, { status: 200, body: { url: "https://cdn/legacy.png" } }]);
    expect(await uploadOrReadAsDataUrl(API_URL, file("a.png", "image/png"), IMAGE_UPLOAD_RULE)).toBe("https://cdn/legacy.png");
    expect(calls.map((c) => c.url)).toEqual([`${API_URL}/api/v1/uploads/image`, `${API_URL}/api/uploads/image`]);
    expect(calls[1].init.body).toBe(calls[0].init.body);
    const noRetry = stubFetch([{ status: 500 }]);
    expect(await uploadOrReadAsDataUrl(API_URL, file("a.png", "image/png"), IMAGE_UPLOAD_RULE)).toMatch(/^data:image\/png;base64,/);
    expect(noRetry).toHaveLength(1);
  });

  it("falls back to a data URL on a network error or a response without a url", async () => {
    stubFetch([new TypeError("Failed to fetch")]);
    expect(await uploadOrReadAsDataUrl(API_URL, file("v.webm", "video/webm"), VIDEO_UPLOAD_RULE)).toMatch(/^data:video\/webm;base64,/);
    stubFetch([{ status: 200, body: {} }]);
    expect(await uploadOrReadAsDataUrl(API_URL, file("a.gif", "image/gif"), IMPORT_ASSET_RULE)).toMatch(/^data:image\/gif;base64,/);
  });

  it("rejects with the rule's read error when the fallback cannot read the file", async () => {
    stubFetch([new TypeError("offline"), new TypeError("offline"), new TypeError("offline")]);
    const RealReader = globalThis.FileReader;
    vi.stubGlobal("FileReader", class extends RealReader { readAsDataURL() { setTimeout(() => this.onerror?.(new ProgressEvent("error") as any), 0); } });
    await expect(uploadOrReadAsDataUrl(API_URL, file("a.png", "image/png"), IMAGE_UPLOAD_RULE)).rejects.toThrow("Failed to read image file.");
    await expect(uploadOrReadAsDataUrl(API_URL, file("v.mp4", "video/mp4"), VIDEO_UPLOAD_RULE)).rejects.toThrow("Failed to read video file.");
    await expect(uploadOrReadAsDataUrl(API_URL, file("i.png", "image/png"), IMPORT_ASSET_RULE)).rejects.toThrow("Failed to read imported file.");
  });
});

describe("import helpers", () => {
  it("recordImportedAsset keeps the newest 50 entries, newest first, and ignores storage errors", () => {
    localStorage.setItem("forgestudio_imported_assets", JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ name: `old${i}` }))));
    recordImportedAsset(file("new.png", "image/png"), "https://cdn/new.png");
    const history = JSON.parse(localStorage.getItem("forgestudio_imported_assets")!);
    expect(history).toHaveLength(50);
    expect(history[0]).toEqual({ name: "new.png", url: "https://cdn/new.png", type: "image/png", date: expect.stringMatching(/^\d{4}-/) });
    expect(history[49]).toEqual({ name: "old48" });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => recordImportedAsset(file("x.png", "image/png"), "u")).not.toThrow();
  });

  it("buildImportedAssetElement: type and assetType from the MIME type / extension, same key order", () => {
    const cases: Array<[string, string, string, string]> = [
      ["a.png", "image/png", "image", "image"], ["v.mp4", "video/mp4", "video", "video"], ["s.mp3", "audio/mpeg", "audio-playlist", "audio"],
      ["anim.json", "application/json", "lottie", "file"], ["doc.pdf", "application/pdf", "import-asset", "file"],
    ];
    for (const [name, type, elType, assetType] of cases) {
      const el = buildImportedAssetElement(file(name, type), "U", "id1");
      expect(el).toEqual({ id: "id1", type: elType, content: name, src: "U", href: "U", alt: name, assetType, styles: { width: "100%", borderRadius: "12px", marginTop: "16px", marginBottom: "16px" } });
      expect(Object.keys(el)).toEqual(["id", "type", "content", "src", "href", "alt", "assetType", "styles"]);
    }
    expect(buildImportedAssetElement(file("", "image/png"), "U", "id2")).toMatchObject({ content: "Imported Asset", alt: "Imported Asset" });
  });
});
