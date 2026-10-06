/**
 * ForgeStudio Module 28: Storage Provider Interface
 */

export interface WriteResult {
  sizeBytes: number;
  sha256: string;
  storagePath: string;
}

export interface IStorageProvider {
  name: string;
  write(storagePath: string, buffer: Buffer): Promise<WriteResult>;
  read(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
  exists(storagePath: string): Promise<boolean>;
  getSignedUrl(
    projectId: string,
    bucketName: string,
    key: string,
    method: "GET" | "PUT",
    expiresInSeconds: number
  ): Promise<string>;
}
