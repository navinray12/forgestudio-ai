import { AudioPlaylistWidgetRenderer, BasicGalleryWidgetRenderer, BasicMediaCarouselWidgetRenderer, CustomSvgWidgetRenderer, DynamicLightboxWidgetRenderer, FavoriteWidgetsWidgetRenderer, IconLibraryWidgetRenderer, ImportAssetWidgetRenderer, NestedAccordionWidgetRenderer, NestedTabsWidgetRenderer, ReusableComponentWidgetRenderer } from "../../widgets";
import type { EditorElement, ElementStyles } from "../../types";

/** What renderUtilityElements reads: renderElementTree's per-element values, then the editor values it closed over. */
export interface UtilityElementsContext {
  el: EditorElement;
  mergedStyles: ElementStyles;
  isPreview: boolean;
}

/**
 * Canvas renderers: Imported assets, reusable / favourite components, basic media, lightbox, SVG, icons, nested tabs and accordion.
 * Moved verbatim from renderElementTree's leaf wrapper in WebsiteEditor.tsx (the element-renderer
 * slots for import-asset, reusable-components, favorite-widgets, basic-media-carousel, basic-gallery, audio-playlist, dynamic-lightbox, custom-svg, icon-library, nested-tabs, nested-accordion). A plain function, called in one slot of the wrapper during
 * the editor's render: it returns a fragment of the original slot expressions in their original order,
 * of which only the slot for el.type renders.
 */
export function renderUtilityElements({
  el,
  mergedStyles,
  isPreview,
}: UtilityElementsContext) {
  return (
    <>
        {el.type === "import-asset" && (
          <ImportAssetWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "reusable-components" && (
          <ReusableComponentWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {(el.type === "favorite-widgets" || (el.type as string) === "favorite") && (
          <FavoriteWidgetsWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}


        {el.type === "basic-media-carousel" && (
          <BasicMediaCarouselWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "basic-gallery" && (
          <BasicGalleryWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "audio-playlist" && (
          <AudioPlaylistWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "dynamic-lightbox" && (
          <DynamicLightboxWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "custom-svg" && (
          <CustomSvgWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "icon-library" && (
          <IconLibraryWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "nested-tabs" && (
          <NestedTabsWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "nested-accordion" && (
          <NestedAccordionWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}
    </>
  );
}
