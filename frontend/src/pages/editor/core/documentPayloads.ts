import type { DeploymentConfig, EditorElement, PageConfig, PublishingState, SitePartsConfig, ThemeBuilderScope } from "../types";

/** The editor state the save payload reads (the values WebsiteEditor holds in state and refs). */
export interface SavePayloadInput {
  canvasMode: ThemeBuilderScope;
  elements: EditorElement[];
  siteParts: SitePartsConfig;
  pages: PageConfig[];
  activePageId: string;
  pageSettings: { title?: string; path?: string; [key: string]: any };
  homePageId: string;
  publishing: PublishingState;
  deployment: DeploymentConfig;
  breakpoints: any[];
  globalSettings: any;
  globalVariables: any[];
  globalClasses: any[];
  popups: any[];
  pageCss: string;
  publishedDataRef: { current: any };
}

export type PublishDraftSnapshotInput = Omit<SavePayloadInput, "publishing" | "globalVariables" | "globalClasses" | "publishedDataRef">;

/**
 * The manual-save document payload, plus the page elements the autosave baseline is updated with.
 * Moved verbatim from WebsiteEditor's handleSave. Site parts use the `enabled` flag.
 */
export function buildSavePayload({ canvasMode, elements, siteParts, pages, activePageId, pageSettings, homePageId, publishing, deployment, breakpoints, globalSettings, globalVariables, globalClasses, popups, pageCss, publishedDataRef }: SavePayloadInput) {
  const canonicalHeaderElements = canvasMode === "header" ? elements : (siteParts.header?.elements || []);
  const canonicalFooterElements = canvasMode === "footer" ? elements : (siteParts.footer?.elements || []);
  const canonicalSingleElements = canvasMode === "single" ? elements : (siteParts.single?.elements || []);
  const canonicalArchiveElements = canvasMode === "archive" ? elements : (siteParts.archive?.elements || []);
  const canonical404Elements = canvasMode === "404" ? elements : (siteParts.notFound404?.elements || []);
  const canonicalSearchResultsElements = canvasMode === "search-results" ? elements : (siteParts.searchResults?.elements || []);
  const canonicalPageElements = canvasMode === "page" ? elements : (pages.find(p => p.id === activePageId)?.elements || []);

  const payload = {
    editorData: {
      version: 1,
      elements: canonicalPageElements,
      pages: pages.map((p) =>
        p.id === activePageId && canvasMode === "page"
          ? { ...p, elements: canonicalPageElements, pageSettings }
          : p
      ),
      homePageId,
      siteParts: {
        header: {
          enabled: siteParts.header?.enabled ?? true,
          elements: canonicalHeaderElements,
        },
        footer: {
          enabled: siteParts.footer?.enabled ?? true,
          elements: canonicalFooterElements,
        },
        single: {
          enabled: siteParts.single?.enabled ?? true,
          elements: canonicalSingleElements,
        },
        archive: {
          enabled: siteParts.archive?.enabled ?? true,
          elements: canonicalArchiveElements,
        },
        notFound404: {
          enabled: siteParts.notFound404?.enabled ?? true,
          elements: canonical404Elements,
        },
        searchResults: {
          enabled: siteParts.searchResults?.enabled ?? true,
          elements: canonicalSearchResultsElements,
        },
      },
      publishing,
      deployment,
      breakpoints,
      globalSettings,
      globalStyles: globalSettings?.globalStyles,
      globalVariables,
      globalClasses,
      popups,
      pageCss,
      pageSettings,
      ...(publishedDataRef.current ? { publishedData: publishedDataRef.current } : {}),
    },
  };
  return { payload, canonicalPageElements };
}

/**
 * The working-draft snapshot sent as editorData when publishing. Moved verbatim from WebsiteEditor's
 * handlePublishWebsite. Site parts use the `isEnabled` flag, unlike the save payload (known, preserved).
 */
export function buildPublishDraftSnapshot({ canvasMode, elements, siteParts, pages, activePageId, pageSettings, homePageId, deployment, breakpoints, globalSettings, popups, pageCss }: PublishDraftSnapshotInput) {
  const canonicalHeaderElements = canvasMode === "header" ? elements : (siteParts.header?.elements || []);
  const canonicalFooterElements = canvasMode === "footer" ? elements : (siteParts.footer?.elements || []);
  const canonicalSingleElements = canvasMode === "single" ? elements : (siteParts.single?.elements || []);
  const canonicalArchiveElements = canvasMode === "archive" ? elements : (siteParts.archive?.elements || []);
  const canonical404Elements = canvasMode === "404" ? elements : (siteParts.notFound404?.elements || []);
  const canonicalSearchResultsElements = canvasMode === "search-results" ? elements : (siteParts.searchResults?.elements || []);
  const canonicalPageElements = canvasMode === "page" ? elements : (pages.find(p => p.id === activePageId)?.elements || []);

  const workingDraftSnapshot = {
    version: 1,
    elements: canonicalPageElements,
    pages: pages.map((p) =>
      p.id === activePageId && canvasMode === "page"
        ? { ...p, elements: canonicalPageElements, pageSettings }
        : p
    ),
    homePageId,
    siteParts: {
      header: {
        isEnabled: siteParts.header?.isEnabled ?? true,
        elements: canonicalHeaderElements,
      },
      footer: {
        isEnabled: siteParts.footer?.isEnabled ?? true,
        elements: canonicalFooterElements,
      },
      single: {
        isEnabled: siteParts.single?.isEnabled ?? true,
        elements: canonicalSingleElements,
      },
      archive: {
        isEnabled: siteParts.archive?.isEnabled ?? true,
        elements: canonicalArchiveElements,
      },
      notFound404: {
        isEnabled: siteParts.notFound404?.isEnabled ?? true,
        elements: canonical404Elements,
      },
      searchResults: {
        isEnabled: siteParts.searchResults?.isEnabled ?? true,
        elements: canonicalSearchResultsElements,
      },
    },
    deployment,
    breakpoints,
    globalSettings,
    popups,
    pageCss,
    pageSettings,
  };
  return workingDraftSnapshot;
}
