import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";

let cachedClient: S3Client | null = null;

export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export function getStorageConfig(): StorageConfig {
  const endpoint =
    process.env.STORAGE_ENDPOINT ||
    process.env.MINIO_ENDPOINT ||
    "http://localhost:9000";

  const region =
    process.env.STORAGE_REGION ||
    process.env.AWS_REGION ||
    "us-east-1";

  const accessKeyId =
    process.env.STORAGE_ACCESS_KEY ||
    process.env.MINIO_ROOT_USER ||
    process.env.AWS_ACCESS_KEY_ID ||
    "forge_minio_admin";

  const secretAccessKey =
    process.env.STORAGE_SECRET_KEY ||
    process.env.MINIO_ROOT_PASSWORD ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    "forge_minio_secret_key_123";

  const forcePathStyleRaw =
    process.env.STORAGE_FORCE_PATH_STYLE ?? "true";
  const forcePathStyle = forcePathStyleRaw === "true" || forcePathStyleRaw === "1";

  return {
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    forcePathStyle,
  };
}

export function getS3Client(): S3Client {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getStorageConfig();

  cachedClient = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return cachedClient;
}

/**
 * Checks if a bucket exists in S3/MinIO. If not found, creates it.
 */
export async function ensureBucketExists(bucketName: string): Promise<void> {
  const client = getS3Client();

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
  } catch (error: any) {
    const status = error?.$metadata?.httpStatusCode;
    const name = error?.name;

    // 404 or NotFound implies bucket doesn't exist yet
    if (status === 404 || name === "NotFound" || name === "NoSuchBucket") {
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucketName }));
      } catch (createErr: any) {
        // Handle race conditions where another worker created it concurrently
        if (
          createErr?.name === "BucketAlreadyOwnedByYou" ||
          createErr?.name === "BucketAlreadyExists"
        ) {
          return;
        }
        throw createErr;
      }
    } else {
      throw error;
    }
  }
}

/**
 * Retrieves a readable object stream from S3/MinIO.
 */
export async function getObjectStream(
  bucketName: string,
  key: string
): Promise<{
  stream: Readable;
  contentType?: string;
  contentLength?: number;
}> {
  const client = getS3Client();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
  );

  return {
    stream: response.Body as Readable,
    contentType: response.ContentType,
    contentLength: response.ContentLength,
  };
}

/**
 * Deletes an object from S3/MinIO.
 */
export async function deleteObject(
  bucketName: string,
  key: string
): Promise<void> {
  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
  );
}
