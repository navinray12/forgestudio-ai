import { afterEach, describe, expect, it, vi } from "vitest";
import {
  saveGlobalWidget,
  getGlobalWidgets,
  updateGlobalWidgetService,
  deleteGlobalWidgetService,
} from "../src/features/global-widget/services/globalWidgetService";

const apiUrl = "https://forge.example.test/";
const template = {
  id: "widget-1",
  userId: "owner-1",
  name: "Site header",
  description: "Shared header",
  type: "GLOBAL_WIDGET",
  category: "Other",
  templateData: { elements: [{ id: "node-1", type: "heading" }], pageSettings: {} },
  createdAt: "2026-10-24T00:00:00.000Z",
  updatedAt: "2026-10-24T00:00:00.000Z",
};

function mockResponse(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("global widget server persistence", () => {
  it("creates via authenticated templates API and returns the server ID", async () => {
    const fetchMock = mockResponse(201, { success: true, template });
    const created = await saveGlobalWidget(apiUrl, {
      name: "  Site header  ",
      elements: template.templateData.elements as never[],
    });
    expect(created.id).toBe("widget-1");
    expect(created.userId).toBe("owner-1");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://forge.example.test/api/templates");
    expect(request.method).toBe("POST");
    expect(request.credentials).toBe("include");
    expect(JSON.parse(request.body).name).toBe("Site header");
    expect(JSON.parse(request.body).type).toBe("GLOBAL_WIDGET");
  });

  it("rejects invalid creation without calling the server", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(saveGlobalWidget(apiUrl, { name: " ", elements: [] })).rejects.toThrow("name is required");
    await expect(saveGlobalWidget(apiUrl, { name: "Header", elements: [] })).rejects.toThrow("at least one");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads only server-persisted widgets and filters other template types", async () => {
    mockResponse(200, {
      success: true,
      templates: [template, { ...template, id: "page-1", type: "PAGE" }],
    });
    const widgets = await getGlobalWidgets(apiUrl);
    expect(widgets).toHaveLength(1);
    expect(widgets[0].id).toBe("widget-1");
    expect(widgets[0].elements).toHaveLength(1);
  });

  it("rejects malformed server lists instead of showing a false empty state", async () => {
    mockResponse(200, { success: true, templates: null });
    await expect(getGlobalWidgets(apiUrl)).rejects.toThrow("Invalid Global Widget list");
  });

  it("rejects malformed server records instead of inventing ownership", async () => {
    mockResponse(200, {
      success: true,
      templates: [{ ...template, userId: undefined }],
    });
    await expect(getGlobalWidgets(apiUrl)).rejects.toThrow("missing userId");
  });

  it("sends a partial PATCH without overwriting untouched elements", async () => {
    const fetchMock = mockResponse(200, { success: true, template: { ...template, name: "New name" } });
    const updated = await updateGlobalWidgetService(apiUrl, "widget-1", { name: " New name " });
    expect(updated.name).toBe("New name");
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://forge.example.test/api/templates/widget-1");
    expect(request.method).toBe("PATCH");
    expect(JSON.parse(request.body)).toEqual({ name: "New name" });
  });

  it("does not claim update success when permissions are denied", async () => {
    mockResponse(403, { success: false, error: { message: "Forbidden" } });
    await expect(updateGlobalWidgetService(apiUrl, "foreign", { name: "Wrong" }))
      .rejects.toThrow("do not have permission");
  });

  it("does not claim write success on a server error", async () => {
    mockResponse(500, { success: false, error: { message: "Database unavailable" } });
    await expect(saveGlobalWidget(apiUrl, {
      name: "Header",
      elements: template.templateData.elements as never[],
    })).rejects.toThrow("Database unavailable");
  });

  it("does not claim write success when offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network error")));
    await expect(saveGlobalWidget(apiUrl, {
      name: "Header",
      elements: template.templateData.elements as never[],
    })).rejects.toThrow("No Global Widget changes were saved");
  });

  it("fails clearly when authentication expires", async () => {
    mockResponse(401, { success: false });
    await expect(getGlobalWidgets(apiUrl)).rejects.toThrow("session has expired");
  });

  it("deletes only after successful server confirmation", async () => {
    const fetchMock = mockResponse(200, { success: true, id: "widget-1" });
    await expect(deleteGlobalWidgetService(apiUrl, "widget-1")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    mockResponse(404, { success: false, message: "Not found" });
    await expect(deleteGlobalWidgetService(apiUrl, "widget-1")).rejects.toThrow("Not found");
  });
});
