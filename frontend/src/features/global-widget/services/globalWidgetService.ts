import type { GlobalWidget, CreateGlobalWidgetPayload, UpdateGlobalWidgetPayload } from "../types/globalWidget.types";

const LOCAL_STORAGE_KEY = "forgestudio_global_widgets";

function getLocalGlobalWidgets(): GlobalWidget[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is GlobalWidget =>
      typeof item === "object" && item !== null &&
      "id" in item && typeof item.id === "string" &&
      "name" in item && typeof item.name === "string" &&
      "elements" in item && Array.isArray(item.elements)
    );
  } catch {
    return [];
  }
}

function saveLocalGlobalWidgets(widgets: GlobalWidget[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(widgets));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Creates a new Global Widget
 */
export async function saveGlobalWidget(
  apiUrl: string,
  payload: CreateGlobalWidgetPayload
): Promise<GlobalWidget> {
  const trimmedName = payload.name?.trim();
  if (!trimmedName) {
    throw new Error("Global Widget name is required.");
  }

  const clonedElements = JSON.parse(JSON.stringify(payload.elements || []));
  const newWidget: GlobalWidget = {
    id: `gw-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    userId: "user-current",
    name: trimmedName,
    description: payload.description?.trim() || "",
    category: payload.category || "Global Widget",
    elements: clonedElements,
    isGlobalWidget: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    // Try backend persistence if API route exists
    const res = await fetch(`${apiUrl}/api/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: trimmedName,
        description: payload.description || "",
        type: "GLOBAL_WIDGET",
        category: "Global Widget",
        templateData: { elements: clonedElements, pageSettings: {} },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.template) {
        newWidget.id = data.template.id;
      }
    }
  } catch {
    // Fallback to local storage
  }

  const local = getLocalGlobalWidgets();
  saveLocalGlobalWidgets([newWidget, ...local.filter((w) => w.id !== newWidget.id)]);

  return newWidget;
}

/**
 * Retrieves all user Global Widgets
 */
export async function getGlobalWidgets(apiUrl: string): Promise<GlobalWidget[]> {
  let remoteWidgets: GlobalWidget[] = [];

  try {
    const res = await fetch(`${apiUrl}/api/templates`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (res.ok) {
      const data: unknown = await res.json();
      const rawTemplates: unknown = Array.isArray(data)
        ? data
        : typeof data === "object" && data !== null && "templates" in data
          ? data.templates
          : [];
      if (Array.isArray(rawTemplates)) {
        const isTemplate = (value: unknown): value is Record<string, unknown> =>
          typeof value === "object" && value !== null &&
          "id" in value && typeof value.id === "string" &&
          "name" in value && typeof value.name === "string";

        remoteWidgets = rawTemplates
          .filter(isTemplate)
          .filter((template) => template.type === "GLOBAL_WIDGET" || template.category === "Global Widget")
          .map((template): GlobalWidget => {
            const templateData = template.templateData;
            const elements = typeof templateData === "object" && templateData !== null &&
              "elements" in templateData && Array.isArray(templateData.elements)
              ? templateData.elements
              : [];
            return {
              id: template.id as string,
              userId: typeof template.userId === "string" ? template.userId : "user-current",
              name: template.name as string,
              description: typeof template.description === "string" ? template.description : "",
              category: typeof template.category === "string" ? template.category : "Global Widget",
              elements,
              isGlobalWidget: true,
              createdAt: typeof template.createdAt === "string" ? template.createdAt : new Date().toISOString(),
              updatedAt: typeof template.updatedAt === "string" ? template.updatedAt : new Date().toISOString(),
            };
          });
      }
    }
  } catch {
    // Fallback to local
  }

  const localWidgets = getLocalGlobalWidgets();
  const mergedMap = new Map<string, GlobalWidget>();

  localWidgets.forEach((w) => mergedMap.set(w.id, w));
  remoteWidgets.forEach((w) => mergedMap.set(w.id, w));

  return Array.from(mergedMap.values());
}

/**
 * Updates an existing Global Widget
 */
export async function updateGlobalWidgetService(
  apiUrl: string,
  id: string,
  payload: UpdateGlobalWidgetPayload
): Promise<GlobalWidget> {
  const localWidgets = getLocalGlobalWidgets();
  const target = localWidgets.find((w) => w.id === id);

  const updated: GlobalWidget = {
    id,
    userId: target?.userId || "user-current",
    name: payload.name?.trim() || target?.name || "Global Widget",
    description: payload.description !== undefined ? payload.description : target?.description || "",
    category: target?.category || "Global Widget",
    elements: payload.elements ? JSON.parse(JSON.stringify(payload.elements)) : target?.elements || [],
    isGlobalWidget: true,
    createdAt: target?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await fetch(`${apiUrl}/api/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: updated.name,
        description: updated.description,
        type: "GLOBAL_WIDGET",
        category: "Global Widget",
        templateData: { elements: updated.elements, pageSettings: {} },
      }),
    });
  } catch {
    // Local fallback
  }

  // Remote-only widgets also need a local copy for the offline fallback.
  saveLocalGlobalWidgets([
    updated,
    ...localWidgets.filter((widget) => widget.id !== id),
  ]);
  return updated;
}

/**
 * Deletes a Global Widget
 */
export async function deleteGlobalWidgetService(apiUrl: string, id: string): Promise<void> {
  try {
    await fetch(`${apiUrl}/api/templates/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    // Local fallback
  }

  const local = getLocalGlobalWidgets();
  saveLocalGlobalWidgets(local.filter((w) => w.id !== id));
}
