import { afterEach, describe, expect, it } from "vitest";
import { assertProductionEncryptionConfigured, decryptCredential, encryptCredential } from "../modules/data-platform/security/encryption.js";

const prev = {
  secret: process.env.FORGE_DATA_PLATFORM_SECRET,
  jwt: process.env.JWT_SECRET,
  env: process.env.NODE_ENV,
};

afterEach(() => {
  for (const [key, val] of Object.entries({
    FORGE_DATA_PLATFORM_SECRET: prev.secret,
    JWT_SECRET: prev.jwt,
    NODE_ENV: prev.env,
  })) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
});

describe("WP-01 production credential encryption", () => {
  it("fails production boot preflight when encryption key is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.FORGE_DATA_PLATFORM_SECRET;
    expect(() => assertProductionEncryptionConfigured()).toThrow(/FORGE_DATA_PLATFORM_SECRET/);
    process.env.FORGE_DATA_PLATFORM_SECRET = "a-valid-independent-production-encryption-key";
    expect(() => assertProductionEncryptionConfigured()).not.toThrow();
  });

  it("requires a separate encryption key, not JWT_SECRET", () => {
    process.env.NODE_ENV = "production";
    delete process.env.FORGE_DATA_PLATFORM_SECRET;
    process.env.JWT_SECRET = "a-valid-jwt-signing-secret-not-encryption";
    expect(() => encryptCredential("database password")).toThrow(/FORGE_DATA_PLATFORM_SECRET/);
  });

  it("round-trips credentials under an explicitly managed key", () => {
    process.env.NODE_ENV = "production";
    process.env.FORGE_DATA_PLATFORM_SECRET = "a-production-grade-independent-32-byte-secret";
    const value = encryptCredential("tenant password");
    expect(value).not.toContain("tenant password");
    expect(decryptCredential(value)).toBe("tenant password");
  });

  it("rejects plaintext credentials in production", () => {
    process.env.NODE_ENV = "production";
    process.env.FORGE_DATA_PLATFORM_SECRET = "a-production-grade-independent-32-byte-secret";
    expect(() => decryptCredential("legacy-plaintext-password"))
      .toThrow(/could not be authenticated|Plaintext credentials/);
  });

  it("does not allow an invalid authentication tag to become an empty successful secret", () => {
    process.env.NODE_ENV = "production";
    process.env.FORGE_DATA_PLATFORM_SECRET = "a-production-grade-independent-32-byte-secret";
    const value = encryptCredential("secret");
    const parts = value.split(".");
    parts[1] = Buffer.alloc(16, 1).toString("base64");
    expect(() => decryptCredential(parts.join("."))).toThrow(/could not be authenticated/);
  });

  it("does not allow credentials encrypted with another key", () => {
    process.env.NODE_ENV = "production";
    process.env.FORGE_DATA_PLATFORM_SECRET = "a-production-grade-independent-32-byte-secret";
    const value = encryptCredential("secret");
    process.env.FORGE_DATA_PLATFORM_SECRET = "another-production-grade-independent-32-byte-secret";
    expect(() => decryptCredential(value)).toThrow(/could not be authenticated/);
  });
});
