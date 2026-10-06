/**
 * ForgeStudio Module 28: Object Storage Types
 */

export type BucketAccessPolicy = "PUBLIC_READ" | "PRIVATE" | "AUTHENTICATED";
export type ScanStatus = "PENDING" | "CLEAN" | "SUSPICIOUS" | "INFECTED" | "BYPASSED";

export interface BucketEntity {
  id: string;
  projectId: string;
  name: string;
  accessPolicy: BucketAccessPolicy;
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  currentSizeBytes: number;
  objectCount: number;
  isEncrypted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StorageObjectEntity {
  id: string;
  bucketId: string;
  projectId: string;
  key: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256?: string;
  versionId: string;
  isCurrentVersion: boolean;
  storagePath: string;
  scanStatus: ScanStatus;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface MultipartSessionEntity {
  id: string;
  bucketId: string;
  projectId: string;
  uploadId: string;
  key: string;
  fileName: string;
  mimeType: string;
  totalParts: number;
  parts: Array<{ partNumber: number; sizeBytes: number; etag: string }>;
  status: "IN_PROGRESS" | "COMPLETED" | "ABORTED";
  expiresAt: string;
  createdAt: string;
}

export interface SignedUrlResult {
  url: string;
  method: "GET" | "PUT";
  key: string;
  expiresInSeconds: number;
  token?: string;
}
