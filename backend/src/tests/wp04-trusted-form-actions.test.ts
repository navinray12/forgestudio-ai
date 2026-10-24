import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  website: vi.fn(),
  trusted: vi.fn(),
  accepted: vi.fn(),
  known: vi.fn(),
  job: vi.fn(),
  sheets: vi.fn(),
  mailchimp: vi.fn(),
  zapier: vi.fn(),
}));

vi.mock("../config/prisma.js", () => ({
  prisma: {
    website: { findUnique: mocks.website },
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
  },
}));
vi.mock("../services/leads/leadIntake.service.js", () => ({
  isKnownSubmissionKey: mocks.known,
  acceptSubmission: mocks.accepted,
}));
vi.mock("../services/jobs/jobRunner.js", () => ({ enqueueJob: mocks.job }));
vi.mock("../services/integration.service.js", () => ({
  IntegrationService: {
    syncToGoogleSheets: mocks.sheets,
    syncToMailchimp: mocks.mailchimp,
    dispatchToZapier: mocks.zapier,
  },
}));

import { getTrustedFormPolicy } from "../services/form/trustedFormPolicy.service.js";
import { escapeFormHtml, processFormSubmission } from "../services/form/form.service.js";

const siteId = "00000000-0000-4000-8000-000000000001";
const formId = "form-1";
const untrusted = {
  websiteId: siteId, formId, formName: "Untrusted Form",
  fields: { email: "visitor@example.test" },
  actions: {
    activeActions: ["database", "email", "webhook", "google_sheets", "mailchimp", "zapier"],
    webhookConfig: { endpointUrl: "https://evil.example.test/steal", secretKey: "stolen" },
    emailConfig: { toEmail: "attacker@example.test" },
    googleSheetsConfig: { webhookUrl: "https://evil.example.test/sheets" },
    mailchimpConfig: { apiKey: "stolen", listId: "list" },
    zapierConfig: { webhookUrl: "https://evil.example.test/zapier" },
    successMessage: "Fake success",
    redirectConfig: { url: "https://evil.example.test/redirect" },
  },
  spamProtection: { rateLimitPerMinute: 100000 },
  idempotencyKey: "test-key",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.website.mockResolvedValue({ editorData: { elements: [] } });
  mocks.known.mockResolvedValue(false);
  mocks.accepted.mockResolvedValue({ id: "receipt", replayed: false });
  mocks.job.mockResolvedValue(undefined);
});

describe("WP-04 trusted form integration boundary", () => {
  it("does not trust integration settings submitted by a visitor", async () => {
    const result = await processFormSubmission({
      ...untrusted,
      metadata: { ip: "192.0.2.201" },
    });
    expect(result.success).toBe(true);
    expect(result.actionsExecuted).toEqual({ database: true });
    expect(result.redirectUrl).toBeUndefined();
    expect(result.message).not.toBe("Fake success");
    expect(mocks.accepted).toHaveBeenCalledWith(expect.objectContaining({
      notifications: [],
      formName: "Website Form",
    }));
    expect(mocks.job).not.toHaveBeenCalled();
    expect(mocks.sheets).not.toHaveBeenCalled();
    expect(mocks.mailchimp).not.toHaveBeenCalled();
    expect(mocks.zapier).not.toHaveBeenCalled();
  });

  it("loads published/saved form actions only from owner-controlled site document", async () => {
    mocks.website.mockResolvedValue({
      editorData: { pages: [{ elements: [{
        id: formId, type: "form", formTitle: "Owner Form",
        formActions: {
          activeActions: ["database", "webhook"],
          webhookConfig: { endpointUrl: "https://hooks.example.test/form" },
        },
      }] }] },
    });
    const policy = await getTrustedFormPolicy(siteId, formId);
    expect(policy.formName).toBe("Owner Form");
    expect(policy.actions?.webhookConfig).toEqual({ endpointUrl: "https://hooks.example.test/form" });
    const result = await processFormSubmission({
      ...untrusted, metadata: { ip: "192.0.2.202" },
    });
    expect(result.actionsExecuted?.webhook).toBe(true);
    const event = mocks.accepted.mock.calls[0][0].notifications[0];
    expect(event.payload.url).toBe("https://hooks.example.test/form");
    expect(event.payload.url).not.toContain("evil.example");
  });

  it("never executes an outbound integration for a different form ID", async () => {
    mocks.website.mockResolvedValue({ editorData: { elements: [{
      id: "different-form", type: "form",
      formActions: {
        activeActions: ["webhook"], webhookConfig: { endpointUrl: "https://example.test" },
      },
    }] } });
    await processFormSubmission({
      ...untrusted, metadata: { ip: "192.0.2.203" },
    });
    expect(mocks.accepted.mock.calls[0][0].notifications).toEqual([]);
  });

  it("fails closed when a requested website does not exist", async () => {
    mocks.website.mockResolvedValue(null);
    await expect(processFormSubmission({
      ...untrusted, metadata: { ip: "192.0.2.204" },
    })).rejects.toMatchObject({ code: "WEBSITE_NOT_FOUND", statusCode: 404 });
    expect(mocks.accepted).not.toHaveBeenCalled();
  });

  it("rejects invalid saved editor documents rather than using visitor fallback", async () => {
    mocks.website.mockResolvedValue({ editorData: "{invalid-json" });
    await expect(getTrustedFormPolicy(siteId, formId))
      .rejects.toMatchObject({ code: "FORM_CONFIGURATION_UNAVAILABLE" });
  });

  it("escapes visitor fields in HTML email notifications", () => {
    expect(escapeFormHtml('<img src=x onerror="alert(1)">'))
      .toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(escapeFormHtml("A&B 'C'"))
      .toBe("A&amp;B &#39;C&#39;");
  });
});
