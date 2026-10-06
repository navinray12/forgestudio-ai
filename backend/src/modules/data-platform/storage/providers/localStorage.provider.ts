/**
 * ForgeStudio Module 28: Local Disk Storage Provider
 * Production-ready local filesystem storage provider with path isolation and signed URL HMAC generation.
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { AppError } from "../../../../utils/app-error.js";
import { IStorageProvider, WriteResult } from "./storageProvider.interface.js";

export class LocalStorageProvider implements IStorageProvider {
  public name = "local";
  private rootDir: string;

  constructor(customRoot?: string) {
    this.rootDir = customRoot || path.resolve(process.cwd(), "forge_storage");
  }

  private resolveSafePath(storagePath: string): string {
    const clean = path.normalize(storagePath).replace(/^(\.\.(\/|\\|$))+/, "");
    const full = path.join(this.rootDir, clean);
    if (!full.startsWith(this.rootDir)) {
      throw new AppError("Path traversal rejected", 400, "INVALID_PATH");
    }
    return full;
  }

  public async write(storagePath: string, buffer: Buffer): Promise<WriteResult> {
    const fullPath = this.resolveSafePath(storagePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);

    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    return {
      sizeBytes: buffer.length,
      sha256,
      storagePath,
    };
  }

  public async read(storagePath: string): Promise<Buffer> {
    const fullPath = this.resolveSafePath(storagePath);
    try {
      return await fs.readFile(fullPath);
    } catch (err: any) {
      if (err.code === "ENOENT") {
        throw new AppError("Storage object not found on disk", 404, "OBJECT_NOT_FOUND");
      }
      throw err;
    }
  }

  public async delete(storagePath: string): Promise<void> {
    const fullPath = this.resolveSafePath(storagePath);
    try {
      await fs.unlink(fullPath);
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
    }
  }

  public async exists(storagePath: string): Promise<boolean> {
    const fullPath = this.resolveSafePath(storagePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  public async getSignedUrl(
    projectId: string,
    bucketName: string,
    key: string,
    method: "GET" | "PUT",
    expiresInSeconds: number
  ): Promise<string> {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const secret = process.env.FORGE_STORAGE_SIGNING_SECRET || process.env.JWT_SECRET || "storage-secret-signing-key";

    const payload = `${projectId}:${bucketName}:${key}:${method}:${expiresAt}`;
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    const endpoint = method === "GET" ? "download" : "upload";
    return `/api/v1/projects/${projectId}/storage/buckets/${bucketName}/objects/${encodeURIComponent(
      key
    )}/${endpoint}?expires=${expiresAt}&sig=${signature}`;
  }

  public verifySignature(
    projectId: string,
    bucketName: string,
    key: string,
    method: "GET" | "PUT",
    expiresAt: number,
    signature: string
  ): boolean {
    if (Date.now() > expiresAt) return false;
    const secret = process.env.FORGE_STORAGE_SIGNING_SECRET || process.env.JWT_SECRET || "storage-secret-signing-key";
    const payload = `${projectId}:${bucketName}:${key}:${method}:${expiresAt}`;
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}
