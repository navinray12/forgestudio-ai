import React from "react";
import { SeoAnalyzerModal } from "../../../../features/seo/components/SeoAnalyzerModal";
import { DesignNotesOverlay } from "../../components/notes/DesignNotesOverlay";
import type { EditorElement, PageConfig, WebsiteData } from "../../types";

/** What renderSeoAndNotesModals reads: the editor values and callbacks the inline JSX used. */
export interface SeoAndNotesModalsDeps {
  activePageId: string;
  elements: EditorElement[];
  globalSettings: any;
  handleSelectElementFromAudit: (elementId: string) => void;
  handleUpdateElementPropById: (elementId: string, propKey: string, propValue: any) => void;
  isDesignNotesOpen: boolean;
  isSeoModalOpen: boolean;
  pages: PageConfig[];
  selectedElementAny: any;
  setIsDesignNotesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSeoModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPageSettings: React.Dispatch<React.SetStateAction<{ [key: string]: any; title?: string | undefined; description?: string | undefined; path?: string | undefined; backgroundColor?: string | undefined; customHead?: string | undefined; isMaintenanceMode?: boolean | undefined; siteLanguage?: string | undefined; ogTitle?: string | undefined; ogDescription?: string | undefined; ogImage?: string | undefined; canonicalUrl?: string | undefined; noindex?: boolean | undefined; nofollow?: boolean | undefined; }>>;
  website: WebsiteData;
  websiteId: string | undefined;
}

/**
 * SEO analyzer modal (toolbar instance) and the design notes overlay.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 11293-11315 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderSeoAndNotesModals({
  activePageId,
  elements,
  globalSettings,
  handleSelectElementFromAudit,
  handleUpdateElementPropById,
  isDesignNotesOpen,
  isSeoModalOpen,
  pages,
  selectedElementAny,
  setIsDesignNotesOpen,
  setIsSeoModalOpen,
  setPageSettings,
  website,
  websiteId,
}: SeoAndNotesModalsDeps): React.ReactNode {
  return (
      <>
      <SeoAnalyzerModal
        isOpen={isSeoModalOpen}
        onClose={() => setIsSeoModalOpen(false)}
        websiteId={websiteId || ""}
        activePage={pages.find((p) => p.id === activePageId) || pages[0] || { elements }}
        allPages={pages}
        websiteData={{
          name: website?.name,
          siteSettings: globalSettings || {},
          pages,
        }}
        onSelectElement={handleSelectElementFromAudit}
        onUpdateElementProp={handleUpdateElementPropById}
        onUpdatePageSettings={setPageSettings}
      />

      {/* Collaborative Design Notes & Feedback Overlay */}
      <DesignNotesOverlay
        isOpen={isDesignNotesOpen}
        onClose={() => setIsDesignNotesOpen(false)}
        websiteId={websiteId || ""}
        activeElementId={selectedElementAny?.id || null}
      />
      </>
  );
}
