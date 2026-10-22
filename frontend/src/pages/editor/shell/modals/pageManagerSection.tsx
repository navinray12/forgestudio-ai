import React from "react";
import { PageManagerModal } from "../../components/PageManagerModal";
import type { PageConfig, SitePartsConfig } from "../../types";

/** What renderPageManagerSection reads: the editor values and callbacks the inline JSX used. */
export interface PageManagerSectionDeps {
  activePageId: string;
  handleSwitchEditingPage: (targetPageId: string) => void;
  homePageId: string;
  isPageManagerModalOpen: boolean;
  pages: PageConfig[];
  setHomePageId: React.Dispatch<React.SetStateAction<string>>;
  setIsPageManagerModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPages: React.Dispatch<React.SetStateAction<PageConfig[]>>;
  siteParts: SitePartsConfig;
}

/**
 * Page manager modal (pages list management).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 11257-11272 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderPageManagerSection({
  activePageId,
  handleSwitchEditingPage,
  homePageId,
  isPageManagerModalOpen,
  pages,
  setHomePageId,
  setIsPageManagerModalOpen,
  setPages,
  siteParts,
}: PageManagerSectionDeps): React.ReactNode {
  return (
      <PageManagerModal
        isOpen={isPageManagerModalOpen}
        onClose={() => setIsPageManagerModalOpen(false)}
        pages={pages}
        activePageId={activePageId}
        homePageId={homePageId}
        onSwitchPage={(pageId) => {
          handleSwitchEditingPage(pageId);
          setIsPageManagerModalOpen(false);
        }}
        onUpdatePages={(updatedPages, newHomeId) => {
          setPages(updatedPages);
          if (newHomeId) setHomePageId(newHomeId);
        }}
        siteParts={siteParts}
      />
  );
}
