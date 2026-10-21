import React from "react";
import { NavigationSettingsPanel } from "../../navigation/NavigationSettings";
import type { DeviceMode, EditorElement, ElementStyles, PageConfig, SiteProduct } from "../../types";
import { AlertWidgetInspector, AnimatedTextWidgetInspector, AudioPlaylistInspector, BlockquoteWidgetInspector, ButtonWidgetInspector, CodeHighlightWidgetInspector, CountdownWidgetInspector, CounterWidgetInspector, CTAWidgetInspector, CustomSVGWidgetInspector, DisplayConditionsWidgetInspector, DividerWidgetInspector, FacebookWidgetInspector, FlipBoxWidgetInspector, FormWidgetInspector, GalleryWidgetInspector, GoogleMapsWidgetInspector, IconBoxWidgetInspector, IconLibraryWidgetInspector, IconListWidgetInspector, ImageBoxWidgetInspector, ImageWidgetInspector, LinkInBioWidgetInspector, LoginWidgetInspector, LottieWidgetInspector, MediaCarouselWidgetInspector, NavMenuWidgetInspector, NestedAccordionWidgetInspector, NestedTabsWidgetInspector, PaymentWidgetInspector, PortfolioWidgetInspector, PriceListWidgetInspector, PriceTableWidgetInspector, ProgressBarWidgetInspector, QueryBuilderWidgetInspector, RatingWidgetInspector, ReviewsWidgetInspector, ShareButtonsInspector, SlidesWidgetInspector, SpacerWidgetInspector, TOCWidgetInspector, VideoPlaylistInspector, VideoWidgetInspector, WooCommerceWidgetInspector } from "../DynamicWidgetInspectors";

/** What renderWidgetInspectorSlots reads: the editor values and callbacks the inline JSX used. */
export interface WidgetInspectorSlotsDeps {
  activeDevice: DeviceMode;
  activePageId: string;
  breakpoints: any[];
  handleCreatePageQuick: (customName?: string | undefined) => PageConfig;
  handleOpenIconPicker: (targetField?: string) => void;
  pages: PageConfig[];
  renderResponsiveLabel: (label: string) => React.JSX.Element;
  selectedElement: EditorElement | null;
  selectedElementAny: any;
  siteProducts: SiteProduct[];
  updateElementProperties: (updater: (el: EditorElement) => EditorElement) => void;
  updateSelectedProp: (key: string, value: any) => void;
  updateSelectedStyle: (key: keyof ElementStyles, value: any) => void;
}

