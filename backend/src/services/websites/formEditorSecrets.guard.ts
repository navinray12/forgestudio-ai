import { AppError } from "../../utils/app-error.js";

/**
 * Published editor documents are not a secret store. Credential-bearing form
 * actions belong in /api/forms/:websiteId/forms/:formId/delivery (encrypted).
 * Bound traversal avoids expensive recursion over arbitrarily nested documents.
 */
export function assertNoInlineFormCredentials(document: unknown): void {
  const seen = new Set<object>();
  const queue: unknown[] = [document];
  let checked = 0;
  while (queue.length) {
    if (++checked > 20000) {
      throw new AppError("Editor document exceeds credential validation limits", 422, "DOCUMENT_INVALID");
    }
    const node = queue.shift();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }
    const record = node as Record<string, unknown>;
    const formConfig = record.formConfig && typeof record.formConfig === "object" &&
      !Array.isArray(record.formConfig) ? record.formConfig as Record<string, unknown> : null;
    const actions = [record.formActions, formConfig?.actions,
      record.type === "form" || record.type === "form-widget" || record.type === "formWidget"
        ? record.actions : undefined];
    for (const item of actions) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const actionQueue: unknown[] = [item];
      let size = 0;
      while (actionQueue.length) {
        if (++size > 1000) throw new AppError("Form configuration exceeds validation limits", 422, "DOCUMENT_INVALID");
        const value = actionQueue.shift();
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        for (const [key, child] of Object.entries(value)) {
          if (/^(apiKey|secretKey|accessToken|refreshToken|password|clientSecret|smtpPassword|privateKey)$/i.test(key) &&
              typeof child === "string" && child.length) {
            throw new AppError(
              "Form integration credentials must be saved through the secure server delivery settings, not editor JSON",
              422,
              "EDITOR_FORM_SECRET_FORBIDDEN"
            );
          }
          if (child && typeof child === "object") actionQueue.push(child);
        }
      }
    }
    for (const child of Object.values(record)) if (child && typeof child === "object") queue.push(child);
  }
}
