import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma, pgPool } from "../config/prisma.js";
import { getTrustedFormPolicy } from "../services/form/trustedFormPolicy.service.js";
import {
  upsertFormDeliveryPolicy,
  listFormDeliveryPolicy,
  deleteFormDeliveryPolicy,
} from "../services/form/formDeliveryPolicy.service.js";

const url = new URL(process.env.DATABASE_URL || "http://invalid/");
if (process.env.FORGE_DISPOSABLE_TEST_DB !== "1" ||
    process.env.NODE_ENV !== "test" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.pathname !== "/forge_phase2_fresh") {
  throw new Error("Real form delivery tests require disposable forge_phase2_fresh only");
}

const siteId = randomUUID();
const ownerId = randomUUID();
const outsiderId = randomUUID();
const formId = "owner-form-1";
const previous = {
  secret: process.env.FORGE_DATA_PLATFORM_SECRET,
  nodeEnv: process.env.NODE_ENV,
};

describe("WP-04 real server-only form delivery persistence", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: ownerId, email: "form-owner-" + siteId + "@example.test",
        fullName: "Form Owner", status: "ACTIVE",
      },
    });
    await prisma.user.create({
      data: {
        id: outsiderId, email: "form-foreign-" + siteId + "@example.test",
        fullName: "Foreign Caller", status: "ACTIVE",
      },
    });
    await prisma.website.create({
      data: {
        id: siteId, userId: ownerId, name: "Site", slug: "form-" + siteId,
        editorData: {
          elements: [{
            id: formId, type: "form",
            formActions: {
              activeActions: ["webhook"],
              webhookConfig: {
                endpointUrl: "https://public-document.example.test/leak",
                secretKey: "editor-plaintext-unsafe",
              },
            },
          }],
        },
      },
    });
    process.env.FORGE_DATA_PLATFORM_SECRET = "disposable-real-test-form-encryption-key-32-bytes";
  });

  afterAll(async () => {
    process.env.NODE_ENV = "test";
    await pgPool.query(`DELETE FROM form_delivery_policies WHERE "websiteId" = $1::uuid`, [siteId]).catch(() => undefined);
    await prisma.website.deleteMany({ where: { id: siteId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, outsiderId] } } }).catch(() => undefined);
    if (previous.secret === undefined) delete process.env.FORGE_DATA_PLATFORM_SECRET;
    else process.env.FORGE_DATA_PLATFORM_SECRET = previous.secret;
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    await prisma.$disconnect();
    await pgPool.end();
  });

  it("persists only encrypted policy content on the real control-plane database", async () => {
    const payload = {
      activeActions: ["database", "email"],
      emailConfig: { toEmail: "leads@example.test" },
      mailchimpConfig: { apiKey: "form-encryption-canary-secret" },
    };
    await upsertFormDeliveryPolicy(siteId, formId, ownerId, payload);
    const { rows: [record] } = await pgPool.query<{
      encryptedActions: string;
    }>(`SELECT "encryptedActions" FROM form_delivery_policies
       WHERE "websiteId"=$1::uuid AND "formId"=$2`, [siteId, formId]);
    expect(record.encryptedActions).not.toContain("form-encryption-canary-secret");
    expect(record.encryptedActions).not.toContain("leads@example.test");
  });

  it("serves the encrypted policy in production, ignoring unsafe editor-stored integration", async () => {
    process.env.NODE_ENV = "production";
    try {
      const result = await getTrustedFormPolicy(siteId, formId);
      expect(result.actions).toMatchObject({
        activeActions: ["database", "email"],
        emailConfig: { toEmail: "leads@example.test" },
      });
      expect(JSON.stringify(result.actions)).not.toContain("editor-plaintext-unsafe");
    } finally { process.env.NODE_ENV = "test"; }
  });

  it("does not reveal sensitive policy fields through the owner status endpoint", async () => {
    const status = await listFormDeliveryPolicy(siteId, formId, ownerId);
    expect(status).toEqual({
      formId, configured: true, activeActions: ["database", "email"],
    });
    expect(JSON.stringify(status)).not.toContain("form-encryption-canary-secret");
  });

  it("blocks outsiders from changing an existing form delivery integration", async () => {
    await expect(upsertFormDeliveryPolicy(siteId, formId, outsiderId, {
      activeActions: ["email"], emailConfig: { toEmail: "attacker@example.test" },
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("revokes stored outbound delivery when the owner deletes the policy", async () => {
    await deleteFormDeliveryPolicy(siteId, formId, ownerId);
    process.env.NODE_ENV = "production";
    try {
      const result = await getTrustedFormPolicy(siteId, formId);
      expect(result.actions).toBeUndefined();
    } finally { process.env.NODE_ENV = "test"; }
  });
});
