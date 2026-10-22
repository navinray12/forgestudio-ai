import { BreadcrumbsRenderer, MenuAnchorRenderer, PostNavigationRenderer, SiteSearchRenderer, TaxonomyFilterRenderer, WpMenuRenderer } from "../../navigation/NavigationRenderers";
import type { DeviceMode, EditorElement, PageConfig } from "../../types";

/** What renderNavigationElements reads: renderElementTree's per-element values, then the editor values it closed over. */
export interface NavigationElementsContext {
  el: EditorElement;
  activeDevice: DeviceMode;
  breakpoints: any[];
  homePageId: string;
  isPreview: boolean;
  pages: PageConfig[];
}

/**
 * Canvas renderers: Site search, breadcrumbs, WP menu, menu anchor, post navigation and taxonomy filter.
 * Moved verbatim from renderElementTree's leaf wrapper in WebsiteEditor.tsx (the element-renderer
 * slots for site-search, breadcrumbs, wp-menu, menu-anchor, post-nav, taxonomy-filter). A plain function, called in one slot of the wrapper during
 * the editor's render: it returns a fragment of the original slot expressions in their original order,
 * of which only the slot for el.type renders.
 */
export function renderNavigationElements({
  el,
  activeDevice,
  breakpoints,
  homePageId,
  isPreview,
  pages,
}: NavigationElementsContext) {
  return (
    <>
        {el.type === "site-search" && (
          <SiteSearchRenderer
            element={el}
            activeBreakpointId={activeDevice}
            breakpoints={breakpoints}
            isPreview={isPreview}
          />
        )}

        {el.type === "breadcrumbs" && (
          <BreadcrumbsRenderer
            element={el}
            activeBreakpointId={activeDevice}
            breakpoints={breakpoints}
            isPreview={isPreview}
            pages={pages}
            homePageId={homePageId}
          />
        )}

        {el.type === "wp-menu" && (
          <WpMenuRenderer
            element={el}
            activeBreakpointId={activeDevice}
            breakpoints={breakpoints}
            isPreview={isPreview}
            pages={pages}
            homePageId={homePageId}
          />
        )}

        {el.type === "menu-anchor" && (
          <MenuAnchorRenderer
            element={el}
            activeBreakpointId={activeDevice}
            breakpoints={breakpoints}
            isPreview={isPreview}
          />
        )}

        {el.type === "post-nav" && (
          <PostNavigationRenderer
            element={el}
            activeBreakpointId={activeDevice}
            breakpoints={breakpoints}
            isPreview={isPreview}
          />
        )}

        {el.type === "taxonomy-filter" && (
          <TaxonomyFilterRenderer
            element={el}
            activeBreakpointId={activeDevice}
            breakpoints={breakpoints}
            isPreview={isPreview}
          />
        )}
    </>
  );
}
