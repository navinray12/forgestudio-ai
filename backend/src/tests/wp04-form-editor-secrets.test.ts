import { describe, expect, it } from "vitest";
import { assertNoInlineFormCredentials } from "../services/websites/formEditorSecrets.guard.js";

describe("WP-04 prevent inline form secrets in editor document", () => {
  it("allows ordinary form fields, styles and non-sensitive action settings", () => {
    const document = { pages: [{ elements: [{
      id: "contact", type: "form", formConfig: {
        fields: [{ name: "email" }],
        actions: {
          activeActions: ["database", "email", "webhook"],
          emailConfig: { toEmail: "team@example.test" },
          webhookConfig: { endpointUrl: "https://api.example.test/contact" },
        },
      },
    }] }] };
    expect(() => assertNoInlineFormCredentials(document)).not.toThrow();
  });

  it.each([
    ["webhook secret", { formActions: { webhookConfig: { secretKey: "raw-secret" } } }],
    ["mailchimp API key", { formConfig: { actions: { mailchimpConfig: { apiKey: "sensitive-token" } } } }],
    ["access token", { formActions: { googleSheetsConfig: { accessToken: "sensitive-token" } } }],
    ["password", { type: "form", actions: { smtpConfig: { password: "sensitive-pass" } } }],
  ])("blocks %s embedded in publishable website document", (_label, unsafe) => {
    expect(() => assertNoInlineFormCredentials({
      pages: [{ children: [{ id: "form-1", ...unsafe }] }],
    })).toThrow(/secure server delivery settings/);
  });

  it("does not falsely identify normal text mentioning a secret", () => {
    expect(() => assertNoInlineFormCredentials({
      elements: [{ type: "text", content: "A tutorial about API keys", apiKey: "sample" }],
    })).not.toThrow();
  });

  it("enforces bounded traversal on malformed oversized documents", () => {
    expect(() => assertNoInlineFormCredentials({ elements: Array.from({ length: 22000 }, () => ({ type: "text" })) }))
      .toThrow(/validation limits/);
  });
});
