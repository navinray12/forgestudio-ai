import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import type { Request, Response, NextFunction } from "express";

const h = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("../services/media.service.js", () => ({
  createMediaAsset: h.save,
  extractImageDimensions: () => ({ width: 1, height: 1 }),
}));

import { detectRasterImage, handleImageUpload } from "../middlewares/upload.middleware.js";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");
const directory = path.join(process.cwd(), "uploads", "images");
const originalEnv = process.env.NODE_ENV;

function request(buffer: Buffer, contentType = "image/png") {
  return {
    headers: { "content-type": contentType },
    async *[Symbol.asyncIterator]() { yield buffer; },
  } as unknown as Request;
}
function response(authenticated = true) {
  const json = vi.fn().mockImplementation((payload) => payload);
  const res = {
    locals: authenticated ? { user: { id: "owner-1" } } : {},
    status: vi.fn().mockReturnThis(),
    json,
  } as unknown as Response;
  return { res, json };
}
async function upload(buffer: Buffer, type = "image/png", authenticated = true) {
  const { res, json } = response(authenticated);
  const next = vi.fn() as unknown as NextFunction;
  await handleImageUpload(request(buffer, type), res, next);
  return { status: (res.status as ReturnType<typeof vi.fn>).mock.calls[0]?.[0], result: json.mock.calls[0]?.[0], next };
}
async function stored() {
  return (await fs.readdir(directory)).filter((file) => /^img_\d+_[a-f0-9]{12}\.(jpg|png|webp|gif)$/.test(file));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NODE_ENV = "test";
  h.save.mockResolvedValue({ id: "asset-1", userId: "owner-1" });
});

afterEach(() => {
  if (originalEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv;
});

describe("WP-04 legacy local image upload safety", () => {
  it("detects real supported raster content regardless of claimed MIME", () => {
    expect(detectRasterImage(PNG)).toEqual({ extension: "png", mimeType: "image/png" });
    expect(detectRasterImage(Buffer.from("<html><script>danger</script></html>"))).toBeNull();
    expect(detectRasterImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
  });

  it("does not allow the legacy local disk upload endpoint in production", async () => {
    process.env.NODE_ENV = "production";
    const res = await upload(PNG);
    expect(res.status).toBe(503);
    expect(res.result.error.code).toBe("DURABLE_UPLOAD_REQUIRED");
    expect(h.save).not.toHaveBeenCalled();
  });

  it("rejects forged image content before persisting any file", async () => {
    const before = await stored();
    const res = await upload(Buffer.from("<html>fake image</html>"));
    expect(res.status).toBe(415);
    expect(await stored()).toEqual(before);
    expect(h.save).not.toHaveBeenCalled();
  });

  it("rejects SVG with active content from this unsanitized route", async () => {
    const res = await upload(Buffer.from('<svg onload="alert(1)"></svg>'), "image/svg+xml");
    expect(res.status).toBe(415);
    expect(h.save).not.toHaveBeenCalled();
  });

  it("rolls back the local file if metadata persistence fails", async () => {
    const before = await stored();
    h.save.mockRejectedValueOnce(new Error("database down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await upload(PNG);
      expect(res.status).toBe(503);
      expect(res.result).toMatchObject({ success: false, error: { code: "MEDIA_PERSISTENCE_UNAVAILABLE" } });
      expect(await stored()).toEqual(before);
    } finally { spy.mockRestore(); }
  });

  it("returns a saved asset only after its metadata is committed", async () => {
    const res = await upload(PNG);
    expect(res.status).toBe(200);
    expect(res.result.success).toBe(true);
    expect(res.result.asset.id).toBe("asset-1");
    expect(h.save).toHaveBeenCalledWith(expect.objectContaining({
      mimeType: "image/png", userId: "owner-1", sizeBytes: PNG.length,
    }));
    const filename = path.basename(res.result.url);
    try {
      expect(await fs.stat(path.join(directory, filename))).toBeTruthy();
    } finally {
      await fs.unlink(path.join(directory, filename)).catch(() => undefined);
    }
  });

  it("rejects unauthenticated uploads before disk persistence", async () => {
    const before = await stored();
    const res = await upload(PNG, "image/png", false);
    expect(res.status).toBe(401);
    expect(await stored()).toEqual(before);
    expect(h.save).not.toHaveBeenCalled();
  });
});
