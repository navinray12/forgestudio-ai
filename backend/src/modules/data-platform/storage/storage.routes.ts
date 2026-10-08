import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import {
  getUploadPresignedUrlHandler,
  confirmUploadHandler,
  listBucketsHandler,
  listBucketObjectsHandler,
  deleteObjectHandler,
  transformImageHandler,
} from "./storage.controller.js";

export const storageRoutes = Router({ mergeParams: true });

// 1. Pre-signed direct PUT upload authorization
storageRoutes.post("/upload-sign", requireAuth, getUploadPresignedUrlHandler);

// 2. Upload confirmation & quota ledger update
storageRoutes.post("/confirm-upload", requireAuth, confirmUploadHandler);

// 3. Bucket management
storageRoutes.get("/buckets", requireAuth, listBucketsHandler);
storageRoutes.get("/buckets/:bucketName/objects", requireAuth, listBucketObjectsHandler);

// 4. Object deletion
storageRoutes.delete("/objects/:objectId", requireAuth, deleteObjectHandler);

// 5. Public on-the-fly Image CDN Transformation
storageRoutes.get("/transform/{*objectKey}", transformImageHandler);

export default storageRoutes;
