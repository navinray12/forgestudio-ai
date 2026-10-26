import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { publishingService } from "../../../features/publishing/services/publishingService";
import type { DeploymentConfig, PublishingState } from "../types";
import { buildPublishDraftSnapshot, type PublishDraftSnapshotInput } from "./documentPayloads";

/** What publishing reads and writes; no state is owned here. */
export interface PublishWebsiteInput extends PublishDraftSnapshotInput {
  websiteId: string | undefined;
  apiUrl: string;
  publishing: PublishingState;
  setPublishing: (value: PublishingState) => void;
  setDeployment: Dispatch<SetStateAction<DeploymentConfig>>;
  publishedDataRef: MutableRefObject<any>;
  setSaveMessage: (value: string) => void;
}

/**
 * The editor's publish handler (PublishModal "Publish Now"), moved verbatim from WebsiteEditor.tsx
 * ("F-PUBLISH"). Builds the working-draft snapshot, writes it to localStorage
 * (forgestudio_editor_<id>, before the request, whatever its outcome: unchanged behaviour), posts
 * { editorData, environment: "PRODUCTION", destinationType } to the publish endpoint, treats
 * `success: false` as a failure, then records the published version in publishing / deployment state
 * and publishedDataRef and shows the toast. Errors propagate to the caller (the modal shows them);
 * nothing is updated on failure. It sends no document precondition and never advances the document
 * version; publishing / deployment are server-owned and excluded from autosave writes.
 *
 * Calls no React hooks: like the inline handler it returns a new function on every render.
 */
export function usePublishWebsite({
  websiteId,
  apiUrl,
  canvasMode,
  elements,
  siteParts,
  pages,
  activePageId,
  pageSettings,
  homePageId,
  deployment,
  breakpoints,
  globalSettings,
  popups,
  pageCss,
  publishing,
  setPublishing,
  setDeployment,
  publishedDataRef,
  setSaveMessage,
}: PublishWebsiteInput) {
  const handlePublishWebsite = async (options?: { destinationType?: "INTERNAL" | "WORDPRESS" }) => {
    if (!websiteId) return;

    const destType = options?.destinationType || "INTERNAL";

    const workingDraftSnapshot = buildPublishDraftSnapshot({
      canvasMode,
      elements,
      siteParts,
      pages,
      activePageId,
      pageSettings,
      homePageId,
      deployment,
      breakpoints,
      globalSettings,
      popups,
      pageCss,
    });

    const payload = {
      editorData: workingDraftSnapshot,
      environment: "PRODUCTION" as const,
      destinationType: destType,
    };

    try {
      localStorage.setItem(`forgestudio_editor_${websiteId}`, JSON.stringify(payload.editorData));
    } catch (e) { }

    // Call server publishing endpoint
    const result = await publishingService.publishWebsite(websiteId, payload, apiUrl);

    if (!result.success) {
      throw new Error("Publishing failed on server.");
    }

    const updatedPub: PublishingState = {
      ...publishing,
      status: "PUBLISHED",
      publishedVersion: result.version,
      version: result.version,
      publishedAt: result.publishedAt,
      deploymentId: result.deploymentId,
    };
    setPublishing(updatedPub);

    setDeployment((prev) => ({
      ...prev,
      deployedAt: result.publishedAt,
      productionUrl: result.liveUrl,
    }));

    publishedDataRef.current = {
      ...workingDraftSnapshot,
      version: result.version,
      publishing: updatedPub,
    };

    setSaveMessage(`Website successfully published (v${result.version})!`);
    setTimeout(() => setSaveMessage(""), 3500);
  };

  return handlePublishWebsite;
}

/** What rollback reads and writes; no state is owned here. */
export interface RollbackDeploymentInput {
  websiteId: string | undefined;
  apiUrl: string;
  setPublishing: Dispatch<SetStateAction<PublishingState>>;
  setSaveMessage: (value: string) => void;
}

/**
 * The editor's deployment rollback (PublishModal deployment history), moved verbatim from
 * WebsiteEditor.tsx. POSTs to `<apiUrl>/api/websites/<id>/deployments/<deploymentId>/rollback` (no body);
 * on `success` marks that version published and shows the toast; on `success: false` changes nothing
 * and resolves normally; request errors propagate to the modal. Deployment config and the local draft
 * are not touched.
 *
 * Calls no React hooks: like the inline handler it returns a new function on every render.
 */
export function useRollbackDeployment({
  websiteId,
  apiUrl,
  setPublishing,
  setSaveMessage,
}: RollbackDeploymentInput) {
  const handleRollbackDeployment = async (deploymentId: string) => {
    if (!websiteId) return;
    const result = await publishingService.rollbackDeployment(websiteId, deploymentId, apiUrl);
    if (result.success) {
      setPublishing((prev) => ({
        ...prev,
        status: "PUBLISHED",
        publishedVersion: result.version,
        version: result.version,
        publishedAt: result.publishedAt,
        deploymentId: result.deploymentId,
      }));
      setSaveMessage(`Successfully rolled back to deployment v${result.version}!`);
      setTimeout(() => setSaveMessage(""), 3500);
    }
  };

  return handleRollbackDeployment;
}
