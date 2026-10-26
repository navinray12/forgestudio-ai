import React from "react";
import { ALL_WIDGET_REGISTRY } from "../../types";
import type { EditorElement, ElementType } from "../../types";
import { AnimatedHeadlineBoxIcon, BlockquoteBoxIcon, ButtonBoxIcon, CodeHighlightBoxIcon, ContainerBoxIcon, CtaBoxIcon, FacebookButtonBoxIcon, FacebookCommentsBoxIcon, FacebookEmbedBoxIcon, FacebookPageBoxIcon, FlipBoxIcon, FormBoxIcon, GalleryBoxIcon, HeadingBoxIcon, ImageBoxIcon, ImageCarouselBoxIcon, LoginBoxIcon, LoopCarouselBoxIcon, LottieBoxIcon, MediaCarouselBoxIcon, MegaMenuBoxIcon, NavMenuBoxIcon, NestedCarouselBoxIcon, OffCanvasBoxIcon, PayPalButtonBoxIcon, PortfolioBoxIcon, PostsBoxIcon, PriceListBoxIcon, PriceTableBoxIcon, ReviewsBoxIcon, ShareButtonsBoxIcon, SlidesBoxIcon, StripeButtonBoxIcon, TemplateBoxIcon, TestimonialBoxIcon, TextBoxIcon, VideoPlaylistBoxIcon } from "../../widgets";

