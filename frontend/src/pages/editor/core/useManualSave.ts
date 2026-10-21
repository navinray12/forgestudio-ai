import type { MutableRefObject } from "react";
import { describeCanvasSourceSync } from "../../../features/developer-workspace/services/canvasSourceSync";
import type { DocumentAcknowledgement } from "../../../features/editor-access/save-authorized-website";
import type { useAutosave } from "../../../features/autosave/hooks/useAutosave";
import { buildSavePayload, type SavePayloadInput } from "./documentPayloads";

type Setter<T> = (value: T) => void;

/** What a manual save reads and writes; no state is owned here. */
export interface ManualSaveInput extends Omit<SavePayloadInput, "publishedDataRef"> {
  websiteId: string | undefined;
  website: unknown;
  userAccess: { canEditContent: boolean };
  setSaving: Setter<boolean>;
  setSaveMessage: Setter<string>;
  setErrorMessage: Setter<string>;
  publishedDataRef: MutableRefObject<any>;
  /** Saves through the editor's DocumentSaveCoordinator and carries the change to hand-written source. */
  persistDocument: (payload: unknown, signal?: AbortSignal) => Promise<DocumentAcknowledgement>;
  updateAutosaveBaseline: ReturnType<typeof useAutosave>["updateBaseline"];
}

/**
 * The editor's manual save (Save button, Ctrl+S, command palette, Code Workspace / AI flows), moved
 * verbatim from WebsiteEditor.tsx. Builds the save payload, persists it through the save coordinator
 * (If-Match on the acknowledged version, one idempotency key per command, an unknown outcome re-sent
 * as the same command, 401/403/404/409/412/428 blocking later saves), advances the autosave baseline,
 * announces visual_saved with the acknowledged documentVersion (BroadcastChannel and the
 * forge_workspace_sync_event storage key), reports Code Workspace source-sync outcomes, and resolves
 * to the acknowledgement, or undefined when the save failed or was not allowed.
 *
 * Calls no React hooks: like the inline handler it returns a new function on every render, closing
 * over that render's state.
 */
export function useManualSave({
  websiteId,
  website,
  userAccess,
  setSaving,
  setSaveMessage,
  setErrorMessage,
  canvasMode,
  elements,
  siteParts,
  pages,
  activePageId,
  pageSettings,
  homePageId,
  publishing,
  deployment,
  breakpoints,
  globalSettings,
  globalVariables,
  globalClasses,
  popups,
  pageCss,
  publishedDataRef,
  persistDocument,
  updateAutosaveBaseline,
}: ManualSaveInput) {
  const handleSave = async () => {
    if (!websiteId || !website || !userAccess.canEditContent) return;

    try {
      setSaving(true);
      setSaveMessage("");
      setErrorMessage("");

      const { payload, canonicalPageElements } = buildSavePayload({
        canvasMode,
        elements,
        siteParts,
        pages,
        activePageId,
        pageSettings,
        homePageId,
        publishing,
        deployment,
        breakpoints,
        globalSettings,
        globalVariables,
        globalClasses,
        popups,
        pageCss,
        publishedDataRef,
      });

      // Only a confirmed server response advances the saved baseline.
      const acknowledged = await persistDocument(payload);

      // Update F-321 Autosave baseline on successful save
      updateAutosaveBaseline(
        canonicalPageElements,
        pageSettings,
        payload.editorData.pages,
        homePageId,
        siteParts,
        globalSettings,
        globalSettings?.globalStyles,
        publishing,
        deployment,
        breakpoints,
        popups,
        pageCss
      );

      setSaveMessage("Saved successfully!");
      setTimeout(() => setSaveMessage(""), 3000);

      try {
        const channel = new BroadcastChannel("forge_workspace_sync");
        channel.postMessage({
          type: "visual_saved",
          websiteId,
          documentVersion: acknowledged.documentVersion,
          timestamp: Date.now(),
        });
        channel.close();
      } catch {}
      try {
        localStorage.setItem(
          "forge_workspace_sync_event",
          JSON.stringify({
            type: "visual_saved",
            websiteId,
            documentVersion: acknowledged.documentVersion,
            timestamp: Date.now(),
          })
        );
      } catch {}

      // The design is saved; say so separately if the Code Workspace source could not follow it
      const codeSync = acknowledged.codeSync;
      if (codeSync?.stale) {
        setErrorMessage(
          `Saved. The Code Workspace source could not be regenerated from this design: ${codeSync.error || "generation failed"}`
        );
      } else if (codeSync?.conflicts?.length) {
        // Hand-written pages are not regenerated; this save's canvas edits were sent to them as
        // element edits. Say what was applied and, separately, anything that was not.
        const sourceSync = describeCanvasSourceSync(acknowledged.sourceSync);
        if (sourceSync?.isProblem) {
          setErrorMessage(`Saved. ${sourceSync.text}`);
        } else if (sourceSync) {
          setSaveMessage(`Saved. ${sourceSync.text}`);
        } else if (!acknowledged.sourceSync) {
          setErrorMessage(
            `Saved. These page files hold hand-written code and were not regenerated: ${codeSync.conflicts.join(", ")}. Resolve them in the Code Workspace.`
          );
        }
      }
      return acknowledged;
    } catch (err: any) {
      setSaveMessage("Save failed — changes remain unsaved");
      setErrorMessage(err instanceof Error ? err.message : "The server did not confirm this save");
      setTimeout(() => setSaveMessage(""), 3000);
    } finally {
      setSaving(false);
    }
  };

  return handleSave;
}
