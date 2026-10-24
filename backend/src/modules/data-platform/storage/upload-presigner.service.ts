import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import {
  ensureBucketExists,
  deleteObject,
  getStorageConfig,
  getPresignedPutUrl,
  headObject,
} from "./s3-client.js";
import type { StorageBucket, StorageObject } from "../../../generated/prisma/client.js";

/**
 * Sanitizes bucket name to be compliant with S3 naming rules.
 */
function sanitizeBucketName(name: string): string {
  const sanitized = name.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
  return sanitized.slice(0, 63) || "default";
}

/**
 * Ensures a bucket exists in Prisma and on S3/MinIO.
 */
export async function getOrCreateDefaultBucket(
  websiteId: string,
  bucketName = "default"
): Promise<StorageBucket> {
  const normalizedName = sanitizeBucketName(bucketName);

  let bucket = await prisma.storageBucket.findUnique({
    where: {
      websiteId_name: {
        websiteId,
        name: normalizedName,
      },
    },
  });

  if (!bucket) {
    bucket = await prisma.storageBucket.create({
      data: {
        websiteId,
        name: normalizedName,
        visibility: "PRIVATE",
        maxSizeBytes: 524288000n, // 500 MB
        usedSizeBytes: 0n,
        allowedMimeTypes: ["*/*"],
      },
    });
  }

  // Ensure corresponding bucket exists on storage engine
  await ensureBucketExists(normalizedName);

  return bucket;
}

export interface PresignedUrlParams {
  websiteId: string;
  bucketName?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface PresignedUrlResult {
  bucketId: string;
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresInSeconds: number;
}

/**
 * Generates an authorized S3 PUT pre-signed URL after validating quotas and MIME types.
 */
export async function generateUploadPresignedUrl(
  params: {
    websiteId: string;
    bucketName?: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }
): Promise<PresignedUrlResult> {
  const bucket = await getOrCreateDefaultBucket(
    params.websiteId,
    params.bucketName || "default"
  );

  // 1. Quota validation
  const requestedBytes = BigInt(params.sizeBytes);
  if (bucket.usedSizeBytes + requestedBytes > bucket.maxSizeBytes) {
    throw new AppError(
      `Storage quota exceeded. Used: ${bucket.usedSizeBytes.toString()} bytes, Requested: ${requestedBytes.toString()} bytes, Max: ${bucket.maxSizeBytes.toString()} bytes`,
      413,
      "STORAGE_QUOTA_EXCEEDED"
    );
  }

  // 2. MIME type validation
  const allowed = (bucket.allowedMimeTypes as string[]) || ["*/*"];
  const isAllowed = allowed.some((pattern) => {
    if (pattern === "*/*") return true;
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      return params.mimeType.startsWith(prefix);
    }
    return pattern.toLowerCase() === params.mimeType.toLowerCase();
  });

  if (!isAllowed) {
    throw new AppError(
      `MIME type "${params.mimeType}" is not permitted in this bucket.`,
      415,
      "FILE_TYPE_NOT_ALLOWED"
    );
  }

  // 3. Generate sanitized object key
  const sanitizedFileName = params.fileName
    .replace(/[\\/\0\r\n]/g, "_")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .slice(0, 180);

  const objectKey = `${params.websiteId}/${Date.now()}-${sanitizedFileName}`;

  // 4. Generate Pre-signed PUT URL
  const expiresInSeconds = 300;
  const uploadUrl = await getPresignedPutUrl(
    bucket.name,
    objectKey,
    params.mimeType,
    params.sizeBytes,
    expiresInSeconds
  );

  const config = getStorageConfig();
  const publicUrl = `${config.endpoint}/${bucket.name}/${objectKey}`;

  return {
    bucketId: bucket.id,
    uploadUrl,
    objectKey,
    publicUrl,
    expiresInSeconds,
  };
}

export interface ConfirmUploadParams {
  websiteId: string;
  bucketId: string;
  objectKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256?: string;
  eTag?: string;
}

/**
 * Confirms a successful direct upload, creates the StorageObject record,
 * and atomically increments the bucket's usedSizeBytes.
 */
export async function confirmUpload(
  params: ConfirmUploadParams
): Promise<StorageObject> {
  if (!Number.isSafeInteger(params.sizeBytes) || params.sizeBytes <= 0 ||
      !params.websiteId || !params.objectKey.startsWith(params.websiteId + "/") ||
      params.objectKey.includes("..") || params.objectKey.includes("\\") ||
      params.mimeType.length > 128) {
    throw new AppError("Invalid upload confirmation", 400, "INVALID_UPLOAD_CONFIRMATION");
  }
  const assignedBucket = await prisma.storageBucket.findUnique({
    where: { id: params.bucketId },
  });
  if (!assignedBucket || assignedBucket.websiteId !== params.websiteId) {
    throw new AppError("Storage bucket not found for this website", 404, "BUCKET_NOT_FOUND");
  }
  const observed = await headObject(assignedBucket.name, params.objectKey);
  if (observed.contentLength !== params.sizeBytes ||
      (observed.contentType && observed.contentType.toLowerCase() !== params.mimeType.toLowerCase())) {
    throw new AppError("Upload metadata does not match the stored object", 409, "UPLOAD_METADATA_MISMATCH");
  }
  const bytes = BigInt(params.sizeBytes);

  return await prisma.$transaction(async (tx) => {
    const bucket = await tx.storageBucket.findUnique({
      where: { id: params.bucketId },
    });

    if (!bucket || bucket.websiteId !== params.websiteId) {
      throw new AppError("Storage bucket not found", 404, "BUCKET_NOT_FOUND");
    }
    if (bucket.usedSizeBytes + bytes > bucket.maxSizeBytes) {
      throw new AppError("Storage quota exceeded", 413, "STORAGE_QUOTA_EXCEEDED");
    }

    const createdObject = await tx.storageObject.create({
      data: {
        bucketId: params.bucketId,
        objectKey: params.objectKey,
        originalName: params.originalName,
        mimeType: params.mimeType,
        sizeBytes: bytes,
        checksumSha256: params.checksumSha256 || "",
        eTag: params.eTag || null,
      },
    });

    await tx.storageBucket.update({
      where: { id: params.bucketId },
      data: {
        usedSizeBytes: {
          increment: bytes,
        },
      },
    });

    return createdObject;
  });
}

/**
 * Deletes a storage object from S3 and decrements the bucket's storage quota.
 */
export async function deleteStorageObject(objectId: string): Promise<void> {
  const object = await prisma.storageObject.findUnique({
    where: { id: objectId },
    include: { bucket: true },
  });

  if (!object) {
    throw new AppError("Storage object not found", 404, "OBJECT_NOT_FOUND");
  }

  // 1. Delete physical object from S3/MinIO
  await deleteObject(object.bucket.name, object.objectKey);

  // 2. Decrement bucket usage and delete record atomically
  await prisma.$transaction(async (tx) => {
    await tx.storageObject.delete({
      where: { id: objectId },
    });

    await tx.storageBucket.update({
      where: { id: object.bucketId },
      data: {
        usedSizeBytes: {
          decrement: object.sizeBytes,
        },
      },
    });
  });
}
