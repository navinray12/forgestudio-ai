import { afterEach, describe, expect, it, vi } from "vitest";
import {
  saveAsTemplate,
  getUserTemplates,
  getPublicTemplate,
  updateTemplate,
  deleteTemplate,
  toggleTemplateSharing,
} from "../src/features/templates/services/templateService";

const apiUrl = "https://example.test";
const template = {
  id: "template-a",
  userId: "owner",
  name: "Hero",
  templateData: { elements: [{ id: "element-1", type: "heading" }], pageSettings: {} },
};

function mockServer(status: number, body: unknown) {
  // Every HTTP request receives its own readable response body.
  const mock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  }));
  vi.stubGlobal("fetch", mock);
  return mock;
}
afterEach(() => vi.unstubAllGlobals());

describe("WP-03 template API persistence contracts", () => {
  it("distinguishes a valid empty library from a malformed successful response", async () => {
    mockServer(200, { success: true, templates: [] });
    await expect(getUserTemplates(apiUrl)).resolves.toEqual([]);
    mockServer(200, { success: true, templates: null });
    await expect(getUserTemplates(apiUrl)).rejects.toThrow("Invalid template library response");
  });

  it("never reports server-declared failure as an empty library", async () => {
    mockServer(200, { success: false, templates: [], message: "Database temporarily unavailable" });
    await expect(getUserTemplates(apiUrl)).rejects.toThrow("Database temporarily unavailable");
  });

  it("does not claim a template was saved without a server-owned ID", async () => {
    mockServer(201, { success: true, template: { name: "Hero" } });
    await expect(saveAsTemplate(apiUrl, {
      name: "Hero",
      templateData: template.templateData as never,
    })).rejects.toThrow("not confirmed saved");
  });

  it("saves via authenticated backend and preserves the returned server ID", async () => {
    const mock = mockServer(201, { success: true, template });
    const created = await saveAsTemplate(apiUrl, {
      name: "  Hero  ", templateData: template.templateData as never,
    });
    expect(created.id).toBe("template-a");
    const [url, options] = mock.mock.calls[0];
    expect(url).toBe("https://example.test/api/templates");
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    expect(JSON.parse(options.body).name).toBe("Hero");
  });

  it("refuses to confirm update or share from a malformed server response", async () => {
    mockServer(200, { success: true });
    await expect(updateTemplate(apiUrl, "template-a", { name: "New" }))
      .rejects.toThrow("update was not confirmed");
    await expect(toggleTemplateSharing(apiUrl, "template-a", true))
      .rejects.toThrow("Sharing change was not confirmed");
  });

  it("refuses to confirm deletion from HTTP success with failed business operation", async () => {
    mockServer(200, { success: false, message: "Not deleted" });
    await expect(deleteTemplate(apiUrl, "template-a")).rejects.toThrow("Not deleted");
  });

  it("encodes public share tokens as one path segment", async () => {
    const mock = mockServer(200, { success: true, template });
    await getPublicTemplate(apiUrl, "token/with spaces");
    expect(mock.mock.calls[0][0]).toBe(
      "https://example.test/api/templates/public/token%2Fwith%20spaces",
    );
  });

  it("propagates HTTP authentication and backend availability errors", async () => {
    mockServer(401, { message: "Login required" });
    await expect(getUserTemplates(apiUrl)).rejects.toThrow("Login required");
    mockServer(503, { error: { message: "PostgreSQL unavailable" } });
    await expect(getUserTemplates(apiUrl)).rejects.toThrow("PostgreSQL unavailable");
  });
});
