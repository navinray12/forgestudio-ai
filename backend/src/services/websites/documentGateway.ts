/**
 * Entry point for server-side features that change a website's visual document
 * on the user's behalf (Code Workspace sync, page registration). Writes go
 * through the same command as an editor save, so permissions, protected
 * components, the audit trail and document-version concurrency all apply.
 */
import { randomUUID } from "node:crypto";
import { saveWebsiteDocument } from "./save-document.js";

export interface DocumentWriteResult {
  documentVersion: number;
}

/**
 * Replace the website's editor document, provided it is still at `expectedVersion`.
 * Rejects with DOCUMENT_VERSION_CONFLICT (412) when the document changed meanwhile.
 */
export async function saveDocumentFromCode(
  websiteId: string,
  actorId: string,
  editorData: unknown,
  expectedVersion: number
): Promise<DocumentWriteResult> {
  // The save command accepts plain JSON only: a property left `undefined` by an
  // in-memory edit must not reach it
  const document = JSON.parse(JSON.stringify(editorData ?? {}));
  const saved = await saveWebsiteDocument(
    websiteId,
    actorId,
    { editorData: document },
    { key: `code-sync:${randomUUID()}`, expectedVersion }
  );
  return { documentVersion: saved.documentVersion };
}
