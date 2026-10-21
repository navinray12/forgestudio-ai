import React from "react";
import { ALL_WIDGET_REGISTRY } from "../../types";
import type { ElementType } from "../../types";
import { AnimatedHeadlineBoxIcon, BlockquoteBoxIcon, ButtonBoxIcon, CodeHighlightBoxIcon, ContainerBoxIcon, CountdownBoxIcon, CtaBoxIcon, FacebookPageBoxIcon, FlipBoxIcon, FormBoxIcon, GalleryBoxIcon, HeadingBoxIcon, ImageBoxIcon, ImageCarouselBoxIcon, LoginBoxIcon, LoopCarouselBoxIcon, LottieBoxIcon, MediaCarouselBoxIcon, MegaMenuBoxIcon, NavMenuBoxIcon, NestedCarouselBoxIcon, OffCanvasBoxIcon, PayPalButtonBoxIcon, PortfolioBoxIcon, PostsBoxIcon, PriceListBoxIcon, PriceTableBoxIcon, ReviewsBoxIcon, ShareButtonsBoxIcon, SlidesBoxIcon, StripeButtonBoxIcon, TemplateBoxIcon, TestimonialBoxIcon, TextBoxIcon, TocBoxIcon, VideoPlaylistBoxIcon } from "../../widgets";

/** What renderWidgetLibraryGrid reads: the editor values and callbacks the inline JSX used. */
export interface WidgetLibraryGridDeps {
  favoriteWidgets: ElementType[];
  handleAddElement: (type: ElementType, targetId?: string | null) => void;
  isWidgetLibraryVisible: (type: ElementType, name?: string | undefined) => boolean;
  toggleFavoriteWidget: (type: ElementType, e?: React.MouseEvent<Element, MouseEvent> | undefined) => void;
}

