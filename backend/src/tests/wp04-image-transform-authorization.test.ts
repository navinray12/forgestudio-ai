import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

const h = vi.hoisted(() => ({
  objectFind: vi.fn(),
  transform: vi.fn(),
}));

vi.mock("../config/prisma.js", () => ({
  prisma: { storageObject: { findFirst: h.objectFind } },
}));
vi.mock("../modules/data-platform/storage/image-transformer.service.js", () => ({
  transformImage: h.transform,
}));
vi.mock("../modules/data-platform/storage/upload-presigner.service.js", () => ({}));

import { transformImageHandler } from "../modules/data-platform/storage/storage.controller.js";

beforeEach(() => {
  vi.clearAllMocks();
  h.objectFind.mockResolvedValue(null);
  h.transform.mockResolvedValue({ buffer: Buffer.from("safe"), contentType: "image/webp" });
});

async function invoke(projectId: string, objectKey: string, bucket = "default") {
  const next = vi.fn();
  const setHeader = vi.fn();
  const send = vi.fn();
  const res = {
    setHeader,
    status: vi.fn().mockReturnThis(),
    send,
  } as unknown as Response;
  await transformImageHandler({
    params: { projectId, objectKey },
    query: { bucket },
  } as unknown as Request, res, next as unknown as NextFunction);
  return { next, send, setHeader };
}
const site = "11111111-1111-4111-8111-111111111111";

describe("WP-04 public image transform authorization", () => {
  it("blocks unknown object keys before downloading S3 data", async () => {
    const { next } = await invoke(site, site + "/not-confirmed.png");
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 404, code: "IMAGE_NOT_FOUND",
    }));
    expect(h.transform).not.toHaveBeenCalled();
  });

  it("blocks a key from another tenant even if S3 bucket name is the same", async () => {
    const { next } = await invoke(site, "different-site/secret.png");
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "IMAGE_NOT_FOUND" }));
    expect(h.objectFind).not.toHaveBeenCalled();
    expect(h.transform).not.toHaveBeenCalled();
  });

  it("blocks path traversal and malformed bucket selectors", async () => {
    const first = await invoke(site, site + "/../../private.png");
    const second = await invoke(site, site + "/valid.png", "../admin");
    expect(first.next).toHaveBeenCalledWith(expect.objectContaining({ code: "IMAGE_NOT_FOUND" }));
    expect(second.next).toHaveBeenCalledWith(expect.objectContaining({ code: "IMAGE_NOT_FOUND" }));
    expect(h.transform).not.toHaveBeenCalled();
  });

  it("requires the registered object to belong to an explicitly public bucket", async () => {
    h.objectFind.mockResolvedValue({ id: "public-obj" });
    const { next, send } = await invoke(site, site + "/cover.png", "published");
    expect(next).not.toHaveBeenCalled();
    expect(h.objectFind).toHaveBeenCalledWith({
      where: {
        objectKey: site + "/cover.png",
        bucket: { websiteId: site, name: "published", visibility: "PUBLIC" },
      },
      select: { id: true },
    });
    expect(h.transform).toHaveBeenCalledWith("published", site + "/cover.png", expect.any(Object));
    expect(send).toHaveBeenCalledWith(Buffer.from("safe"));
  });

  it("does not transform a private or unregistered media object", async () => {
    h.objectFind.mockResolvedValue(null);
    const { next } = await invoke(site, site + "/private.png");
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "IMAGE_NOT_FOUND" }));
    expect(h.transform).not.toHaveBeenCalled();
  });
});
