import React from "react";
import { MultilingualExportModal } from "../../../../components/accessibility/MultilingualExportModal";
import { SeoAnalyzerModal } from "../../../../features/seo/components/SeoAnalyzerModal";
import { ExperimentManagerModal } from "../../components/experiments/ExperimentManagerModal";
import type { EditorElement, PageConfig, WebsiteData } from "../../types";
import { updateTreeElement } from "../../utils";

/** What renderExperimentSeoMultilingualModals reads: the editor values and callbacks the inline JSX used. */
export interface ExperimentSeoMultilingualModalsDeps {
  activePageId: string;
  elements: EditorElement[];
  isExperimentModalOpen: boolean;
  isMultilingualModalOpen: boolean;
  isSeoAnalyzerOpen: boolean;
  pageSettings: { [key: string]: any; title?: string | undefined; description?: string | undefined; path?: string | undefined; backgroundColor?: string | undefined; customHead?: string | undefined; isMaintenanceMode?: boolean | undefined; siteLanguage?: string | undefined; ogTitle?: string | undefined; ogDescription?: string | undefined; ogImage?: string | undefined; canonicalUrl?: string | undefined; noindex?: boolean | undefined; nofollow?: boolean | undefined; };
  pages: PageConfig[];
  setElements: React.Dispatch<React.SetStateAction<EditorElement[]>>;
  setIsExperimentModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsMultilingualModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSeoAnalyzerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPageSettings: React.Dispatch<React.SetStateAction<{ [key: string]: any; title?: string | undefined; description?: string | undefined; path?: string | undefined; backgroundColor?: string | undefined; customHead?: string | undefined; isMaintenanceMode?: boolean | undefined; siteLanguage?: string | undefined; ogTitle?: string | undefined; ogDescription?: string | undefined; ogImage?: string | undefined; canonicalUrl?: string | undefined; noindex?: boolean | undefined; nofollow?: boolean | undefined; }>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  website: WebsiteData;
  websiteId: string | undefined;
}

/**
 * A/B experiment manager, the SEO & quality analyzer (second instance) and the multilingual export modal.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 11380-11411 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderExperimentSeoMultilingualModals({
  activePageId,
  elements,
  isExperimentModalOpen,
  isMultilingualModalOpen,
  isSeoAnalyzerOpen,
  pageSettings,
  pages,
  setElements,
  setIsExperimentModalOpen,
  setIsMultilingualModalOpen,
  setIsSeoAnalyzerOpen,
  setPageSettings,
  setSelectedId,
  website,
  websiteId,
}: ExperimentSeoMultilingualModalsDeps): React.ReactNode {
  return (
      <>
      <ExperimentManagerModal
        isOpen={isExperimentModalOpen}
        onClose={() => setIsExperimentModalOpen(false)}
        websiteId={websiteId || (website as any)?.id || ""}
      />

      {/* F-363 & F-371: SEO & WCAG Accessibility Audit Modal */}
      <SeoAnalyzerModal
        isOpen={isSeoAnalyzerOpen}
        onClose={() => setIsSeoAnalyzerOpen(false)}
        websiteId={websiteId || ""}
        activePage={pages.find((p) => p.id === activePageId) || { id: activePageId || "home", name: pageSettings.title || "Home", elements, pageSettings }}
        allPages={pages}
        websiteData={website}
        onSelectElement={(elId) => {
          setSelectedId(elId);
        }}
        onUpdateElementProp={(elId, propKey, propVal) => {
          setElements((prev) => updateTreeElement(prev, elId, (item) => ({ ...item, [propKey]: propVal })));
        }}
        onUpdatePageSettings={(updater) => {
          setPageSettings((prev) => updater(prev));
        }}
      />

      {/* F-381: Multilingual Plugin Compatibility Modal */}
      <MultilingualExportModal
        isOpen={isMultilingualModalOpen}
        onClose={() => setIsMultilingualModalOpen(false)}
        activePage={pages.find((p) => p.id === activePageId) || { id: activePageId || "home", name: pageSettings.title || "Home", elements, pageSettings }}
        websiteData={website}
      />
      </>
  );
}
