import type { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "images");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MULTIPART_OVERHEAD = 128 * 1024;

/** Use file signatures, never client-controlled names or MIME, to select a stored media type. */
export function detectRasterImage(buffer: Buffer): { extension: string; mimeType: string } | null {
  if (buffer.length >= 24 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) {
    return { extension: "png", mimeType: "image/png" };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }
  if (buffer.length >= 10 &&
      (buffer.toString("ascii", 0, 6) === "GIF87a" || buffer.toString("ascii", 0, 6) === "GIF89a")) {
    return { extension: "gif", mimeType: "image/gif" };
  }
  if (buffer.length >= 16 && buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP") {
    return { extension: "webp", mimeType: "image/webp" };
  }
  // SVG can contain scripts and external resources; only admit via a dedicated
  // sanitized object-storage pipeline, not through this legacy public-file route.
  return null;
}

/**
 * Handle multipart or raw image upload parsing safely without external native dependencies
 */
export async function handleImageUpload(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({
        success: false, error: {
          code: "DURABLE_UPLOAD_REQUIRED",
          message: "Use the durable media upload pipeline for production assets",
        },
      });
    }
    const contentType = req.headers["content-type"] || "";

    let fileBuffer: Buffer | null = null;
    let fileExt = "png";
    let originalName = "upload.png";

    if (contentType.includes("multipart/form-data")) {
      // Parse multipart boundary
      const chunks: Buffer[] = [];
      let received = 0;
      for await (const chunk of req) {
        received += chunk.length;
        if (received > MAX_FILE_SIZE + MULTIPART_OVERHEAD) {
          return res.status(413).json({ success: false, error: { message: "Image request is too large" } });
        }
        chunks.push(chunk);
      }
      const rawBuffer = Buffer.concat(chunks);

      if (rawBuffer.length > MAX_FILE_SIZE) {
        return res.status(400).json({
          success: false,
          error: { message: "File size exceeds maximum limit of 5MB" },
        });
      }

      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      const boundary = boundaryMatch ? boundaryMatch[1] || boundaryMatch[2] : null;

      if (!boundary) {
        return res.status(400).json({
          success: false,
          error: { message: "Invalid form boundary" },
        });
      }

      const boundaryBuffer = Buffer.from(`--${boundary}`);
      const parts = splitBuffer(rawBuffer, boundaryBuffer);

      for (const part of parts) {
        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd === -1) continue;

        const headerText = part.subarray(0, headerEnd).toString("utf8");
        if (headerText.includes('name="image"') || headerText.includes('filename=')) {
          const filenameMatch = headerText.match(/filename="([^"]+)"/i);
          if (filenameMatch) {
            originalName = filenameMatch[1];
          }

          // Content body is after \r\n\r\n and before trailing \r\n
          let body = part.subarray(headerEnd + 4);
          if (body.subarray(body.length - 2).toString() === "\r\n") {
            body = body.subarray(0, body.length - 2);
          }
          fileBuffer = body;
          break;
        }
      }
    } else if (contentType.startsWith("image/")) {
      // Direct binary stream
      const chunks: Buffer[] = [];
      let received = 0;
      for await (const chunk of req) {
        received += chunk.length;
        if (received > MAX_FILE_SIZE) {
          return res.status(413).json({ success: false, error: { message: "Image request is too large" } });
        }
        chunks.push(chunk);
      }
      fileBuffer = Buffer.concat(chunks);

      const mimeSub = contentType.split("/")[1]?.split(";")[0] || "png";
      fileExt = mimeSub === "svg+xml" ? "svg" : mimeSub;
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: "No image file provided in request" },
      });
    }

    if (fileBuffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        error: { message: "File size exceeds maximum limit of 5MB" },
      });
    }

    const detected = detectRasterImage(fileBuffer);
    if (!detected) {
      return res.status(415).json({
        success: false, error: { message: "Unsupported or invalid image data. Use JPG, PNG, GIF or WebP." },
      });
    }
    fileExt = detected.extension;

    // Generate safe unique filename
    const uniqueFilename = `img_${Date.now()}_${crypto.randomBytes(6).toString("hex")}.${fileExt}`;
    const filePath = path.join(UPLOAD_DIR, uniqueFilename);

    // This legacy local route is development-only. A file is not a successful
    // upload until its asset metadata is durably committed.
    const userId = res.locals.user?.id || (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: "Authentication required" } });
    }

    try {
      await fs.promises.writeFile(filePath, fileBuffer, { flag: "wx" });
      const publicUrl = `/uploads/images/${uniqueFilename}`;
      const { extractImageDimensions, createMediaAsset } = await import("../services/media.service.js");
      const dimensions = extractImageDimensions(fileBuffer, detected.mimeType);
      const asset = await createMediaAsset({
        userId,
        filename: uniqueFilename,
        originalName,
        mimeType: detected.mimeType,
        sizeBytes: fileBuffer.length,
        url: publicUrl,
        width: dimensions.width,
        height: dimensions.height,
      });
      return res.status(200).json({
        success: true, url: publicUrl, asset, width: dimensions.width, height: dimensions.height,
      });
    } catch (error) {
      await fs.promises.unlink(filePath).catch(() => undefined);
      console.error("Image upload could not be persisted:", error);
      return res.status(503).json({
        success: false, error: {
          code: "MEDIA_PERSISTENCE_UNAVAILABLE",
          message: "Image could not be saved. No upload was confirmed.",
        },
      });
    }
  } catch (error) {
    console.error("Image upload error:", error);
    return res.status(500).json({
      success: false,
      error: { message: "Failed to upload image" },
    });
  }
}

function splitBuffer(buffer: Buffer, delimiter: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;
  let index: number;

  while ((index = buffer.indexOf(delimiter, start)) !== -1) {
    if (index > start) {
      parts.push(buffer.subarray(start, index));
    }
    start = index + delimiter.length;
  }

  if (start < buffer.length) {
    parts.push(buffer.subarray(start));
  }

  return parts;
}
