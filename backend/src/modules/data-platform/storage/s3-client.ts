import type { Readable } from "node:stream";
import { AppError } from "../../../utils/app-error.js";

let cachedClient: any = null;
let s3SdkPromise: Promise<any> | null = null;
let presignerSdkPromise: Promise<any> | null = null;

export async function getS3Sdk(): Promise<any> {
  if (!s3SdkPromise) {
    const s3Pkg = "@aws-sdk/client-s3";
    // @ts-ignore - optional dynamic load until installed
    s3SdkPromise = import(s3Pkg).catch(() => null);
  }
  const sdk = await s3SdkPromise;
  if (!sdk) {
    throw new AppError(
      "@aws-sdk/client-s3 package is not installed. Please run 'npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner' in the backend folder.",
      500,
      "S3_SDK_NOT_INSTALLED"
    );
  }
  return sdk;
}

export async function getPresignerSdk(): Promise<any> {
  if (!presignerSdkPromise) {
    const presignerPkg = "@aws-sdk/s3-request-presigner";
    // @ts-ignore - optional dynamic load until installed
    presignerSdkPromise = import(presignerPkg).catch(() => null);
  }
  const sdk = await presignerSdkPromise;
  if (!sdk) {
    throw new AppError(
      "@aws-sdk/s3-request-presigner package is not installed. Please run 'npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner' in the backend folder.",
      500,
      "S3_PRESIGNER_NOT_INSTALLED"
    );
  }
  return sdk;
}

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

export async function getS3Client(): Promise<any> {
  if (cachedClient) {
    return cachedClient;
  }

  const sdk = await getS3Sdk();
  const config = getStorageConfig();

  cachedClient = new sdk.S3Client({
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
  const sdk = await getS3Sdk();
  const client = await getS3Client();

  try {
    await client.send(new sdk.HeadBucketCommand({ Bucket: bucketName }));
  } catch (error: any) {
    const status = error?.$metadata?.httpStatusCode;
    const name = error?.name;

    // 404 or NotFound implies bucket doesn't exist yet
    if (status === 404 || name === "NotFound" || name === "NoSuchBucket") {
      try {
        await client.send(new sdk.CreateBucketCommand({ Bucket: bucketName }));
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
 * Uploads an object to S3/MinIO.
 */
export async function putObject(
  bucketName: string,
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string
): Promise<any> {
  const sdk = await getS3Sdk();
  const client = await getS3Client();

  return await client.send(
    new sdk.PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
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
  const sdk = await getS3Sdk();
  const client = await getS3Client();

  const response = await client.send(
    new sdk.GetObjectCommand({
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
  const sdk = await getS3Sdk();
  const client = await getS3Client();

  await client.send(
    new sdk.DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
  );
}

/**
 * Generates a presigned PUT upload URL.
 */
export async function getPresignedPutUrl(
  bucketName: string,
  key: string,
  contentType: string,
  contentLength: number,
  expiresInSeconds = 300
): Promise<string> {
  const sdk = await getS3Sdk();
  const presigner = await getPresignerSdk();
  const client = await getS3Client();

  const command = new sdk.PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  return await presigner.getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });
}
