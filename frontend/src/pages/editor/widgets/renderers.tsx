import { useEffect, useRef, useState } from "react";
import { submissionKeyFor, type SubmissionKeySlot } from "../../../utils/submissionKey";
import {
  Monitor, Smartphone, Tablet, Undo, Redo, Save, Eye, Settings, Plus, Trash2, Copy,
  ChevronDown, ChevronRight, Layers, Type, Image as ImageIcon, Box, Grid,
  Sliders, Palette, FileText, Globe, Code, Play, Check, X, Move, Lock, Unlock,
  HelpCircle, ExternalLink, RefreshCw, Database, Server, Cpu, HardDrive, Key,
  Mail, MessageSquare, Phone, User, Calendar, MapPin, Search, Star, Share2,
  AlertCircle, Info, Download, Upload, Zap, Shield, Sparkles, Layout, Compass,
  Terminal, ShieldCheck, StickyNote, FormInput, Link as LinkIcon, Navigation, ArrowRight, Menu
} from "lucide-react";
import {
  FacebookEmbedBoxIcon,
  FacebookCommentsBoxIcon,
  PayPalButtonBoxIcon,
  StripeButtonBoxIcon,
  LottieBoxIcon,
  MegaMenuBoxIcon,
  OffCanvasBoxIcon,
  IconRenderer
} from "./icons";
import { sanitizeSvg } from "../../../utils/svgSanitizer";

// ==========================================
// Types & Interfaces
// ==========================================

import { useWooCommerce } from "../../../context/WooCommerceContext";


import type {
  ElementType,
  EditorElement,
  ElementStyles,
  ContainerLayout,
  DeviceMode,
  SlideItem,
  FormFieldItem,
  NavMenuItem,
  NavSubmenuItem,
  PricingPlan,
  PricePlanFeature,
  PriceListItem,
  GalleryImageItem,
  TestimonialItem,
  ReviewItem,
  LoopCarouselItem,
  PlaylistItem,
  MediaCarouselItem,
  ImageCarouselItem,
  ShareNetworkType,
  ShareNetworkItem,
  ShareActionType,
  MegaMenuItem,
  PostItem,
  PageConfig,
  MegaMenuColumn,
  MegaMenuColumnLink,
  SiteProduct,
  ProductAddonItem
} from "../types";
import {
  resolveDynamicTokens,
  resolveTokensInTree
} from "../types";
import {
  resolveImageUrl,
  getEffectiveStyle,
  getMergedStyles,
  getMergedLayout
} from "../utils";
import { resolveInternalLink } from "../utils/pageManagerService";
import { PRESET_SECTION_TEMPLATES } from "../defaults";

