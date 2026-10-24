import type {
  GlobalWidget,
  CreateGlobalWidgetPayload,
  UpdateGlobalWidgetPayload,
} from "../types/globalWidget.types";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: JsonObject, field: string): string {
  const item = value[field];
  if (typeof item !== "string" || item.length === 0) {
    throw new Error(`Invalid Global Widget response: missing ${field}.`);
  }
  return item;
}

/**
 * Templates are the existing server-side source of truth for Global Widgets.
 * Never synthesize widget IDs or claim a mutation succeeded when the request
 * failed: an offline localStorage fallback could leak data between accounts.
 */
function fromTemplate(value: unknown): GlobalWidget {
  if (!isObject(value) || !isObject(value.templateData)) {
    throw new Error("Invalid Global Widget response from server.");
  }
  const elements = value.templateData.elements;
  if (!Array.isArray(elements)) {
    throw new Error("Invalid Global Widget elements from server.");
  }
  return {
    id: stringField(value, "id"),
    userId: stringField(value, "userId"),
    name: stringField(value, "name"),
    description: typeof value.description === "string" ? value.description : "",
    category: "Global Widget",
    elements,
    isGlobalWidget: true,
    createdAt: stringField(value, "createdAt"),
    updatedAt: stringField(value, "updatedAt"),
  };
}

function errorMessage(body: unknown, fallback: string): string {
  if (isObject(body)) {
    if (isObject(body.error) && typeof body.error.message === "string") {
      return body.error.message;
    }
    if (typeof body.message === "string") return body.message;
  }
  return fallback;
}

async function templateRequest(
  apiUrl: string,
  path: string,
  init: RequestInit,
): Promise<JsonObject> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/templates${path}`, {
      credentials: "include",
      ...init,
    });
  } catch {
    throw new Error("Unable to connect to the server. No Global Widget changes were saved.");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`Global Widget request failed (HTTP ${response.status}).`);
    }
    throw new Error("Invalid Global Widget response from server.");
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session has expired. Sign in again.");
    if (response.status === 403) throw new Error("You do not have permission to modify this Global Widget.");
    throw new Error(errorMessage(body, `Global Widget request failed (HTTP ${response.status}).`));
  }
  if (!isObject(body) || body.success === false) {
    throw new Error(errorMessage(body, "Invalid Global Widget response from server."));
  }
  return body;
}

const jsonHeaders = { "Content-Type": "application/json" };

/** Creates a durable server-owned Global Widget. */
export async function saveGlobalWidget(
  apiUrl: string,
  payload: CreateGlobalWidgetPayload,
): Promise<GlobalWidget> {
  const name = payload.name?.trim();
  if (!name) throw new Error("Global Widget name is required.");
  if (!Array.isArray(payload.elements) || payload.elements.length === 0) {
    throw new Error("Select at least one element to save as a Global Widget.");
  }

  const body = await templateRequest(apiUrl, "", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      name,
      description: payload.description?.trim() || "",
      type: "GLOBAL_WIDGET",
      category: "Global Widget",
      templateData: { elements: payload.elements, pageSettings: {} },
    }),
  });
  return fromTemplate(body.template);
}

/** Lists only the authenticated user's server-persisted Global Widgets. */
export async function getGlobalWidgets(apiUrl: string): Promise<GlobalWidget[]> {
  const body = await templateRequest(apiUrl, "", { method: "GET" });
  if (!Array.isArray(body.templates)) {
    throw new Error("Invalid Global Widget list from server.");
  }
  return body.templates
    .filter((template): template is JsonObject =>
      isObject(template) && (
        template.type === "GLOBAL_WIDGET" ||
        template.category === "Global Widget"
      ),
    )
    .map(fromTemplate);
}

/** Updates a widget only after the server confirms ownership and persistence. */
export async function updateGlobalWidgetService(
  apiUrl: string,
  id: string,
  payload: UpdateGlobalWidgetPayload,
): Promise<GlobalWidget> {
  if (!id) throw new Error("Global Widget ID is required.");
  const name = payload.name === undefined ? undefined : payload.name.trim();
  if (name === "") throw new Error("Global Widget name cannot be empty.");
  if (payload.elements !== undefined &&
      (!Array.isArray(payload.elements) || payload.elements.length === 0)) {
    throw new Error("Global Widget must contain at least one element.");
  }

  const patch: JsonObject = {};
  if (name !== undefined) patch.name = name;
  if (payload.description !== undefined) patch.description = payload.description.trim();
  if (payload.elements !== undefined) {
    patch.templateData = { elements: payload.elements, pageSettings: {} };
  }
  const body = await templateRequest(apiUrl, `/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(patch),
  });
  return fromTemplate(body.template);
}

/** Deletes only after the server confirms that the authenticated user owns it. */
export async function deleteGlobalWidgetService(apiUrl: string, id: string): Promise<void> {
  if (!id) throw new Error("Global Widget ID is required.");
  await templateRequest(apiUrl, `/${encodeURIComponent(id)}`, { method: "DELETE" });
}
