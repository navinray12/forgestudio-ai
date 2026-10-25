import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { loadAuthorizedWebsite } from "../../../features/editor-access/load-authorized-website";
import { decideWorkspaceRefresh } from "../../../features/developer-workspace/services/workspaceRefreshPolicy";
import type { EditorElement, PageConfig } from "../types";

type Setter<T> = Dispatch<SetStateAction<T>>;

/** What workspace sync reads and writes; no new state is owned here. */
export interface WorkspaceSyncInput {
  activePageId: string;
  hasUnsavedDocumentChanges: () => boolean;
  website: { documentVersion?: number } | null;
  websiteId: string | undefined;
  apiUrl: string;
  documentWriter: { initialize(version: number): void };
  lastSavedEditorDataRef: MutableRefObject<unknown>;
  setSaveMessage: Setter<string>;
  setWebsite: Setter<any>;
  setPages: Setter<PageConfig[]>;
  setActivePageId: Setter<string>;
  setActivePreviewPageId: Setter<any>;
  clearHistoryForLoad: () => void;
  setElements: Setter<EditorElement[]>;
  setPageSettings: Setter<any>;
  setBreakpoints: Setter<any[]>;
  setHomePageId: Setter<string>;
  resetAutosaveBaseline: () => void;
  // Read only through reloadWebsiteFromWorkspace's dependency list: kept so the callback, and with it
  // the listener re-subscription, changes exactly when it did before the extraction.
  siteParts: unknown;
  globalSettings: unknown;
  publishing: unknown;
  deployment: unknown;
  breakpoints: unknown;
  popups: unknown;
  pageCss: unknown;
}

/**
 * Code Workspace synchronisation, moved verbatim from WebsiteEditor.tsx: reloads the authoritative
 * website on BroadcastChannel / storage (forge_workspace_sync_event) messages for this site, window
 * focus and the tab becoming visible; only the newest request may apply (sequence counter, also bumped
 * on cleanup); decideWorkspaceRefresh ignores invalid / stale versions and never overwrites unsaved
 * edits ("dirty"); an applied reload re-initialises the document version, replaces pages / elements as
 * a history boundary and resets the autosave baseline. Same callback and effect dependency lists.
 */
