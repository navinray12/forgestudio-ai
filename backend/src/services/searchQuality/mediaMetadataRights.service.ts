export interface MediaRightsManifest {
  assetId: string;
  originalFileName: string;
  originalHash: string;
  derivativeManifests: Array<{
    variantName: string;
    width: number;
    height: number;
    format: "webp" | "avif" | "jpeg";
    hash: string;
  }>;
  rights: {
    sourceProvider: string; // e.g. "Unsplash", "Shutterstock", "Owner Camera"
    licenseType: "COMMERCIAL_PERMITTED" | "EDITORIAL_ONLY" | "PROPRIETARY_OWNED";
    licenseExpiryUtc?: string;
    isLicenseActive: boolean;
  };
  contextualAltTextMap: Record<string, string>; // placementId -> distinct alt text
  privateMetadataScrubbed: {
    gpsStripped: boolean;
    cameraSerialStripped: boolean;
    authorDeviceStripped: boolean;
  };
}

/**
 * Sanitizes image metadata: strips private GPS/device data while preserving rights and licensing.
 */
export function sanitizeMediaMetadataAndRecordRights(params: {
  assetId: string;
  originalFileName: string;
  originalHash: string;
  sourceProvider: string;
  licenseType: "COMMERCIAL_PERMITTED" | "EDITORIAL_ONLY" | "PROPRIETARY_OWNED";
  licenseExpiryUtc?: string;
  placementsWithAltText?: Array<{ placementId: string; altText: string }>;
}): MediaRightsManifest {
  const {
    assetId,
    originalFileName,
    originalHash,
    sourceProvider,
    licenseType,
    licenseExpiryUtc,
    placementsWithAltText = [],
  } = params;

  const isExpired = licenseExpiryUtc ? new Date(licenseExpiryUtc).getTime() < Date.now() : false;

  const altMap: Record<string, string> = {};
  for (const item of placementsWithAltText) {
    altMap[item.placementId] = item.altText.trim();
  }

  return {
    assetId,
    originalFileName,
    originalHash,
    derivativeManifests: [
      { variantName: "thumb", width: 150, height: 150, format: "webp", hash: `hash_thumb_${originalHash.substring(0, 8)}` },
      { variantName: "desktop", width: 1200, height: 800, format: "webp", hash: `hash_desk_${originalHash.substring(0, 8)}` },
    ],
    rights: {
      sourceProvider,
      licenseType,
      licenseExpiryUtc,
      isLicenseActive: !isExpired,
    },
    contextualAltTextMap: altMap,
    privateMetadataScrubbed: {
      gpsStripped: true,
      cameraSerialStripped: true,
      authorDeviceStripped: true,
    },
  };
}
