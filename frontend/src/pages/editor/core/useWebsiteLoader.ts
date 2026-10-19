import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { loadAuthorizedWebsite } from "../../../features/editor-access/load-authorized-website";
import type { DeploymentConfig, EditorElement, PageConfig, PublishingState, SitePartsConfig } from "../types";
import { loadSiteParts } from "./siteParts";

type Setter<T> = Dispatch<SetStateAction<T>>;

/** What the initial load writes into: the editor's state setters and refs (no new state is owned here). */
export interface WebsiteLoaderInput {
  websiteId: string | undefined;
  apiUrl: string;
  documentWriter: { initialize(version: number): void };
  lastSavedEditorDataRef: MutableRefObject<unknown>;
  publishedDataRef: MutableRefObject<any>;
  clearHistoryForLoad: () => void;
  setLoading: Setter<boolean>;
  setWebsite: Setter<any>;
  setErrorMessage: Setter<string>;
  setAllowedComponentIds: Setter<Set<string>>;
  setPages: Setter<PageConfig[]>;
  setActivePageId: Setter<string>;
  setActivePreviewPageId: Setter<any>;
  setElements: Setter<EditorElement[]>;
  setPageSettings: Setter<any>;
  setBreakpoints: Setter<any[]>;
  setGlobalSettings: Setter<any>;
  setPageCss: Setter<string>;
  setHomePageId: Setter<string>;
  setSiteParts: Setter<SitePartsConfig>;
  setPublishing: Setter<PublishingState>;
  setDeployment: Setter<DeploymentConfig>;
  setGlobalVariables: Setter<any[]>;
  setGlobalClasses: Setter<any[]>;
}

/**
 * The editor's initial website load, moved verbatim from WebsiteEditor.tsx ("Fetch Website Data"):
 * GET the authorised website (aborted when the website changes or the editor unmounts), initialise the
 * document version, request component access, then populate pages, the active page, elements (as the
 * first undo-history entry), settings, site parts and the rest. Same dependency list as before
 * ([websiteId, apiUrl]), so it re-runs, and captures the render's setters, exactly as the inline effect.
 */
export function useWebsiteLoader({
  websiteId,
  apiUrl,
  documentWriter,
  lastSavedEditorDataRef,
  publishedDataRef,
  clearHistoryForLoad,
  setLoading,
  setWebsite,
  setErrorMessage,
  setAllowedComponentIds,
  setPages,
  setActivePageId,
  setActivePreviewPageId,
  setElements,
  setPageSettings,
  setBreakpoints,
  setGlobalSettings,
  setPageCss,
  setHomePageId,
  setSiteParts,
  setPublishing,
  setDeployment,
  setGlobalVariables,
  setGlobalClasses,
}: WebsiteLoaderInput) {
  useEffect(() => {
    if (!websiteId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const fetchWebsite = async () => {
      try {
        setLoading(true);
        setWebsite(null);
        setErrorMessage("");

        const loadedSite = await loadAuthorizedWebsite(apiUrl, websiteId, controller.signal);
        if (controller.signal.aborted) return;

        if (loadedSite) {
          documentWriter.initialize(loadedSite.documentVersion);
          lastSavedEditorDataRef.current = loadedSite.editorData ?? null;
          setWebsite(loadedSite);

          // Fetch component accesses
          try {
            const accessRes = await fetch(`${apiUrl}/api/v1/component-access/${websiteId}/all`, {
              signal: controller.signal,
              credentials: "include"
            });
            const accessData = await accessRes.json();
            if (controller.signal.aborted) return;
            if (accessRes.ok && accessData.accesses) {
              setAllowedComponentIds(new Set(accessData.accesses.map((a: any) => a.componentId)));
            }
          } catch (e) {
            if (controller.signal.aborted) return;
            console.error("Failed to fetch accesses", e);
          }

          // Initialize multi-page website pages
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

          const initialHome = initialPages.find((p) => p.isHome || p.slug === "/" || p.id === "home") || initialPages[0];
          setActivePageId(initialHome.id);
          setActivePreviewPageId(initialHome.id);

          // The loaded document starts undo history: drop the pre-load [] entry so the history effect
          // records the elements set below as entry 0 (undo right after load must not empty the page).
          clearHistoryForLoad();

          if (initialHome.elements && Array.isArray(initialHome.elements)) {
            setElements(initialHome.elements);
          } else if (loadedSite?.editorData?.elements && Array.isArray(loadedSite.editorData.elements)) {
            setElements(loadedSite.editorData.elements);
          } else {
            setElements([]);
          }

          if (initialHome.pageSettings) {
            setPageSettings((prev) => ({ ...prev, ...initialHome.pageSettings }));
          } else if (loadedSite?.editorData?.pageSettings) {
            setPageSettings((prev) => ({ ...prev, ...loadedSite.editorData.pageSettings }));
          } else if (loadedSite?.name) {
            setPageSettings((prev) => ({ ...prev, title: loadedSite.name }));
          }

          if (loadedSite?.editorData?.breakpoints && Array.isArray(loadedSite.editorData.breakpoints)) {
            setBreakpoints(loadedSite.editorData.breakpoints);
          }

          if (loadedSite?.editorData?.globalSettings) {
            const mergedGlobalSettings = { ...loadedSite.editorData.globalSettings };
            if (loadedSite.editorData.globalStyles && !mergedGlobalSettings.globalStyles) {
              mergedGlobalSettings.globalStyles = loadedSite.editorData.globalStyles;
            }
            setGlobalSettings(mergedGlobalSettings);
          } else if (loadedSite?.editorData?.globalStyles) {
            setGlobalSettings((prev: any) => ({ ...prev, globalStyles: loadedSite.editorData.globalStyles }));
          }

          if (loadedSite?.editorData?.pageCss) {
            setPageCss(loadedSite.editorData.pageCss);
          }

          if (loadedSite?.editorData?.homePageId) {
            setHomePageId(loadedSite.editorData.homePageId);
          } else {
            setHomePageId(initialHome.id);
          }

          if (loadedSite?.editorData?.siteParts) {
            setSiteParts(loadSiteParts(loadedSite.editorData.siteParts));
          }

          if (loadedSite?.editorData?.publishing) {
            setPublishing(loadedSite.editorData.publishing);
          }

          if (loadedSite?.editorData?.deployment) {
            setDeployment(loadedSite.editorData.deployment);
          }

          if (loadedSite?.editorData?.publishedData) {
            publishedDataRef.current = loadedSite.editorData.publishedData;
          }

          if (Array.isArray(loadedSite?.editorData?.globalVariables)) {
            setGlobalVariables(loadedSite.editorData.globalVariables);
          }

          if (Array.isArray(loadedSite?.editorData?.globalClasses)) {
            setGlobalClasses(loadedSite.editorData.globalClasses);
          }
        } else {
          // Default empty initialization if completely fresh project
          const defaultHome: PageConfig = {
            id: "home",
            name: "Home",
            slug: "/",
            elements: [],
            pageSettings: { title: "Home", path: "/" },
            isHome: true,
          };
          setPages([defaultHome]);
          setActivePageId("home");
          setElements([]);
        }
      } catch (err) {
        if (!controller.signal.aborted) setErrorMessage(err instanceof Error ? err.message : "Website loading failed");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchWebsite();
    return () => controller.abort();
  }, [websiteId, apiUrl]);
}