/**
 * Selected-element inspector: the per-type widget inspector slots (image ... display conditions), in their original order; for each element only the slots matching its type render.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 4984-5387 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderWidgetInspectorSlots({
  activeDevice,
  activePageId,
  breakpoints,
  handleCreatePageQuick,
  handleOpenIconPicker,
  pages,
  renderResponsiveLabel,
  selectedElement,
  selectedElementAny,
  siteProducts,
  updateElementProperties,
  updateSelectedProp,
  updateSelectedStyle,
}: WidgetInspectorSlotsDeps): React.ReactNode {
  return (
                    <>
                    {selectedElementAny.type === "image" && (
                      <ImageWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                        updateStyle={updateSelectedStyle}
                      />
                    )}

                    {/* Video Widget Specific Inspector */}
                    {selectedElementAny.type === "video" && (
                      <VideoWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Gallery Widget Specific Inspector */}
                    {(selectedElementAny.type === "gallery" || selectedElementAny.type === "basic-gallery") && (
                      <GalleryWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Slides Widget Specific Inspector */}
                    {selectedElementAny.type === "slides" && (
                      <SlidesWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Share Buttons Specific Inspector */}
                    {selectedElementAny.type === "share-buttons" && (
                      <ShareButtonsInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                        pages={pages}
                        activePageId={activePageId}
                      />
                    )}

                    {/* Form Builder Specific Inspector */}
                    {selectedElementAny.type === "form" && (
                      <FormWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Reviews / Testimonials Specific Inspector */}
                    {(selectedElementAny.type === "reviews" || selectedElementAny.type === "testimonial-carousel") && (
                      <ReviewsWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Video Playlist Specific Inspector */}
                    {selectedElementAny.type === "video-playlist" && (
                      <VideoPlaylistInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Audio Playlist Specific Inspector */}
                    {selectedElementAny.type === "audio-playlist" && (
                      <AudioPlaylistInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Navigation Menu Specific Inspector */}
                    {selectedElementAny.type === "nav-menu" && (
                      <NavMenuWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                        pages={pages}
                        siteProducts={siteProducts}
                        onCreatePage={handleCreatePageQuick}
                      />
                    )}

                    {/* Module 10: Navigation Settings Panel */}
                    {selectedElement && [
                      "nav-menu",
                      "wp-menu",
                      "menu-widget",
                      "mega-menu",
                      "breadcrumbs",
                      "menu-anchor",
                      "post-nav",
                      "off-canvas",
                      "off-canvas-nav",
                      "site-search",
                      "search-form",
                      "taxonomy-filter"
                    ].includes(selectedElement.type) && (
                      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                        <NavigationSettingsPanel
                          selectedElement={selectedElement}
                          onUpdateElement={updateElementProperties}
                          availablePages={pages}
                          activeBreakpointId={activeDevice}
                          breakpoints={breakpoints}
                          updateSelectedStyle={updateSelectedStyle}
                          updateSelectedProp={updateSelectedProp}
                          renderResponsiveLabel={renderResponsiveLabel}
                        />
                      </div>
                    )}

                    {/* Countdown Specific Inspector */}
                    {selectedElementAny.type === "countdown" && (
                      <CountdownWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Lottie Specific Inspector */}
                    {selectedElementAny.type === "lottie" && (
                      <LottieWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Code Highlight Specific Inspector */}
                    {selectedElementAny.type === "code-highlight" && (
                      <CodeHighlightWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Button Inspector */}
                    {selectedElementAny.type === "button" && (
                      <ButtonWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                        updateStyle={updateSelectedStyle}
                        pages={pages}
                        activePageId={activePageId}
                        onCreatePage={handleCreatePageQuick}
                        siteProducts={siteProducts}
                        onOpenIconPicker={() => handleOpenIconPicker("iconName")}
                      />
                    )}

                    {/* Icon Library Inspector */}
                    {selectedElementAny.type === "icon-library" && (
                      <IconLibraryWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                        updateStyle={updateSelectedStyle}
                        onOpenIconPicker={() => handleOpenIconPicker("iconName")}
                      />
                    )}

                    {/* Portfolio Inspector */}
                    {selectedElementAny.type === "portfolio" && (
                      <PortfolioWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Login Inspector */}
                    {selectedElementAny.type === "login" && (
                      <LoginWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Animated Text Inspector */}
                    {selectedElementAny.type === "animated-headline" && (
                      <AnimatedTextWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Price Table Inspector */}
                    {selectedElementAny.type === "price-table" && (
                      <PriceTableWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Price List Inspector */}
                    {selectedElementAny.type === "price-list" && (
                      <PriceListWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

{/* Flip Box Inspector */}
                {selectedElementAny.type === "flip-box" && (
                  <FlipBoxWidgetInspector
                    el={selectedElementAny}
                    updateProp={updateSelectedProp}
                  />
                )}

                {/* Nested Tabs Inspector */}
                {selectedElementAny.type === "nested-tabs" && (
                  <NestedTabsWidgetInspector
                    el={selectedElementAny}
                    updateProp={updateSelectedProp}
                  />
                )}

                {/* Nested Accordion Inspector */}
                {selectedElementAny.type === "nested-accordion" && (
                  <NestedAccordionWidgetInspector
                    el={selectedElementAny}
                    updateProp={updateSelectedProp}
                  />
                )}

                {/* Query Builder Inspector */}
                {(selectedElementAny.type === "posts" || selectedElementAny.type === "portfolio" || selectedElementAny.type === "loop-grid") && (
                  <QueryBuilderWidgetInspector
                    el={selectedElementAny}
                    updateProp={updateSelectedProp}
                  />
                )}

                    {/* Call to Action Inspector */}
                    {selectedElementAny.type === "call-to-action" && (
                      <CTAWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Media & Loop Carousel Inspector */}
                    {(selectedElementAny.type === "media-carousel" || selectedElementAny.type === "loop-carousel" || selectedElementAny.type === "basic-media-carousel" || selectedElementAny.type === "image-carousel") && (
                      <MediaCarouselWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Table of Contents Inspector */}
                    {selectedElementAny.type === "table-of-contents" && (
                      <TOCWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Facebook Widgets Inspector */}
                    {(selectedElementAny.type === "facebook-page" || selectedElementAny.type === "facebook-button" || selectedElementAny.type === "facebook-embed" || selectedElementAny.type === "facebook-comments") && (
                      <FacebookWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Blockquote Inspector */}
                    {selectedElementAny.type === "blockquote" && (
                      <BlockquoteWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Payment Widgets Inspector (PayPal & Stripe) */}
                    {(selectedElementAny.type === "paypal-button" || selectedElementAny.type === "stripe-button" || selectedElementAny.type === "paypal" || selectedElementAny.type === "stripe") && (
                      <PaymentWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* WooCommerce Widgets Inspector */}
                    {selectedElementAny.type?.startsWith("wc-") && (
                      <WooCommerceWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                        siteProducts={siteProducts}
                      />
                    )}

                    {/* Link in Bio Inspector */}
                    {selectedElementAny.type === "link-in-bio" && (
                      <LinkInBioWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Image Box Inspector */}
                    {selectedElementAny.type === "image-box" && (
                      <ImageBoxWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                        updateStyle={updateSelectedStyle}
                      />
                    )}

                    {/* Icon Box Inspector */}
                    {selectedElementAny.type === "icon-box" && (
                      <IconBoxWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Icon List Inspector */}
                    {selectedElementAny.type === "icon-list" && (
                      <IconListWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Counter Inspector */}
                    {selectedElementAny.type === "counter" && (
                      <CounterWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Progress Bar Inspector */}
                    {selectedElementAny.type === "progress-bar" && (
                      <ProgressBarWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Rating Inspector */}
                    {selectedElementAny.type === "rating" && (
                      <RatingWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Alert Inspector */}
                    {selectedElementAny.type === "alert" && (
                      <AlertWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Google Maps Inspector */}
                    {selectedElementAny.type === "google-maps" && (
                      <GoogleMapsWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Divider Inspector */}
                    {selectedElementAny.type === "divider" && (
                      <DividerWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                        updateStyle={updateSelectedStyle}
                      />
                    )}

                    {/* Spacer Inspector */}
                    {selectedElementAny.type === "spacer" && (
                      <SpacerWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Custom SVG Inspector */}
                    {selectedElementAny.type === "custom-svg" && (
                      <CustomSVGWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Query Builder Inspector */}
                    {(selectedElementAny.type === "posts" || selectedElementAny.type === "portfolio" || selectedElementAny.type === "loop-grid") && (
                      <QueryBuilderWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Display Conditions Inspector */}
                    {selectedElementAny.type === "template" && (
                      <DisplayConditionsWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}
                    </>
  );
}