/**
 * Left sidebar, Elements tab: the widget library grid (one draggable / clickable tile per element type, filtered by search and disabled widgets).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3647-4659 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderWidgetLibraryGrid({
  favoriteWidgets,
  handleAddElement,
  isWidgetLibraryVisible,
  toggleFavoriteWidget,
}: WidgetLibraryGridDeps): React.ReactNode {
  return (
                <div className="grid grid-cols-2 gap-3">
                  {/* Container */}
                  {isWidgetLibraryVisible("container", "Container") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "container" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("container")}
                      className="relative col-span-2 flex items-center justify-center gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3 shadow-xs hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("container", e)}
                        className={`absolute top-2 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("container") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("container") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("container") ? "★" : "☆"}
                      </button>
                      <ContainerBoxIcon />
                      <span className="text-xs font-bold text-blue-700 group-hover:text-blue-800">
                        + Add Container
                      </span>
                    </div>
                  )}

                  {/* Heading */}
                  {isWidgetLibraryVisible("heading", "Heading") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "heading" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("heading")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-blue-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("heading", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("heading") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("heading") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("heading") ? "★" : "☆"}
                      </button>
                      <HeadingBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-blue-600">
                        Heading
                      </span>
                    </div>
                  )}

                  {/* Text */}
                  {isWidgetLibraryVisible("text", "Text") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "text" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("text")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-blue-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("text", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("text") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("text") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("text") ? "★" : "☆"}
                      </button>
                      <TextBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-blue-600">
                        Text
                      </span>
                    </div>
                  )}

                  {/* Image */}
                  {isWidgetLibraryVisible("image", "Image") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "image" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("image")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-blue-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("image", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("image") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("image") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("image") ? "★" : "☆"}
                      </button>
                      <ImageBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-blue-600">
                        Image
                      </span>
                    </div>
                  )}

                  {/* Button */}
                  {isWidgetLibraryVisible("button", "Button") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "button" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("button")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-blue-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("button", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("button") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("button") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("button") ? "★" : "☆"}
                      </button>
                      <ButtonBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-blue-600">
                        Button
                      </span>
                    </div>
                  )}

                  {/* Posts Widget (F-174) */}
                  {isWidgetLibraryVisible("posts", "Posts") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "posts" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("posts")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-purple-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("posts", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("posts") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("posts") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("posts") ? "★" : "☆"}
                      </button>
                      <PostsBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-purple-600">
                        Posts
                      </span>
                    </div>
                  )}

                  {/* Share Buttons Widget (F-175) */}
                  {isWidgetLibraryVisible("share-buttons", "Share Buttons") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "share-buttons" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("share-buttons")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-blue-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("share-buttons", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("share-buttons") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("share-buttons") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("share-buttons") ? "★" : "☆"}
                      </button>
                      <ShareButtonsBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-blue-600">
                        Share Buttons
                      </span>
                    </div>
                  )}

                  {/* Portfolio Widget (F-176) */}
                  {isWidgetLibraryVisible("portfolio", "Portfolio") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "portfolio" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("portfolio")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-indigo-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("portfolio", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("portfolio") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("portfolio") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("portfolio") ? "★" : "☆"}
                      </button>
                      <PortfolioBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-indigo-600">
                        Portfolio
                      </span>
                    </div>
                  )}

                  {/* Slides Widget (F-177) */}
                  {isWidgetLibraryVisible("slides", "Slides") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "slides" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("slides")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-pink-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("slides", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("slides") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("slides") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("slides") ? "★" : "☆"}
                      </button>
                      <SlidesBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-pink-600">
                        Slides
                      </span>
                    </div>
                  )}

                  {/* Form Widget (F-178) */}
                  {isWidgetLibraryVisible("form", "Form") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "form" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("form")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-emerald-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("form", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("form") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("form") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("form") ? "★" : "☆"}
                      </button>
                      <FormBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-emerald-600">
                        Form
                      </span>
                    </div>
                  )}

                  {/* Login Widget (F-179) */}
                  {isWidgetLibraryVisible("login", "Login") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "login" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("login")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-blue-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("login", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("login") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("login") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("login") ? "★" : "☆"}
                      </button>
                      <LoginBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-blue-600">
                        Login
                      </span>
                    </div>
                  )}

                  {/* Nav Menu Widget (F-180) */}
                  {isWidgetLibraryVisible("nav-menu", "Nav Menu") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "nav-menu" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("nav-menu")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-amber-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("nav-menu", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("nav-menu") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("nav-menu") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("nav-menu") ? "★" : "☆"}
                      </button>
                      <NavMenuBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-amber-600">
                        Nav Menu
                      </span>
                    </div>
                  )}

                  {/* Animated Headline Widget (F-181) */}
                  {isWidgetLibraryVisible("animated-headline", "Animated Headline") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "animated-headline" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("animated-headline")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-violet-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("animated-headline", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("animated-headline") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("animated-headline") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("animated-headline") ? "★" : "☆"}
                      </button>
                      <AnimatedHeadlineBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-violet-600">
                        Animated Text
                      </span>
                    </div>
                  )}

                  {/* Price Table Widget (F-182) */}
                  {isWidgetLibraryVisible("price-table", "Price Table") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "price-table" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("price-table")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-emerald-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("price-table", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("price-table") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("price-table") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("price-table") ? "★" : "☆"}
                      </button>
                      <PriceTableBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-emerald-600">
                        Price Table
                      </span>
                    </div>
                  )}

                  {/* Price List Widget (F-183) */}
                  {isWidgetLibraryVisible("price-list", "Price List") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "price-list" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("price-list")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-teal-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("price-list", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("price-list") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("price-list") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("price-list") ? "★" : "☆"}
                      </button>
                      <PriceListBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-teal-600">
                        Price List
                      </span>
                    </div>
                  )}

                  {/* Gallery Widget (F-184) */}
                  {isWidgetLibraryVisible("gallery", "Gallery") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "gallery" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("gallery")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-pink-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("gallery", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("gallery") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("gallery") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("gallery") ? "★" : "☆"}
                      </button>
                      <GalleryBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-pink-600">
                        Gallery
                      </span>
                    </div>
                  )}

                  {/* Flip Box Widget (F-185) */}
                  {isWidgetLibraryVisible("flip-box", "Flip Box") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "flip-box" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("flip-box")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-amber-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("flip-box", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("flip-box") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("flip-box") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("flip-box") ? "★" : "☆"}
                      </button>
                      <FlipBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-amber-600">
                        Flip Box
                      </span>
                    </div>
                  )}

                  {/* Call to Action Widget (F-186) */}
                  {isWidgetLibraryVisible("call-to-action", "Call to Action") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "call-to-action" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("call-to-action")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-rose-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("call-to-action", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("call-to-action") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("call-to-action") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("call-to-action") ? "★" : "☆"}
                      </button>
                      <CtaBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-rose-600">
                        Call to Action
                      </span>
                    </div>
                  )}

                  {/* Media Carousel Widget (F-187) */}
                  {isWidgetLibraryVisible("media-carousel", "Media Carousel") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "media-carousel" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("media-carousel")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-cyan-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("media-carousel", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("media-carousel") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("media-carousel") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("media-carousel") ? "★" : "☆"}
                      </button>
                      <MediaCarouselBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-cyan-600">
                        Media Carousel
                      </span>
                    </div>
                  )}

                  {/* Testimonial Carousel Widget (F-188) */}
                  {isWidgetLibraryVisible("testimonial-carousel", "Testimonials") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "testimonial-carousel" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("testimonial-carousel")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-emerald-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("testimonial-carousel", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("testimonial-carousel") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("testimonial-carousel") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("testimonial-carousel") ? "★" : "☆"}
                      </button>
                      <TestimonialBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-emerald-600">
                        Testimonials
                      </span>
                    </div>
                  )}

                  {/* Nested Carousel Widget (F-189) */}
                  {isWidgetLibraryVisible("nested-carousel", "Nested Carousel") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "nested-carousel" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("nested-carousel")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-indigo-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("nested-carousel", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("nested-carousel") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("nested-carousel") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("nested-carousel") ? "★" : "☆"}
                      </button>
                      <NestedCarouselBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-indigo-600">
                        Nested Carousel
                      </span>
                    </div>
                  )}

                  {/* Loop Carousel Widget (F-190) */}
                  {isWidgetLibraryVisible("loop-carousel", "Loop Carousel") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "loop-carousel" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("loop-carousel")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-purple-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("loop-carousel", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("loop-carousel") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("loop-carousel") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("loop-carousel") ? "★" : "☆"}
                      </button>
                      <LoopCarouselBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-purple-600">
                        Loop Carousel
                      </span>
                    </div>
                  )}

                  {/* Table of Contents Widget (F-191) */}
                  {isWidgetLibraryVisible("table-of-contents", "Table of Contents") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "table-of-contents" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("table-of-contents")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-teal-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("table-of-contents", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("table-of-contents") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("table-of-contents") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("table-of-contents") ? "★" : "☆"}
                      </button>
                      <TocBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-teal-600">
                        Table of Contents
                      </span>
                    </div>
                  )}

                  {/* Countdown Widget (F-192) */}
                  {isWidgetLibraryVisible("countdown", "Countdown") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "countdown" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("countdown")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-amber-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("countdown", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("countdown") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("countdown") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("countdown") ? "★" : "☆"}
                      </button>
                      <CountdownBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-amber-600">
                        Countdown
                      </span>
                    </div>
                  )}

                  {/* Facebook Page Widget (F-193) */}
                  {isWidgetLibraryVisible("facebook-page", "Facebook Page") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "facebook-page" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("facebook-page")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-blue-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("facebook-page", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("facebook-page") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("facebook-page") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("facebook-page") ? "★" : "☆"}
                      </button>
                      <FacebookPageBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-blue-600">
                        Facebook Page
                      </span>
                    </div>
                  )}

                  {/* Blockquote Widget (F-194) */}
                  {isWidgetLibraryVisible("blockquote", "Blockquote") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "blockquote" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("blockquote")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-indigo-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("blockquote", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("blockquote") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("blockquote") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("blockquote") ? "★" : "☆"}
                      </button>
                      <BlockquoteBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-indigo-600">
                        Blockquote
                      </span>
                    </div>
                  )}

                  {/* Template Widget (F-195) */}
                  {isWidgetLibraryVisible("template", "Template") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "template" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("template")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-purple-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("template", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("template") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("template") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("template") ? "★" : "☆"}
                      </button>
                      <TemplateBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-purple-600">
                        Template
                      </span>
                    </div>
                  )}

                  {/* Reviews Widget (F-196) */}
                  {isWidgetLibraryVisible("reviews", "Reviews") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "reviews" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("reviews")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-amber-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("reviews", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("reviews") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("reviews") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("reviews") ? "★" : "☆"}
                      </button>
                      <ReviewsBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-amber-600">
                        Reviews
                      </span>
                    </div>
                  )}



                  {/* PayPal Button Widget (F-200) */}
                  {isWidgetLibraryVisible("paypal-button", "PayPal Button") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "paypal-button" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("paypal-button")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-amber-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("paypal-button", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("paypal-button") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("paypal-button") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("paypal-button") ? "★" : "☆"}
                      </button>
                      <PayPalButtonBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-amber-600">
                        PayPal
                      </span>
                    </div>
                  )}

                  {/* Stripe Button Widget (F-201) */}
                  {isWidgetLibraryVisible("stripe-button", "Stripe Button") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "stripe-button" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("stripe-button")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-indigo-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("stripe-button", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("stripe-button") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("stripe-button") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("stripe-button") ? "★" : "☆"}
                      </button>
                      <StripeButtonBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-indigo-600">
                        Stripe
                      </span>
                    </div>
                  )}

                  {/* Lottie Widget (F-202) */}
                  {isWidgetLibraryVisible("lottie", "Lottie Animation") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "lottie" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("lottie")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-teal-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("lottie", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("lottie") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("lottie") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("lottie") ? "★" : "☆"}
                      </button>
                      <LottieBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-teal-600">
                        Lottie
                      </span>
                    </div>
                  )}

                  {/* Code Highlight Widget (F-203) */}
                  {isWidgetLibraryVisible("code-highlight", "Code Highlight") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "code-highlight" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("code-highlight")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-purple-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("code-highlight", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("code-highlight") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("code-highlight") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("code-highlight") ? "★" : "☆"}
                      </button>
                      <CodeHighlightBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-purple-600">
                        Code Highlight
                      </span>
                    </div>
                  )}

                  {/* Video Playlist Widget (F-204) */}
                  {isWidgetLibraryVisible("video-playlist", "Video Playlist") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "video-playlist" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("video-playlist")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-red-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("video-playlist", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("video-playlist") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("video-playlist") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("video-playlist") ? "★" : "☆"}
                      </button>
                      <VideoPlaylistBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-red-600">
                        Video Playlist
                      </span>
                    </div>
                  )}

                  {/* Mega Menu Widget (F-205) */}
                  {isWidgetLibraryVisible("mega-menu", "Mega Menu") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "mega-menu" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("mega-menu")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-blue-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("mega-menu", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("mega-menu") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("mega-menu") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("mega-menu") ? "★" : "☆"}
                      </button>
                      <MegaMenuBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-blue-600">
                        Mega Menu
                      </span>
                    </div>
                  )}

                  {/* Off Canvas Widget (F-206) */}
                  {isWidgetLibraryVisible("off-canvas", "Off Canvas") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "off-canvas" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("off-canvas")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-amber-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("off-canvas", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("off-canvas") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("off-canvas") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("off-canvas") ? "★" : "☆"}
                      </button>
                      <OffCanvasBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-amber-600">
                        Off Canvas
                      </span>
                    </div>
                  )}

                  {/* Image Carousel Widget (F-210) */}
                  {isWidgetLibraryVisible("image-carousel", "Image Carousel") && (
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: "image-carousel" }));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddElement("image-carousel")}
                      className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-blue-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleFavoriteWidget("image-carousel", e)}
                        className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${favoriteWidgets.includes("image-carousel") ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                          }`}
                        title={favoriteWidgets.includes("image-carousel") ? "Remove favorite" : "Mark as favorite"}
                      >
                        {favoriteWidgets.includes("image-carousel") ? "★" : "☆"}
                      </button>
                      <ImageCarouselBoxIcon />
                      <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-blue-600">
                        Image Carousel
                      </span>
                    </div>
                  )}

                  {/* Dynamically Render All Additional Registered Widgets (F-212 to F-222 & future widgets) */}
                  {ALL_WIDGET_REGISTRY.filter((w) => ![
                    "container", "heading", "text", "image", "button", "posts", "share-buttons", "portfolio", "slides", "form",
                    "login", "nav-menu", "animated-headline", "price-table", "price-list", "gallery", "flip-box", "call-to-action",
                    "media-carousel", "testimonial-carousel", "nested-carousel", "loop-carousel", "table-of-contents", "countdown",
                    "facebook-page", "blockquote", "template", "reviews", "facebook-button", "facebook-embed", "facebook-comments",
                    "paypal-button", "stripe-button", "lottie", "code-highlight", "video-playlist", "mega-menu", "off-canvas", "image-carousel"
                  ].includes(w.type)).map((widget) => {
                    if (!isWidgetLibraryVisible(widget.type, widget.name)) return null;
                    const isFav = favoriteWidgets.includes(widget.type);
                    return (
                      <div
                        key={widget.type}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/json", JSON.stringify({ type: "new", widgetType: widget.type }));
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => handleAddElement(widget.type)}
                        className="relative flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-blue-400 hover:shadow-sm hover:-translate-y-0.5 active:scale-95 group cursor-grab transition"
                      >
                        <button
                          type="button"
                          onClick={(e) => toggleFavoriteWidget(widget.type, e)}
                          className={`absolute top-1.5 right-2 text-xs transition hover:scale-125 ${isFav ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                            }`}
                          title={isFav ? "Remove favorite" : "Mark as favorite"}
                        >
                          {isFav ? "★" : "☆"}
                        </button>
                        <span className="text-2xl">{widget.icon || "📦"}</span>
                        <span className="mt-2 text-xs font-semibold text-slate-700 group-hover:text-blue-600 text-center line-clamp-1">
                          {widget.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
  );
}
