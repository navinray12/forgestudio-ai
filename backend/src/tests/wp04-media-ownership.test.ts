import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  websiteFind: vi.fn(),
  assetFind: vi.fn(),
  assetCreate: vi.fn(),
  assetUpdate: vi.fn(),
  assetDelete: vi.fn(),
  assetList: vi.fn(),
  assetCount: vi.fn(),
}));

vi.mock("../config/prisma.js", () => ({
  prisma: {
    website: { findFirst: h.websiteFind },
    mediaAsset: {
      findFirst: h.assetFind,
      findMany: h.assetList,
      count: h.assetCount,
      create: h.assetCreate,
      update: h.assetUpdate,
      delete: h.assetDelete,
    },
  },
}));

import {
  createMediaAsset,
  listMediaAssets,
  updateMediaAsset,
} from "../services/media.service.js";

const OWNER = "00000000-0000-4000-8000-000000000001";
const OWN_SITE = "00000000-0000-4000-8000-000000000002";
const FOREIGN_SITE = "00000000-0000-4000-8000-000000000003";
const ASSET = { id: "asset-1", userId: OWNER, filename: "logo.png" };
const upload = {
  userId: OWNER,
  filename: "logo.png",
  originalName: "logo.png",
  mimeType: "image/png",
  sizeBytes: 1536,
  url: "/assets/logo.png",
};

beforeEach(() => {
  vi.clearAllMocks();
  h.websiteFind.mockImplementation(async ({ where }) =>
    where.id === OWN_SITE && where.userId === OWNER ? { id: OWN_SITE } : null);
  h.assetFind.mockResolvedValue(ASSET);
  h.assetCreate.mockResolvedValue(ASSET);
  h.assetUpdate.mockResolvedValue({ ...ASSET, websiteId: OWN_SITE });
  h.assetList.mockResolvedValue([]);
  h.assetCount.mockResolvedValue(0);
});

describe("WP-04 media library website ownership", () => {
  it("creates an account-wide media asset without a site assignment", async () => {
    await createMediaAsset(upload);
    expect(h.websiteFind).not.toHaveBeenCalled();
    expect(h.assetCreate).toHaveBeenCalledOnce();
  });

  it("allows media creation for a site owned by the asset owner", async () => {
    await createMediaAsset({ ...upload, websiteId: OWN_SITE });
    expect(h.websiteFind).toHaveBeenCalledWith({
      where: { id: OWN_SITE, userId: OWNER }, select: { id: true },
    });
    expect(h.assetCreate).toHaveBeenCalledOnce();
  });

  it("blocks creating media attached to another tenant's website", async () => {
    await expect(createMediaAsset({ ...upload, websiteId: FOREIGN_SITE }))
      .rejects.toMatchObject({ statusCode: 404, code: "WEBSITE_NOT_FOUND" });
    expect(h.assetCreate).not.toHaveBeenCalled();
  });

  it("rejects invalid site identifiers without querying a cross-tenant asset", async () => {
    await expect(createMediaAsset({ ...upload, websiteId: "../other" }))
      .rejects.toMatchObject({ code: "WEBSITE_NOT_FOUND" });
    expect(h.websiteFind).not.toHaveBeenCalled();
    expect(h.assetCreate).not.toHaveBeenCalled();
  });

  it("rejects foreign-site media listing rather than returning account-wide assets", async () => {
    await expect(listMediaAssets(OWNER, { websiteId: FOREIGN_SITE }))
      .rejects.toMatchObject({ code: "WEBSITE_NOT_FOUND" });
    expect(h.assetList).not.toHaveBeenCalled();
    expect(h.assetCount).not.toHaveBeenCalled();
  });

  it("lists site-specific and account-wide media within the owner's account", async () => {
    await listMediaAssets(OWNER, { websiteId: OWN_SITE });
    expect(h.assetList).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: OWNER, OR: [{ websiteId: OWN_SITE }, { websiteId: null }] },
    }));
  });

  it("rejects reassigning owned assets to someone else's website", async () => {
    await expect(updateMediaAsset("asset-1", OWNER, { websiteId: FOREIGN_SITE }))
      .rejects.toMatchObject({ code: "WEBSITE_NOT_FOUND" });
    expect(h.assetUpdate).not.toHaveBeenCalled();
  });

  it("allows updating ordinary asset metadata without a destination site", async () => {
    await updateMediaAsset("asset-1", OWNER, { altText: "Logo" });
    expect(h.websiteFind).not.toHaveBeenCalled();
    expect(h.assetUpdate).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: { altText: "Logo", websiteId: undefined },
    });
  });

  it("never allows changes to an asset that is not owned by the caller", async () => {
    h.assetFind.mockResolvedValue(null);
    await expect(updateMediaAsset("asset-1", OWNER, { websiteId: OWN_SITE }))
      .rejects.toMatchObject({ code: "MEDIA_NOT_FOUND", statusCode: 404 });
    expect(h.assetUpdate).not.toHaveBeenCalled();
  });
});
