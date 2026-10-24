/**
 * ForgeStudio Data Platform Security
 * Production-grade AES-256-GCM encryption for database credentials and storage tokens.
 */

import crypto from "node:crypto";

function getMasterKey(): Buffer {
  // An encryption key must be managed independently of the JWT signing key.
  // Production credentials must never be encrypted with a public default.
  const secret = process.env.FORGE_DATA_PLATFORM_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("FORGE_DATA_PLATFORM_SECRET (minimum 32 characters) is required in production");
  }
  const effective = secret || "forge-studio-data-platform-master-encryption-key-32b";
  return crypto.createHash("sha256").update(effective).digest();
}

/** Refuse to boot production without a dedicated credential encryption key. */
export function assertProductionEncryptionConfigured(): void {
  if (process.env.NODE_ENV === "production") {
    getMasterKey();
  }
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 */
export function encryptCredential(plaintext: string): string {
  if (!plaintext) return "";
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

/**
 * Decrypt an AES-256-GCM ciphertext string
 */
export function decryptCredential(ciphertext: string): string {
  if (!ciphertext) return "";
  try {
    const parts = ciphertext.split(".");
    if (parts.length !== 3) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Plaintext credentials are not permitted in production");
      }
      return ciphertext; // Development-only compatibility with legacy data
    }

    const [ivB64, tagB64, encryptedB64] = parts;
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const encrypted = Buffer.from(encryptedB64, "base64");
    if (iv.length !== 12 || tag.length !== 16 || !encryptedB64) {
      throw new Error("Invalid encrypted credential format");
    }
    const key = getMasterKey();

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    // Never turn a corrupted credential into an empty success response.
    throw new Error("Credential could not be authenticated or decrypted");
  }
}

/**
 * Mask sensitive credentials for UI or log presentation
 */
export function maskConnectionUrl(url: string): string {
  if (!url) return "";
  return url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:••••••••@");
}
