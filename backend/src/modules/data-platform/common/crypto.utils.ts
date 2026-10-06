import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // Standard 96-bit IV for AES-GCM
const AUTH_TAG_LENGTH_BYTES = 16; // Standard 128-bit authentication tag

/**
 * Resolves a 32-byte cryptographic key for AES-256-GCM encryption.
 * Priority:
 * 1. process.env.DATA_PLATFORM_ENCRYPTION_KEY (hex or raw)
 * 2. Fallback key derived via SHA-256 in development/test environments
 */
function resolveEncryptionKey(): Buffer {
  const raw = process.env.DATA_PLATFORM_ENCRYPTION_KEY;

  if (raw && raw.trim().length > 0) {
    const trimmed = raw.trim();
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return Buffer.from(trimmed, "hex");
    }
    return crypto.createHash("sha256").update(trimmed).digest();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATA_PLATFORM_ENCRYPTION_KEY is required in production environment"
    );
  }

  return crypto
    .createHash("sha256")
    .update("forgestudio-default-dev-data-platform-key-seed")
    .digest();
}

/**
 * Encrypts sensitive credentials (such as tenant database passwords) using AES-256-GCM.
 * @returns Hex-encoded string in the format "iv:authTag:encryptedContent"
 */
export function encryptCredential(plaintext: string): string {
  if (typeof plaintext !== "string") {
    throw new TypeError("Plaintext must be a string");
  }

  const key = resolveEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts sensitive credentials previously encrypted with encryptCredential.
 * @param ciphertext Hex-encoded string in the format "iv:authTag:encryptedContent"
 * @returns Decrypted UTF-8 string
 */
export function decryptCredential(ciphertext: string): string {
  if (typeof ciphertext !== "string" || !ciphertext.includes(":")) {
    throw new Error("Invalid ciphertext format; expected 'iv:authTag:content'");
  }

  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Ciphertext format mismatch; expected 3 colon-delimited parts");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error("Invalid cryptographic parameters in ciphertext payload");
  }

  const key = resolveEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Generates a cryptographically strong random password for tenant PostgreSQL roles.
 * Includes alphanumeric characters and safe symbols.
 */
export function generateSecurePassword(length = 24): string {
  const safeLength = Math.max(16, Math.min(128, length));
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&*+-=?@_";

  const randomBytes = crypto.randomBytes(safeLength);
  let password = "";
  for (let i = 0; i < safeLength; i++) {
    password += charset[randomBytes[i] % charset.length];
  }

  return password;
}

/**
 * Generates a scoped Project API Key (Anon or Service Role) along with its prefix and hash.
 * Only the hashed value is saved to the database.
 */
export function generateApiKey(keyType: "ANON" | "SERVICE_ROLE"): {
  key: string;
  prefix: string;
  tokenHash: string;
} {
  const prefix = keyType === "ANON" ? "fg_anon_" : "fg_sec_";
  const entropy = crypto.randomBytes(32).toString("base64url");
  const fullKey = `${prefix}${entropy}`;

  const tokenHash = crypto
    .createHash("sha256")
    .update(fullKey)
    .digest("hex");

  return {
    key: fullKey,
    prefix,
    tokenHash,
  };
}
