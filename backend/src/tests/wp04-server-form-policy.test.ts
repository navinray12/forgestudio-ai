import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  query: vi.fn(),
  siteFind: vi.fn(),
  authorize: vi.fn(),
}));
vi.mock("../config/prisma.js", () => ({
  prisma: { website: { findUnique: h.siteFind } },
  pgPool: { query: h.query },
}));
vi.mock("../modules/data-platform/common/project-access.js", () => ({
  verifyProjectAccess: h.authorize,
}));

import {
  upsertFormDeliveryPolicy,
  listFormDeliveryPolicy,
  deleteFormDeliveryPolicy,
  getServerFormDeliveryActions,
} from "../services/form/formDeliveryPolicy.service.js";
import { getTrustedFormPolicy } from "../services/form/trustedFormPolicy.service.js";
import { decryptCredential } from "../modules/data-platform/security/encryption.js";

const site = "00000000-0000-4000-8000-000000000011";
const user = "00000000-0000-4000-8000-000000000012";
const formId = "contact-form";
const previousSecret = process.env.FORGE_DATA_PLATFORM_SECRET;
const previousEnv = process.env.NODE_ENV;
let stored: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  stored = undefined;
  process.env.FORGE_DATA_PLATFORM_SECRET = "a-unique-production-form-policy-key-that-is-32-bytes";
  process.env.NODE_ENV = "production";
  h.authorize.mockResolvedValue({ canAdminister: true });
  h.siteFind.mockResolvedValue({
    editorData: { elements: [{ id: formId, type: "form", formActions: {
      activeActions: ["webhook"],
      webhookConfig: { endpointUrl: "https://untrusted-editor.example.test/leak", secretKey: "editor-plain" },
    } }] },
  });
  h.query.mockImplementation(async (sql: string, values: unknown[]) => {
    if (sql.includes("INSERT INTO form_delivery_policies")) {
      stored = String(values[2]);
      return { rowCount: 1, rows: [] };
    }
    if (sql.includes("SELECT") && sql.includes("form_delivery_policies"))
      return { rowCount: stored ? 1 : 0, rows: stored ? [{ encryptedActions: stored }] : [] };
    if (sql.includes("DELETE FROM form_delivery_policies")) {
      stored = undefined;
      return { rowCount: 1, rows: [] };
    }
    throw new Error("Unexpected SQL");
  });
});
afterEach(() => {
  if (previousSecret === undefined) delete process.env.FORGE_DATA_PLATFORM_SECRET;
  else process.env.FORGE_DATA_PLATFORM_SECRET = previousSecret;
  if (previousEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousEnv;
});

describe("WP-04 production form policy management", () => {
  it("stores an authenticated owner's policy encrypted and never echoes credentials", async () => {
    const actions = {
      activeActions: ["database", "email"],
      emailConfig: { toEmail: "leads@example.test" },
      mailchimpConfig: { apiKey: "server-only-secret" },
    };
    const result = await upsertFormDeliveryPolicy(site, formId, user, actions);
    expect(result).toEqual({ configured: true, formId, activeActions: ["database", "email"] });
    expect(stored).not.toContain("server-only-secret");
    expect(decryptCredential(stored!)).toContain("server-only-secret");
    expect(await listFormDeliveryPolicy(site, formId, user))
      .toEqual({ configured: true, formId, activeActions: ["database", "email"] });
    expect(h.authorize).toHaveBeenCalledWith(site, user);
  });

  it("never uses editor-stored webhook credentials in production", async () => {
    expect(await getTrustedFormPolicy(site, formId)).toMatchObject({
      actions: undefined,
    });
    expect(await getServerFormDeliveryActions(site, formId)).toBeUndefined();
  });

  it("resolves only encrypted server-delivery policy after admin config", async () => {
    await upsertFormDeliveryPolicy(site, formId, user, {
      activeActions: ["database", "email"],
      emailConfig: { toEmail: "leads@example.test" },
    });
    const policy = await getTrustedFormPolicy(site, formId);
    expect(policy.actions).toMatchObject({
      activeActions: ["database", "email"],
      emailConfig: { toEmail: "leads@example.test" },
    });
    expect(JSON.stringify(policy.actions)).not.toContain("editor-plain");
  });

  it("denies read-only collaborators from writing or viewing config", async () => {
    h.authorize.mockResolvedValue({ canAdminister: false });
    await expect(upsertFormDeliveryPolicy(site, formId, user, { activeActions: ["database"] }))
      .rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    await expect(listFormDeliveryPolicy(site, formId, user))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(h.query).not.toHaveBeenCalled();
  });

  it("fails closed on unknown site ownership", async () => {
    h.authorize.mockRejectedValue(new Error("foreign website"));
    await expect(upsertFormDeliveryPolicy(site, formId, user, { activeActions: ["database"] }))
      .rejects.toThrow("foreign website");
    expect(h.query).not.toHaveBeenCalled();
  });

  it("rejects non-HTTPS, private and invalid webhook URLs", async () => {
    for (const endpointUrl of ["http://example.test/receive", "https://127.0.0.1/receive"]) {
      await expect(upsertFormDeliveryPolicy(site, formId, user, {
        activeActions: ["webhook"], webhookConfig: { endpointUrl },
      })).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(h.query).not.toHaveBeenCalled();
  });

  it("rejects duplicate outbound actions and empty provider credentials before encryption/write", async () => {
    const invalid = [
      { activeActions: ["webhook", "webhook"], webhookConfig: { endpointUrl: "https://hooks.example.org/submit" } },
      { activeActions: ["mailchimp"], mailchimpConfig: { apiKey: " ", listId: "customers" } },
      { activeActions: ["mailchimp"], mailchimpConfig: { apiKey: "valid-key", listId: "" } },
    ];
    for (const policy of invalid) {
      await expect(upsertFormDeliveryPolicy(site, formId, user, policy))
        .rejects.toMatchObject({ statusCode: 400, code: "INVALID_FORM_POLICY" });
    }
    expect(h.query).not.toHaveBeenCalled();
  });

  it("blocks unsafe active redirect and popup destinations before persistence", async () => {
    const invalid = [
      { activeActions: ["redirect"] },
      { activeActions: ["redirect"], redirectConfig: { url: "http://example.org" } },
      { activeActions: ["redirect"], redirectConfig: { url: "https://127.0.0.1/private" } },
      { activeActions: ["popup"] },
      { activeActions: ["popup"], popupConfig: { popupId: "../bad" } },
    ];
    for (const policy of invalid) {
      await expect(upsertFormDeliveryPolicy(site, formId, user, policy))
        .rejects.toMatchObject({ statusCode: 400, code: "INVALID_FORM_POLICY" });
    }
    expect(h.query).not.toHaveBeenCalled();
  });

  it("deleting a policy disables delivery without deleting the form itself", async () => {
    await upsertFormDeliveryPolicy(site, formId, user, { activeActions: ["database"] });
    await deleteFormDeliveryPolicy(site, formId, user);
    expect(await getServerFormDeliveryActions(site, formId)).toBeUndefined();
    expect(await getTrustedFormPolicy(site, formId)).toMatchObject({ actions: undefined });
  });
});
