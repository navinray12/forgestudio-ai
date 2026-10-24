import { afterEach, describe, expect, it } from "vitest";
import { getStorageConfig } from "../modules/data-platform/storage/s3-client.js";

const keys = ["NODE_ENV", "STORAGE_ENDPOINT", "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

describe("WP-04 production object storage credentials", () => {
  it("rejects default MinIO credentials in production", () => {
    process.env.NODE_ENV = "production";
    process.env.STORAGE_ENDPOINT = "https://storage.example.test";
    process.env.STORAGE_ACCESS_KEY = "forge_minio_admin";
    process.env.STORAGE_SECRET_KEY = "forge_minio_secret_key_123";
    expect(() => getStorageConfig()).toThrow(/non-default credentials/);
  });

  it("rejects a plain HTTP object storage endpoint in production", () => {
    process.env.NODE_ENV = "production";
    process.env.STORAGE_ENDPOINT = "http://localhost:9000";
    process.env.STORAGE_ACCESS_KEY = "production_account";
    process.env.STORAGE_SECRET_KEY = "a-random-production-secret";
    expect(() => getStorageConfig()).toThrow(/HTTPS endpoint/);
  });

  it("accepts explicitly configured HTTPS production storage credentials", () => {
    process.env.NODE_ENV = "production";
    process.env.STORAGE_ENDPOINT = "https://storage.example.test";
    process.env.STORAGE_ACCESS_KEY = "production_account";
    process.env.STORAGE_SECRET_KEY = "a-random-production-secret";
    expect(getStorageConfig()).toMatchObject({
      endpoint: "https://storage.example.test",
      accessKeyId: "production_account",
    });
  });
});
