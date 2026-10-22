import React from "react";
import { RevisionHistoryPanel } from "../../../../features/revision-history";
import type { EditorElement, PageConfig, SitePartsConfig } from "../../types";

/** What renderRevisionHistorySection reads: the editor values and callbacks the inline JSX used. */
export interface RevisionHistorySectionDeps {
  apiUrl: any;
  breakpoints: any[];
  elements: EditorElement[];
  globalSettings: any;
  handleRestoreRevision: (restoredElements: EditorElement[], restoredPageSettings?: any, fullRestoredState?: any) => void;
  homePageId: string;
  isRevisionHistoryOpen: boolean;
  pageCss: string;
  pageSettings: { [key: string]: any; title?: string | undefined; description?: string | undefined; path?: string | undefined; backgroundColor?: string | undefined; customHead?: string | undefined; isMaintenanceMode?: boolean | undefined; siteLanguage?: string | undefined; ogTitle?: string | undefined; ogDescription?: string | undefined; ogImage?: string | undefined; canonicalUrl?: string | undefined; noindex?: boolean | undefined; nofollow?: boolean | undefined; };
  pages: PageConfig[];
  popups: any[];
  setIsRevisionHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  siteParts: SitePartsConfig;
  websiteId: string | undefined;
}

/**
 * Revision history panel (document revisions, restore).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 11214-11231 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderRevisionHistorySection({
  apiUrl,
  breakpoints,
  elements,
  globalSettings,
  handleRestoreRevision,
  homePageId,
  isRevisionHistoryOpen,
  pageCss,
  pageSettings,
  pages,
  popups,
  setIsRevisionHistoryOpen,
  siteParts,
  websiteId,
}: RevisionHistorySectionDeps): React.ReactNode {
  return (
      <RevisionHistoryPanel
        isOpen={isRevisionHistoryOpen}
        onClose={() => setIsRevisionHistoryOpen(false)}
        websiteId={websiteId || ""}
        apiUrl={apiUrl}
        onRestore={handleRestoreRevision}
        currentWorkingState={{
          elements,
          pageSettings,
          pages,
          siteParts,
          globalSettings,
          breakpoints,
          popups,
          pageCss,
          homePageId,
        }}
      />
  );
}