// --- Renderers and helpers moved to ./renderers/ (verbatim; re-exported for compatibility) ---
export { resolveForgeLink } from "./renderers/links";
export type { ResolveForgeLinkOptions, ResolvedForgeLink } from "./renderers/links";
export { getEmbedVideoUrl } from "./renderers/embed";
export { NETWORK_BRAND_COLORS, renderSocialNetworkIcon, isSafeShareUrl, getCurrentResolvedPageUrl, resolveShareDestinationUrl, getSocialShareUrl, resolveShareAction } from "./renderers/share";
export type { ShareActionResult } from "./renderers/share";
export { resolveButtonHref, getLinkedPageStatus } from "./renderers/pageLinks";
export type { LinkedPageStatus } from "./renderers/pageLinks";
export { BlockquoteWidgetRenderer } from "./renderers/display/BlockquoteWidgetRenderer";
export { FacebookEmbedWidgetRenderer } from "./renderers/display/FacebookEmbedWidgetRenderer";
export { FacebookCommentsWidgetRenderer } from "./renderers/display/FacebookCommentsWidgetRenderer";
export { FacebookPageWidgetRenderer } from "./renderers/display/FacebookPageWidgetRenderer";
export { LottieWidgetRenderer } from "./renderers/display/LottieWidgetRenderer";
export { CustomSvgWidgetRenderer } from "./renderers/display/CustomSvgWidgetRenderer";
export { IconLibraryWidgetRenderer } from "./renderers/display/IconLibraryWidgetRenderer";
export { BasicGalleryWidgetRenderer } from "./renderers/display/BasicGalleryWidgetRenderer";
export { ReusableComponentWidgetRenderer } from "./renderers/display/ReusableComponentWidgetRenderer";
export { WcProductTitleWidgetRenderer } from "./renderers/woocommerce/WcProductTitleWidgetRenderer";
export { WcProductPriceWidgetRenderer } from "./renderers/woocommerce/WcProductPriceWidgetRenderer";
export { WcProductImagesWidgetRenderer } from "./renderers/woocommerce/WcProductImagesWidgetRenderer";
export { WcAddToCartWidgetRenderer } from "./renderers/woocommerce/WcAddToCartWidgetRenderer";
export { WcProductRatingWidgetRenderer } from "./renderers/woocommerce/WcProductRatingWidgetRenderer";
export { WcBuilderWidgetRenderer } from "./renderers/woocommerce/WcBuilderWidgetRenderer";
export { WcProductWidgetRenderer } from "./renderers/woocommerce/WcProductWidgetRenderer";
export { WcProductStockWidgetRenderer } from "./renderers/woocommerce/WcProductStockWidgetRenderer";
export { WcProductMetaWidgetRenderer } from "./renderers/woocommerce/WcProductMetaWidgetRenderer";
export { WcProductContentWidgetRenderer } from "./renderers/woocommerce/WcProductContentWidgetRenderer";
export { WcShortDescriptionWidgetRenderer } from "./renderers/woocommerce/WcShortDescriptionWidgetRenderer";
export { WcProductDataTabsWidgetRenderer } from "./renderers/woocommerce/WcProductDataTabsWidgetRenderer";
export { WcAdditionalInfoWidgetRenderer } from "./renderers/woocommerce/WcAdditionalInfoWidgetRenderer";
export { WcRelatedProductsWidgetRenderer } from "./renderers/woocommerce/WcRelatedProductsWidgetRenderer";
export { WcUpsellsWidgetRenderer } from "./renderers/woocommerce/WcUpsellsWidgetRenderer";
export { WcProductsWidgetRenderer } from "./renderers/woocommerce/WcProductsWidgetRenderer";
export { WcCustomAddToCartWidgetRenderer } from "./renderers/woocommerce/WcCustomAddToCartWidgetRenderer";
export { WcProductCategoriesWidgetRenderer } from "./renderers/woocommerce/WcProductCategoriesWidgetRenderer";
export { WcMenuCartWidgetRenderer } from "./renderers/woocommerce/WcMenuCartWidgetRenderer";
export { WcCartWidgetRenderer } from "./renderers/woocommerce/WcCartWidgetRenderer";
export { WcCheckoutWidgetRenderer } from "./renderers/woocommerce/WcCheckoutWidgetRenderer";
export { WcMyAccountWidgetRenderer } from "./renderers/woocommerce/WcMyAccountWidgetRenderer";
export { WcPurchaseSummaryWidgetRenderer } from "./renderers/woocommerce/WcPurchaseSummaryWidgetRenderer";
export { WcNoticesWidgetRenderer } from "./renderers/woocommerce/WcNoticesWidgetRenderer";
export { WcShopLayoutsWidgetRenderer } from "./renderers/woocommerce/WcShopLayoutsWidgetRenderer";
export { WcProductArchiveWidgetRenderer } from "./renderers/woocommerce/WcProductArchiveWidgetRenderer";
export { WcProductPageTemplatesWidgetRenderer } from "./renderers/woocommerce/WcProductPageTemplatesWidgetRenderer";
export { WcProductArchiveTemplatesWidgetRenderer } from "./renderers/woocommerce/WcProductArchiveTemplatesWidgetRenderer";
export { WcProductAddOnsWidgetRenderer } from "./renderers/woocommerce/WcProductAddOnsWidgetRenderer";
export { FlipBoxWidgetRenderer } from "./renderers/interactive/FlipBoxWidgetRenderer";
export { StripeButtonWidgetRenderer } from "./renderers/interactive/StripeButtonWidgetRenderer";
export { CodeHighlightWidgetRenderer } from "./renderers/interactive/CodeHighlightWidgetRenderer";
export { SearchBarWidgetRenderer } from "./renderers/interactive/SearchBarWidgetRenderer";
export { NestedTabsWidgetRenderer } from "./renderers/interactive/NestedTabsWidgetRenderer";
export { NestedAccordionWidgetRenderer } from "./renderers/interactive/NestedAccordionWidgetRenderer";
export { CountdownWidgetRenderer } from "./renderers/timers/CountdownWidgetRenderer";
export { AnimatedHeadlineWidgetRenderer } from "./renderers/timers/AnimatedHeadlineWidgetRenderer";
export { SlidesWidgetRenderer } from "./renderers/timers/SlidesWidgetRenderer";
export { NestedCarouselWidgetRenderer } from "./renderers/timers/NestedCarouselWidgetRenderer";
export { BasicMediaCarouselWidgetRenderer } from "./renderers/timers/BasicMediaCarouselWidgetRenderer";
export { LoginWidgetRenderer } from "./renderers/content/LoginWidgetRenderer";
export { PriceTableWidgetRenderer } from "./renderers/content/PriceTableWidgetRenderer";
export { PriceListWidgetRenderer } from "./renderers/content/PriceListWidgetRenderer";
export { GalleryWidgetRenderer } from "./renderers/content/GalleryWidgetRenderer";
export { TemplateWidgetRenderer } from "./renderers/content/TemplateWidgetRenderer";
export { ImportAssetWidgetRenderer } from "./renderers/content/ImportAssetWidgetRenderer";
export { NavMenuWidgetRenderer } from "./renderers/navigation/NavMenuWidgetRenderer";
export { MegaMenuWidgetRenderer } from "./renderers/navigation/MegaMenuWidgetRenderer";
export { CtaWidgetRenderer } from "./renderers/navigation/CtaWidgetRenderer";
export { ShareButtonsWidgetRenderer } from "./renderers/navigation/ShareButtonsWidgetRenderer";
export { FormWidgetRenderer } from "./renderers/network/FormWidgetRenderer";
export { PayPalButtonWidgetRenderer } from "./renderers/network/PayPalButtonWidgetRenderer";
export { MediaCarouselWidgetRenderer } from "./renderers/media/MediaCarouselWidgetRenderer";
export { TestimonialCarouselWidgetRenderer } from "./renderers/media/TestimonialCarouselWidgetRenderer";
export { LoopCarouselWidgetRenderer } from "./renderers/media/LoopCarouselWidgetRenderer";
export { ReviewsWidgetRenderer } from "./renderers/media/ReviewsWidgetRenderer";
export { ImageCarouselWidgetRenderer } from "./renderers/media/ImageCarouselWidgetRenderer";
export { AudioPlaylistWidgetRenderer } from "./renderers/media/AudioPlaylistWidgetRenderer";
export { TocWidgetRenderer } from "./renderers/browser/TocWidgetRenderer";
export { OffCanvasWidgetRenderer } from "./renderers/browser/OffCanvasWidgetRenderer";
export { DynamicLightboxWidgetRenderer } from "./renderers/browser/DynamicLightboxWidgetRenderer";
export { FavoriteWidgetsWidgetRenderer } from "./renderers/browser/FavoriteWidgetsWidgetRenderer";
export { DEFAULT_LOOP_ITEMS, LoopGridWidgetRenderer } from "./renderers/loopGrid";
export type { LoopGridWidgetRendererProps } from "./renderers/loopGrid";