/** What renderFavoriteWidgetsSection reads: the editor values and callbacks the inline JSX used. */
export interface FavoriteWidgetsSectionDeps {
  components: Record<string, { name: string; element: EditorElement; isFavorite?: boolean | undefined; }>;
  disabledWidgets: ElementType[];
  favoriteWidgets: ElementType[];
  handleAddElement: (type: ElementType, targetId?: string | null) => void;
  handleAddInstanceFromComponent: (compId: string) => void;
  isWidgetLibraryVisible: (type: ElementType, name?: string | undefined) => boolean;
  toggleFavoriteComponent: (compId: string, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  toggleFavoriteWidget: (type: ElementType, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
  widgetLibrarySearch: string;
}

/**
 * Left sidebar, Elements tab: pinned favourite widgets and reusable components (F-012).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3535-3646 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderFavoriteWidgetsSection({
  components,
  disabledWidgets,
  favoriteWidgets,
  handleAddElement,
  handleAddInstanceFromComponent,
  isWidgetLibraryVisible,
  toggleFavoriteComponent,
  toggleFavoriteWidget,
  widgetLibrarySearch,
}: FavoriteWidgetsSectionDeps): React.ReactNode {
  return (
                !disabledWidgets.includes("favorite-widgets") && (() => {
                  const visibleFavTypes = favoriteWidgets.filter(
                    (type) => !disabledWidgets.includes(type) && isWidgetLibraryVisible(type)
                  );
                  const visibleFavComps = Object.entries(components).filter(
                    ([_compId, comp]) => comp.isFavorite && (!widgetLibrarySearch || comp.name.toLowerCase().includes(widgetLibrarySearch.toLowerCase()))
                  );

                  if (visibleFavTypes.length === 0 && visibleFavComps.length === 0) {
                    return null;
                  }

                  return (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 shadow-xs">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-2.5 flex items-center justify-between">
                        <span className="flex items-center gap-1">⭐ Favorite Widgets</span>
                        <span className="text-[9px] text-amber-600/70 font-normal">Quick Access ({visibleFavTypes.length + visibleFavComps.length})</span>
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Core Favorite Widgets */}
                        {visibleFavTypes.map((type) => {
                          const widgetDef = ALL_WIDGET_REGISTRY.find((w) => w.type === type);
                          const name = widgetDef?.name || type;
                          return (
                            <div
                              key={`fav_${type}`}
                              draggable={true}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: type }));
                                e.dataTransfer.effectAllowed = "copy";
                              }}
                              onClick={() => handleAddElement(type)}
                              className="relative flex flex-col items-center justify-center rounded-lg border border-amber-200 bg-white p-2.5 shadow-xs hover:border-amber-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                            >
                              <button
                                type="button"
                                onClick={(e) => toggleFavoriteWidget(type, e)}
                                className="absolute top-1 right-1 text-amber-500 text-[11px] hover:scale-125 transition cursor-pointer p-0.5"
                                title="Remove from favorites"
                              >
                                ★
                              </button>
                              {type === "container" ? <ContainerBoxIcon /> :
                                type === "heading" ? <HeadingBoxIcon /> :
                                  type === "text" ? <TextBoxIcon /> :
                                    type === "image" ? <ImageBoxIcon /> :
                                      type === "button" ? <ButtonBoxIcon /> :
                                        type === "posts" ? <PostsBoxIcon /> :
                                          type === "share-buttons" ? <ShareButtonsBoxIcon /> :
                                            type === "portfolio" ? <PortfolioBoxIcon /> :
                                              type === "slides" ? <SlidesBoxIcon /> :
                                                type === "form" ? <FormBoxIcon /> :
                                                  type === "login" ? <LoginBoxIcon /> :
                                                    type === "nav-menu" ? <NavMenuBoxIcon /> :
                                                      type === "animated-headline" ? <AnimatedHeadlineBoxIcon /> :
                                                        type === "price-table" ? <PriceTableBoxIcon /> :
                                                          type === "price-list" ? <PriceListBoxIcon /> :
                                                            type === "gallery" ? <GalleryBoxIcon /> :
                                                              type === "flip-box" ? <FlipBoxIcon /> :
                                                                type === "call-to-action" ? <CtaBoxIcon /> :
                                                                  type === "media-carousel" ? <MediaCarouselBoxIcon /> :
                                                                    type === "testimonial-carousel" ? <TestimonialBoxIcon /> :
                                                                      type === "nested-carousel" ? <NestedCarouselBoxIcon /> :
                                                                        type === "loop-carousel" ? <LoopCarouselBoxIcon /> :
                                                                          type === "facebook-page" ? <FacebookPageBoxIcon /> :
                                                                            type === "blockquote" ? <BlockquoteBoxIcon /> :
                                                                              type === "template" ? <TemplateBoxIcon /> :
                                                                                type === "reviews" ? <ReviewsBoxIcon /> :
                                                                                  type === "facebook-button" ? <FacebookButtonBoxIcon /> :
                                                                                    type === "facebook-embed" ? <FacebookEmbedBoxIcon /> :
                                                                                      type === "facebook-comments" ? <FacebookCommentsBoxIcon /> :
                                                                                        type === "paypal-button" ? <PayPalButtonBoxIcon /> :
                                                                                          type === "stripe-button" ? <StripeButtonBoxIcon /> :
                                                                                            type === "lottie" ? <LottieBoxIcon /> :
                                                                                              type === "code-highlight" ? <CodeHighlightBoxIcon /> :
                                                                                                type === "video-playlist" ? <VideoPlaylistBoxIcon /> :
                                                                                                  type === "mega-menu" ? <MegaMenuBoxIcon /> :
                                                                                                    type === "off-canvas" ? <OffCanvasBoxIcon /> :
                                                                                                      type === "image-carousel" ? <ImageCarouselBoxIcon /> :
                                                                                                        <span className="text-xl">{widgetDef?.icon || "📦"}</span>}
                              <span className="mt-1 text-[11px] font-semibold text-slate-700 text-center line-clamp-1 group-hover:text-amber-700">
                                {name}
                              </span>
                            </div>
                          );
                        })}

                        {/* Favorite Reusable Components */}
                        {visibleFavComps.map(([compId, comp]) => (
                          <div
                            key={`fav_comp_${compId}`}
                            onClick={() => handleAddInstanceFromComponent(compId)}
                            className="relative flex flex-col items-center justify-center rounded-lg border border-purple-200 bg-purple-50/70 p-2.5 shadow-xs hover:border-purple-400 hover:bg-purple-100/70 hover:-translate-y-0.5 active:scale-95 group cursor-pointer transition"
                          >
                            <button
                              type="button"
                              onClick={(e) => toggleFavoriteComponent(compId, e)}
                              className="absolute top-1 right-1 text-amber-500 text-[11px] hover:scale-125 transition cursor-pointer p-0.5"
                              title="Remove favorite component"
                            >
                              ★
                            </button>
                            <span className="text-lg">🧩</span>
                            <span className="mt-1 text-[11px] font-semibold text-purple-900 text-center line-clamp-1 group-hover:text-purple-950">
                              {comp.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
  );
}