export function useWorkspaceSync({
  activePageId,
  hasUnsavedDocumentChanges,
  website,
  websiteId,
  apiUrl,
  documentWriter,
  lastSavedEditorDataRef,
  setSaveMessage,
  setWebsite,
  setPages,
  setActivePageId,
  setActivePreviewPageId,
  clearHistoryForLoad,
  setElements,
  setPageSettings,
  setBreakpoints,
  setHomePageId,
  resetAutosaveBaseline,
  siteParts,
  globalSettings,
  publishing,
  deployment,
  breakpoints,
  popups,
  pageCss,
}: WorkspaceSyncInput) {
  const activePageIdRef = useRef(activePageId);
  activePageIdRef.current = activePageId;
  const workspaceReloadSequence = useRef(0);
  const hasUnsavedRef = useRef(hasUnsavedDocumentChanges);
  hasUnsavedRef.current = hasUnsavedDocumentChanges;
  const websiteDocVerRef = useRef(website?.documentVersion ?? 1);
  websiteDocVerRef.current = website?.documentVersion ?? 1;

  const reloadWebsiteFromWorkspace = useCallback(async (forced = false) => {
    if (!websiteId) return;
    const requestSequence = ++workspaceReloadSequence.current;
    try {
      const loadedSite = await loadAuthorizedWebsite(apiUrl, websiteId, AbortSignal.timeout(15000));
      if (!loadedSite || requestSequence !== workspaceReloadSequence.current) return;

      const serverVer = loadedSite.documentVersion ?? 1;
      const decision = decideWorkspaceRefresh(serverVer, websiteDocVerRef.current, hasUnsavedRef.current, forced);
      if (decision === "invalid" || decision === "stale") return;

      if (decision === "dirty") {
        setSaveMessage(`Code Workspace updated (v${serverVer}). Save or switch pages to merge.`);
        setTimeout(() => setSaveMessage(""), 5000);
        return;
      }

      // Advance synchronously so a delayed response cannot roll this snapshot back.
      websiteDocVerRef.current = serverVer;
      documentWriter.initialize(serverVer);
      lastSavedEditorDataRef.current = loadedSite.editorData ?? null;
      setWebsite(loadedSite);

      let initialPages: PageConfig[] = [];
      if (loadedSite?.editorData?.pages && Array.isArray(loadedSite.editorData.pages) && loadedSite.editorData.pages.length > 0) {
        initialPages = loadedSite.editorData.pages.map((p: any, idx: number) => ({
          id: p.id || `page_${idx + 1}`,
          name: p.name || p.title || (idx === 0 ? "Home" : `Page ${idx + 1}`),
          slug: p.slug || p.path || (idx === 0 ? "/" : `/${(p.name || p.title || `page-${idx + 1}`).toLowerCase().replace(/\s+/g, "-")}`),
          elements: Array.isArray(p.elements) ? p.elements : [],
          pageSettings: p.pageSettings || { title: p.name || p.title || "Page", path: p.slug || p.path || "/" },
          customCss: p.customCss || "",
          isHome: Boolean(p.isHome || p.slug === "/" || p.path === "/" || idx === 0),
        }));
      } else {
        const defaultPageTitle = loadedSite?.editorData?.pageSettings?.title || loadedSite?.name || "Home";
        const defaultPagePath = loadedSite?.editorData?.pageSettings?.path || "/";
        initialPages = [
          {
            id: "home",
            name: defaultPageTitle,
            slug: defaultPagePath,
            elements: loadedSite?.editorData?.elements || [],
            pageSettings: loadedSite?.editorData?.pageSettings || { title: defaultPageTitle, path: defaultPagePath },
            isHome: true,
          },
        ];
      }
      setPages(initialPages);

      // Keep active page or fallback to home
      const currentActive = initialPages.find((p) => p.id === activePageIdRef.current) || initialPages[0];
      if (currentActive) {
        setActivePageId(currentActive.id);
        setActivePreviewPageId(currentActive.id);
        // The authoritative document is a history boundary: undo/redo must not restore the
        // pre-reload document, which autosave would then write over the newer server version.
        clearHistoryForLoad();
        setElements(currentActive.elements || []);
        if (currentActive.pageSettings) {
          setPageSettings((prev) => ({ ...prev, ...currentActive.pageSettings }));
        }
      }

      if (loadedSite?.editorData?.breakpoints && Array.isArray(loadedSite.editorData.breakpoints)) {
        setBreakpoints(loadedSite.editorData.breakpoints);
      }
      if (loadedSite?.editorData?.homePageId) {
        setHomePageId(loadedSite.editorData.homePageId);
      }
      // The reloaded document is the new saved state: take it from what the editor renders next
      // (merged page settings, canonical pages), so the unchanged document is not saved again.
      resetAutosaveBaseline();
    } catch (err) {
      console.warn("Failed to reload website after workspace sync:", err);
    }
  }, [websiteId, apiUrl, documentWriter, resetAutosaveBaseline, siteParts, globalSettings, publishing, deployment, breakpoints, popups, pageCss]);

  useEffect(() => {
    if (!websiteId) return;

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("forge_workspace_sync");
      channel.onmessage = (event) => {
        if (event.data?.websiteId === websiteId) {
          reloadWebsiteFromWorkspace(false);
        }
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "forge_workspace_sync_event" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.websiteId === websiteId) {
            reloadWebsiteFromWorkspace(false);
          }
        } catch {}
      }
    };

    const handleFocus = () => {
      reloadWebsiteFromWorkspace(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        reloadWebsiteFromWorkspace(false);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      ++workspaceReloadSequence.current;
      channel?.close();
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [websiteId, reloadWebsiteFromWorkspace]);
}
