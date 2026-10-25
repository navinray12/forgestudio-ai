import React from "react";
import { updateTreeElement } from "../../utils";
import { AnimatedHeadlineWidgetRenderer, BlockquoteWidgetRenderer, CodeHighlightWidgetRenderer, CountdownWidgetRenderer, CtaWidgetRenderer, FacebookPageWidgetRenderer, FlipBoxWidgetRenderer, FormWidgetRenderer, GalleryWidgetRenderer, ImageCarouselWidgetRenderer, LoginWidgetRenderer, LoopCarouselWidgetRenderer, LottieWidgetRenderer, MediaCarouselWidgetRenderer, NavMenuWidgetRenderer, NestedCarouselWidgetRenderer, PayPalButtonWidgetRenderer, PriceListWidgetRenderer, PriceTableWidgetRenderer, ReviewsWidgetRenderer, SearchBarWidgetRenderer, StripeButtonWidgetRenderer, TemplateWidgetRenderer, TestimonialCarouselWidgetRenderer, TocWidgetRenderer } from "../../widgets";
import type { EditorElement, ElementStyles, PageConfig } from "../../types";

/** What renderWidgetElements reads: renderElementTree's per-element values, then the editor values it closed over. */
export interface WidgetElementsContext {
  el: EditorElement;
  mergedStyles: ElementStyles;
  components: Record<string, { name: string; element: EditorElement; isFavorite?: boolean | undefined; }>;
  elements: EditorElement[];
  handlePreviewPageNavigate: (targetPage: PageConfig) => void;
  handleSelectTemplate: (elementId: string, templateId?: string | undefined, presetName?: string | undefined) => void;
  handleUnpackTemplate: (elementId: string) => void;
  homePageId: string;
  isPreview: boolean;
  pages: PageConfig[];
  renderElementTree: (el: EditorElement) => React.ReactNode;
  setElements: React.Dispatch<React.SetStateAction<EditorElement[]>>;
}

/**
 * Canvas renderers: Form, login, nav menu and the general widget set (pricing, galleries, carousels, CTA, countdown, reviews, payments, Lottie, code, search bar, templates).
 * Moved verbatim from renderElementTree's leaf wrapper in WebsiteEditor.tsx (the element-renderer
 * slots for form, login, nav-menu, animated-headline, price-table, price-list, gallery, flip-box, call-to-action, media-carousel, testimonial-carousel, nested-carousel, loop-carousel, image-carousel, table-of-contents, countdown, facebook-page, blockquote, template, reviews, paypal-button, stripe-button, lottie, code-highlight, search-bar). A plain function, called in one slot of the wrapper during
 * the editor's render: it returns a fragment of the original slot expressions in their original order,
 * of which only the slot for el.type renders.
 */
export function renderWidgetElements({
  el,
  mergedStyles,
  components,
  elements,
  handlePreviewPageNavigate,
  handleSelectTemplate,
  handleUnpackTemplate,
  homePageId,
  isPreview,
  pages,
  renderElementTree,
  setElements,
}: WidgetElementsContext) {
  return (
    <>
        {el.type === "form" && (
          <FormWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "login" && (
          <LoginWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "nav-menu" && (
          <NavMenuWidgetRenderer
            el={el}
            isPreview={isPreview}
            mergedStyles={mergedStyles}
            pages={pages}
            homePageId={homePageId}
            onUpdateElement={(updater) => {
              setElements((prev) => updateTreeElement(prev, el.id, updater));
            }}
            onNavigatePage={(targetIdOrSlug) => {
              const clean = targetIdOrSlug.replace(/^\//, "");
              const targetPage = pages.find(
                (p) =>
                  p.id === targetIdOrSlug ||
                  p.slug === targetIdOrSlug ||
                  p.slug === `/${clean}` ||
                  p.slug.replace(/^\//, "") === clean ||
                  p.name.toLowerCase() === targetIdOrSlug.toLowerCase() ||
                  (clean === "" && (p.isHome || p.id === "home"))
              );
              if (targetPage) {
                handlePreviewPageNavigate(targetPage);
              }
            }}
          />
        )}

        {el.type === "animated-headline" && (
          <AnimatedHeadlineWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "price-table" && (
          <PriceTableWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "price-list" && (
          <PriceListWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "gallery" && (
          <GalleryWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "flip-box" && (
          <FlipBoxWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "call-to-action" && (
          <CtaWidgetRenderer
            el={el}
            isPreview={isPreview}
            mergedStyles={mergedStyles}
            pages={pages}
            onNavigatePage={(targetIdOrSlug) => {
              const clean = targetIdOrSlug.replace(/^\//, "");
              const targetPage = pages.find(
                (p) =>
                  p.id === targetIdOrSlug ||
                  p.slug === targetIdOrSlug ||
                  p.slug === `/${clean}` ||
                  p.slug.replace(/^\//, "") === clean ||
                  p.name.toLowerCase() === targetIdOrSlug.toLowerCase() ||
                  (clean === "" && (p.isHome || p.id === "home"))
              );
              if (targetPage) {
                handlePreviewPageNavigate(targetPage);
              }
            }}
          />
        )}

        {el.type === "media-carousel" && (
          <MediaCarouselWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "testimonial-carousel" && (
          <TestimonialCarouselWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "nested-carousel" && (
          <NestedCarouselWidgetRenderer
            el={el}
            isPreview={isPreview}
            mergedStyles={mergedStyles}
            renderElementTree={renderElementTree}
          />
        )}

        {el.type === "loop-carousel" && (
          <LoopCarouselWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "image-carousel" && (
          <ImageCarouselWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "table-of-contents" && (
          <TocWidgetRenderer el={el} elements={elements} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "countdown" && (
          <CountdownWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {(el.type === "facebook-page" || el.type === "facebook-button" || el.type === "facebook-embed" || el.type === "facebook-comments") && (
          <FacebookPageWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "blockquote" && (
          <BlockquoteWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "template" && (
          <TemplateWidgetRenderer
            el={el}
            components={components}
            onUnpackTemplate={handleUnpackTemplate}
            onSelectTemplate={handleSelectTemplate}
            isPreview={isPreview}
            mergedStyles={mergedStyles}
          />
        )}

        {el.type === "reviews" && (
          <ReviewsWidgetRenderer
            el={el}
            isPreview={isPreview}
            mergedStyles={mergedStyles}
            onUpdateElement={(updatedEl) => {
              const updateRecursive = (list: EditorElement[]): EditorElement[] => {
                return list.map((item) => {
                  if (item.id === updatedEl.id) return updatedEl;
                  if (item.children) return { ...item, children: updateRecursive(item.children) };
                  return item;
                });
              };
              setElements((prev) => updateRecursive(prev));
            }}
          />
        )}

        {el.type === "paypal-button" && (
          <PayPalButtonWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "stripe-button" && (
          <StripeButtonWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "lottie" && (
          <LottieWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {el.type === "code-highlight" && (
          <CodeHighlightWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}

        {(el.type === "search-bar" || el.type === "search-form") && (
          <SearchBarWidgetRenderer el={el} isPreview={isPreview} mergedStyles={mergedStyles} />
        )}
    </>
  );
}
