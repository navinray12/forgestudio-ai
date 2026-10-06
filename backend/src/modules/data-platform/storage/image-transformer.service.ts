import sharp from "sharp";
import type { Readable } from "node:stream";
import { getObjectStream } from "./s3-client.js";
import { AppError } from "../../../utils/app-error.js";

export interface TransformOptions {
  width?: number;
  height?: number;
  format?: "webp" | "jpeg" | "png" | "avif";
  quality?: number;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Transforms an image stored in S3/MinIO on-the-fly using Sharp.
 */
export async function transformImage(
  bucketName: string,
  objectKey: string,
  options: TransformOptions = {}
): Promise<{ buffer: Buffer; contentType: string }> {
  let sourceStream: Readable;

  try {
    const obj = await getObjectStream(bucketName, objectKey);
    sourceStream = obj.stream;
  } catch (err: any) {
    throw new AppError("Requested image object not found", 404, "IMAGE_NOT_FOUND");
  }

  const sourceBuffer = await streamToBuffer(sourceStream);

  let pipeline = sharp(sourceBuffer);

  // 1. Resize if dimensions are provided
  if (options.width || options.height) {
    const width = options.width ? Math.min(4096, Math.max(1, options.width)) : undefined;
    const height = options.height ? Math.min(4096, Math.max(1, options.height)) : undefined;

    pipeline = pipeline.resize({
      width,
      height,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // 2. Format conversion & compression
  const targetFormat = options.format || "webp";
  const quality = options.quality
    ? Math.min(100, Math.max(10, options.quality))
    : 80;

  switch (targetFormat) {
    case "jpeg":
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      break;
    case "png":
      pipeline = pipeline.png({ compressionLevel: 8 });
      break;
    case "avif":
      pipeline = pipeline.avif({ quality });
      break;
    case "webp":
    default:
      pipeline = pipeline.webp({ quality, effort: 4 });
      break;
  }

  try {
    const buffer = await pipeline.toBuffer();
    const contentType = targetFormat === "jpeg" ? "image/jpeg" : `image/${targetFormat}`;
    return { buffer, contentType };
  } catch (error: any) {
    throw new AppError(
      `Failed to transform image: ${error.message || "Invalid image data"}`,
      422,
      "IMAGE_TRANSFORM_FAILED"
    );
  }
}
