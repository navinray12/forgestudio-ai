import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  bucketFind: vi.fn(),
  objectCreate: vi.fn(),
  bucketUpdate: vi.fn(),
  head: vi.fn(),
  tx: vi.fn(),
}));

vi.mock("../config/prisma.js", () => ({
  prisma: {
    storageBucket: { findUnique: h.bucketFind },
    $transaction: h.tx,
  },
}));
vi.mock("../modules/data-platform/storage/s3-client.js", () => ({
  headObject: h.head,
  getPresignedPutUrl: vi.fn(),
  ensureBucketExists: vi.fn(),
}));
import { confirmUpload } from "../modules/data-platform/storage/upload-presigner.service.js";

const site = "00000000-0000-4000-8000-000000000001";
const foreign = "00000000-0000-4000-8000-000000000002";
const bucket = {
  id: "bucket-1", websiteId: site, name: "site-assets",
  usedSizeBytes: 0n, maxSizeBytes: 10000n,
};
const params = {
  websiteId: site, bucketId: "bucket-1",
  objectKey: site + "/hero.png", originalName: "hero.png",
  mimeType: "image/png", sizeBytes: 1200,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.bucketFind.mockResolvedValue(bucket);
  h.head.mockResolvedValue({ contentLength: 1200, contentType: "image/png" });
  h.objectCreate.mockResolvedValue({ id: "object-1" });
  h.bucketUpdate.mockResolvedValue({});
  h.tx.mockImplementation(async (fn) => fn({
    storageBucket: { findUnique: h.bucketFind, update: h.bucketUpdate },
    storageObject: { create: h.objectCreate },
  }));
});

describe("WP-04 confirmed storage object trust boundary", () => {
  it("rejects using another website's bucket without contacting S3", async () => {
    h.bucketFind.mockResolvedValue({ ...bucket, websiteId: foreign });
    await expect(confirmUpload(params)).rejects.toMatchObject({ statusCode: 404, code: "BUCKET_NOT_FOUND" });
    expect(h.head).not.toHaveBeenCalled();
    expect(h.tx).not.toHaveBeenCalled();
  });

  it("rejects a key outside the authorized website prefix", async () => {
    await expect(confirmUpload({ ...params, objectKey: foreign + "/secret.png" }))
      .rejects.toMatchObject({ code: "INVALID_UPLOAD_CONFIRMATION" });
    expect(h.head).not.toHaveBeenCalled();
  });

  it("requires actual S3 HEAD evidence before claiming upload success", async () => {
    h.head.mockRejectedValue(new Error("NoSuchKey"));
    await expect(confirmUpload(params)).rejects.toThrow("NoSuchKey");
    expect(h.tx).not.toHaveBeenCalled();
  });

  it("rejects client-forged size and content type claims", async () => {
    h.head.mockResolvedValue({ contentLength: 500, contentType: "image/png" });
    await expect(confirmUpload(params)).rejects.toMatchObject({ code: "UPLOAD_METADATA_MISMATCH" });
    h.head.mockResolvedValue({ contentLength: 1200, contentType: "text/html" });
    await expect(confirmUpload(params)).rejects.toMatchObject({ code: "UPLOAD_METADATA_MISMATCH" });
    expect(h.tx).not.toHaveBeenCalled();
  });

  it("rechecks tenant bucket and quota inside the database transaction", async () => {
    h.bucketFind.mockResolvedValueOnce(bucket).mockResolvedValueOnce({ ...bucket, usedSizeBytes: 9000n });
    await expect(confirmUpload(params)).rejects.toMatchObject({ code: "STORAGE_QUOTA_EXCEEDED" });
    expect(h.objectCreate).not.toHaveBeenCalled();
  });

  it("persists a verified upload scoped to the owning website", async () => {
    await expect(confirmUpload(params)).resolves.toMatchObject({ id: "object-1" });
    expect(h.head).toHaveBeenCalledWith("site-assets", site + "/hero.png");
    expect(h.objectCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      bucketId: "bucket-1", objectKey: site + "/hero.png", mimeType: "image/png", sizeBytes: 1200n,
    }) });
    expect(h.bucketUpdate).toHaveBeenCalled();
  });
});
