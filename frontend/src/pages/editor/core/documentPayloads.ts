import type { DeploymentConfig, EditorElement, PageConfig, PublishingState, SitePartsConfig, ThemeBuilderScope } from "../types";
import { isSitePartEnabled, sitePartMetadata } from "./siteParts";

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
 * Moved verbatim from WebsiteEditor's handleSave. Site parts are written with the `enabled` flag,
 * resolved by isSitePartEnabled.
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
          enabled: isSitePartEnabled(siteParts.header),
          elements: canonicalHeaderElements,
          ...sitePartMetadata(siteParts.header),
        },
        footer: {
          enabled: isSitePartEnabled(siteParts.footer),
          elements: canonicalFooterElements,
          ...sitePartMetadata(siteParts.footer),
        },
        single: {
          enabled: isSitePartEnabled(siteParts.single),
          elements: canonicalSingleElements,
          ...sitePartMetadata(siteParts.single),
        },
        archive: {
          enabled: isSitePartEnabled(siteParts.archive),
          elements: canonicalArchiveElements,
          ...sitePartMetadata(siteParts.archive),
        },
        notFound404: {
          enabled: isSitePartEnabled(siteParts.notFound404),
          elements: canonical404Elements,
          ...sitePartMetadata(siteParts.notFound404),
        },
        searchResults: {
          enabled: isSitePartEnabled(siteParts.searchResults),
          elements: canonicalSearchResultsElements,
          ...sitePartMetadata(siteParts.searchResults),
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
 * handlePublishWebsite. Site parts are written with the `isEnabled` flag (the published-snapshot
 * spelling), resolved by isSitePartEnabled so a part disabled in the draft is published disabled.
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
        isEnabled: isSitePartEnabled(siteParts.header),
        elements: canonicalHeaderElements,
        ...sitePartMetadata(siteParts.header),
      },
      footer: {
        isEnabled: isSitePartEnabled(siteParts.footer),
        elements: canonicalFooterElements,
        ...sitePartMetadata(siteParts.footer),
      },
      single: {
        isEnabled: isSitePartEnabled(siteParts.single),
        elements: canonicalSingleElements,
        ...sitePartMetadata(siteParts.single),
      },
      archive: {
        isEnabled: isSitePartEnabled(siteParts.archive),
        elements: canonicalArchiveElements,
        ...sitePartMetadata(siteParts.archive),
      },
      notFound404: {
        isEnabled: isSitePartEnabled(siteParts.notFound404),
        elements: canonical404Elements,
        ...sitePartMetadata(siteParts.notFound404),
      },
      searchResults: {
        isEnabled: isSitePartEnabled(siteParts.searchResults),
        elements: canonicalSearchResultsElements,
        ...sitePartMetadata(siteParts.searchResults),
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
