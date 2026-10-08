import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../utils/app-error.js";
import {
  generateUploadPresignedUrl,
  confirmUpload,
  deleteStorageObject,
  getOrCreateDefaultBucket,
} from "./upload-presigner.service.js";
import { transformImage } from "./image-transformer.service.js";

/**
 * Helper to safely extract single string parameter in Express 5.
 */
function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || "";
  return param || "";
}

/**
 * Serializes Prisma BigInt fields into string representation for JSON output.
 */
function serializeStorageBucket(bucket: any) {
  return {
    ...bucket,
    maxSizeBytes: bucket.maxSizeBytes ? bucket.maxSizeBytes.toString() : "0",
    usedSizeBytes: bucket.usedSizeBytes ? bucket.usedSizeBytes.toString() : "0",
  };
}

function serializeStorageObject(obj: any) {
  return {
    ...obj,
    sizeBytes: obj.sizeBytes ? obj.sizeBytes.toString() : "0",
  };
}

/**
 * Validates that the active user has access to the project/website.
 */
async function verifyProjectAccess(websiteId: string, userId: string) {
  const website = await prisma.website.findFirst({
    where: {
      id: websiteId,
      OR: [
        { userId },
        { collaborators: { some: { userId } } },
        { team: { members: { some: { userId } } } },
        { workspace: { members: { some: { userId } } } },
        { organization: { members: { some: { userId } } } },
      ],
    },
  });

  if (!website) {
    throw new AppError("Project not found or access denied", 404, "NOT_FOUND");
  }

  return website;
}

/**
 * POST /api/v1/projects/:projectId/storage/upload-sign
 */
export async function getUploadPresignedUrlHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const projectId = getParam(req.params.projectId);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);

    const { fileName, mimeType, sizeBytes, bucketName } = req.body;

    if (!fileName || !mimeType || sizeBytes === undefined) {
      throw new AppError(
        "fileName, mimeType, and sizeBytes are required",
        400,
        "INVALID_INPUT"
      );
    }

    const result = await generateUploadPresignedUrl({
      websiteId: projectId,
      bucketName: bucketName ? String(bucketName) : "default",
      fileName: String(fileName),
      mimeType: String(mimeType),
      sizeBytes: Number(sizeBytes),
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/projects/:projectId/storage/confirm-upload
 */
export async function confirmUploadHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const projectId = getParam(req.params.projectId);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);

    const {
      bucketName,
      bucketId: incomingBucketId,
      objectKey,
      originalName,
      mimeType,
      sizeBytes,
      checksumSha256,
      eTag,
    } = req.body;

    if (!objectKey || !originalName || !mimeType || sizeBytes === undefined) {
      throw new AppError(
        "objectKey, originalName, mimeType, and sizeBytes are required",
        400,
        "INVALID_INPUT"
      );
    }

    let bucketId = incomingBucketId ? String(incomingBucketId) : undefined;
    if (!bucketId) {
      const bucket = await getOrCreateDefaultBucket(
        projectId,
        bucketName ? String(bucketName) : "default"
      );
      bucketId = bucket.id;
    }

    const savedObject = await confirmUpload({
      bucketId,
      objectKey: String(objectKey),
      originalName: String(originalName),
      mimeType: String(mimeType),
      sizeBytes: Number(sizeBytes),
      checksumSha256: checksumSha256 ? String(checksumSha256) : undefined,
      eTag: eTag ? String(eTag) : undefined,
    });

    return res.status(201).json({
      success: true,
      data: serializeStorageObject(savedObject),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/projects/:projectId/storage/buckets
 */
export async function listBucketsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const projectId = getParam(req.params.projectId);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);

    // Auto-ensure default bucket exists
    await getOrCreateDefaultBucket(projectId, "default");

    const buckets: any[] = await prisma.storageBucket.findMany({
      where: { websiteId: projectId },
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: { objects: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: buckets.map((b) => ({
        ...serializeStorageBucket(b),
        objectCount: b._count?.objects ?? 0,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/projects/:projectId/storage/buckets/:bucketName/objects
 */
export async function listBucketObjectsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const projectId = getParam(req.params.projectId);
    const bucketName = getParam(req.params.bucketName);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);

    const bucket = await prisma.storageBucket.findUnique({
      where: {
        websiteId_name: {
          websiteId: projectId,
          name: bucketName,
        },
      },
    });

    if (!bucket) {
      throw new AppError("Storage bucket not found", 404, "BUCKET_NOT_FOUND");
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [total, objects] = await Promise.all([
      prisma.storageObject.count({ where: { bucketId: bucket.id } }),
      prisma.storageObject.findMany({
        where: { bucketId: bucket.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: objects.map(serializeStorageObject),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/projects/:projectId/storage/objects/:objectId
 */
export async function deleteObjectHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const projectId = getParam(req.params.projectId);
    const objectId = getParam(req.params.objectId);
    const user = res.locals.user || (req as any).user;
    if (!user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");

    await verifyProjectAccess(projectId, user.id);

    // Verify object belongs to this project
    const object: any = await prisma.storageObject.findUnique({
      where: { id: objectId },
      include: { bucket: true },
    });

    if (!object || object.bucket?.websiteId !== projectId) {
      throw new AppError("Object not found in this project", 404, "OBJECT_NOT_FOUND");
    }

    await deleteStorageObject(objectId);

    return res.status(200).json({
      success: true,
      message: "Storage object deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/projects/:projectId/storage/transform/*
 * Serves on-the-fly transformed and optimized images with immutable CDN caching headers.
 */
export async function transformImageHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const projectId = getParam(req.params.projectId);
    // Extract object key from wildcard path
    const rawKey = (req.params as any).objectKey ?? (req.params as any)[0];
    const objectKey = Array.isArray(rawKey) ? rawKey.join("/") : String(rawKey || "");

    if (!objectKey) {
      throw new AppError("Object key is required", 400, "INVALID_PATH");
    }

    const width = req.query.w ? parseInt(req.query.w as string, 10) : undefined;
    const height = req.query.h ? parseInt(req.query.h as string, 10) : undefined;
    const formatRaw = req.query.fmt as string | undefined;
    const quality = req.query.q ? parseInt(req.query.q as string, 10) : undefined;
    const bucketName = (req.query.bucket as string) || "default";

    const allowedFormats = new Set(["webp", "jpeg", "png", "avif"]);
    const format = formatRaw && allowedFormats.has(formatRaw.toLowerCase())
      ? (formatRaw.toLowerCase() as "webp" | "jpeg" | "png" | "avif")
      : "webp";

    const { buffer, contentType } = await transformImage(bucketName, objectKey, {
      width,
      height,
      format,
      quality,
    });

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("ETag", `"${Buffer.from(objectKey).toString("base64")}_w${width || 0}_h${height || 0}"`);

    return res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
}
