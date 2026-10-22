import type { EditorElement, ElementType } from "../types";

/**
 * Upload / import of image, video and other asset files, moved from WebsiteEditor's
 * handleImageFileSelect, handleVideoFileSelect and handleImportAsset (which stay in the editor and
 * keep their state updates, logs and error fallbacks). Behaviour is unchanged: validation before any
 * request; POST multipart to /api/v1/uploads/<field>, retried once at /api/uploads/<field> on 404;
 * any failure or a response without a url falls back to a data URL read from the file.
 */
export interface AssetUploadRule {
  /** Accepted MIME types. */
  types: string[];
  /** Also accepted: any type with this prefix (video only). */
  anyTypePrefix?: string;
  typeError: string;
  maxBytes: number;
  sizeError: string;
  /** Multipart field name and upload route segment. */
  field: "image" | "video";
  /** Message when the data-URL fallback cannot read the file. */
  readError: string;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

export const IMAGE_UPLOAD_RULE: AssetUploadRule = {
  types: IMAGE_TYPES,
  typeError: "Please select a valid image file (JPG, PNG, WEBP, GIF, SVG).",
  maxBytes: 5 * 1024 * 1024,
  sizeError: "Image size must be less than 5 MB.",
  field: "image",
  readError: "Failed to read image file.",
};

export const VIDEO_UPLOAD_RULE: AssetUploadRule = {
  types: ["video/mp4", "video/webm", "video/ogg", "video/quicktime"],
  anyTypePrefix: "video/",
  typeError: "Please select a valid video file (MP4, WEBM, OGG, MOV).",
  maxBytes: 50 * 1024 * 1024,
  sizeError: "Video file size must be less than 50 MB.",
  field: "video",
  readError: "Failed to read video file.",
};

export const IMPORT_ASSET_RULE: AssetUploadRule = {
  types: IMAGE_TYPES,
  typeError: "Invalid file type. Supported: JPG, PNG, WEBP, GIF, SVG.",
  maxBytes: 5 * 1024 * 1024,
  sizeError: "Imported asset size must be less than 5 MB.",
  field: "image",
  readError: "Failed to read imported file.",
};

/** The validation message for a file, or null when it may be uploaded (type is checked before size). */
export function assetFileError(file: File, rule: AssetUploadRule): string | null {
  if (!rule.types.includes(file.type) && !(rule.anyTypePrefix !== undefined && file.type.startsWith(rule.anyTypePrefix))) {
    return rule.typeError;
  }
  if (file.size > rule.maxBytes) {
    return rule.sizeError;
  }
  return null;
}

/** Uploads the file and returns its URL, or a data URL of the file when the upload does not give one. Rejects only if the file cannot be read. */
export async function uploadOrReadAsDataUrl(apiUrl: string, file: File, rule: AssetUploadRule): Promise<string> {
  let finalUrl = "";
  try {
    const formData = new FormData();
    formData.append(rule.field, file);

    let uploadRes = await fetch(`${apiUrl}/api/v1/uploads/${rule.field}`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!uploadRes.ok && uploadRes.status === 404) {
      uploadRes = await fetch(`${apiUrl}/api/uploads/${rule.field}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
    }

    if (uploadRes.ok) {
      const uploadData = await uploadRes.json();
      finalUrl = uploadData.url || uploadData?.data?.url || "";
    }
  } catch {
    // Fallback to local Data URL
  }

  if (!finalUrl) {
    finalUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(rule.readError));
      reader.readAsDataURL(file);
    });
  }
  return finalUrl;
}

/** Prepends the import to the local asset history (forgestudio_imported_assets, newest first, at most 50). Storage errors are ignored. */
export function recordImportedAsset(file: File, finalUrl: string): void {
  try {
    const historyRaw = localStorage.getItem("forgestudio_imported_assets");
    const history = historyRaw ? JSON.parse(historyRaw) : [];
    history.unshift({ name: file.name, url: finalUrl, type: file.type, date: new Date().toISOString() });
    localStorage.setItem("forgestudio_imported_assets", JSON.stringify(history.slice(0, 50)));
  } catch { }
}

/** The element an import inserts: its type from the file's MIME type / extension, src and href set to the URL. */
export function buildImportedAssetElement(file: File, finalUrl: string, id: string): EditorElement {
  let detectedType: ElementType = "image";
  if (file.type.startsWith("video/")) {
    detectedType = "video" as ElementType;
  } else if (file.type.startsWith("audio/")) {
    detectedType = "audio-playlist";
  } else if (file.name.endsWith(".json")) {
    detectedType = "lottie";
  } else if (!file.type.startsWith("image/")) {
    detectedType = "import-asset";
  }

  return {
    id,
    type: detectedType,
    content: file.name || "Imported Asset",
    src: finalUrl,
    href: finalUrl,
    alt: file.name || "Imported Asset",
    assetType: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "file",
    styles: {
      width: "100%",
      borderRadius: "12px",
      marginTop: "16px",
      marginBottom: "16px",
    },
  };
}
