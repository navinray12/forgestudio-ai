import { AppError } from "../../utils/app-error.js";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_NODES = 100_000;
const MAX_DEPTH = 48;
const RESERVED_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const SERVER_DOCUMENT_KEYS = new Set(["publishedData", "publishing", "releases", "currentReleaseId", "deploymentHistory", "deployment", "backups", "backupPolicy", "hostingConfig", "customDomains", "scheduledPublish"]);
const CONTENT_KEYS = new Set(["text", "title", "description", "buttonText", "imageUrl", "imageAlt", "videoUrl", "link", "url", "label", "placeholder", "htmlContent"]);
const EPHEMERAL_KEYS = new Set(["lastSavedAt", "activePageId", "selectedElementId"]);

/** Validate before JSON.stringify, hashing, recursion or database admission. */
export function canonicalDocumentJson(input: unknown): string {
  let nodes = 0;
  let bytes = 0;
  function visit(value: unknown, depth: number): string {
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) throw new AppError("Document exceeds the supported complexity", 413, "DOCUMENT_TOO_COMPLEX");
    let encoded: string;
    if (value === null || typeof value === "boolean") encoded = JSON.stringify(value);
    else if (typeof value === "number" && Number.isFinite(value)) encoded = JSON.stringify(value);
    else if (typeof value === "string") encoded = JSON.stringify(value);
    else if (Array.isArray(value)) {
      if (value.length > 20_000) throw new AppError("Document collection is too large", 413, "DOCUMENT_TOO_COMPLEX");
      encoded = `[${value.map(item => visit(item, depth + 1)).join(",")}]`;
      bytes += 2 + Math.max(0, value.length - 1);
      if (bytes > MAX_BYTES) throw new AppError("Document exceeds four MiB", 413, "DOCUMENT_TOO_LARGE");
      return encoded;
    } else if (value && typeof value === "object") {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== null && (Object.getPrototypeOf(prototype) !== null || Object.getOwnPropertyDescriptor(prototype, "constructor")?.value?.name !== "Object")) throw new AppError("Only plain JSON objects are accepted", 422, "DOCUMENT_INVALID");
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const fields: string[] = [];
      for (const key of Object.keys(descriptors).sort()) {
        if (RESERVED_KEYS.has(key) || descriptors[key]?.get || descriptors[key]?.set || descriptors[key]?.value === undefined) {
          throw new AppError("Document contains an unsupported field", 422, "DOCUMENT_INVALID");
        }
        const prefix = JSON.stringify(key);
        bytes += Buffer.byteLength(prefix) + 1;
        fields.push(`${prefix}:${visit(descriptors[key]?.value, depth + 1)}`);
      }
      bytes += 2 + Math.max(0, fields.length - 1);
      if (bytes > MAX_BYTES) throw new AppError("Document exceeds four MiB", 413, "DOCUMENT_TOO_LARGE");
      return `{${fields.join(",")}}`;
    } else throw new AppError("Only finite JSON values are accepted", 422, "DOCUMENT_INVALID");
    bytes += Buffer.byteLength(encoded);
    if (bytes > MAX_BYTES) throw new AppError("Document exceeds four MiB", 413, "DOCUMENT_TOO_LARGE");
    return encoded;
  }
  return visit(input, 0);
}
export function documentObject(input: unknown): JsonObject {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AppError("A document object is required", 422, "DOCUMENT_INVALID");
  return JSON.parse(canonicalDocumentJson(input)) as JsonObject;
}
export function expectedDocumentVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value >= 2_147_483_647) {
    throw new AppError("Load the current document and provide its version", 428, "DOCUMENT_PRECONDITION_REQUIRED");
  }
  return value;
}
export function documentETag(id: string, version: number): string { return `"${id}:document:${expectedDocumentVersion(version)}"`; }
export function parseDocumentETag(id: string, value: unknown): number {
  if (typeof value !== "string" || value.length > 100) return expectedDocumentVersion(null);
  const match = /^"([a-fA-F0-9-]{36}):document:([1-9][0-9]{0,9})"$/.exec(value);
  if (!match || match[1] !== id) return expectedDocumentVersion(null);
  return expectedDocumentVersion(Number(match[2]));
}
function equal(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  return left === undefined || right === undefined ? left === right : canonicalDocumentJson(left) === canonicalDocumentJson(right);
}
function asObject(value: JsonValue | undefined): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function omit(object: JsonObject, keys: Set<string>): JsonObject {
  return Object.fromEntries(Object.entries(object).filter(([key]) => !keys.has(key)));
}
/** A draft save can never forge a published release, even for an owner. */
export function preservePublishingAuthority(current: JsonObject, incoming: JsonObject): JsonObject {
  for (const key of SERVER_DOCUMENT_KEYS) {
    if (key in incoming && !equal(current[key], incoming[key])) throw new AppError("Publishing state is owned by the publish workflow", 403, "PUBLISH_COMMAND_REQUIRED");
  }
  const result = { ...current, ...incoming };
  for (const key of SERVER_DOCUMENT_KEYS) {
    if (key in current) result[key] = current[key]!; else delete result[key];
  }
  return result;
}
/** Validate structure and stable identifiers independently of the renderer. */
export function validateDocumentTree(document: JsonObject): void {
  const ids = new Set<string>();
  let elements = 0;
  const visit = (items: JsonValue | undefined, depth = 0) => {
    if (items === undefined) return;
    if (!Array.isArray(items) || depth > 24) throw new AppError("Invalid element tree", 422, "DOCUMENT_INVALID");
    for (const item of items) {
      const node = asObject(item);
      if (!node || typeof node.id !== "string" || !node.id || node.id.length > 200 || ids.has(node.id) || ++elements > 10_000) {
        throw new AppError("Element identifiers must be unique and bounded", 422, "DOCUMENT_INVALID");
      }
      if (node.isProtected !== undefined && typeof node.isProtected !== "boolean") throw new AppError("Invalid protection marker", 422, "DOCUMENT_INVALID");
      ids.add(node.id); visit(node.children, depth + 1);
    }
  };
  if (document.pages !== undefined) {
    if (!Array.isArray(document.pages) || document.pages.length > 500) throw new AppError("Invalid page collection", 422, "DOCUMENT_INVALID");
    const pageIds = new Set<string>();
    for (const item of document.pages) {
      const page = asObject(item);
      if (!page || typeof page.id !== "string" || !page.id || page.id.length > 200 || pageIds.has(page.id)) throw new AppError("Page identifiers must be unique", 422, "DOCUMENT_INVALID");
      pageIds.add(page.id); visit(page.elements);
    }
    // Legacy `elements` mirrors the home page. Validate it separately, not as a second unique tree.
    if (document.elements !== undefined) { ids.clear(); visit(document.elements); }
  } else visit(document.elements);
  if (document.siteParts !== undefined && document.siteParts !== null) {
    const parts = asObject(document.siteParts);
    if (!parts) throw new AppError("Invalid site parts", 422, "DOCUMENT_INVALID");
    for (const part of Object.values(parts)) { const container = asObject(part); if (!container) throw new AppError("Invalid site part", 422, "DOCUMENT_INVALID"); ids.clear(); visit(container.elements); }
  }
  if (document.popups !== undefined) {
    if (!Array.isArray(document.popups) || document.popups.length > 200) throw new AppError("Invalid popup collection", 422, "DOCUMENT_INVALID");
    for (const popup of document.popups) { const container = asObject(popup); if (!container) throw new AppError("Invalid popup", 422, "DOCUMENT_INVALID"); ids.clear(); visit(container.elements); }
  }
}
function contentOnly(current: JsonObject, incoming: JsonObject): boolean {
  const compareElements = (before: JsonValue | undefined, after: JsonValue | undefined): boolean => {
    if (before === undefined || after === undefined) return before === after;
    if (!Array.isArray(before) || !Array.isArray(after) || before.length !== after.length) return false;
    return before.every((item, index) => {
      const old = asObject(item), next = asObject(after[index]);
      if (!old || !next || old.id !== next.id) return false;
      if (!equal(omit(old, new Set(["content", "text", "children"])), omit(next, new Set(["content", "text", "children"])))) return false;
      const oldContent = asObject(old.content) || {}, newContent = asObject(next.content) || {};
      if (!equal(omit(oldContent, CONTENT_KEYS), omit(newContent, CONTENT_KEYS))) return false;
      return compareElements(old.children, next.children);
    });
  };
  if (!equal(omit(current, new Set(["pages", "elements", ...EPHEMERAL_KEYS])), omit(incoming, new Set(["pages", "elements", ...EPHEMERAL_KEYS])))) return false;
  if (!compareElements(current.elements, incoming.elements)) return false;
  if (current.pages === undefined || incoming.pages === undefined) return current.pages === incoming.pages;
  if (!Array.isArray(current.pages) || !Array.isArray(incoming.pages) || current.pages.length !== incoming.pages.length) return false;
  return current.pages.every((item, index) => {
    const old = asObject(item), next = asObject((incoming.pages as JsonValue[])[index]);
    return !!old && !!next && equal(omit(old, new Set(["elements"])), omit(next, new Set(["elements"]))) && compareElements(old.elements, next.elements);
  });
}
function seoOnly(current: JsonObject, incoming: JsonObject): boolean {
  const fields = new Set(["title", "seoTitle", "seoDescription", "description", "keywords", "canonicalUrl", "noindex", "nofollow", "ogTitle", "ogDescription", "ogImage", "twitterTitle", "twitterDescription", "twitterImage", "focusKeyword", "structuredData"]);
  const sameSettings = (before: JsonValue | undefined, after: JsonValue | undefined) => {
    const left = before === undefined ? {} : asObject(before), right = after === undefined ? {} : asObject(after);
    return left !== null && right !== null && equal(omit(left, fields), omit(right, fields));
  };
  if (!equal(omit(current,new Set(["pages","pageSettings","siteSettings",...EPHEMERAL_KEYS])), omit(incoming,new Set(["pages","pageSettings","siteSettings",...EPHEMERAL_KEYS])))) return false;
  if (!sameSettings(current.pageSettings,incoming.pageSettings) || !sameSettings(current.siteSettings,incoming.siteSettings)) return false;
  if (current.pages === undefined || incoming.pages === undefined) return current.pages === incoming.pages;
  if (!Array.isArray(current.pages) || !Array.isArray(incoming.pages) || current.pages.length !== incoming.pages.length) return false;
  return current.pages.every((value,index) => {
    const before=asObject(value),after=asObject((incoming.pages as JsonValue[])[index]);
    return !!before && !!after && equal(omit(before,new Set(["pageSettings"])),omit(after,new Set(["pageSettings"]))) && sameSettings(before.pageSettings,after.pageSettings);
  });
}
function protectedNodes(document: JsonObject): Map<string, {node: JsonObject; parent: string}> {
  const result = new Map<string, {node: JsonObject; parent: string}>();
  const walk = (value: JsonValue | undefined, parent: string, scope: string) => {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      const node = asObject(item); if (!node || typeof node.id !== "string") continue;
      result.set(`${scope}:${node.id}`, {node, parent}); walk(node.children, node.id, scope);
    }
  };
  if (Array.isArray(document.pages)) for (const item of document.pages) { const page = asObject(item); if (page) walk(page.elements, "root", `page:${page.id}`); }
  walk(document.elements, "root", "legacy-root");
  for (const [id,value] of Object.entries(asObject(document.siteParts) || {})) { const part=asObject(value); if(part) walk(part.elements,"root",`part:${id}`); }
  if (Array.isArray(document.popups)) for (const item of document.popups) { const popup=asObject(item); if(popup) walk(popup.elements,"root",`popup:${popup.id}`); }
  return result;
}
export function authorizeDocumentEdit(current: JsonObject, incoming: JsonObject, permissions: {
  canDesign: boolean; canContent: boolean; canManage: boolean; canSeo?: boolean; editableProtectedIds: Set<string>;
}): JsonObject {
  const next = preservePublishingAuthority(current, incoming);
  validateDocumentTree(next);
  if (!permissions.canDesign && !((permissions.canContent && contentOnly(current, next)) || (permissions.canSeo && seoOnly(current, next)))) {
    throw new AppError("Your access does not permit these document changes", 403, "DOCUMENT_EDIT_FORBIDDEN");
  }
  if (!permissions.canManage) {
    const before = protectedNodes(current), after = protectedNodes(next);
    for (const [id, old] of before) if (old.node.isProtected === true && !permissions.editableProtectedIds.has(String(old.node.id))) {
      const changed = after.get(id);
      if (!changed || changed.parent !== old.parent || !equal(old.node, changed.node)) throw new AppError("A protected component cannot be changed", 403, "PROTECTED_COMPONENT");
    }
    for (const [id, node] of after) if ((node.node.isProtected === true) !== (before.get(id)?.node.isProtected === true)) {
      throw new AppError("Component protection requires management permission", 403, "PROTECTED_COMPONENT");
    }
  }
  return next;
}
