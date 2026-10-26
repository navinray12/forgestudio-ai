import React from "react";
import { DesignAssistant } from "../../../../features/ai/DesignAssistant";
import type { DocumentSaveCoordinator } from "../../../../features/editor-access/document-save-coordinator";
import { DocumentSaveError } from "../../../../features/editor-access/save-authorized-website";
import type { DocumentAcknowledgement } from "../../../../features/editor-access/save-authorized-website";

/** What renderDesignAssistantSection reads: the editor values and callbacks the inline JSX used. */
export interface DesignAssistantSectionDeps {
  activePageId: string;
  apiUrl: any;
  documentWriter: DocumentSaveCoordinator;
  handleSave: () => Promise<DocumentAcknowledgement | undefined>;
  hasUnsavedDocumentChanges: () => boolean;
  isDesignAssistantOpen: boolean;
  pendingDesignApplyKey: React.RefObject<string | null>;
  selectedId: string | null;
  setIsDesignAssistantOpen: React.Dispatch<React.SetStateAction<boolean>>;
  websiteId: string | undefined;
}

/**
 * Design Assistant panel (AI design suggestions applied to the canvas).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 14395-14419 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderDesignAssistantSection({
  activePageId,
  apiUrl,
  documentWriter,
  handleSave,
  hasUnsavedDocumentChanges,
  isDesignAssistantOpen,
  pendingDesignApplyKey,
  selectedId,
  setIsDesignAssistantOpen,
  websiteId,
}: DesignAssistantSectionDeps): React.ReactNode {
  return (
      isDesignAssistantOpen && websiteId && <DesignAssistant apiUrl={apiUrl} websiteId={websiteId} pageId={activePageId} elementId={selectedId || undefined}
        onClose={() => setIsDesignAssistantOpen(false)}
        prepare={async () => { const saved = await handleSave(); if (!saved) throw new Error("Save failed. Your local edits are still here; resolve the save before generating."); return saved.documentVersion; }}
        apply={async (proposal, key) => {
          if (pendingDesignApplyKey.current !== key) {
            if (hasUnsavedDocumentChanges()) {
              const saved = await handleSave();
              if (!saved) throw new Error("Save failed. Preserve your local changes before applying a proposal.");
            }
            pendingDesignApplyKey.current = key;
          }
          await documentWriter.applyExternal({ changesetId: proposal.id }, proposal.expectedDocumentVersion, key, async (_payload, options) => {
            let response: Response;
            try { response = await fetch(`${apiUrl}/api/v1/ai/changesets/${proposal.id}/apply`, { method: "POST", credentials: "include", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", "X-Forge-Intent": "document-command", "Idempotency-Key": options.key, "If-Match": `"${websiteId}:document:${options.expectedVersion}"` } }); }
            catch { throw new DocumentSaveError("Apply outcome is unknown. Retry Apply to confirm the same operation.", 0, "DOCUMENT_OUTCOME_UNKNOWN", true); }
            let body;
            try { body = await response.json(); } catch { throw new DocumentSaveError("Apply response was interrupted. Retry Apply.", response.status, "DOCUMENT_OUTCOME_UNKNOWN", true); }
            if (!response.ok) throw new DocumentSaveError(response.status === 412 ? "The website changed. Generate a new proposal." : "The proposal could not be applied.", response.status, body?.code || "AI_APPLY_FAILED", response.status >= 500);
            if (body?.website?.id !== websiteId || !Number.isInteger(body.website.documentVersion) || body.website.documentVersion < options.expectedVersion || body.website.documentVersion > options.expectedVersion + 1) throw new DocumentSaveError("Apply acknowledgement was invalid. Retry Apply.", 0, "DOCUMENT_OUTCOME_UNKNOWN", true);
            return body.website;
          });
          // Remount from the acknowledged server document; old queued saves have
          // been invalidated by the coordinator's generation barrier.
          window.location.reload();
        }} />
  );
}
