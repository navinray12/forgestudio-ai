import { AppError } from "../../../utils/app-error.js";
import { documentObject, validateDocumentTree, type JsonObject } from "../../../services/websites/document-policy.js";
import { editOperationsSchema, type EditScope } from "./contracts.js";
import { safeDesignStyles } from "./converter.js";

export function applyScopedEdits(input: JsonObject, raw: unknown, scope: EditScope): JsonObject {
  const operations = editOperationsSchema.parse(raw), document = documentObject(input);
  const pages = Array.isArray(document.pages) ? document.pages as JsonObject[] : [];
  const selectedPages = scope.type === "site" ? pages : pages.filter(page => page.id === scope.pageId);
  if (!selectedPages.length) throw new AppError("Select a current page before requesting edits", 422, "AI_SCOPE_INVALID");
  const allowed = new Map<string, JsonObject>();
  const visit = (nodes: unknown, inside = false) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes as JsonObject[]) {
      const selected = inside || scope.type !== "selection" || node.id === scope.elementId;
      if (selected) allowed.set(String(node.id), node);
      visit(node.children, selected);
    }
  };
  selectedPages.forEach(page => visit(page.elements));
  for (const operation of operations) {
    const node = allowed.get(operation.elementId);
    if (!node) throw new AppError("AI edit exceeded the requested scope", 403, "AI_SCOPE_VIOLATION");
    if (operation.type === "text") {
      if (!["heading", "text", "button"].includes(String(node.type))) throw new AppError("This element does not support text editing", 422, "AI_SCOPE_INVALID");
      node.content = operation.text;
    } else node.styles = { ...(node.styles as JsonObject || {}), ...safeDesignStyles(operation.styles) };
  }
  const home = pages.find(page => page.id === document.homePageId) || pages[0]!;
  document.elements = home.elements!;
  validateDocumentTree(document);
  return document;
}
