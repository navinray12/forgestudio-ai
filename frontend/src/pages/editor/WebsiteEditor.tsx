
import PopupManagerModal from "./components/PopupManagerModal";
import IconPickerModal from "./components/IconPickerModal";
import PopupRuntimePreview from "./components/PopupRuntimePreview";
import type { DeveloperModalMode } from "./components/DeveloperModal";
import { PageManagerModal } from "./components/PageManagerModal";
import { PublishModal } from "./components/PublishModal";
import { SupportCredentialsModal } from "./components/SupportCredentialsModal";
import { SeoAnalyzerModal } from "../../features/seo/components/SeoAnalyzerModal";
import { MultilingualExportModal } from "../../components/accessibility/MultilingualExportModal";
import { AccessibilityWidget } from "../../components/accessibility/AccessibilityWidget";
import { AccessibilityStatementModal } from "../../components/accessibility/AccessibilityStatementModal";
import { ReadingGuideBar } from "../../components/accessibility/ReadingGuideBar";
import { DesignNotesOverlay } from "./components/notes/DesignNotesOverlay";
import { VariablesManagerModal } from "./components/VariablesManagerModal";
import { ClassManagerModal } from "./components/ClassManagerModal";
import { validateSlug, generateSlug, safeDeletePage, createStarterPages } from "./utils/pageManagerService";
import { matchesThemeCondition, type SitePartsConfig, type PublishingState, type DeploymentConfig, type CanonicalWebsiteData, type ThemeBuilderScope, resolveDynamicTokens, type DynamicContext } from "./types";
import { SaveTemplateDialog, ReplaceTemplateDialog, ImportWebsiteKitDialog, useSaveTemplate, useTemplateLibrary, TemplateLibrary, exportWebsiteKitAsJson, type Template } from "../../features/templates";
import { RevisionHistoryPanel, revisionHistoryService } from "../../features/revision-history";
import { DesignAssistant } from "../../features/ai/DesignAssistant";
import { UnifiedAiAssistant } from "../../features/ai/UnifiedAiAssistant";
import "../../features/editor-access/save-authorized-website";
import { useAutosave } from "../../features/autosave";
import { AtomicEditor, GlobalElementService, ReusableComponentService } from "../../features/atomic-editor";
import { useComponentAccess } from "../../features/permissions/hooks/useComponentAccess";
import { createDocumentSaveCoordinator } from "../../features/editor-access/document-save-coordinator";
import { ContentOnlyInspector } from "./components/ContentOnlyInspector";
import { ExperimentManagerModal } from "./components/experiments/ExperimentManagerModal";
import { useCanvasPresence } from "../../features/collaboration/hooks/useCanvasPresence";
import { WooCommerceProvider } from "../../context/WooCommerceContext";
import { sanitizeHtml } from "../../utils/sanitizeHtml";

import { lazy, Suspense, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { forgeProjectService } from "../../features/developer-workspace/services/forgeProjectService";
import { syncAcknowledgedSave } from "../../features/developer-workspace/services/canvasSourceSync";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Tablet,
  Undo,
  Redo,
  Save,
  Settings,
  Trash2,
  Copy,
  ChevronRight,
  Type,
  Image as ImageIcon,
  Box,
  Grid,
  Sliders,
  Palette,
  Globe,
  Code,
  Play,
  Check,
  X,
  Move,
  Lock,
  Unlock,
  HelpCircle,
  ExternalLink,
  Database,
  Server,
  Cpu,
  HardDrive,
  Mail,
  Phone,
  User,
  Calendar,
  MapPin,
  Search,
  Star,
  Share2,
  AlertCircle,
  Info,
  Download,
  Upload,
  Zap,
  Shield,
  Layout,
  Compass,
  Terminal,
  ShieldCheck,
  StickyNote,
  FormInput,
  Link as LinkIcon,
  Navigation,
  ArrowRight,
  Menu,
  Keyboard,
} from "lucide-react";

// ==========================================
// Types & Interfaces
// ==========================================



// Extracted Modular Imports
export type { EditorElement, ElementStyles, ContainerLayout, Breakpoint, ElementType } from "./types";
import { type SiteProduct } from "./types";
import { IconRenderer } from "./widgets/icons";
import {
  triggerImagePicker,
  UniversalIconControls,
  PriceTableWidgetInspector,
  CTAWidgetInspector,
  MediaCarouselWidgetInspector,
  TestimonialCarouselWidgetInspector,
  NestedCarouselWidgetInspector,
  LoopCarouselWidgetInspector,
  TOCWidgetInspector,
  PayPalWidgetInspector,
} from "./inspector/DynamicWidgetInspectors";
import { MediaLightboxModal } from "../../components/MediaLightboxModal";
import "./inspector";
import { FontPickerModal } from "../../components/FontPickerModal";
import { FontPickerControl } from "../../components/FontPickerControl";
import { FontService } from "../../features/fonts/FontService";
import { syncDocumentFonts } from "../../features/fonts/FontManager";
import {
  BreadcrumbsRenderer,
  WpMenuRenderer,
  MenuAnchorRenderer,
  PostNavigationRenderer,
  TaxonomyFilterRenderer,
  SiteSearchRenderer,
} from "./navigation/NavigationRenderers";
import "./navigation/NavigationSettings";
import { isNavigationElement } from "./navigation/navigationDefaults";

import type {
  PageConfig,
  ElementType,
  NavSubmenuItem,
  NavMenuItem,
  PricePlanFeature,
  PricingPlan,
  PriceListItem,
  GalleryImageItem,
  AnimatedHeadlineStyle,
  WidgetRegistryItem,
  DeviceMode,
  Breakpoint,
  PlaylistItem,
  ImageCarouselItem,
  MegaMenuColumnLink,
  MegaMenuColumn,
  MegaMenuItem,
  ReviewItem,
  FormFieldType,
  FormFieldItem,
  SlideItem,
  PortfolioItem,
  ShareNetworkType,
  ShareNetworkItem,
  ContainerLayout,
  ElementStyles,
  ElementState,
  EditorElement,
  WebsiteData,
} from "./types";
import {
  ALL_WIDGET_REGISTRY,
  DEFAULT_VISIBLE_WIDGETS
} from "./types";

import {
  generateId,
  resolveImageUrl,
  parseSpacingUnit,
  getEffectiveStyle,
  getEffectiveHoverStyle,
  getControlStyleValue,
  isControlStyleConfigured,
  getMergedStyles,
  getInnerStyles,
  generateElementsHoverCSS,
  getElementBreadcrumbPath,
  updateTreeElement,
  insertTreeElement,
  insertTreeElementAtPosition,
  deleteTreeElement,
  duplicateTreeElement,
  moveTreeElement,
  isDescendant,
  reorderTreeElement,
  resolveMotionAttrs,
  resolveStickyStyles,
  initMotionRuntime,
} from "./utils";

import {
  PRESET_SECTION_TEMPLATES,
  createDefaultElement
} from "./defaults";

import {
  FacebookButtonBoxIcon,
  FacebookEmbedBoxIcon,
  FacebookCommentsBoxIcon,
  StripeButtonBoxIcon,
  LottieBoxIcon,
  CodeHighlightBoxIcon,
  VideoPlaylistBoxIcon,
  MegaMenuBoxIcon,
  OffCanvasBoxIcon,
  EmptyPictureIcon,
  UploadCloudIcon,
  AnimatedCounter,
} from "./widgets";

import {
  SlidesWidgetRenderer,
  FormWidgetRenderer,
  LoginWidgetRenderer,
  NavMenuWidgetRenderer,
  AnimatedHeadlineWidgetRenderer,
  PriceTableWidgetRenderer,
  PriceListWidgetRenderer,
  GalleryWidgetRenderer,
  FlipBoxWidgetRenderer,
  CtaWidgetRenderer,
  MediaCarouselWidgetRenderer,
  TestimonialCarouselWidgetRenderer,
  NestedCarouselWidgetRenderer,
  LoopCarouselWidgetRenderer,
  TocWidgetRenderer,
  CountdownWidgetRenderer,
  FacebookPageWidgetRenderer,
  BlockquoteWidgetRenderer,
  TemplateWidgetRenderer,
  ReviewsWidgetRenderer,
  FacebookButtonWidgetRenderer,
  FacebookEmbedWidgetRenderer,
  FacebookCommentsWidgetRenderer,
  PayPalButtonWidgetRenderer,
  StripeButtonWidgetRenderer,
  ImageCarouselWidgetRenderer,
  LottieWidgetRenderer,
  CodeHighlightWidgetRenderer,
  MegaMenuWidgetRenderer,
  OffCanvasWidgetRenderer,
  BasicMediaCarouselWidgetRenderer,
  BasicGalleryWidgetRenderer,
  AudioPlaylistWidgetRenderer,
  DynamicLightboxWidgetRenderer,
  CustomSvgWidgetRenderer,
  IconLibraryWidgetRenderer,
  NestedTabsWidgetRenderer,
  NestedAccordionWidgetRenderer,
  ShareButtonsWidgetRenderer,
  WcProductTitleWidgetRenderer,
  WcProductPriceWidgetRenderer,
  WcProductImagesWidgetRenderer,
  WcAddToCartWidgetRenderer,
  WcProductRatingWidgetRenderer,
  WcBuilderWidgetRenderer,
  WcProductWidgetRenderer,
  WcProductStockWidgetRenderer,
  WcProductMetaWidgetRenderer,
  WcProductContentWidgetRenderer,
  WcShortDescriptionWidgetRenderer,
  WcProductDataTabsWidgetRenderer,
  WcAdditionalInfoWidgetRenderer,
  WcRelatedProductsWidgetRenderer,
  WcUpsellsWidgetRenderer,
  WcProductsWidgetRenderer,
  WcCustomAddToCartWidgetRenderer,
  WcProductCategoriesWidgetRenderer,
  WcMenuCartWidgetRenderer,
  WcCartWidgetRenderer,
  WcCheckoutWidgetRenderer,
  WcMyAccountWidgetRenderer,
  WcPurchaseSummaryWidgetRenderer,
  WcNoticesWidgetRenderer,
  WcShopLayoutsWidgetRenderer,
  WcProductArchiveWidgetRenderer,
  WcProductPageTemplatesWidgetRenderer,
  WcProductArchiveTemplatesWidgetRenderer,
  WcProductAddOnsWidgetRenderer,
  SearchBarWidgetRenderer,
  ImportAssetWidgetRenderer,
  ReusableComponentWidgetRenderer,
  FavoriteWidgetsWidgetRenderer,
  LoopGridWidgetRenderer,
  resolveButtonHref
} from "./widgets";

import { SpacingControl } from "./inspector";
import { DefaultWebsiteNavbar } from "./components/DefaultWebsiteNavbar";
import { findTreeElement, getAllElementIds } from "./core/elementTree";
import { getYouTubeId, getVimeoId } from "./core/videoEmbed";
import { createBackgroundAndBorderStylesCompiler, compilePositioningStyles } from "./core/styleCompilers";
import { useEditorHistory } from "./core/useEditorHistory";
import { useEditorShortcuts } from "./core/useEditorShortcuts";
import { ScrubbableNumberInput } from "./components/ScrubbableNumberInput";
import { assetFileError, buildImportedAssetElement, IMAGE_UPLOAD_RULE, IMPORT_ASSET_RULE, recordImportedAsset, uploadOrReadAsDataUrl, VIDEO_UPLOAD_RULE } from "./core/assetUpload";
import { buildTypographySection } from "./inspector/typographySection";
import { buildPositioningControls } from "./inspector/positioningControls";
import { buildBackgroundAndBorderControls } from "./inspector/backgroundBorderControls";
import { buildNavigatorTreeItem } from "./navigator/navigatorTreeItem";
import { renderTextElements } from "./canvas/elements/textElements";
import { renderMediaElements } from "./canvas/elements/mediaElements";
import { renderButtonElement } from "./canvas/elements/buttonElement";
import { renderDynamicContentElements } from "./canvas/elements/dynamicContentElements";
import { renderWidgetElements } from "./canvas/elements/widgetElements";
import { renderNavigationElements } from "./canvas/elements/navigationElements";
import { renderUtilityElements } from "./canvas/elements/utilityElements";
import { renderMenuElements } from "./canvas/elements/menuElements";
import { renderWooCommerceElements } from "./canvas/elements/wooCommerceElements";
import { renderBasicWidgetElements } from "./canvas/elements/basicWidgetElements";
import { renderContainerElement } from "./canvas/elements/containerElement";
import { canvasModeTarget, storeCanvasIntoActivePage } from "./core/canvasMode";
import { sitePartKeyForScope, withSitePartElements } from "./core/sitePartScopes";
import { renderAddPageModal } from "./shell/addPageModal";
import { renderHeaderRightRegion } from "./shell/header/headerRightRegion";
import { renderHeaderCenterRegion } from "./shell/header/headerCenterRegion";
import { renderHeaderLeftRegion } from "./shell/header/headerLeftRegion";
import { renderNavigatorPanel } from "./shell/sidebar/navigatorPanel";
import { renderReusableComponentsSection } from "./shell/sidebar/reusableComponentsSection";
import { renderWidgetLibraryGrid } from "./shell/sidebar/widgetLibraryGrid";
import { renderFavoriteWidgetsSection } from "./shell/sidebar/favoriteWidgetsSection";
import { renderImportAssetButton } from "./shell/sidebar/importAssetButton";
import { renderSidebarTabBar } from "./shell/sidebar/sidebarTabBar";
import { renderWidgetLibrarySearch } from "./shell/sidebar/widgetLibrarySearch";
import { renderElementManagerOverlay } from "./shell/overlays/elementManagerOverlay";
import { renderShortcutsHelpOverlay } from "./shell/overlays/shortcutsHelpOverlay";
import { renderFinderOverlay } from "./shell/overlays/finderOverlay";
import { renderElementContextMenu } from "./shell/overlays/elementContextMenu";
import { renderEditPageModal } from "./shell/modals/editPageModal";
import { renderDesignAssistantSection } from "./shell/modals/designAssistantSection";
import { renderUnifiedAiAssistantSection } from "./shell/modals/unifiedAiAssistantSection";
import { renderAiAssistantLauncher } from "./shell/modals/aiAssistantLauncher";
import { renderMotionAccordion } from "./inspector/selected/motionAccordion";
import { renderBoxShadowAccordion } from "./inspector/selected/boxShadowAccordion";
import { renderBordersAccordion } from "./inspector/selected/bordersAccordion";
import { renderTypographyAccordion } from "./inspector/selected/typographyAccordion";
import { renderScrollSnapAccordion } from "./inspector/selected/scrollSnapAccordion";
import { renderSmartLinkControls } from "./inspector/selected/smartLinkControls";
import { renderNonContainerSpacingSection } from "./inspector/selected/nonContainerSpacingSection";
import { renderWidgetInspectorSlots } from "./inspector/selected/widgetInspectorSlots";
import { renderPostsControls } from "./inspector/selected/postsControls";
import { renderUniversalSizingControls } from "./inspector/selected/universalSizingControls";
import { renderContainerLayoutControls } from "./inspector/selected/containerLayoutControls";
import { renderElementStateSelector } from "./inspector/selected/elementStateSelector";
import { renderElementTypeHeader } from "./inspector/selected/elementTypeHeader";
import { renderSiteSettingsSecondBlock } from "./inspector/noSelection/siteSettingsSecondBlock";
import { renderSiteSettingsFirstBlock } from "./inspector/noSelection/siteSettingsFirstBlock";
import { buildCanonicalPages } from "./core/canonicalPages";
import { buildNewPage, findStarterPage, newPageId, pageSettingsOf, previewPageIdFromUrl, previewPageParam, slugFromName, starterElementsOf, syncActivePageIntoPages } from "./core/pageManagement";
import { useWebsiteLoader } from "./core/useWebsiteLoader";
import { useWorkspaceSync } from "./core/useWorkspaceSync";
import { useManualSave } from "./core/useManualSave";
import { usePublishWebsite, useRollbackDeployment } from "./core/usePublishWebsite";

// Monaco includes a substantial language runtime; load it only when a developer
// opens code editing rather than with every editor session.
const DeveloperModal = lazy(() => import("./components/DeveloperModal"));

export default function WebsiteEditor() {
  const { websiteId } = useParams<{ websiteId: string }>();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

  // State Management
  const [website, setWebsite] = useState<WebsiteData | null>(null);
  const documentWriter = useMemo(() => createDocumentSaveCoordinator(apiUrl, websiteId || ""), [apiUrl, websiteId]);
  // The visual document as the server last acknowledged it: the "before" side of a canvas change.
  const lastSavedEditorDataRef = useRef<unknown>(null);
  const persistDocument = useCallback(async (payload: unknown, signal?: AbortSignal) => {
    const saved = await documentWriter.save(payload, signal);
    setWebsite(current => current && current.id === saved.id ? { ...current, ...saved } : current);

    // Pages holding hand-written code are not regenerated by the save (codeSync.conflicts). The
    // change made on the canvas reaches them as element edits through the AST mutation endpoint.
    const after = (payload as { editorData?: unknown } | null)?.editorData;
    const before = lastSavedEditorDataRef.current;
    if (after) lastSavedEditorDataRef.current = JSON.parse(JSON.stringify(after));
    saved.sourceSync = await syncAcknowledgedSave(forgeProjectService, saved, before, after);
    return saved;
  }, [documentWriter]);

  const [globalSettings, setGlobalSettings] = useState<any>({
    siteIdentity: { name: "My Website" },
    backToTop: { enabled: true, position: "bottom-right", offset: 300 },
    floatingActionButton: { enabled: false, icon: "whatsapp", label: "Chat with us", position: "bottom-left" }
  });

  const [elements, setElements] = useState<EditorElement[]>([]);

  const [popups, setPopups] = useState<any[]>([]);

  const [isPopupManagerOpen, setIsPopupManagerOpen] = useState(false);
  const [isUnifiedAiOpen, setIsUnifiedAiOpen] = useState(false);
  const [isSeoAnalyzerOpen, setIsSeoAnalyzerOpen] = useState(false);
  const [isMultilingualModalOpen, setIsMultilingualModalOpen] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isComponentAccessOpen, setIsComponentAccessOpen] = useState(false);
  const [isSupportCredentialsOpen, setIsSupportCredentialsOpen] = useState(false);
  const [activeCanvasMode, setActiveCanvasMode] = useState<"page" | "popup">("page");
  const [activePopupId, setActivePopupId] = useState<string | null>(null);
  const [devModalMode, setDevModalMode] = useState<DeveloperModalMode | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<string>("widgets");
  const [pageCss, setPageCss] = useState<string>("");

  const handleSelectPopupForEdit = (popup: any) => {
    setActivePopupId(popup.id);
  };
  const handleCreatePopup = (popup: any) => {
    setPopups((prev) => [...prev, popup]);
  };
  const handleUpdatePopup = (id: string, popup: any) => {
    setPopups((prev) => prev.map((p) => (p.id === id ? { ...p, ...popup } : p)));
  };
  const handleDeletePopup = (id: string) => {
    setPopups((prev) => prev.filter((p) => p.id !== id));
  };
  const handleDuplicatePopup = (id: string) => {
    const p = popups.find((pop) => pop.id === id);
    if (p) setPopups((prev) => [...prev, { ...p, id: generateId(), title: `${p.title} (Copy)` }]);
  };
  const handleTrackPopupView = (id: string) => {
    setPopups((prev) =>
      prev.map((p) => (p.id === id ? { ...p, viewsCount: (p.viewsCount || 0) + 1 } : p))
    );
  };
  const handleTrackPopupClick = (id: string) => {
    setPopups((prev) =>
      prev.map((p) => (p.id === id ? { ...p, clicksCount: (p.clicksCount || 0) + 1 } : p))
    );
  };

  const handleSampleColor = async (onColorPicked: (hex: string) => void) => {
    if (typeof window !== "undefined" && "EyeDropper" in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          onColorPicked(result.sRGBHex);
        }
      } catch (err) {
        console.warn("EyeDropper error:", err);
      }
    }
  };

  const [activeDevice, setActiveDevice] = useState<DeviceMode>("desktop");

  const [breakpoints, setBreakpoints] = useState<any[]>([
    { id: "desktop", name: "Desktop", minWidth: 1025 },
    { id: "tablet", name: "Tablet", minWidth: 768, maxWidth: 1024 },
    { id: "mobile", name: "Mobile", maxWidth: 767 }
  ]);
  const activeBreakpointId = activeDevice;

  const getStyleVal = (element: any, key: string, breakpointId: string, _bpList: any[]) => {
    if (!element) return undefined;
    if (element.responsiveStyles && element.responsiveStyles[breakpointId]?.[key]) {
      return element.responsiveStyles[breakpointId][key];
    }
    return element.styles?.[key];
  };

  const renderResponsiveLabel = (label: string) => (
    <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
  );

  const renderAccordion = (title: string, id: string, children: React.ReactNode) => (
    <details key={id} className="group border border-slate-200 rounded-lg bg-white overflow-hidden my-2">
      <summary className="flex cursor-pointer items-center justify-between p-3 text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 select-none">
        <span>{title}</span>
        <span className="transition-transform group-open:rotate-180">▼</span>
      </summary>
      <div className="p-3 border-t border-slate-200 space-y-3">{children}</div>
    </details>
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedElement = selectedId ? findTreeElement(elements, selectedId) : null;
  const selectedElementAny = selectedElement as any;
  const [allowedComponentIds, setAllowedComponentIds] = useState<Set<string>>(new Set());
  const userAccess = useComponentAccess(website, allowedComponentIds);
  const isRestrictedMode = userAccess.isRestrictedMode;
  const [canvasTheme, setCanvasTheme] = useState<"light" | "dark">("light");
  const [isExperimentModalOpen, setIsExperimentModalOpen] = useState(false);

  // Real-Time Canvas Presence (Phase 3 Subsystem 3)
  const currentLoggedInUser = useMemo(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) return JSON.parse(stored);
    } catch { }
    return { id: "user_editor", name: "Editor User" };
  }, []);

  const {
    peers: canvasPeers,
    peerSelections: canvasPeerSelections,
    isConnected: isPresenceConnected,
    broadcastCursor,
    broadcastSelection,
  } = useCanvasPresence(websiteId || (website as any)?.id, currentLoggedInUser);

  useEffect(() => {
    broadcastSelection(selectedId || null);
  }, [selectedId, broadcastSelection]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeElementState, setActiveElementState] = useState<ElementState>("normal");

  // Reusable Components State (F-005)
  const [components, setComponents] = useState<Record<string, { name: string; element: EditorElement; isFavorite?: boolean }>>(() => {
    try {
      const saved = localStorage.getItem("forgestudio_reusable_components");
      if (saved) return JSON.parse(saved);
      const serviceComps = ReusableComponentService.getComponents();
      const compMap: Record<string, { name: string; element: EditorElement; isFavorite?: boolean }> = {};
      serviceComps.forEach((c) => {
        compMap[c.id] = {
          name: c.name,
          element: {
            id: c.rootElement.id || c.id,
            type: (c.rootElement.type as ElementType) || "container",
            content: c.name,
            styles: c.rootElement.styles || {},
          },
          isFavorite: false,
        };
      });
      return compMap;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("forgestudio_reusable_components", JSON.stringify(components));
    } catch (err) {
      console.error("Failed to save reusable components:", err);
    }
  }, [components]);

  const toggleFavoriteComponent = (compId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setComponents((prev) => {
      const target = prev[compId];
      if (!target) return prev;
      const updated = {
        ...prev,
        [compId]: {
          ...target,
          isFavorite: !target.isFavorite,
        },
      };
      try {
        localStorage.setItem("forgestudio_reusable_components", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to save favorite component:", err);
      }
      return updated;
    });
  };

  const syncComponentInstances = (compId: string, updatedSource: EditorElement) => {
    const updateMatching = (list: EditorElement[]): EditorElement[] => {
      return list.map((item) => {
        let currentItem = item;
        if (item.componentId === compId) {
          currentItem = {
            ...currentItem,
            content: updatedSource.content,
            src: updatedSource.src,
            alt: updatedSource.alt,
            href: updatedSource.href,
            styles: { ...updatedSource.styles },
            hoverStyles: updatedSource.hoverStyles ? JSON.parse(JSON.stringify(updatedSource.hoverStyles)) : undefined,
            layout: updatedSource.layout ? { ...updatedSource.layout } : undefined,
            responsiveStyles: updatedSource.responsiveStyles ? JSON.parse(JSON.stringify(updatedSource.responsiveStyles)) : undefined,
            responsiveHoverStyles: updatedSource.responsiveHoverStyles ? JSON.parse(JSON.stringify(updatedSource.responsiveHoverStyles)) : undefined,
            responsiveLayout: updatedSource.responsiveLayout ? JSON.parse(JSON.stringify(updatedSource.responsiveLayout)) : undefined,
          };
        }
        if (currentItem.children && currentItem.children.length > 0) {
          currentItem = {
            ...currentItem,
            children: updateMatching(currentItem.children),
          };
        }
        return currentItem;
      });
    };

    setElements((prev) => updateMatching(prev));
  };

  const handleSaveAsComponent = (elementId: string) => {
    const el = findTreeElement(elements, elementId);
    if (!el) return;
    const compId = "comp_" + Math.random().toString(36).substring(2, 9);
    const compName = el.componentName || `${el.type.charAt(0).toUpperCase() + el.type.slice(1)} Component`;

    const masterCopy: EditorElement = JSON.parse(JSON.stringify(el));
    masterCopy.componentId = compId;
    masterCopy.isComponent = true;

    setComponents((prev) => ({
      ...prev,
      [compId]: {
        name: compName,
        element: masterCopy,
      },
    }));

    setElements((prev) =>
      updateTreeElement(prev, elementId, (item) => ({
        ...item,
        componentId: compId,
        isComponent: true,
        componentName: compName,
      }))
    );
  };

  const handleAddInstanceFromComponent = (compId: string) => {
    const comp = components[compId];
    if (!comp) return;

    const createInstance = (base: EditorElement): EditorElement => ({
      ...JSON.parse(JSON.stringify(base)),
      id: generateId(),
      componentId: compId,
      isComponent: true,
      componentName: comp.name,
      children: base.children ? base.children.map(createInstance) : undefined,
    });

    const newInstance = createInstance(comp.element);
    setElements((prev) => [...prev, newInstance]);
    setSelectedId(newInstance.id);
    setSelectedIds([newInstance.id]);
  };

  const handleSelectTemplate = (elementId: string, templateId?: string, presetName?: string) => {
    setElements((prev) =>
      updateTreeElement(prev, elementId, (item) => ({
        ...item,
        templateId: templateId,
        templateSource: templateId ? "custom" : "preset",
        templatePresetName: presetName as any,
      }))
    );
  };

  const handleUnpackTemplate = (elementId: string) => {
    const el = findTreeElement(elements, elementId);
    if (!el) return;

    let unpackedElements: EditorElement | null = null;

    if (el.templateId && components[el.templateId]) {
      const comp = components[el.templateId];
      const createInstance = (base: EditorElement): EditorElement => ({
        ...JSON.parse(JSON.stringify(base)),
        id: generateId(),
        children: base.children ? base.children.map(createInstance) : undefined,
      });
      unpackedElements = createInstance(comp.element);
    } else if (el.templatePresetName && PRESET_SECTION_TEMPLATES[el.templatePresetName]) {
      unpackedElements = PRESET_SECTION_TEMPLATES[el.templatePresetName].getElements(generateId);
    }

    if (!unpackedElements) return;

    setElements((prev) => {
      const replaceInTree = (list: EditorElement[]): EditorElement[] => {
        return list.map((item) => {
          if (item.id === elementId) {
            return unpackedElements!;
          }
          if (item.children && item.children.length > 0) {
            return {
              ...item,
              children: replaceInTree(item.children),
            };
          }
          return item;
        });
      };
      return replaceInTree(prev);
    });

    setSelectedId(unpackedElements.id);
    setSelectedIds([unpackedElements.id]);
  };

  // Drag & Drop State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | "inside" | null>(null);

  // Context Menu State (F-010)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    window.addEventListener("click", handleCloseMenu);
    return () => window.removeEventListener("click", handleCloseMenu);
  }, []);

  // Favorite Widgets State (F-012)
  const [favoriteWidgets, setFavoriteWidgets] = useState<ElementType[]>(() => {
    try {
      const saved = localStorage.getItem("forgestudio_favorite_widgets");
      return saved ? JSON.parse(saved) : ["heading", "button"];
    } catch {
      return ["heading", "button"];
    }
  });

  // User Preferences State (F-026)
  const [userPreferences, setUserPreferences] = useState<{
    autoSaveEnabled: boolean;
    gridOverlay: boolean;
    themeMode: "dark" | "light";
  }>(() => {
    try {
      const saved = localStorage.getItem("forgestudio_user_preferences");
      return saved ? JSON.parse(saved) : { autoSaveEnabled: true, gridOverlay: false, themeMode: "dark" };
    } catch {
      return { autoSaveEnabled: true, gridOverlay: false, themeMode: "dark" };
    }
  });

  const updatePreference = <K extends keyof typeof userPreferences>(
    key: K,
    value: (typeof userPreferences)[K]
  ) => {
    setUserPreferences((prev) => {
      const updated = { ...prev, [key]: value };
      try {
        localStorage.setItem("forgestudio_user_preferences", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to save user preferences:", err);
      }
      return updated;
    });
  };

  const toggleFavoriteWidget = (type: ElementType, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavoriteWidgets((prev) => {
      const isFav = prev.includes(type);
      const updated = isFav ? prev.filter((item) => item !== type) : [...prev, type];
      try {
        localStorage.setItem("forgestudio_favorite_widgets", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to save favorite widgets:", err);
      }
      return updated;
    });
  };

  // Revision & History State (F-013): see core/useEditorHistory
  const { history, historyIndex, handleUndo, handleRedo, resetHistoryTo, clearHistoryForLoad } = useEditorHistory(elements, setElements);


  const handleSelectElement = (id: string | null, e?: React.MouseEvent) => {
    setActiveElementState("normal");
    if (!id) {
      setSelectedId(null);
      setSelectedIds([]);
      return;
    }

    if (e && (e.ctrlKey || e.metaKey)) {
      setSelectedIds((prev) => {
        const isAlreadySelected = prev.includes(id);
        const updated = isAlreadySelected
          ? prev.filter((item) => item !== id)
          : [...prev, id];
        setSelectedId(updated.length > 0 ? updated[updated.length - 1] : null);
        return updated;
      });
    } else if (e && e.shiftKey && selectedId && elements.length > 0) {
      const allIds = getAllElementIds(elements);
      const startIdx = allIds.indexOf(selectedId);
      const endIdx = allIds.indexOf(id);
      if (startIdx !== -1 && endIdx !== -1) {
        const minIdx = Math.min(startIdx, endIdx);
        const maxIdx = Math.max(startIdx, endIdx);
        const rangeIds = allIds.slice(minIdx, maxIdx + 1);
        setSelectedIds((prev) => Array.from(new Set([...prev, ...rangeIds])));
        setSelectedId(id);
      } else {
        setSelectedId(id);
        setSelectedIds([id]);
      }
    } else {
      setSelectedId(id);
      setSelectedIds([id]);
    }
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState<boolean>(false);
  const scopeDropdownRef = useRef<HTMLDivElement>(null);

  // Close scope dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        scopeDropdownRef.current &&
        !scopeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsScopeDropdownOpen(false);
      }
    };
    if (isScopeDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isScopeDropdownOpen]);
  const [isMarginLinked, setIsMarginLinked] = useState<boolean>(true);
  const [isPaddingLinked, setIsPaddingLinked] = useState<boolean>(true);
  const [isBorderRadiusLinked, setIsBorderRadiusLinked] = useState<boolean>(true);

  const [isPreview, setIsPreview] = useState(false);
  const [isFullScreenCanvas, setIsFullScreenCanvas] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const bgFileInputRef = useRef<HTMLInputElement | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  // Navigator & Sidebar State
  const [leftSidebarTab, setLeftSidebarTab] = useState<"elements" | "navigator" | "templates">("elements");
  const [collapsedContainers, setCollapsedContainers] = useState<Record<string, boolean>>({});
  const [structureSearchQuery, setStructureSearchQuery] = useState("");


  // Element Manager & Widget Visibility State
  const [disabledWidgets, setDisabledWidgets] = useState<ElementType[]>(() => {
    try {
      const saved = localStorage.getItem("forgestudio_disabled_widgets");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    // Default on fresh launch: Show ALL widgets in sidebar palette
    return [];
  });
  const [isElementManagerOpen, setIsElementManagerOpen] = useState(false);
  const [isRevisionHistoryOpen, setIsRevisionHistoryOpen] = useState(false);
  const [isDesignAssistantOpen, setIsDesignAssistantOpen] = useState(false);
  const [startParams, setStartParams] = useSearchParams();
  useEffect(() => {
    if (loading || !website || !userAccess.canEditDesign) return;
    const mode = startParams.get("start");
    if (mode !== "ai" && mode !== "template") return;
    if (mode === "ai") setIsDesignAssistantOpen(true);
    else setLeftSidebarTab("templates");
    const remaining = new URLSearchParams(startParams);
    remaining.delete("start");
    setStartParams(remaining, { replace: true });
  }, [loading, website, userAccess.canEditDesign, startParams, setStartParams]);
  const pendingDesignApplyKey = useRef<string | null>(null);
  const [widgetLibrarySearch, setWidgetLibrarySearch] = useState("");
  const [managerSearchQuery, setManagerSearchQuery] = useState("");
  const [managerCategoryFilter, setManagerCategoryFilter] = useState<string>("All");

  const handleRestoreRevision = (restoredElements: EditorElement[], restoredPageSettings?: any, fullRestoredState?: any) => {
    if (Array.isArray(restoredElements)) {
      setElements(JSON.parse(JSON.stringify(restoredElements)));
    }
    if (restoredPageSettings) {
      setPageSettings(JSON.parse(JSON.stringify(restoredPageSettings)));
    }
    if (fullRestoredState?.pages && Array.isArray(fullRestoredState.pages)) {
      setPages(JSON.parse(JSON.stringify(fullRestoredState.pages)));
    }
    if (fullRestoredState?.siteParts) {
      setSiteParts(JSON.parse(JSON.stringify(fullRestoredState.siteParts)));
    }
    if (updateAutosaveBaseline) {
      updateAutosaveBaseline(
        restoredElements,
        restoredPageSettings,
        fullRestoredState?.pages || pages,
        fullRestoredState?.homePageId || homePageId,
        fullRestoredState?.siteParts || siteParts,
        fullRestoredState?.globalSettings || globalSettings,
        fullRestoredState?.globalStyles || globalSettings?.globalStyles,
        publishing,
        deployment,
        fullRestoredState?.breakpoints || breakpoints,
        fullRestoredState?.popups || popups,
        fullRestoredState?.pageCss || pageCss
      );
    }
    setSelectedId(null);
    setSelectedIds([]);
    setSaveMessage("Restored revision successfully!");
    setTimeout(() => setSaveMessage(""), 3500);
  };

  const handleUpdateElementPropById = useCallback((elementId: string, propKey: string, propValue: any) => {
    const updateInTree = (items: EditorElement[]): EditorElement[] => {
      return items.map((el) => {
        if (el.id === elementId) {
          return {
            ...el,
            props: {
              ...(el.props || {}),
              [propKey]: propValue,
            },
          };
        }
        let updated = { ...el };
        if (Array.isArray(el.children)) {
          updated.children = updateInTree(el.children);
        }
        if (Array.isArray(el.elements)) {
          updated.elements = updateInTree(el.elements);
        }
        return updated;
      });
    };

    setElements((prev) => updateInTree(prev));
  }, []);

  const handleSelectElementFromAudit = useCallback((elementId: string) => {
    setSelectedId(elementId);
    setSelectedIds([elementId]);
  }, []);

  const toggleWidgetAvailability = (type: ElementType) => {
    setDisabledWidgets((prev) => {
      const updated = prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type];
      try {
        localStorage.setItem("forgestudio_disabled_widgets", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to save widget visibility preferences:", err);
      }
      return updated;
    });
  };

  const enableAllWidgets = () => {
    setDisabledWidgets([]);
    try {
      localStorage.setItem("forgestudio_disabled_widgets", JSON.stringify([]));
    } catch (err) {
      console.error("Failed to save widget visibility preferences:", err);
    }
  };

  const resetWidgetsToDefault = () => {
    const core5: ElementType[] = ["heading", "text", "button", "image", "container"];
    const nonCore = ALL_WIDGET_REGISTRY.map((w) => w.type).filter((t) => !core5.includes(t));
    setDisabledWidgets(nonCore);
    try {
      localStorage.setItem("forgestudio_disabled_widgets", JSON.stringify(nonCore));
    } catch (err) {
      console.error("Failed to save widget visibility preferences:", err);
    }
  };

  const isWidgetLibraryVisible = (type: ElementType, name?: string) => {
    if (disabledWidgets.includes(type)) return false;
    if (!widgetLibrarySearch.trim()) return true;
    const q = widgetLibrarySearch.toLowerCase().trim();
    const label = name || ALL_WIDGET_REGISTRY.find((w) => w.type === type)?.name || type;
    return label.toLowerCase().includes(q) || type.toLowerCase().includes(q);
  };

  // Copy / Paste State
  const [copiedElement, setCopiedElement] = useState<EditorElement | null>(null);
  const [copiedElements, setCopiedElements] = useState<EditorElement[]>([]);
  const [copiedStyles, setCopiedStyles] = useState<{
    styles?: ElementStyles;
    responsiveStyles?: Partial<Record<DeviceMode, Partial<ElementStyles>>>;
    hoverStyles?: Partial<ElementStyles>;
    responsiveHoverStyles?: Partial<Record<DeviceMode, Partial<ElementStyles>>>;
  } | null>(null);

  // Page Settings State (F-018 & F-019 & F-022)
  const [pageSettings, setPageSettings] = useState<{
    title?: string;
    description?: string;
    path?: string;
    backgroundColor?: string;
    customHead?: string;
    isMaintenanceMode?: boolean;
    siteLanguage?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    canonicalUrl?: string;
    noindex?: boolean;
    nofollow?: boolean;
    [key: string]: any;
  }>({
    title: "Home",
    description: "",
    path: "/",
    backgroundColor: "#ffffff",
    customHead: "",
    isMaintenanceMode: false,
    siteLanguage: "en",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    canonicalUrl: "",
    noindex: false,
    nofollow: false,
  });

  // Multi-Page Management, Site Parts & Preview States
  const [pages, setPages] = useState<PageConfig[]>([]);
  const [homePageId, setHomePageId] = useState<string>("home");
  const [activePageId, setActivePageId] = useState<string>("home");
  const [activePreviewPageId, setActivePreviewPageId] = useState<string>("home");
  const [isPageSelectorOpen, setIsPageSelectorOpen] = useState<boolean>(false);
  const [isPageManagerModalOpen, setIsPageManagerModalOpen] = useState<boolean>(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);
  const [isSeoModalOpen, setIsSeoModalOpen] = useState<boolean>(false);
  const [isDesignNotesOpen, setIsDesignNotesOpen] = useState<boolean>(false);
  const [isVariablesModalOpen, setIsVariablesModalOpen] = useState<boolean>(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState<boolean>(false);
  const [globalVariables, setGlobalVariables] = useState<any[]>([]);
  const [globalClasses, setGlobalClasses] = useState<any[]>([]);
  const [isAddPageModalOpen, setIsAddPageModalOpen] = useState<boolean>(false);
  const [newPageName, setNewPageName] = useState<string>("");
  const [newPageSlug, setNewPageSlug] = useState<string>("");
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editPageName, setEditPageName] = useState<string>("");
  const [editPageSlug, setEditPageSlug] = useState<string>("");
  const [isEditPageModalOpen, setIsEditPageModalOpen] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // F-SITE-PARTS: Global Header & Footer Canonical State (Comment 5)
  const [siteParts, setSiteParts] = useState<SitePartsConfig>({
    header: { enabled: true, elements: [] },
    footer: { enabled: true, elements: [] },
  });

  // Publishing State & Deployment Configuration
  const [publishing, setPublishing] = useState<PublishingState>({
    status: "DRAFT",
    publishedVersion: 1,
  });
  const [deployment, setDeployment] = useState<DeploymentConfig>({
    provider: "static",
  });
  const publishedDataRef = useRef<any>(null);

  // Canvas Editing Target Mode: ThemeBuilderScope ("page" | "header" | "footer" | "single" | "archive" | "404" | "search-results")
  const [canvasMode, setCanvasMode] = useState<ThemeBuilderScope>("page");

  // Sync live editor state with active page entry ONLY when in page mode (protects Header/Footer isolation)
  // Advanced Icon Library Modal State
  const [isIconPickerOpen, setIsIconPickerOpen] = useState<boolean>(false);
  const [iconPickerTargetField, setIconPickerTargetField] = useState<string>("iconName");

  const handleOpenIconPicker = (targetField = "iconName") => {
    setIconPickerTargetField(targetField);
    setIsIconPickerOpen(true);
  };

  // Dynamic Font System Modal State
  const [isFontPickerModalOpen, setIsFontPickerModalOpen] = useState<boolean>(false);
  const [fontPickerCallback, setFontPickerCallback] = useState<((family: string) => void) | null>(null);

  const handleOpenFontPicker = (onSelect?: (family: string) => void) => {
    if (onSelect) setFontPickerCallback(() => onSelect);
    setIsFontPickerModalOpen(true);
  };

  // Global Site Products Catalog State (WooCommerce & Dynamic Navigation Data Engine)
  const [siteProducts, setSiteProducts] = useState<SiteProduct[]>([
    {
      id: "prod_1",
      name: "Premium Wireless Headphones",
      price: "$199.99",
      regularPrice: "$249.99",
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80",
      rating: 5,
      category: "Electronics",
      inStock: true,
      url: "#product-headphones",
      description: "High fidelity noise-canceling wireless headphones."
    },
    {
      id: "prod_2",
      name: "Ergonomic Smart Watch",
      price: "$149.00",
      regularPrice: "$179.00",
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
      rating: 4.8,
      category: "Wearables",
      inStock: true,
      url: "#product-watch",
      description: "Track fitness, health metrics, and smart notifications."
    },
    {
      id: "prod_3",
      name: "Minimalist Leather Backpack",
      price: "$89.50",
      regularPrice: "$110.00",
      image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80",
      rating: 4.6,
      category: "Accessories",
      inStock: true,
      url: "#product-backpack",
      description: "Crafted from genuine full-grain leather for everyday carry."
    }
  ]);

  // Sync live editor state (elements & pageSettings) with the active page entry in pages array
  useEffect(() => {
    if (!activePageId || canvasMode !== "page") return;

    setPages((prevPages) => syncActivePageIntoPages(prevPages, activePageId, elements, pageSettings));
  }, [elements, pageSettings, activePageId, canvasMode]);

  // Sync active Theme Builder changes into siteParts when in theme builder canvasMode (see core/sitePartScopes)
  useEffect(() => {
    const part = sitePartKeyForScope(canvasMode);
    if (part) {
      setSiteParts((prev) => withSitePartElements(prev, part, elements));
    }
  }, [elements, canvasMode]);

  // Sync preview active page with URL query parameter "?page=..." and popstate listener
  useEffect(() => {
    if (!isPreview || pages.length === 0) return;

    const syncFromUrl = () => {
      const pageId = previewPageIdFromUrl(pages, homePageId, window.location.search);
      if (pageId !== undefined) {
        setActivePreviewPageId(pageId);
      }
    };

    syncFromUrl();

    window.addEventListener("popstate", syncFromUrl);

    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [isPreview, pages, homePageId]);

  const handlePreviewPageNavigate = (targetPage: PageConfig) => {
    setActivePreviewPageId(targetPage.id);

    const newUrl = new URL(window.location.href);

    const cleanSlug = previewPageParam(targetPage, homePageId);

    newUrl.searchParams.set("page", cleanSlug);

    window.history.pushState({}, "", newUrl.toString());
  };

  const handleSwitchEditingPage = (targetPageId: string) => {
    const target = pages.find((p) => p.id === targetPageId);

    if (!target) return;

    // 1. Sync current page elements if we were editing a page
    if (canvasMode === "page") {
      setPages((prev) => buildCanonicalPages({ pages: prev, activePageId, canvasMode, elements, pageSettings }));
    }

    // 2. Clear element selection to isolate inspector across pages (Comment 18)
    setSelectedId(null);
    setSelectedIds([]);
    setCanvasMode("page");

    // 3. Reset undo/redo history to isolate active page history (Comment 6)
    resetHistoryTo(target.elements || []);

    setActivePageId(target.id);
    setElements(target.elements || []);

    setPageSettings(pageSettingsOf(target));

    setIsPageSelectorOpen(false);
  };

  // Canvas Mode Switcher: switches between Page, Header, Footer, Single, Archive, 404, and Search Results editing modes safely
  const handleSwitchCanvasMode = (mode: ThemeBuilderScope) => {
    if (mode === canvasMode) return;

    // 1. Save current elements into appropriate model
    if (canvasMode === "page") {
      setPages((prev) => storeCanvasIntoActivePage(prev, activePageId, elements, pageSettings));
    } else {
      const part = sitePartKeyForScope(canvasMode);
      if (part) setSiteParts((prev) => withSitePartElements(prev, part, elements));
    }

    // 2. Clear selections & reset undo/redo for new target
    setSelectedId(null);
    setSelectedIds([]);

    // 3. Load target elements (seeding an empty site part with its defaults first)
    const target = canvasModeTarget(mode, {
      pages,
      activePageId,
      siteParts,
      siteName: () => website?.name || globalSettings?.siteIdentity?.name || "ForgeStudio",
    });
    if (target) {
      const { seed } = target;
      if (seed) {
        setSiteParts((prev) => withSitePartElements(prev, seed.part, target.elements, seed.extra));
      }
      setElements(target.elements);
      resetHistoryTo(target.elements);
    }
    setCanvasMode(mode);
    setIsPageSelectorOpen(false);
  };

  const handleCreateNewPage = () => {
    const rawTitle =
      newPageName.trim() || `Page ${pages.length + 1}`;

    const existingSlugs = pages.map((p) => p.slug);
    const initialSlug = newPageSlug.trim() || generateSlug(rawTitle, existingSlugs);
    const validation = validateSlug(initialSlug, pages);

    if (!validation.isValid) {
      setErrorMessage(validation.error || "Invalid slug.");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }

    // Sync current page canvas elements if editing a page before switching (a new array in every mode)
    const currentPagesSnapshot = buildCanonicalPages({ pages, activePageId, canvasMode, elements, pageSettings });

    // Check if starter template elements match (About, Contact, Services, etc.)
    const starters = createStarterPages(website?.name || "ForgeStudio");
    const starterMatch = findStarterPage(starters, validation.slug, rawTitle);
    const initialElements = starterElementsOf(starterMatch);

    const newPageObj: PageConfig = buildNewPage({
      id: newPageId(),
      name: rawTitle,
      slug: validation.slug,
      elements: initialElements,
      description: starterMatch?.pageSettings?.description || "",
      isHome: currentPagesSnapshot.length === 0,
    });

    const updatedPages = [...currentPagesSnapshot, newPageObj];

    setPages(updatedPages);
    setActivePageId(newPageObj.id);

    setElements(initialElements);
    setPageSettings(newPageObj.pageSettings);

    setSelectedId(null);
    setSelectedIds([]);
    setCanvasMode("page");
    resetHistoryTo(initialElements);

    setNewPageName("");
    setNewPageSlug("");

    setIsAddPageModalOpen(false);
    setIsPageSelectorOpen(false);

    setSaveMessage(`Page "${rawTitle}" created!`);

    setTimeout(() => setSaveMessage(""), 3000);
  };

  const handleQuickCreateOrSwitchPage = (pageName: string, preferredSlug?: string) => {
    const defaultSlug = preferredSlug || slugFromName(pageName);

    // Check if a page with matching slug or name already exists
    const existing = pages.find(
      (p) => p.slug.toLowerCase() === defaultSlug.toLowerCase() || p.name.toLowerCase() === pageName.toLowerCase()
    );

    if (existing) {
      handleSwitchEditingPage(existing.id);
      setIsPageSelectorOpen(false);
      setSaveMessage(`Switched to "${existing.name}" page`);
      setTimeout(() => setSaveMessage(""), 2500);
      return;
    }

    // Sync current page canvas elements if editing a page before switching (a new array in every mode)
    const currentPagesSnapshot = buildCanonicalPages({ pages, activePageId, canvasMode, elements, pageSettings });

    const starters = createStarterPages(website?.name || "ForgeStudio");
    const starterMatch = findStarterPage(starters, defaultSlug, pageName);

    const newSlug = generateSlug(pageName, currentPagesSnapshot.map((p) => p.slug));
    const newId = newPageId();
    const starterElements = starterElementsOf(starterMatch);

    const newPageObj: PageConfig = buildNewPage({
      id: newId,
      name: pageName,
      slug: newSlug,
      elements: starterElements,
      description: starterMatch?.pageSettings?.description || `${pageName} page`,
      isHome: currentPagesSnapshot.length === 0,
    });

    const updatedPages = [...currentPagesSnapshot, newPageObj];
    setPages(updatedPages);
    setActivePageId(newPageObj.id);
    setElements(starterElements);
    setPageSettings(newPageObj.pageSettings);
    setSelectedId(null);
    setSelectedIds([]);
    setCanvasMode("page");
    resetHistoryTo(starterElements);
    setIsPageSelectorOpen(false);

    setSaveMessage(`Created and opened "${pageName}" page!`);
    setTimeout(() => setSaveMessage(""), 3000);
  };

  const handleCreatePageQuick = (customName?: string): PageConfig => {
    const count = pages.length + 1;
    const rawTitle = customName || `New Page ${count}`;
    const formattedSlug = slugFromName(rawTitle);
    const newPageObj: PageConfig = {
      id: newPageId(),
      name: rawTitle,
      slug: formattedSlug,
      elements: [],
      pageSettings: {
        title: rawTitle,
        path: formattedSlug,
        description: "",
        backgroundColor: "#ffffff",
        isMaintenanceMode: false,
        siteLanguage: "en",
      },
      isHome: pages.length === 0,
    };
    setPages((prev) => [...prev, newPageObj]);
    setSaveMessage(`Page "${rawTitle}" created!`);
    setTimeout(() => setSaveMessage(""), 3000);
    return newPageObj;
  };

  const handleDeletePage = (
    pageIdToDelete: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    if (pages.length <= 1) {
      setErrorMessage("Cannot delete the only remaining page.");

      setTimeout(() => setErrorMessage(""), 3000);

      return;
    }

    const target = pages.find(
      (p) => p.id === pageIdToDelete
    );

    if (!target) return;

    if (
      !window.confirm(
        `Are you sure you want to delete page "${target.name}"?`
      )
    ) {
      return;
    }

    const res = safeDeletePage(pageIdToDelete, pages, homePageId);
    if (!res.success) {
      setErrorMessage(res.error || "Cannot delete page.");
      setTimeout(() => setErrorMessage(""), 3000);
      return;
    }

    setPages(res.updatedPages);
    setHomePageId(res.newHomePageId);

    if (activePageId === pageIdToDelete) {
      const nextActive = res.updatedPages.find((p) => p.id === res.newHomePageId) || res.updatedPages[0];

      setActivePageId(nextActive.id);
      setElements(nextActive.elements || []);

      setPageSettings(
        nextActive.pageSettings || {
          title: nextActive.name,
          path: nextActive.slug,
        }
      );

      setSelectedId(null);
      setSelectedIds([]);
    }

    setSaveMessage(`Deleted page "${target.name}".`);

    setTimeout(() => setSaveMessage(""), 3000);
  };

  const openEditPageModal = (
    page: PageConfig,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    setEditingPageId(page.id);
    setEditPageName(page.name);
    setEditPageSlug(page.slug);

    setIsEditPageModalOpen(true);
    setIsPageSelectorOpen(false);
  };

  const handleSaveEditPage = () => {
    if (!editingPageId) return;

    const rawTitle = editPageName.trim();

    if (!rawTitle) return;

    const isCurrentHome = editingPageId === homePageId;
    let targetSlug = editPageSlug.trim();

    if (isCurrentHome && (targetSlug === "/" || targetSlug === "")) {
      targetSlug = "/";
    } else {
      const fallbackSlug = targetSlug || generateSlug(rawTitle, pages.filter((p) => p.id !== editingPageId).map((p) => p.slug));
      const validation = validateSlug(fallbackSlug, pages, editingPageId);
      if (!validation.isValid) {
        setErrorMessage(validation.error || "Invalid slug.");
        setTimeout(() => setErrorMessage(""), 3000);
        return;
      }
      targetSlug = validation.slug;
    }

    setPages((prev) =>
      prev.map((p) => {
        if (p.id === editingPageId) {
          const updatedSettings = {
            ...(p.pageSettings || {}),
            title: rawTitle,
            path: targetSlug,
          };

          return {
            ...p,
            name: rawTitle,
            slug: targetSlug,
            pageSettings: updatedSettings,
          };
        }

        return p;
      })
    );

    if (activePageId === editingPageId) {
      setPageSettings((prev) => ({
        ...prev,
        title: rawTitle,
        path: targetSlug,
      }));
    }

    setIsEditPageModalOpen(false);
    setEditingPageId(null);

    setSaveMessage(`Page updated to "${rawTitle}"!`);

    setTimeout(() => setSaveMessage(""), 3000);
  };

  const navigate = useNavigate();

  // Quit Visual Editor Handler (F-024)
  const handleQuitEditor = () => {
    navigate("/dashboard");
  };

  // Editor UI Language State & Dictionary (F-022 & F-024)
  const [editorLanguage, setEditorLanguage] = useState<"en" | "es" | "fr" | "de">("en");

  const editorTranslations: Record<string, Record<string, string>> = {
    en: {
      save: "Save",
      saving: "Saving...",
      preview: "Preview",
      exitPreview: "Exit Preview",
      undo: "Undo",
      redo: "Redo",
      elements: "Elements",
      navigator: "Navigator",
      pageSettings: "Page Settings",
      container: "Container",
      heading: "Heading",
      text: "Text",
      image: "Image",
      button: "Button",
      properties: "Properties",
      editorLang: "Editor UI Language",
      siteLang: "Site Language (Published)",
      quitEditor: "Quit Editor",
    },
    es: {
      save: "Guardar",
      saving: "Guardando...",
      preview: "Vista Previa",
      exitPreview: "Salir de Vista Previa",
      undo: "Deshacer",
      redo: "Rehacer",
      elements: "Elementos",
      navigator: "Navegador",
      pageSettings: "Configuración de Página",
      container: "Contenedor",
      heading: "Encabezado",
      text: "Texto",
      image: "Imagen",
      button: "Botón",
      properties: "Propiedades",
      editorLang: "Idioma de Interfaz",
      siteLang: "Idioma del Sitio (Publicado)",
      quitEditor: "Salir del Editor",
    },
    fr: {
      save: "Enregistrer",
      saving: "Enregistrement...",
      preview: "Aperçu",
      exitPreview: "Quitter l'aperçu",
      undo: "Annuler",
      redo: "Rétablir",
      elements: "Éléments",
      navigator: "Navigateur",
      pageSettings: "Paramètres de Page",
      container: "Conteneur",
      heading: "Titre",
      text: "Texte",
      image: "Image",
      button: "Bouton",
      properties: "Propriétés",
      editorLang: "Langue de l'Éditeur",
      siteLang: "Langue du Site (Publié)",
      quitEditor: "Quitter l'éditeur",
    },
    de: {
      save: "Speichern",
      saving: "Speichern...",
      preview: "Vorschau",
      exitPreview: "Vorschau Beenden",
      undo: "Rückgängig",
      redo: "Wiederholen",
      elements: "Elemente",
      navigator: "Navigator",
      pageSettings: "Seiteneinstellungen",
      container: "Behälter",
      heading: "Überschrift",
      text: "Text",
      image: "Bild",
      button: "Schaltfläche",
      properties: "Eigenschaften",
      editorLang: "Editor-Sprache",
      siteLang: "Website-Sprache (Veröffentlicht)",
      quitEditor: "Editor Beenden",
    },
  };

  const t = (key: string, fallback: string) => {
    return editorTranslations[editorLanguage]?.[key] || fallback;
  };

  // Temporary Support Credentials State (F-020)
  const [supportToken, setSupportToken] = useState<string | null>(null);
  const [supportExpiresAt, setSupportExpiresAt] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportCopied, setSupportCopied] = useState(false);

  // Generate Support Token (F-020)
  const handleGenerateSupportToken = async () => {
    try {
      setIsGeneratingToken(true);
      setSupportMessage("");
      const res = await fetch(`${apiUrl}/api/v1/auth/support-token`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to generate support token.");

      setSupportToken(data.data.supportToken);
      setSupportExpiresAt(new Date(data.data.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setSupportMessage("Temporary 2-hr support credential generated!");
    } catch (err: any) {
      setSupportMessage(err.message || "Failed to generate support token.");
    } finally {
      setIsGeneratingToken(false);
    }
  };

  // Revoke Support Tokens (F-020)
  const handleRevokeSupportTokens = async () => {
    try {
      setSupportMessage("");
      const res = await fetch(`${apiUrl}/api/v1/auth/revoke-support-tokens`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to revoke support tokens.");

      setSupportToken(null);
      setSupportExpiresAt(null);
      setSupportMessage("All support credentials revoked.");
    } catch (err: any) {
      setSupportMessage(err.message || "Failed to revoke support tokens.");
    }
  };

  // Fetch Website Data: see core/useWebsiteLoader (same position, so effect order is unchanged)
  useWebsiteLoader({
    websiteId,
    apiUrl,
    documentWriter,
    lastSavedEditorDataRef,
    publishedDataRef,
    clearHistoryForLoad,
    setLoading,
    setWebsite,
    setErrorMessage,
    setAllowedComponentIds,
    setPages,
    setActivePageId,
    setActivePreviewPageId,
    setElements,
    setPageSettings,
    setBreakpoints,
    setGlobalSettings,
    setPageCss,
    setHomePageId,
    setSiteParts,
    setPublishing,
    setDeployment,
    setGlobalVariables,
    setGlobalClasses,
  });

  // Single source of truth: canonicalPages ensures pages[activePageId] is always up-to-date synchronously
  const canonicalPages = useMemo(() => {
    return buildCanonicalPages({ pages, activePageId, canvasMode, elements, pageSettings });
  }, [pages, activePageId, canvasMode, elements, pageSettings]);

  // F-321 Autosave Integration
  const {
    status: autosaveStatus,
    lastSavedAt: autosaveLastSavedAt,
    errorMessage: autosaveError,
    updateBaseline: updateAutosaveBaseline,
    resetBaseline: resetAutosaveBaseline,
    hasUnsavedChanges: hasUnsavedDocumentChanges,
  } = useAutosave({
    websiteId,
    elements,
    pageSettings,
    pages: canonicalPages,
    homePageId,
    siteParts,
    globalSettings,
    globalStyles: globalSettings?.globalStyles,
    publishing,
    deployment,
    breakpoints,
    popups,
    pageCss,
    apiUrl,
    isLoadingWebsite: loading || !website || !userAccess.canEditContent || isDesignAssistantOpen || isUnifiedAiOpen,
    persistDocument,
  });

  // Real-Time Workspace Synchronization: see core/useWorkspaceSync (same position, so hook and effect order are unchanged)
  useWorkspaceSync({
    activePageId,
    hasUnsavedDocumentChanges,
    website,
    websiteId,
    apiUrl,
    documentWriter,
    lastSavedEditorDataRef,
    setSaveMessage,
    setWebsite,
    setPages,
    setActivePageId,
    setActivePreviewPageId,
    clearHistoryForLoad,
    setElements,
    setPageSettings,
    setBreakpoints,
    setHomePageId,
    resetAutosaveBaseline,
    siteParts,
    globalSettings,
    publishing,
    deployment,
    breakpoints,
    popups,
    pageCss,
  });

  // F-322 / F-334 Save & Update Template Integration
  const {
    isOpen: isSaveTemplateOpen,
    isUpdateMode: isSaveTemplateUpdateMode,
    name: saveTemplateName,
    setName: setSaveTemplateName,
    description: saveTemplateDescription,
    setDescription: setSaveTemplateDescription,
    type: saveTemplateType,
    setType: setSaveTemplateType,
    category: saveTemplateCategory,
    setCategory: setSaveTemplateCategory,
    isSaving: isSavingTemplate,
    error: saveTemplateError,
    validationError: saveTemplateValidationError,
    successMessage: saveTemplateSuccessMessage,
    openDialog: openSaveTemplateDialog,
    closeDialog: closeSaveTemplateDialog,
    handleSave: handleSaveTemplateSubmit,
  } = useSaveTemplate({ apiUrl });

  // F-335 & F-336 Website Kit Export & Import State & Logic
  const [isImportWebsiteKitOpen, setIsImportWebsiteKitOpen] = useState(false);

  const handleExportWebsiteKit = () => {
    try {
      exportWebsiteKitAsJson({
        website,
        elements,
        pageSettings,
        templates: libraryTemplates,
      });
      setSaveMessage("Website Kit exported successfully!");
      setTimeout(() => setSaveMessage(""), 3500);
    } catch (err: any) {
      setErrorMessage("Failed to export Website Kit.");
      setTimeout(() => setErrorMessage(""), 3500);
    }
  };

  const handleConfirmImportWebsiteKit = (kitData: {
    website: { name: string; description?: string; settings?: Record<string, any> };
    pages: Array<{
      id: string;
      title: string;
      path: string;
      elements: any[];
      pageSettings: Record<string, any>;
    }>;
    templates: any[];
  }) => {
    if (kitData.pages && kitData.pages.length > 0) {
      const importedPages: PageConfig[] = kitData.pages.map((p, idx) => ({
        id: p.id || `page_${idx + 1}`,
        name: p.title || `Page ${idx + 1}`,
        slug: p.path || (idx === 0 ? "/" : `/${p.title?.toLowerCase().replace(/\s+/g, "-")}`),
        elements: p.elements || [],
        pageSettings: p.pageSettings || {},
        isHome: idx === 0,
      }));
      setPages(importedPages);
      const mainPage = importedPages[0];
      setActivePageId(mainPage.id);
      setActivePreviewPageId(mainPage.id);
      setElements(JSON.parse(JSON.stringify(mainPage.elements || [])));
      if (mainPage.pageSettings) {
        setPageSettings((prev) => ({ ...prev, ...mainPage.pageSettings }));
      }
    }
    if (kitData.website?.name) {
      setWebsite((prev: any) => (prev ? { ...prev, name: kitData.website.name } : { name: kitData.website.name }));
    }
    setSaveMessage("Website Kit imported successfully!");
    setTimeout(() => setSaveMessage(""), 3500);
  };

  // F-501 / F-502: Reactive WordPress Page Import Listener
  useEffect(() => {
    const handleWpPageImported = (e: any) => {
      const data = e.detail;
      if (!data || !data.elements) return;

      const newPageId = data.forgePageId || `wp_${data.wordpressPageId || Date.now()}`;
      const importedPage: PageConfig = {
        id: newPageId,
        name: data.pageTitle || data.pageSettings?.title || "WordPress Page",
        slug: data.slug || data.pageSettings?.slug || `wp-${data.wordpressPageId}`,
        elements: data.elements,
        pageSettings: {
          title: data.pageTitle || data.pageSettings?.title || "WordPress Page",
          slug: data.slug || data.pageSettings?.slug || `wp-${data.wordpressPageId}`,
          status: data.status || "publish",
          wordpressPageId: data.wordpressPageId,
        },
      };

      setPages((prev: any[]) => {
        const existingIdx = prev.findIndex((p) => p.id === newPageId || (p.pageSettings as any)?.wordpressPageId === data.wordpressPageId);
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = { ...updated[existingIdx], ...importedPage };
          return updated;
        }
        return [...prev, importedPage];
      });

      setActivePageId(newPageId);
      setElements(data.elements);
      if (data.pageSettings) {
        setPageSettings((prev: any) => ({ ...prev, ...data.pageSettings, wordpressPageId: data.wordpressPageId }));
      }
      setSaveMessage(`Successfully imported "${data.pageTitle || "WordPress Page"}" into visual editor!`);
      setTimeout(() => setSaveMessage(""), 4000);
    };

    window.addEventListener("forgestudio:wp-page-imported", handleWpPageImported);
    return () => window.removeEventListener("forgestudio:wp-page-imported", handleWpPageImported);
  }, []);

  // F-332 Template Replacement State & Logic
  const { templates: libraryTemplates } = useTemplateLibrary({ apiUrl });
  const [isReplaceTemplateOpen, setIsReplaceTemplateOpen] = useState(false);

  const handleOpenReplaceTemplate = () => {
    if (!selectedId) {
      setSaveMessage("Please select an element or section to replace.");
      setTimeout(() => setSaveMessage(""), 3500);
      return;
    }
    setIsReplaceTemplateOpen(true);
  };

  const handleConfirmReplaceTemplate = (template: Template) => {
    if (!selectedId) return;

    const templateElements = template.templateData?.elements;
    if (!templateElements || !Array.isArray(templateElements) || templateElements.length === 0) {
      setSaveMessage("Selected template contains no elements.");
      setTimeout(() => setSaveMessage(""), 3500);
      return;
    }

    const cloneAndReassign = (list: EditorElement[]): EditorElement[] => {
      const cloned: EditorElement[] = JSON.parse(JSON.stringify(list));
      const reassignIds = (node: EditorElement): EditorElement => {
        const newNode: EditorElement = {
          ...node,
          id: generateId(),
        };
        if (newNode.children && Array.isArray(newNode.children)) {
          newNode.children = newNode.children.map(reassignIds);
        }
        return newNode;
      };
      return cloned.map(reassignIds);
    };

    const freshElements = cloneAndReassign(templateElements);

    const replaceTreeElement = (
      list: EditorElement[],
      targetId: string,
      replacements: EditorElement[]
    ): EditorElement[] => {
      const result: EditorElement[] = [];
      for (const item of list) {
        if (item.id === targetId) {
          result.push(...replacements);
        } else {
          const newItem = { ...item };
          if (newItem.children && Array.isArray(newItem.children)) {
            newItem.children = replaceTreeElement(newItem.children, targetId, replacements);
          }
          result.push(newItem);
        }
      }
      return result;
    };

    const updatedElements = replaceTreeElement(elements, selectedId, freshElements);

    setElements(updatedElements);

    if (freshElements.length > 0) {
      setSelectedId(freshElements[0].id);
      setSelectedIds([freshElements[0].id]);
    }

    setSaveMessage(`Replaced element with template "${template.name}" successfully!`);
    setTimeout(() => setSaveMessage(""), 3500);
  };


  // F-323 Template Library Insertion Logic
  const handleInsertTemplate = (template: Template) => {
    const templateElements = template.templateData?.elements;
    if (!templateElements || !Array.isArray(templateElements) || templateElements.length === 0) {
      setSaveMessage("Template contains no elements.");
      setTimeout(() => setSaveMessage(""), 3000);
      return;
    }

    // Deep clone template elements & recursively generate new unique IDs
    const cloneAndReassign = (list: EditorElement[]): EditorElement[] => {
      const cloned: EditorElement[] = JSON.parse(JSON.stringify(list));
      const reassignIds = (node: EditorElement): EditorElement => {
        const newNode: EditorElement = {
          ...node,
          id: generateId(),
        };
        if (newNode.children && Array.isArray(newNode.children)) {
          newNode.children = newNode.children.map(reassignIds);
        }
        return newNode;
      };
      return cloned.map(reassignIds);
    };

    const freshElements = cloneAndReassign(templateElements);
    let updatedElements = [...elements];
    let lastInsertedId: string | null = null;

    freshElements.forEach((el) => {
      updatedElements = insertTreeElement(updatedElements, selectedId, el);
      lastInsertedId = el.id;
    });

    setElements(updatedElements);

    if (lastInsertedId) {
      setSelectedId(lastInsertedId);
      setSelectedIds([lastInsertedId]);
    }

    setSaveMessage(`Inserted template "${template.name}" successfully!`);
    setTimeout(() => setSaveMessage(""), 3500);
  };

  // Atomic Editor Global Element Insertion
  const handleInsertGlobalElement = (globalElementId: string) => {
    const globalElements = GlobalElementService.getGlobalElements();
    const target = globalElements.find((ge) => ge.id === globalElementId);
    if (!target) return;

    const newEl: EditorElement = {
      id: generateId(),
      type: (target.elementType || "button") as ElementType,
      content: target.content || "",
      styles: target.styles ? { ...target.styles } : {},
      classes: target.classes ? [...target.classes] : [],
    };

    const effectiveTargetId = selectedId;
    setElements((prev) => insertTreeElement(prev, effectiveTargetId, newEl));
    setSelectedId(newEl.id);
    setSelectedIds([newEl.id]);
    setSaveMessage(`Inserted Global Element "${target.name}"!`);
    setTimeout(() => setSaveMessage(""), 3000);
  };

  // Atomic Editor Reusable Component Insertion
  const handleInsertReusableComponent = (componentId: string) => {
    const components = ReusableComponentService.getComponents();
    const target = components.find((c) => c.id === componentId);
    if (!target || !target.rootElement) return;

    const mapNodeToElement = (node: any): EditorElement => {
      return {
        id: generateId(),
        type: (node.type || "container") as ElementType,
        content: node.content || "",
        styles: node.styles ? { ...node.styles } : {},
        classes: node.classes ? [...node.classes] : [],
        children: node.children && Array.isArray(node.children) ? node.children.map(mapNodeToElement) : [],
      };
    };

    const rootEditorEl = mapNodeToElement(target.rootElement);
    const effectiveTargetId = selectedId;
    setElements((prev) => insertTreeElement(prev, effectiveTargetId, rootEditorEl));
    setSelectedId(rootEditorEl.id);
    setSelectedIds([rootEditorEl.id]);
    setSaveMessage(`Inserted Component "${target.name}"!`);
    setTimeout(() => setSaveMessage(""), 3000);
  };



  // F-PUBLISH: see core/usePublishWebsite (same position; a new function on every render, as before)
  const handlePublishWebsite = usePublishWebsite({
    websiteId,
    apiUrl,
    canvasMode,
    elements,
    siteParts,
    pages,
    activePageId,
    pageSettings,
    homePageId,
    deployment,
    breakpoints,
    globalSettings,
    popups,
    pageCss,
    publishing,
    setPublishing,
    setDeployment,
    publishedDataRef,
    setSaveMessage,
  });

  // Deployment rollback: see core/usePublishWebsite (same position; a new function on every render, as before)
  const handleRollbackDeployment = useRollbackDeployment({
    websiteId,
    apiUrl,
    setPublishing,
    setSaveMessage,
  });

  // Save Website Data: see core/useManualSave (same position; a new function on every render, as before)
  const handleSave = useManualSave({
    websiteId,
    website,
    userAccess,
    setSaving,
    setSaveMessage,
    setErrorMessage,
    canvasMode,
    elements,
    siteParts,
    pages,
    activePageId,
    pageSettings,
    homePageId,
    publishing,
    deployment,
    breakpoints,
    globalSettings,
    globalVariables,
    globalClasses,
    popups,
    pageCss,
    publishedDataRef,
    persistDocument,
    updateAutosaveBaseline,
  });

  // Element Actions
  const handleAddElement = (type: ElementType, targetId: string | null = null) => {
    if (disabledWidgets.includes(type)) return;
    const effectiveTargetId = targetId || selectedId;
    const newEl = createDefaultElement(type);
    if (newEl.type === "button") {
      const defaultPage = pages.find((p) => p.id === activePageId) || pages.find((p) => p.isHome || p.id === "home") || pages[0];
      if (defaultPage) {
        newEl.pageId = defaultPage.id;
        newEl.href = defaultPage.slug.startsWith("/") ? defaultPage.slug : `/${defaultPage.slug}`;
        newEl.linkUrl = newEl.href;
        newEl.destinationType = "page";
        newEl.linkType = "page";
        newEl.target = "_self";
      }
    }
    setElements((prev) => insertTreeElement(prev, effectiveTargetId, newEl));
    setSelectedId(newEl.id);
    setSelectedIds([newEl.id]);
  };

  const handleDropElement = (
    e: React.DragEvent,
    targetId: string | null = null,
    position: "before" | "after" | "inside" | null = null
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const dataString = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");

    let effectiveTargetId = targetId || dropTargetId;
    let effectivePosition: "before" | "after" | "inside" = position || dropPosition || "after";

    setDropTargetId(null);
    setDropPosition(null);
    setDraggingId(null);

    if (!effectiveTargetId && elements.length > 0) {
      let closestId: string | null = null;
      let minDist = Infinity;
      let calculatedPos: "before" | "after" = "after";

      const nodes = document.querySelectorAll("[data-el-id]");
      nodes.forEach((node) => {
        const id = node.getAttribute("data-el-id");
        if (!id) return;
        const rect = node.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const dist = Math.abs(e.clientY - midY);
        if (dist < minDist) {
          minDist = dist;
          closestId = id;
          calculatedPos = e.clientY < midY ? "before" : "after";
        }
      });

      if (closestId) {
        effectiveTargetId = closestId;
        effectivePosition = calculatedPos;
      }
    }

    if (!dataString) return;

    try {
      const data = JSON.parse(dataString);
      if (data.type === "template" && data.template) {
        handleInsertTemplate(data.template);
      } else if (data.type === "new" && data.widgetType) {
        if (disabledWidgets.includes(data.widgetType as ElementType)) return;
        const newEl = createDefaultElement(data.widgetType as ElementType);
        if (newEl.type === "button") {
          const defaultPage = pages.find((p) => p.id === activePageId) || pages.find((p) => p.isHome || p.id === "home") || pages[0];
          if (defaultPage) {
            newEl.pageId = defaultPage.id;
            newEl.href = defaultPage.slug.startsWith("/") ? defaultPage.slug : `/${defaultPage.slug}`;
            newEl.linkUrl = newEl.href;
            newEl.destinationType = "page";
            newEl.linkType = "page";
            newEl.target = "_self";
          }
        }
        setElements((prev) => insertTreeElementAtPosition(prev, effectiveTargetId, effectivePosition, newEl));
        setSelectedId(newEl.id);
        setSelectedIds([newEl.id]);
      } else if (data.type === "move" && data.id) {
        if (effectiveTargetId && (data.id === effectiveTargetId || isDescendant(elements, data.id, effectiveTargetId))) return;
        setElements((prev) => moveTreeElement(prev, data.id, effectiveTargetId, effectivePosition));
        setSelectedId(data.id);
        setSelectedIds([data.id]);
      }
    } catch (err) {
      console.error("Drag and drop parse error:", err);
    }
  };

  const handleCanvasAutoScroll = (e: React.DragEvent) => {
    const mainContainer = e.currentTarget.closest("main") || document.querySelector("main");
    if (!mainContainer) return;

    const rect = mainContainer.getBoundingClientRect();
    const edgeThreshold = 60;
    const scrollSpeed = 15;

    if (e.clientY - rect.top < edgeThreshold) {
      mainContainer.scrollTop -= scrollSpeed;
    } else if (rect.bottom - e.clientY < edgeThreshold) {
      mainContainer.scrollTop += scrollSpeed;
    }
  };

  const handleDragOverElement = (
    e: React.DragEvent,
    elId: string,
    isContainer: boolean
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = draggingId ? "move" : "copy";

    if (draggingId === elId || (draggingId && isDescendant(elements, draggingId, elId))) {
      setDropTargetId(null);
      setDropPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    let pos: "before" | "after" | "inside" = "after";
    if (isContainer) {
      if (offsetY < Math.min(height * 0.25, 30)) {
        pos = "before";
      } else if (offsetY > height - Math.min(height * 0.25, 30)) {
        pos = "after";
      } else {
        pos = "inside";
      }
    } else {
      if (offsetY < height * 0.5) {
        pos = "before";
      } else {
        pos = "after";
      }
    }

    setDropTargetId(elId);
    setDropPosition(pos);
  };

  const handleDeleteElement = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setElements((prev) => deleteTreeElement(prev, id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleDuplicateElement = (idToDuplicate?: string | null, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const targetId = idToDuplicate || selectedId;
    if (!targetId) return;

    const { updatedList, newId } = duplicateTreeElement(elements, targetId);
    setElements(updatedList);
    if (newId) {
      setSelectedId(newId);
    }
  };

  const handleCopyElement = (idToCopy?: string | null, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedIds.length > 1 && (!idToCopy || selectedIds.includes(idToCopy))) {
      const targets = selectedIds
        .map((id) => findTreeElement(elements, id))
        .filter((item): item is EditorElement => item !== null);
      if (targets.length > 0) {
        const clonedList: EditorElement[] = JSON.parse(JSON.stringify(targets));
        setCopiedElements(clonedList);
        setCopiedElement(clonedList[clonedList.length - 1]);
      }
      return;
    }

    const targetId = idToCopy || selectedId;
    if (!targetId) return;
    const targetEl = findTreeElement(elements, targetId);
    if (targetEl) {
      const cloned: EditorElement = JSON.parse(JSON.stringify(targetEl));
      setCopiedElement(cloned);
      setCopiedElements([cloned]);
    }
    void copiedElements;
  };

  const handleCopyStyle = (idToCopy?: string | null, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const targetId = idToCopy || selectedId;
    if (!targetId) return;
    const targetEl = findTreeElement(elements, targetId);
    if (targetEl) {
      setCopiedStyles({
        styles: JSON.parse(JSON.stringify(targetEl.styles || {})),
        responsiveStyles: JSON.parse(JSON.stringify(targetEl.responsiveStyles || {})),
        hoverStyles: targetEl.hoverStyles ? JSON.parse(JSON.stringify(targetEl.hoverStyles)) : undefined,
        responsiveHoverStyles: targetEl.responsiveHoverStyles ? JSON.parse(JSON.stringify(targetEl.responsiveHoverStyles)) : undefined,
      });
    }
  };

  const handlePasteStyle = (idToPaste?: string | null, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const targetId = idToPaste || selectedId;
    if (!targetId || !copiedStyles) return;
    setElements((prev) =>
      updateTreeElement(prev, targetId, (el) => ({
        ...el,
        styles: {
          ...el.styles,
          ...JSON.parse(JSON.stringify(copiedStyles.styles || {})),
        },
        responsiveStyles: {
          ...el.responsiveStyles,
          ...JSON.parse(JSON.stringify(copiedStyles.responsiveStyles || {})),
        },
        hoverStyles: copiedStyles.hoverStyles
          ? { ...el.hoverStyles, ...JSON.parse(JSON.stringify(copiedStyles.hoverStyles)) }
          : el.hoverStyles,
        responsiveHoverStyles: copiedStyles.responsiveHoverStyles
          ? { ...el.responsiveHoverStyles, ...JSON.parse(JSON.stringify(copiedStyles.responsiveHoverStyles)) }
          : el.responsiveHoverStyles,
      }))
    );
  };

  const handlePasteElement = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!copiedElement) return;

    const clonedItem: EditorElement = JSON.parse(JSON.stringify(copiedElement));
    const reassignIds = (node: EditorElement) => {
      node.id = generateId();
      if (node.children) {
        node.children.forEach(reassignIds);
      }
    };
    reassignIds(clonedItem);

    setElements((prev) => insertTreeElement(prev, selectedId, clonedItem));
    setSelectedId(clonedItem.id);
  };

  const updateElementContent = (id: string, newContent: string) => {
    setElements((prev) =>
      updateTreeElement(prev, id, (el) => ({ ...el, content: newContent }))
    );
  };

  // Keyboard Shortcuts Listener (F-025: Save, Delete, Preview, Undo, Redo, Copy, Paste, Duplicate, Section Move, F-027: Finder, F-031: Shortcuts Help)
  const [isFinderOpen, setIsFinderOpen] = useState(false);
  const [finderQuery, setFinderQuery] = useState("");
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);

  // Keyboard shortcuts (window keydown): see core/useEditorShortcuts, called after handleReorderElement

  // F-102 - F-141: Preview Mode Motion & Interaction Runtime
  useEffect(() => {
    if (isPreview) {
      const controller = initMotionRuntime(document);
      return () => {
        controller.cleanup();
      };
    }
  }, [isPreview, elements]);

  useEffect(() => {
    if (selectedElement && selectedElement.componentId) {
      syncComponentInstances(selectedElement.componentId, selectedElement);
    }
  }, [selectedElement?.content, selectedElement?.src, selectedElement?.styles, selectedElement?.layout, selectedElement?.responsiveStyles, selectedElement?.responsiveLayout]);

  const updateSelectedProp = (key: keyof EditorElement | string, value: any) => {
    if (!selectedId) return;
    setElements((prev) =>
      updateTreeElement(prev, selectedId, (el) => ({ ...el, [key]: value }))
    );
  };

  const updateElementProperties = (updater: (el: EditorElement) => EditorElement) => {
    if (!selectedId) return;
    setElements((prev) => updateTreeElement(prev, selectedId, updater));
  };

  const updateSelectedStyle = (key: keyof ElementStyles, value: any) => {
    if (!selectedId) return;
    setElements((prev) =>
      updateTreeElement(prev, selectedId, (el) => {
        if (activeElementState === "hover") {
          if (activeDevice === "desktop") {
            const newHoverStyles = { ...(el.hoverStyles || {}), [key]: value };
            let newResponsiveHover = el.responsiveHoverStyles;
            if (newResponsiveHover?.desktop) {
              newResponsiveHover = {
                ...newResponsiveHover,
                desktop: { ...newResponsiveHover.desktop, [key]: value },
              };
            }
            return { ...el, hoverStyles: newHoverStyles, responsiveHoverStyles: newResponsiveHover };
          } else {
            const currentDeviceObj = el.responsiveHoverStyles?.[activeDevice] || {};
            const updatedDeviceObj = { ...currentDeviceObj, [key]: value };
            return {
              ...el,
              responsiveHoverStyles: {
                ...el.responsiveHoverStyles,
                [activeDevice]: updatedDeviceObj,
              },
            };
          }
        } else {
          if (activeDevice === "desktop") {
            const newStyles = { ...el.styles, [key]: value };
            let newResponsive = el.responsiveStyles;
            if (newResponsive?.desktop) {
              newResponsive = {
                ...newResponsive,
                desktop: { ...newResponsive.desktop, [key]: value },
              };
            }
            return { ...el, styles: newStyles, responsiveStyles: newResponsive };
          } else {
            const currentDeviceObj = el.responsiveStyles?.[activeDevice] || {};
            const updatedDeviceObj = { ...currentDeviceObj, [key]: value };
            return {
              ...el,
              responsiveStyles: {
                ...el.responsiveStyles,
                [activeDevice]: updatedDeviceObj,
              },
            };
          }
        }
      })
    );
  };

  const resetSelectedStyle = (key: keyof ElementStyles) => {
    if (!selectedId) return;
    setElements((prev) =>
      updateTreeElement(prev, selectedId, (el) => {
        if (activeElementState === "hover") {
          if (activeDevice === "desktop") {
            const newHoverStyles = { ...(el.hoverStyles || {}) };
            delete newHoverStyles[key];
            let newResponsiveHover = el.responsiveHoverStyles;
            if (newResponsiveHover?.desktop) {
              const newDesktopResp = { ...newResponsiveHover.desktop };
              delete newDesktopResp[key];
              newResponsiveHover = { ...newResponsiveHover, desktop: newDesktopResp };
            }
            return {
              ...el,
              hoverStyles: Object.keys(newHoverStyles).length > 0 ? newHoverStyles : undefined,
              responsiveHoverStyles: newResponsiveHover,
            };
          } else {
            if (!el.responsiveHoverStyles?.[activeDevice]) return el;
            const currentDeviceObj = { ...el.responsiveHoverStyles[activeDevice] };
            delete currentDeviceObj[key];
            const newResponsiveHover = {
              ...el.responsiveHoverStyles,
              [activeDevice]: currentDeviceObj,
            };
            if (Object.keys(currentDeviceObj).length === 0) {
              delete newResponsiveHover[activeDevice];
            }
            return { ...el, responsiveHoverStyles: newResponsiveHover };
          }
        } else {
          if (activeDevice === "desktop") {
            const newStyles = { ...el.styles };
            delete newStyles[key];
            let newResponsive = el.responsiveStyles;
            if (newResponsive?.desktop) {
              const newDesktopResp = { ...newResponsive.desktop };
              delete newDesktopResp[key];
              newResponsive = { ...newResponsive, desktop: newDesktopResp };
            }
            return { ...el, styles: newStyles, responsiveStyles: newResponsive };
          } else {
            if (!el.responsiveStyles?.[activeDevice]) return el;
            const currentDeviceObj = { ...el.responsiveStyles[activeDevice] };
            delete currentDeviceObj[key];
            const newResponsive = {
              ...el.responsiveStyles,
              [activeDevice]: currentDeviceObj,
            };
            if (Object.keys(currentDeviceObj).length === 0) {
              delete newResponsive[activeDevice];
            }
            return { ...el, responsiveStyles: newResponsive };
          }
        }
      })
    );
  };

  // See inspector/typographySection.tsx (moved verbatim; same name and call sites)
  const renderTypographySection = () => buildTypographySection({
    activeDevice,
    activeElementState,
    handleOpenFontPicker,
    resetSelectedStyle,
    selectedElementAny,
    updateSelectedStyle,
  });

  const toggleContainerCollapse = (id: string) => {
    setCollapsedContainers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleReorderElement = (id: string, direction: "up" | "down") => {
    setElements((prev) => reorderTreeElement(prev, id, direction));
  };

  // Keyboard shortcuts: one window keydown listener, same handler and dependency list as before the
  // extraction; called here because the handler references the element actions declared above.
  useEditorShortcuts({
    selectedId,
    selectedIds,
    copiedElement,
    elements,
    historyIndex,
    history,
    isFullScreenCanvas,
    isPreview,
    saving,
    isShortcutsHelpOpen,
    isFinderOpen,
    setIsFinderOpen,
    setIsShortcutsHelpOpen,
    setIsFullScreenCanvas,
    setIsPreview,
    handleSave,
    handleDeleteElement,
    handleUndo,
    handleRedo,
    handleCopyElement,
    handlePasteElement,
    handleDuplicateElement,
    handleReorderElement,
  });


  // See navigator/navigatorTreeItem.tsx (moved verbatim; same name and call sites)
  const renderNavigatorTreeItem = (el: EditorElement, depth: number = 0, isLast: boolean = true): React.ReactNode => buildNavigatorTreeItem({
    activeDevice,
    collapsedContainers,
    handleCopyElement,
    handleDeleteElement,
    handleDuplicateElement,
    handleReorderElement,
    handleSelectElement,
    hoveredId,
    renderNavigatorTreeItem,
    selectedId,
    selectedIds,
    setHoveredId,
    toggleContainerCollapse,
  }, el, depth, isLast);

  const updateSelectedLayout = (key: keyof ContainerLayout, value: any) => {
    if (!selectedId) return;
    setElements((prev) =>
      updateTreeElement(prev, selectedId, (el) => {
        if (activeDevice === "desktop") {
          const newLayout = { ...(el.layout || {}), [key]: value };
          let newResponsiveLayout = el.responsiveLayout;
          if (newResponsiveLayout?.desktop) {
            newResponsiveLayout = {
              ...newResponsiveLayout,
              desktop: { ...newResponsiveLayout.desktop, [key]: value },
            };
          }
          return { ...el, layout: newLayout, responsiveLayout: newResponsiveLayout };
        } else {
          const currentDeviceObj = el.responsiveLayout?.[activeDevice] || {};
          const updatedDeviceObj = { ...currentDeviceObj, [key]: value };
          return {
            ...el,
            responsiveLayout: {
              ...el.responsiveLayout,
              [activeDevice]: updatedDeviceObj,
            },
          };
        }
      })
    );
  };





  const render4SideSpacingControl = (
    title: string,
    type: "margin" | "padding",
    isLinked: boolean,
    setIsLinked: (val: boolean) => void
  ) => {
    const topKey = (type === "margin" ? "marginTop" : "paddingTop") as keyof ElementStyles;
    const rightKey = (type === "margin" ? "marginRight" : "paddingRight") as keyof ElementStyles;
    const bottomKey = (type === "margin" ? "marginBottom" : "paddingBottom") as keyof ElementStyles;
    const leftKey = (type === "margin" ? "marginLeft" : "paddingLeft") as keyof ElementStyles;

    const handleSideChange = (sideKey: keyof ElementStyles, numVal: string, unitVal: string) => {
      const formattedVal = numVal.trim() === "" ? "" : `${numVal}${unitVal}`;
      if (isLinked) {
        updateSelectedStyle(topKey, formattedVal);
        updateSelectedStyle(rightKey, formattedVal);
        updateSelectedStyle(bottomKey, formattedVal);
        updateSelectedStyle(leftKey, formattedVal);
      } else {
        updateSelectedStyle(sideKey, formattedVal);
      }
    };

    const handleUnitChange = (newUnit: string) => {
      const applyUnit = (sideKey: keyof ElementStyles) => {
        if (!selectedElement) return;
        const cur = getControlStyleValue(selectedElement, activeDevice, activeElementState, sideKey);
        const parsed = parseSpacingUnit(String(cur || ""));
        if (parsed.num) {
          updateSelectedStyle(sideKey, `${parsed.num}${newUnit}`);
        }
      };
      applyUnit(topKey);
      applyUnit(rightKey);
      applyUnit(bottomKey);
      applyUnit(leftKey);
    };

    const handleResetAll = () => {
      resetSelectedStyle(topKey);
      resetSelectedStyle(rightKey);
      resetSelectedStyle(bottomKey);
      resetSelectedStyle(leftKey);
    };

    return (
      <SpacingControl
        title={title}
        type={type}
        isLinked={isLinked}
        setIsLinked={setIsLinked}
        selectedElement={selectedElement}
        activeDevice={activeDevice}
        activeElementState={activeElementState}
        handleSideChange={handleSideChange}
        handleUnitChange={handleUnitChange}
        handleResetAll={handleResetAll}
      />
    );
  };

  const [extractedColors, setExtractedColors] = useState<string[]>([]);

  useEffect(() => {
    if (selectedElement && (selectedElement.type === "image" || selectedElement.src)) {
      const srcToUse = selectedElement.src;
      if (srcToUse) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            canvas.width = 40;
            canvas.height = 40;
            ctx.drawImage(img, 0, 0, 40, 40);
            const imgData = ctx.getImageData(0, 0, 40, 40).data;
            const hexColors = new Set<string>();
            for (let i = 0; i < imgData.length; i += 16) {
              const r = imgData[i];
              const g = imgData[i + 1];
              const b = imgData[i + 2];
              const a = imgData[i + 3];
              if (a > 128) {
                const hex = "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
                hexColors.add(hex);
              }
              if (hexColors.size >= 5) break;
            }
            setExtractedColors(Array.from(hexColors));
          } catch {
            setExtractedColors([]);
          }
        };
        img.onerror = () => setExtractedColors([]);
        img.src = resolveImageUrl(srcToUse, apiUrl);
      } else {
        setExtractedColors([]);
      }
    } else {
      setExtractedColors([]);
    }
  }, [selectedElement?.id, selectedElement?.src]);

  // Image File Upload Logic
  const handleImageFileSelect = async (file: File) => {
    if (!file) return;

    const invalid = assetFileError(file, IMAGE_UPLOAD_RULE);
    if (invalid) {
      setUploadError(invalid);
      return;
    }

    setUploadError("");
    setIsUploading(true);

    try {
      const finalUrl = await uploadOrReadAsDataUrl(apiUrl, file, IMAGE_UPLOAD_RULE);

      if (finalUrl) {
        updateSelectedProp("src", finalUrl);
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err?.message || "Failed to process image file.");
    } finally {
      setIsUploading(false);
    }
  };

  // YouTube & Vimeo Embed Helpers (F-208 Video Widget)


  // Video File Upload Logic (F-208 Video Widget)
  const handleVideoFileSelect = async (file: File) => {
    if (!file) return;

    const invalid = assetFileError(file, VIDEO_UPLOAD_RULE);
    if (invalid) {
      setUploadError(invalid);
      return;
    }

    setUploadError("");
    setIsUploading(true);

    try {
      const finalUrl = await uploadOrReadAsDataUrl(apiUrl, file, VIDEO_UPLOAD_RULE);

      if (finalUrl) {
        updateSelectedProp("src", finalUrl);
      }
    } catch (err: any) {
      console.error("Video upload error:", err);
      setUploadError(err?.message || "Failed to process video file.");
    } finally {
      setIsUploading(false);
    }
  };

  // Video Poster Image Upload Logic (F-208 Video Widget)
  const handleVideoPosterSelect = async (file: File) => {
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      setUploadError("Please select a valid image file for video poster.");
      return;
    }

    setUploadError("");
    setIsUploading(true);

    try {
      let finalUrl = "";
      try {
        const formData = new FormData();
        formData.append("image", file);

        let uploadRes = await fetch(`${apiUrl}/api/v1/uploads/image`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalUrl = uploadData.url || uploadData?.data?.url || "";
        }
      } catch {
        // Fallback
      }

      if (!finalUrl) {
        finalUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read poster image."));
          reader.readAsDataURL(file);
        });
      }

      if (finalUrl) {
        updateSelectedProp("videoPoster", finalUrl);
      }
    } catch (err: any) {
      console.error("Poster upload error:", err);
      setUploadError(err?.message || "Failed to process poster image.");
    } finally {
      setIsUploading(false);
    }
  };

  // File & Asset Import Logic (F-014)
  const handleImportAsset = async (file: File) => {
    if (!file) return;

    const invalid = assetFileError(file, IMPORT_ASSET_RULE);
    if (invalid) {
      setUploadError(invalid);
      return;
    }

    setUploadError("");
    setIsUploading(true);

    try {
      const finalUrl = await uploadOrReadAsDataUrl(apiUrl, file, IMPORT_ASSET_RULE);

      // Store in local asset history
      recordImportedAsset(file, finalUrl);

      if (selectedId) {
        const selected = findTreeElement(elements, selectedId);
        if (selected && (selected.type === "image" || selected.type === "import-asset")) {
          updateSelectedProp("src", finalUrl);
          updateSelectedProp("href", finalUrl);
          return;
        }
      }

      const newAssetEl: EditorElement = buildImportedAssetElement(file, finalUrl, generateId());
      setElements((prev) => [...prev, newAssetEl]);
      setSelectedId(newAssetEl.id);
      setSelectedIds([newAssetEl.id]);
    } catch (err: any) {
      console.error("Asset import error:", err);
      setUploadError(err.message || "Failed to import asset.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImportAsset(e.dataTransfer.files[0]);
    }
  };

  const compileBackgroundAndBorderStyles = createBackgroundAndBorderStylesCompiler(apiUrl);


  // See inspector/positioningControls.tsx (moved verbatim; same name and call sites)
  const renderPositioningControls = () => buildPositioningControls({
    activeDevice,
    activeElementState,
    resetSelectedStyle,
    selectedElement,
    updateSelectedStyle,
  });

  const handleBgImageFileSelect = async (file: File) => {
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      setUploadError("Please select a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image size must be less than 5 MB.");
      return;
    }

    setUploadError("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);

      let uploadRes = await fetch(`${apiUrl}/api/v1/uploads/image`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!uploadRes.ok && uploadRes.status === 404) {
        uploadRes = await fetch(`${apiUrl}/api/uploads/image`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
      }

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData?.message || uploadData?.error?.message || "Failed to upload background image.");
      }

      const returnedUrl = uploadData.url || uploadData?.data?.url;
      if (returnedUrl) {
        updateSelectedStyle("backgroundImage", returnedUrl);
      } else {
        throw new Error("No image URL returned from server.");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err instanceof Error ? err.message : "Error uploading image.");
    } finally {
      setIsUploading(false);
    }
  };

  // See inspector/backgroundBorderControls.tsx (moved verbatim; same name and call sites)
  const renderBackgroundAndBorderControls = () => buildBackgroundAndBorderControls({
    activeDevice,
    activeElementState,
    bgFileInputRef,
    handleBgImageFileSelect,
    handleSampleColor,
    isBorderRadiusLinked,
    isUploading,
    resetSelectedStyle,
    selectedElement,
    setIsBorderRadiusLinked,
    updateSelectedStyle,
  });



  // Recursive Element Tree Renderer
  const renderElementTree = (el: EditorElement): React.ReactNode => {
    if (!el || !el.id || !el.type) return null;
    const isSelected = (selectedIds.includes(el.id) || selectedId === el.id) && !isPreview;
    const isEditingHoverState = isSelected && activeElementState === "hover";
    const mergedStyles = getMergedStyles(el, activeDevice, isEditingHoverState ? "hover" : "normal");

    const customAttrs = Array.isArray(el.customAttributes) ? el.customAttributes : [];
    const customAttrProps = customAttrs.reduce((acc, curr) => {
      if (curr.name && curr.name.trim()) acc[curr.name.trim()] = curr.value || "";
      return acc;
    }, {} as any);

    const motionAttrs = resolveMotionAttrs(el);
    const stickyStyles = resolveStickyStyles(el);

    if (el.type === "container") {
      // See canvas/elements/containerElement (moved verbatim)
      return renderContainerElement({
        customAttrProps,
        el,
        isSelected,
        mergedStyles,
        motionAttrs,
        stickyStyles,
        activeDevice,
        compileBackgroundAndBorderStyles,
        copiedStyles,
        draggingId,
        dropPosition,
        dropTargetId,
        elements,
        handleCanvasAutoScroll,
        handleCopyElement,
        handleCopyStyle,
        handleDeleteElement,
        handleDragOverElement,
        handleDropElement,
        handleDuplicateElement,
        handlePasteStyle,
        handleReorderElement,
        handleSaveAsComponent,
        handleSelectElement,
        hoveredId,
        isPreview,
        renderElementTree,
        setContextMenu,
        setDraggingId,
        setDropPosition,
        setDropTargetId,
        setSelectedId,
      });
    }

    const path = isSelected ? getElementBreadcrumbPath(elements, el.id) : null;

    const isHovered = hoveredId === el.id && !isSelected && !isPreview;
    const isDropTarget = dropTargetId === el.id && !isPreview;

    return (
      <div
        key={el.id}
        id={el.customId || undefined}
        {...customAttrProps}
        {...(isPreview ? motionAttrs : {})}
        data-el-id={el.id}
        draggable={!isPreview}
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData("application/json", JSON.stringify({ type: "move", id: el.id }));
          e.dataTransfer.effectAllowed = "move";
          if (!isPreview) handleSelectElement(el.id, e);
          setDraggingId(el.id);
        }}
        onDragOver={(e) => {
          handleCanvasAutoScroll(e);
          handleDragOverElement(e, el.id, false);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          if (dropTargetId === el.id) {
            setDropTargetId(null);
            setDropPosition(null);
          }
        }}
        onDrop={(e) => {
          handleDropElement(e, el.id, dropPosition);
        }}
        onDragEnd={(e) => {
          e.stopPropagation();
          setDraggingId(null);
          setDropTargetId(null);
          setDropPosition(null);
        }}
        {...customAttrProps}
        onClick={(e) => {
          e.stopPropagation();
          if (!isPreview) handleSelectElement(el.id, e);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isPreview) {
            handleSelectElement(el.id, e);
            setContextMenu({ x: e.clientX, y: e.clientY, elementId: el.id });
          }
        }}
        onMouseEnter={(e) => {
          e.stopPropagation();
          if (!isPreview) setHoveredId(el.id);
        }}
        onMouseLeave={(e) => {
          e.stopPropagation();
          if (!isPreview && hoveredId === el.id) setHoveredId(null);
        }}
        className={`relative transition duration-150 ${el.id} ${el.customClass || ""} ${draggingId === el.id ? "opacity-40 scale-[0.99]" : ""
          } ${isPreview
            ? ""
            : "cursor-grab active:cursor-grabbing hover:outline hover:outline-1 hover:outline-blue-400/60"
          } ${isSelected
            ? "border-2 border-blue-500 p-2.5"
            : isHovered
              ? "border border-blue-400 outline outline-2 outline-blue-400/80 p-2.5 shadow-sm"
              : "p-2.5 border border-transparent"
          } ${isDropTarget && dropPosition === "before"
            ? "border-t-4 border-t-blue-500"
            : isDropTarget && dropPosition === "after"
              ? "border-b-4 border-b-blue-500"
              : ""
          }`}
        style={{
          ...stickyStyles,
          boxSizing: "border-box",
          width: mergedStyles.width,
          height: mergedStyles.height,
          marginTop: mergedStyles.marginTop,
          marginRight: mergedStyles.marginRight,
          marginBottom: mergedStyles.marginBottom,
          marginLeft: mergedStyles.marginLeft,
          paddingTop: mergedStyles.paddingTop,
          paddingRight: mergedStyles.paddingRight,
          paddingBottom: mergedStyles.paddingBottom,
          paddingLeft: mergedStyles.paddingLeft,
          padding: mergedStyles.padding,
          backgroundColor: el.containerBg ? el.containerBg : el.type === "button" ? "transparent" : undefined,
          ...compileBackgroundAndBorderStyles(mergedStyles),
          ...compilePositioningStyles(mergedStyles),
          ...(el.type === "button" && el.containerBg ? { backgroundColor: el.containerBg } : {}),
        }}
      >
        {/* Drop Indicators for Leaf Element */}
        {isDropTarget && dropPosition === "before" && (
          <div className="absolute -top-1.5 left-0 right-0 h-1.5 bg-blue-600 rounded-full z-50 pointer-events-none shadow-md animate-pulse" />
        )}
        {isDropTarget && dropPosition === "after" && (
          <div className="absolute -bottom-1.5 left-0 right-0 h-1.5 bg-blue-600 rounded-full z-50 pointer-events-none shadow-md animate-pulse" />
        )}

        {isHovered && !isSelected && !isPreview && (
          <span className="absolute -top-3 left-3 z-30 rounded-full bg-blue-500/90 text-white px-2 py-0.5 text-[9px] font-bold shadow-sm pointer-events-none uppercase tracking-wider">
            {el.type}
          </span>
        )}

        {isSelected && (
          <div className="absolute -top-3.5 right-3 z-30 flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-0.5 text-[11px] font-semibold text-white shadow">
            {path && path.length > 1 ? (
              <span className="flex items-center gap-1">
                {path.map((item, idx) => (
                  <span key={item.id} className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(item.id);
                      }}
                      className={`capitalize hover:underline ${item.id === el.id ? "font-bold text-white" : "text-blue-200"
                        }`}
                    >
                      {item.type}
                    </button>
                    {idx < path.length - 1 && <span>›</span>}
                  </span>
                ))}
              </span>
            ) : (
              <span className="capitalize">{el.type}</span>
            )}
            <span>•</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReorderElement(el.id, "up");
              }}
              className="hover:underline"
              title="Move Element Up"
            >
              ▲
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReorderElement(el.id, "down");
              }}
              className="hover:underline"
              title="Move Element Down"
            >
              ▼
            </button>
            <span>•</span>
            <button
              onClick={(e) => handleCopyElement(el.id, e)}
              className="hover:underline"
            >
              Copy
            </button>
            <span>•</span>
            <button
              onClick={(e) => handleCopyStyle(el.id, e)}
              className="hover:underline"
              title="Copy Element Style"
            >
              Copy Style
            </button>
            {copiedStyles && (
              <>
                <span>•</span>
                <button
                  onClick={(e) => handlePasteStyle(el.id, e)}
                  className="hover:underline text-emerald-200 hover:text-white"
                  title="Paste Copied Style"
                >
                  Paste Style
                </button>
              </>
            )}
            <span>•</span>
            <button
              onClick={(e) => handleDuplicateElement(el.id, e)}
              className="hover:underline"
            >
              Duplicate
            </button>
            <span>•</span>
            <button
              onClick={(e) => handleDeleteElement(el.id, e)}
              className="hover:underline text-red-200 hover:text-white"
            >
              Delete
            </button>
          </div>
        )}

        {/* Element Renderers */}
        {/* See canvas/elements/textElements (moved verbatim) */}
        {renderTextElements({
          el,
          isSelected,
          mergedStyles,
          activePageId,
          globalSettings,
          handleSelectElement,
          isPreview,
          pageSettings,
          pages,
          updateElementContent,
          website,
        })}

        {/* See canvas/elements/mediaElements (moved verbatim) */}
        {renderMediaElements({
          el,
          mergedStyles,
          apiUrl,
          compileBackgroundAndBorderStyles,
          handlePreviewPageNavigate,
          handleSelectElement,
          isPreview,
          pages,
          setElements,
        })}

        {/* See canvas/elements/buttonElement (moved verbatim) */}
        {renderButtonElement({
          customAttrProps,
          el,
          mergedStyles,
          handlePreviewPageNavigate,
          handleSelectElement,
          isPreview,
          pages,
          setActivePopupId,
          updateElementContent,
        })}

        {/* See canvas/elements/dynamicContentElements (moved verbatim) */}
        {renderDynamicContentElements({
          el,
          mergedStyles,
          activeDevice,
          activePageId,
          activePreviewPageId,
          apiUrl,
          isPreview,
          pages,
          setActivePageId,
          setActivePreviewPageId,
        })}

        {/* See canvas/elements/widgetElements (moved verbatim) */}
        {renderWidgetElements({
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
        })}

        {/* See canvas/elements/navigationElements (moved verbatim) */}
        {renderNavigationElements({
          el,
          activeDevice,
          breakpoints,
          homePageId,
          isPreview,
          pages,
        })}

        {/* See canvas/elements/utilityElements (moved verbatim) */}
        {renderUtilityElements({
          el,
          mergedStyles,
          isPreview,
        })}

        {/* See canvas/elements/menuElements (moved verbatim) */}
        {renderMenuElements({
          el,
          mergedStyles,
          handlePreviewPageNavigate,
          isPreview,
          pages,
          renderElementTree,
          setElements,
        })}

        {/* See canvas/elements/wooCommerceElements (moved verbatim) */}
        {renderWooCommerceElements({
          el,
          mergedStyles,
          isPreview,
        })}

        {/* See canvas/elements/basicWidgetElements (moved verbatim) */}
        {renderBasicWidgetElements({
          el,
          apiUrl,
          isPreview,
        })}
      </div>
    );
  };

  // Render Loader
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] text-slate-600">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-xs font-semibold">Loading Website Editor...</p>
        </div>
      </div>
    );
  }

  if (!website) {
    return <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6" role="alert">
      <p>{errorMessage || "Website access could not be established."}</p>
      <Link to="/dashboard" className="underline">Return to dashboard</Link>
    </main>;
  }

  return (
    <WooCommerceProvider websiteId={websiteId}>
    <div className="flex h-screen flex-col overflow-hidden bg-[#f1f5f9] text-slate-800 font-sans">
      {/* ========================================== */}
      {/* Top Header Bar */}
      {/* ========================================== */}
      {!isFullScreenCanvas && (
        <header
          className={`relative w-full h-13 shrink-0 flex items-center justify-between px-3 md:px-4 shadow-md transition overflow-x-auto ${userPreferences.themeMode === "light"
            ? "bg-white border-b border-slate-200 text-slate-800"
            : "bg-[#0b1329] text-white"
            }`}
        >
          {/* 1. Left Region: Brand / Back / Breadcrumb & Page Selector */}
          {/* See shell/header/headerLeftRegion (moved verbatim) */}
          {renderHeaderLeftRegion({
            activePageId,
            canvasMode,
            handleQuickCreateOrSwitchPage,
            handleQuitEditor,
            handleSwitchCanvasMode,
            handleSwitchEditingPage,
            homePageId,
            isPageSelectorOpen,
            isScopeDropdownOpen,
            pages,
            scopeDropdownRef,
            setIsAddPageModalOpen,
            setIsPageManagerModalOpen,
            setIsPageSelectorOpen,
            setIsScopeDropdownOpen,
            setNewPageName,
            setNewPageSlug,
            website,
          })}

          {/* 2. Center Region: Viewport Switcher */}
          {/* See shell/header/headerCenterRegion (moved verbatim) */}
          {renderHeaderCenterRegion({
            activeDevice,
            setActiveDevice,
          })}

          {/* 3. Right Region: Compact Tools, History, Primary Actions */}
          {/* See shell/header/headerRightRegion (moved verbatim) */}
          {renderHeaderRightRegion({
            autosaveError,
            autosaveLastSavedAt,
            autosaveStatus,
            canvasPeers,
            canvasTheme,
            devModalMode,
            errorMessage,
            handleCopyElement,
            handleDuplicateElement,
            handleOpenReplaceTemplate,
            handleRedo,
            handleReorderElement,
            handleSave,
            handleSaveAsComponent,
            handleUndo,
            history,
            historyIndex,
            isDesignNotesOpen,
            isFullScreenCanvas,
            isPreview,
            isRestrictedMode,
            navigate,
            publishing,
            saveMessage,
            saving,
            selectedId,
            setCanvasTheme,
            setDevModalMode,
            setIsClassModalOpen,
            setIsDesignNotesOpen,
            setIsExperimentModalOpen,
            setIsFinderOpen,
            setIsFullScreenCanvas,
            setIsPreview,
            setIsPublishModalOpen,
            setIsRevisionHistoryOpen,
            setIsSeoModalOpen,
            setIsVariablesModalOpen,
            userAccess,
            websiteId,
          })}
        </header>
      )}

      {/* ========================================== */}
      {/* Main Workspace Body                         */}
      {/* ========================================== */}
      <div className="flex flex-1 overflow-hidden">
        {/* ========================================== */}
        {/* Left Sidebar: ELEMENTS                     */}
        {/* ========================================== */}
        {!isPreview && !isFullScreenCanvas && (
          <aside className="w-64 md:w-72 shrink-0 border-r border-slate-200 bg-white p-3.5 overflow-y-auto shadow-sm flex flex-col">
            {/* See shell/sidebar/sidebarTabBar (moved verbatim) */}
            {renderSidebarTabBar({
              leftSidebarTab,
              setLeftSidebarTab,
              t,
            })}

            {isRestrictedMode ? (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 text-center my-4 space-y-2">
                <Lock className="w-6 h-6 text-amber-600 mx-auto" />
                <span className="block text-xs font-bold text-amber-800">Widget Drawer Locked</span>
                <p className="text-[11px] text-amber-700 leading-snug">
                  Your Client Editor role allows editing text, images, and links directly on the canvas without adding new layout blocks.
                </p>
              </div>
            ) : leftSidebarTab === "elements" ? (
              <div className="space-y-3">
                {/* Main Widget Library Search Input */}
                {/* See shell/sidebar/widgetLibrarySearch (moved verbatim) */}
                {renderWidgetLibrarySearch({
                  disabledWidgets,
                  setWidgetLibrarySearch,
                  widgetLibrarySearch,
                })}

                {/* Import Asset Button (F-014) */}
                {/* See shell/sidebar/importAssetButton (moved verbatim) */}
                {renderImportAssetButton({
                  disabledWidgets,
                  handleImportAsset,
                  importFileInputRef,
                  isUploading,
                })}

                {/* Pinned Favorite Widgets & Reusable Components (F-012) */}
                {/* See shell/sidebar/favoriteWidgetsSection (moved verbatim) */}
                {renderFavoriteWidgetsSection({
                  components,
                  disabledWidgets,
                  favoriteWidgets,
                  handleAddElement,
                  handleAddInstanceFromComponent,
                  isWidgetLibraryVisible,
                  toggleFavoriteComponent,
                  toggleFavoriteWidget,
                  widgetLibrarySearch,
                })}

                {/* See shell/sidebar/widgetLibraryGrid (moved verbatim) */}
                {renderWidgetLibraryGrid({
                  favoriteWidgets,
                  handleAddElement,
                  isWidgetLibraryVisible,
                  toggleFavoriteWidget,
                })}

                {/* Reusable Components Section (F-005) */}
                {/* See shell/sidebar/reusableComponentsSection (moved verbatim) */}
                {renderReusableComponentsSection({
                  components,
                  disabledWidgets,
                  handleAddInstanceFromComponent,
                  toggleFavoriteComponent,
                  widgetLibrarySearch,
                })}
              </div>
            ) : leftSidebarTab === "navigator" ? (
              /* See shell/sidebar/navigatorPanel (moved verbatim) */ renderNavigatorPanel({
                elements,
                handleSelectElement,
                renderNavigatorTreeItem,
                selectedId,
                selectedIds,
                setStructureSearchQuery,
                structureSearchQuery,
              })
            ) : leftSidebarTab === ("atomic" as any) ? (
              <AtomicEditor
                onClose={() => setLeftSidebarTab("elements")}
                onInsertGlobalElement={handleInsertGlobalElement}
                onInsertComponent={handleInsertReusableComponent}
              />
            ) : (
              <TemplateLibrary
                apiUrl={apiUrl}
                onInsertTemplate={handleInsertTemplate}
                onOpenSaveTemplate={openSaveTemplateDialog}
              />
            )}

          </aside>
        )}

        {/* ========================================== */}
        {/* Center: White Canvas Container              */}
        {/* ========================================== */}
        <main
          data-theme={canvasTheme}
          onClick={() => handleSelectElement(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            broadcastCursor(e.clientX - rect.left, e.clientY - rect.top);
          }}
          onDragOver={(e) => {
            if (isRestrictedMode) return;
            e.preventDefault();
            handleCanvasAutoScroll(e);
            e.dataTransfer.dropEffect = draggingId ? "move" : "copy";
          }}
          onDrop={(e) => (isRestrictedMode ? undefined : handleDropElement(e, null, "after"))}
          className={`relative flex flex-1 justify-center items-start overflow-y-auto overflow-x-auto min-w-0 max-w-full ${canvasTheme === "dark" ? "bg-slate-950 text-slate-100" : "bg-[#f1f5f9]"
            } p-4 sm:p-8 box-border`}
        >
          {/* Dynamic Hover Styles Block (F-036) */}
          <style dangerouslySetInnerHTML={{ __html: generateElementsHoverCSS(elements, activeDevice) }} />

          {/* Live Real-time Multi-Cursor Overlays */}
          {canvasPeers.map((peer) => {
            if (!peer.cursor) return null;
            return (
              <div
                key={`cursor-${peer.socketId}`}
                className="pointer-events-none absolute z-50 transition-all duration-75 ease-out"
                style={{
                  left: `${peer.cursor.x}px`,
                  top: `${peer.cursor.y}px`,
                }}
              >
                <svg
                  className="w-4 h-4 drop-shadow-md"
                  viewBox="0 0 24 24"
                  fill={peer.user.color}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                >
                  <path d="M5.653 3.123A1 1 0 0 0 4.19 4.316l3.5 14.5a1 1 0 0 0 1.838.256l3.224-6.448 6.448-3.224a1 1 0 0 0 .256-1.838l-14.5-3.5z" />
                </svg>
                <div
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-md whitespace-nowrap ml-3 -mt-2"
                  style={{ backgroundColor: peer.user.color }}
                >
                  {peer.user.name}
                </div>
              </div>
            );
          })}

          {/* Floating Exit Full Screen Overlay Button (F-015) */}
          {isFullScreenCanvas && (
            <div className="absolute top-4 right-6 z-50">
              <button
                type="button"
                onClick={() => setIsFullScreenCanvas(false)}
                className="flex items-center gap-1.5 rounded-full bg-slate-900/90 text-white px-4 py-2 text-xs font-bold shadow-lg border border-slate-700 hover:bg-black hover:scale-105 transition"
                title="Exit Full Screen Mode (Esc)"
              >
                <span>✕</span>
                <span>Exit Full Screen (Esc)</span>
              </button>
            </div>
          )}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCanvasAutoScroll(e);
              e.dataTransfer.dropEffect = draggingId ? "move" : "copy";
            }}
            onDrop={(e) => handleDropElement(e, null, "after")}
            style={{
              backgroundColor: pageSettings.backgroundColor || "#ffffff",
              backgroundImage: userPreferences.gridOverlay
                ? "linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)"
                : undefined,
              backgroundSize: userPreferences.gridOverlay ? "20px 20px" : undefined,
              width: activeDevice === "mobile" ? "380px" : activeDevice === "tablet" ? "520px" : "100%",
              maxWidth: activeDevice === "mobile" ? "380px" : activeDevice === "tablet" ? "min(520px, 90%)" : "100%",
            }}
            className={`relative transition-all duration-300 ease-in-out min-h-[750px] h-auto shrink-0 my-2 rounded-2xl border border-slate-200 p-6 sm:p-8 pb-20 box-border overflow-x-hidden ${activeDevice !== "desktop" ? "ring-1 ring-slate-300 shadow-md" : "shadow-sm"
              }`}
          >
            {/* Global Design Tokens / CSS Variables (Comment 14) */}
            <style>{`
              :root {
                --forge-primary: ${globalSettings?.globalStyles?.primaryColor || "#3b82f6"};
                --forge-secondary: ${globalSettings?.globalStyles?.secondaryColor || "#64748b"};
                --forge-accent: ${globalSettings?.globalStyles?.accentColor || "#10b981"};
                --forge-text: ${globalSettings?.globalStyles?.textColor || "#1e293b"};
                --forge-bg: ${globalSettings?.globalStyles?.backgroundColor || "#ffffff"};
                --forge-font-heading: ${globalSettings?.globalStyles?.headingFont || "inherit"};
                --forge-font-body: ${globalSettings?.globalStyles?.bodyFont || "inherit"};
                --forge-btn-radius: ${globalSettings?.globalStyles?.buttonBorderRadius || "6px"};
              }
            `}</style>

            {/* Dynamic Website Navigation Header in Preview Mode */}
            {isPreview ? (
              <div className="space-y-6">
                <header className="sticky top-0 z-30 w-full rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur-md shadow-sm transition-all overflow-hidden">
                  <div className="flex items-center justify-between px-4 sm:px-6 py-3">
                    {/* Website Brand / Logo */}
                    <div
                      className="flex items-center gap-2.5 cursor-pointer"
                      onClick={() => {
                        const homePage = pages.find((p) => p.isHome || p.id === homePageId || p.slug === "/") || pages[0];
                        if (homePage) handlePreviewPageNavigate(homePage);
                      }}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xs shadow-md">
                        {(website?.name || pageSettings?.title || "W").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-extrabold tracking-tight text-slate-900 block leading-tight">
                          {globalSettings?.siteIdentity?.name || website?.name || "My Website"}
                        </span>
                        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Website Preview
                        </span>
                      </div>
                    </div>

                    {/* Desktop Navigation Links */}
                    {pages.length > 0 && (
                      <nav className="hidden sm:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70">
                        {pages.map((p) => {
                          const isCurrent = (activePreviewPageId || pages[0]?.id) === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handlePreviewPageNavigate(p)}
                              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${isCurrent
                                ? "bg-white text-blue-600 shadow-sm border border-slate-200/60 font-extrabold"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                }`}
                            >
                              {p.name || p.pageSettings?.title || "Untitled"}
                            </button>
                          );
                        })}
                      </nav>
                    )}

                    {/* Mobile Hamburger Toggle Button */}
                    {pages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="sm:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                        aria-label="Toggle Navigation Menu"
                      >
                        <span className="text-sm">{mobileMenuOpen ? "✕" : "☰"}</span>
                      </button>
                    )}
                  </div>

                  {/* Mobile Dropdown Menu Drawer */}
                  {mobileMenuOpen && pages.length > 0 && (
                    <div className="sm:hidden border-t border-slate-200 bg-slate-50 p-2.5 space-y-1 animate-fadeIn">
                      {pages.map((p) => {
                        const isCurrent = (activePreviewPageId || pages[0]?.id) === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              handlePreviewPageNavigate(p);
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center justify-between ${isCurrent
                              ? "bg-blue-600 text-white font-extrabold shadow-sm"
                              : "text-slate-700 hover:bg-slate-200/70"
                              }`}
                          >
                            <span>{p.name || p.pageSettings?.title || "Untitled"}</span>
                            <span className="text-[10px] opacity-70 font-mono">{p.slug}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </header>

                {/* Currently Selected Preview Page Content */}
                {(() => {
                  const currentPreviewPage = pages.find((p) => p.id === activePreviewPageId) || pages[0];
                  const activeElements = currentPreviewPage?.id === activePageId ? elements : (currentPreviewPage?.elements || []);

                  if (pageSettings.isMaintenanceMode) {
                    return (
                      <div className="flex min-h-[450px] flex-col items-center justify-center rounded-2xl bg-amber-50/60 border border-amber-200/80 p-8 text-center shadow-inner my-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-md mb-4 animate-pulse">
                          <span className="text-3xl">🛠️</span>
                        </div>
                        <span className="inline-block rounded-full bg-amber-200/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-2">
                          Temporary Maintenance State
                        </span>
                        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                          Website Under Maintenance
                        </h2>
                        <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-600">
                          This website is currently undergoing scheduled maintenance and upgrades. Please check back shortly!
                        </p>
                        <div className="mt-6 flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => setIsPreview(false)}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-black transition"
                          >
                            Return to Editor
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-6 py-2">
                      {/* Global Header in Preview (Comment 5, 21) */}
                      {(siteParts.header?.enabled ?? siteParts.header?.isEnabled ?? true) &&
                        matchesThemeCondition(siteParts.header?.conditions, {
                          pageId: currentPreviewPage?.id,
                          isHome: currentPreviewPage?.isHome,
                          slug: currentPreviewPage?.slug,
                        }) && (
                          <div className="site-global-header border-b border-slate-100 pb-4 mb-4">
                            {siteParts.header?.elements && siteParts.header.elements.length > 0 ? (
                              siteParts.header.elements.map((el) => renderElementTree(el))
                            ) : (
                              <DefaultWebsiteNavbar
                                websiteName={website?.name || globalSettings?.siteIdentity?.name || "ForgeStudio"}
                                pages={pages}
                                activePageId={currentPreviewPage?.id || activePageId}
                                isPreview={true}
                                activeDevice={activeDevice}
                                onNavigatePage={(targetPage) => handlePreviewPageNavigate(targetPage)}
                                onEditHeader={() => {
                                  setIsPreview(false);
                                  handleSwitchCanvasMode("header");
                                }}
                              />
                            )}
                          </div>
                        )}

                      {/* Active Page Elements */}
                      <div className="site-page-content">
                        {(!activeElements || activeElements.length === 0) ? (
                          <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-center p-8 bg-slate-50/50">
                            <p className="text-sm font-bold text-slate-700">
                              Page "{currentPreviewPage?.name || "Untitled"}" is Empty
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              Switch back to the editor to add elements to this page.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {activeElements.map((el) => renderElementTree(el))}
                          </div>
                        )}
                      </div>

                      {/* Global Footer in Preview (Comment 5, 21) */}
                      {(siteParts.footer?.enabled ?? siteParts.footer?.isEnabled ?? true) &&
                        matchesThemeCondition(siteParts.footer?.conditions, {
                          pageId: currentPreviewPage?.id,
                          isHome: currentPreviewPage?.isHome,
                          slug: currentPreviewPage?.slug,
                        }) && (
                          <div className="site-global-footer border-t border-slate-100 pt-6 mt-10">
                            {siteParts.footer?.elements && siteParts.footer.elements.length > 0 ? (
                              siteParts.footer.elements.map((el) => renderElementTree(el))
                            ) : (
                              <div className="py-6 text-center text-xs text-slate-500">
                                © {new Date().getFullYear()} {website?.name || globalSettings?.siteIdentity?.name || "ForgeStudio"}. All rights reserved.
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <>
                {/* Canvas Target Banner: Header Mode */}
                {canvasMode === "header" && (
                  <div className="flex items-center justify-between border-b-2 border-purple-500 bg-purple-50/90 rounded-xl px-4 py-3 mb-6 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🌐</span>
                      <div>
                        <span className="text-xs font-bold text-purple-900 block">
                          Editing Shared Global Header
                        </span>
                        <span className="text-[10px] text-purple-600 block">
                          Changes made here appear across all pages in the website.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchCanvasMode("page")}
                      className="text-xs font-bold text-purple-700 hover:text-purple-900 bg-white hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-300 transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>←</span>
                      <span>Back to Page ({pages.find((p) => p.id === activePageId)?.name || "Page"})</span>
                    </button>
                  </div>
                )}

                {/* Canvas Target Banner: Footer Mode */}
                {canvasMode === "footer" && (
                  <div className="flex items-center justify-between border-b-2 border-purple-500 bg-purple-50/90 rounded-xl px-4 py-3 mb-6 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🌐</span>
                      <div>
                        <span className="text-xs font-bold text-purple-900 block">
                          Editing Shared Global Footer
                        </span>
                        <span className="text-[10px] text-purple-600 block">
                          Changes made here appear across all pages in the website.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchCanvasMode("page")}
                      className="text-xs font-bold text-purple-700 hover:text-purple-900 bg-white hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-300 transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>←</span>
                      <span>Back to Page ({pages.find((p) => p.id === activePageId)?.name || "Page"})</span>
                    </button>
                  </div>
                )}

                {/* Canvas Target Banner: Single Post Template Mode */}
                {canvasMode === "single" && (
                  <div className="flex items-center justify-between border-b-2 border-indigo-500 bg-indigo-50/90 rounded-xl px-4 py-3 mb-6 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">📰</span>
                      <div>
                        <span className="text-xs font-bold text-indigo-900 block">
                          Editing Single Post Template (F-237)
                        </span>
                        <span className="text-[10px] text-indigo-600 block">
                          Dynamic layout applied when viewing individual blog posts or articles (/post/:slug).
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchCanvasMode("page")}
                      className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-300 transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>←</span>
                      <span>Back to Page</span>
                    </button>
                  </div>
                )}

                {/* Canvas Target Banner: Archive Template Mode */}
                {canvasMode === "archive" && (
                  <div className="flex items-center justify-between border-b-2 border-emerald-500 bg-emerald-50/90 rounded-xl px-4 py-3 mb-6 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">📚</span>
                      <div>
                        <span className="text-xs font-bold text-emerald-900 block">
                          Editing Archive Template (F-238)
                        </span>
                        <span className="text-[10px] text-emerald-600 block">
                          Layout applied to category listings, taxonomy archives, and blog indexes (/archive.html).
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchCanvasMode("page")}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-white hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-300 transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>←</span>
                      <span>Back to Page</span>
                    </button>
                  </div>
                )}

                {/* Canvas Target Banner: 404 Template Mode */}
                {canvasMode === "404" && (
                  <div className="flex items-center justify-between border-b-2 border-amber-500 bg-amber-50/90 rounded-xl px-4 py-3 mb-6 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">⚠️</span>
                      <div>
                        <span className="text-xs font-bold text-amber-900 block">
                          Editing 404 Error Template (F-239)
                        </span>
                        <span className="text-[10px] text-amber-600 block">
                          Layout displayed when visitors navigate to invalid URLs or unlisted routes (/404.html).
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchCanvasMode("page")}
                      className="text-xs font-bold text-amber-700 hover:text-amber-900 bg-white hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300 transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>←</span>
                      <span>Back to Page</span>
                    </button>
                  </div>
                )}

                {/* Canvas Target Banner: Search Results Template Mode */}
                {canvasMode === "search-results" && (
                  <div className="flex items-center justify-between border-b-2 border-blue-500 bg-blue-50/90 rounded-xl px-4 py-3 mb-6 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🔍</span>
                      <div>
                        <span className="text-xs font-bold text-blue-900 block">
                          Editing Search Results Template (F-240)
                        </span>
                        <span className="text-[10px] text-blue-600 block">
                          Layout presented when visitors search site content (/search.html?q=...).
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchCanvasMode("page")}
                      className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-300 transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>←</span>
                      <span>Back to Page</span>
                    </button>
                  </div>
                )}

                {/* Blank Page Layout Bar (F-016) - Page Mode */}
                {canvasMode === "page" && (
                  <>
                    {/* Shared Global Header & Navigation in Page Mode Canvas (Only rendered if custom header elements exist) */}
                    {(siteParts.header?.enabled ?? siteParts.header?.isEnabled ?? true) && siteParts.header?.elements && siteParts.header.elements.length > 0 && (
                      <div className="mb-6 rounded-2xl border border-dashed border-purple-300/80 bg-purple-50/20 p-2.5 transition hover:border-purple-400">
                        <div className="flex items-center justify-between pb-2 border-b border-purple-200/50 mb-2 px-1">
                          <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                            <span>🌐</span>
                            <span>Website Header & Navigation (Shared Across Pages)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSwitchCanvasMode("header")}
                            className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 bg-white hover:bg-purple-100 px-2.5 py-1 rounded-md border border-purple-300 transition shadow-2xs flex items-center gap-1 cursor-pointer"
                            title="Customize Header & Navigation"
                          >
                            <span>✏️</span>
                            <span>Edit Header</span>
                          </button>
                        </div>
                        <div className="space-y-3">
                          {siteParts.header.elements.map((el) => renderElementTree(el))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Elements Tree Rendering */}
                {elements.length === 0 ? (
                  <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-center p-8">
                    <p className="text-sm font-bold text-slate-700">
                      {canvasMode === "header"
                        ? "Global Header is Empty"
                        : canvasMode === "footer"
                          ? "Global Footer is Empty"
                          : canvasMode === "single"
                            ? "Single Post Template is Empty"
                            : canvasMode === "archive"
                              ? "Archive Template is Empty"
                              : canvasMode === "404"
                                ? "404 Not Found Template is Empty"
                                : canvasMode === "search-results"
                                  ? "Search Results Template is Empty"
                                  : "Your Page Canvas is Empty"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {canvasMode === "header"
                        ? "Add navigation menu, logo, buttons, or links from the left panel."
                        : canvasMode === "footer"
                          ? "Add footer links, copyright text, or social icons from the left panel."
                          : canvasMode === "single"
                            ? "Add post title, breadcrumbs, excerpt, or post navigation."
                            : canvasMode === "archive"
                              ? "Add taxonomy filter, archive title, or post cards."
                              : canvasMode === "404"
                                ? "Add 404 message, homepage link, or search bar."
                                : canvasMode === "search-results"
                                  ? "Add search input, results layout, or query heading."
                                  : "Click any element from the left panel to start building."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 w-full max-w-full box-border overflow-x-hidden">
                    {elements.map((el) => renderElementTree(el))}
                  </div>
                )}

                {/* Shared Global Footer in Page Mode Canvas (Only rendered if custom footer elements exist) */}
                {canvasMode === "page" && (siteParts.footer?.enabled ?? siteParts.footer?.isEnabled ?? true) && siteParts.footer?.elements && siteParts.footer.elements.length > 0 && (
                  <div className="mt-8 rounded-2xl border border-dashed border-purple-300/80 bg-purple-50/20 p-2.5 transition hover:border-purple-400">
                    <div className="flex items-center justify-between pb-2 border-b border-purple-200/50 mb-2 px-1">
                      <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span>🌐</span>
                        <span>Website Footer (Shared Across Pages)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSwitchCanvasMode("footer")}
                        className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 bg-white hover:bg-purple-100 px-2.5 py-1 rounded-md border border-purple-300 transition shadow-2xs flex items-center gap-1 cursor-pointer"
                        title="Customize Footer"
                      >
                        <span>✏️</span>
                        <span>Edit Footer</span>
                      </button>
                    </div>
                    <div className="space-y-3">
                      {siteParts.footer.elements.map((el) => renderElementTree(el))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* ========================================== */}
        {/* Right Sidebar: SETTINGS & STYLING           */}
        {/* ========================================== */}
        {!isPreview && (
          <aside className="w-80 shrink-0 border-l border-slate-200 bg-white p-5 overflow-y-auto shadow-sm">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              {isRestrictedMode ? "CONTENT-ONLY SANDBOX" : "SETTINGS & STYLING"}
            </h2>

            {isRestrictedMode ? (
              <ContentOnlyInspector
                element={selectedElementAny}
                onUpdateElement={(id, updates) => {
                  setElements((prev) => updateTreeElement(prev, id, (el) => ({ ...el, ...updates })));
                }}
                onTriggerImagePicker={(callback) => {
                  triggerImagePicker(callback);
                }}
              />
            ) : (
              <>
                {selectedIds.length > 1 && (
                  <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 p-2 text-center text-xs font-semibold text-blue-700">
                    Multi-Select ({selectedIds.length} elements selected)
                  </div>
                )}

                {selectedElementAny ? (
                  <div className="space-y-5">
                    {/* Element Type Header & Quick Actions */}
                    {/* See inspector/selected/elementTypeHeader (moved verbatim) */}
                    {renderElementTypeHeader({
                      copiedStyles,
                      handleCopyStyle,
                      handleDeleteElement,
                      handleDuplicateElement,
                      handlePasteStyle,
                      selectedElementAny,
                    })}

                    {/* Element State Selector (F-036) */}
                    {/* See inspector/selected/elementStateSelector (moved verbatim) */}
                    {renderElementStateSelector({
                      activeElementState,
                      setActiveElementState,
                    })}

                    {/* Container Specific Layout Controls (Flexbox & CSS Grid) */}
                    {/* See inspector/selected/containerLayoutControls (moved verbatim) */}
                    {renderContainerLayoutControls({
                      activeDevice,
                      selectedElementAny,
                      updateSelectedLayout,
                    })}

                    {/* Universal Sizing, Background & Spacing Controls (For ALL Elements) (F-002, F-035, F-052) */}
                    {/* See inspector/selected/universalSizingControls (moved verbatim) */}
                    {renderUniversalSizingControls({
                      activeDevice,
                      activeElementState,
                      handleSampleColor,
                      isMarginLinked,
                      isPaddingLinked,
                      render4SideSpacingControl,
                      resetSelectedStyle,
                      selectedElementAny,
                      setIsMarginLinked,
                      setIsPaddingLinked,
                      updateSelectedLayout,
                      updateSelectedProp,
                      updateSelectedStyle,
                    })}

                    {/* Posts Specific Layout & Content Controls (F-174) */}
                    {/* See inspector/selected/postsControls (moved verbatim) */}
                    {renderPostsControls({
                      selectedElementAny,
                      updateSelectedProp,
                    })}

                    {/* Image Widget Specific Inspector */}
                    {/* See inspector/selected/widgetInspectorSlots (moved verbatim) */}
                    {renderWidgetInspectorSlots({
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
                    })}


                    {/* See inspector/selected/nonContainerSpacingSection (moved verbatim) */}
                    {renderNonContainerSpacingSection({
                      selectedElementAny,
                      updateSelectedProp,
                    })}

                    {/* Smart Link & URL Controls */}
                    {/* See inspector/selected/smartLinkControls (moved verbatim) */}
                    {renderSmartLinkControls({
                      popups,
                      selectedElementAny,
                      updateSelectedProp,
                    })}

                    {/* 1. Typography & Colors Accordion */}
                    {/* See inspector/selected/typographyAccordion (moved verbatim) */}
                    {renderTypographyAccordion({
                      activeDevice,
                      activeElementState,
                      handleOpenFontPicker,
                      renderAccordion,
                      renderResponsiveLabel,
                      resetSelectedStyle,
                      selectedElementAny,
                      updateSelectedStyle,
                    })}

                    {/* 2. Borders & Radius Accordion */}
                    {/* See inspector/selected/bordersAccordion (moved verbatim) */}
                    {renderBordersAccordion({
                      activeDevice,
                      activeElementState,
                      renderAccordion,
                      resetSelectedStyle,
                      selectedElementAny,
                      updateSelectedStyle,
                    })}

                    {/* 3. Box Shadow & Effects Accordion */}
                    {/* See inspector/selected/boxShadowAccordion (moved verbatim) */}
                    {renderBoxShadowAccordion({
                      activeDevice,
                      activeElementState,
                      renderAccordion,
                      selectedElementAny,
                      updateSelectedStyle,
                    })}

                    {/* 4. Scroll Snap & Overflow (F-050) Accordion — if applicable */}
                    {/* See inspector/selected/scrollSnapAccordion (moved verbatim) */}
                    {renderScrollSnapAccordion({
                      activeDevice,
                      activeElementState,
                      renderAccordion,
                      resetSelectedStyle,
                      selectedElementAny,
                      updateSelectedStyle,
                    })}

                    {/* 5. Motion & Interaction Accordion — ALWAYS LAST */}
                    {/* See inspector/selected/motionAccordion (moved verbatim) */}
                    {renderMotionAccordion({
                      renderAccordion,
                      selectedElementAny,
                      updateSelectedProp,
                      updateSelectedStyle,
                    })}
                  </div>
                ) : activeSidebarTab === "advanced" && selectedElementAny ? (
                  <div className="space-y-4">
                    {/* Developer Options for Element (F-102, F-105 to F-109) */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700">Custom CSS ID (F-105)</label>
                        <input type="text" value={selectedElementAny.customId || ""} onChange={e => updateSelectedProp("customId", e.target.value)} placeholder="e.g. hero-section" className="w-full rounded border px-2 py-1.5 text-xs font-mono mt-1" />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700">Additional CSS Classes (F-106)</label>
                        <input type="text" value={selectedElementAny.customClass || ""} onChange={e => updateSelectedProp("customClass", e.target.value)} placeholder="e.g. shadow-lg hover:shadow-xl" className="w-full rounded border px-2 py-1.5 text-xs font-mono mt-1" />
                      </div>
                      <hr className="border-slate-200" />
                      <button onClick={() => setDevModalMode("element-css")} className="w-full rounded-lg bg-white border border-slate-300 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-2">
                        <span className="text-blue-500">{"</>"}</span> Edit Element CSS (F-102)
                      </button>
                      <button onClick={() => setDevModalMode("css-selectors")} className="w-full rounded-lg bg-white border border-slate-300 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-2">
                        <span className="text-pink-500">{""}</span> Edit Selectors & Pseudo (F-107)
                      </button>
                      <button onClick={() => setDevModalMode(selectedElementAny.type === "button" ? "custom-attributes" : "custom-attributes")} className="w-full rounded-lg bg-white border border-slate-300 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-2">
                        <span className="text-emerald-500">{""}</span> Manage DOM Attributes (F-108 & F-109)
                      </button>
                    </div>
                    {/* Slider Specific Controls */}
                    {selectedElementAny.type === "slider" && (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        {/* Display Navigation Controls */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                          <span className="block text-[11px] font-bold text-slate-600 mb-1">
                            Navigation Controls
                          </span>
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.slidesShowArrows !== false}
                              onChange={(e) => updateSelectedProp("slidesShowArrows", e.target.checked)}
                              className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                            />
                            <span>Prev / Next Arrow Buttons</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.slidesShowDots !== false}
                              onChange={(e) => updateSelectedProp("slidesShowDots", e.target.checked)}
                              className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                            />
                            <span>Bottom Dots Indicators</span>
                          </label>
                        </div>

                        {/* Slide Items Manager */}
                        <div className="pt-2 border-t border-slate-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700">Slide Items ({selectedElementAny.slidesItems?.length || 0})</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newSlide: SlideItem = {
                                  id: generateId(),
                                  title: "New Highlight Slide",
                                  description: "Add custom tagline, promotional announcement or banner copy.",
                                  bgImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&auto=format&fit=crop&q=80",
                                  bgColor: "#0f172a",
                                  buttonText: "Learn More",
                                  buttonUrl: "#",
                                };
                                const updated = [...(selectedElementAny.slidesItems || []), newSlide];
                                updateSelectedProp("slidesItems", updated);
                                updateSelectedProp("slidesActiveIndex", updated.length - 1);
                              }}
                              className="text-[11px] font-bold text-pink-600 hover:text-pink-800"
                            >
                              + Add Slide
                            </button>
                          </div>

                          <div className="space-y-3">
                            {(selectedElementAny.slidesItems || []).map((slide, idx) => (
                              <div
                                key={slide.id}
                                className={`rounded-xl border p-3 shadow-xs space-y-2 transition ${(selectedElementAny.slidesActiveIndex ?? 0) === idx
                                  ? "border-pink-400 bg-pink-50/20 ring-1 ring-pink-400"
                                  : "border-slate-200 bg-white"
                                  }`}
                              >
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <button
                                    type="button"
                                    onClick={() => updateSelectedProp("slidesActiveIndex", idx)}
                                    className="text-xs font-bold text-slate-800 hover:text-pink-600 text-left truncate max-w-[150px]"
                                  >
                                    Slide #{idx + 1}: {slide.title}
                                  </button>
                                  <div className="flex items-center gap-1.5">
                                    {idx > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const items = [...(selectedElementAny.slidesItems || [])];
                                          const temp = items[idx];
                                          items[idx] = items[idx - 1];
                                          items[idx - 1] = temp;
                                          updateSelectedProp("slidesItems", items);
                                          updateSelectedProp("slidesActiveIndex", idx - 1);
                                        }}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800"
                                        title="Move Up"
                                      >
                                        ↑
                                      </button>
                                    )}
                                    {idx < (selectedElementAny.slidesItems?.length || 0) - 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const items = [...(selectedElementAny.slidesItems || [])];
                                          const temp = items[idx];
                                          items[idx] = items[idx + 1];
                                          items[idx + 1] = temp;
                                          updateSelectedProp("slidesItems", items);
                                          updateSelectedProp("slidesActiveIndex", idx + 1);
                                        }}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800"
                                        title="Move Down"
                                      >
                                        ↓
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = (selectedElementAny.slidesItems || []).filter((s) => s.id !== slide.id);
                                        updateSelectedProp("slidesItems", updated);
                                        updateSelectedProp("slidesActiveIndex", Math.max(0, idx - 1));
                                      }}
                                      className="text-[10px] font-bold text-red-500 hover:text-red-700"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                    Slide Title
                                  </label>
                                  <input
                                    type="text"
                                    value={slide.title}
                                    onChange={(e) => {
                                      const updated = (selectedElementAny.slidesItems || []).map((s) =>
                                        s.id === slide.id ? { ...s, title: e.target.value } : s
                                      );
                                      updateSelectedProp("slidesItems", updated);
                                    }}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500 focus:bg-white"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                    Description
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={slide.description || ""}
                                    onChange={(e) => {
                                      const updated = (selectedElementAny.slidesItems || []).map((s) =>
                                        s.id === slide.id ? { ...s, description: e.target.value } : s
                                      );
                                      updateSelectedProp("slidesItems", updated);
                                    }}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500 focus:bg-white"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                    Background Image URL
                                  </label>
                                  <input
                                    type="text"
                                    value={slide.bgImage || ""}
                                    onChange={(e) => {
                                      const updated = (selectedElementAny.slidesItems || []).map((s) =>
                                        s.id === slide.id ? { ...s, bgImage: e.target.value } : s
                                      );
                                      updateSelectedProp("slidesItems", updated);
                                    }}
                                    placeholder="https://images.unsplash.com/..."
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-mono text-slate-800 outline-none focus:border-pink-500 focus:bg-white"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Background Color
                                    </label>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="color"
                                        value={slide.bgColor || "#0f172a"}
                                        onChange={(e) => {
                                          const updated = (selectedElementAny.slidesItems || []).map((s) =>
                                            s.id === slide.id ? { ...s, bgColor: e.target.value } : s
                                          );
                                          updateSelectedProp("slidesItems", updated);
                                        }}
                                        className="h-6 w-7 cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
                                      />
                                      <input
                                        type="text"
                                        value={slide.bgColor || "#0f172a"}
                                        onChange={(e) => {
                                          const updated = (selectedElementAny.slidesItems || []).map((s) =>
                                            s.id === slide.id ? { ...s, bgColor: e.target.value } : s
                                          );
                                          updateSelectedProp("slidesItems", updated);
                                        }}
                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-mono text-slate-800 outline-none focus:border-pink-500 focus:bg-white"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Button Text
                                    </label>
                                    <input
                                      type="text"
                                      value={slide.buttonText || ""}
                                      onChange={(e) => {
                                        const updated = (selectedElementAny.slidesItems || []).map((s) =>
                                          s.id === slide.id ? { ...s, buttonText: e.target.value } : s
                                        );
                                        updateSelectedProp("slidesItems", updated);
                                      }}
                                      placeholder="Learn More"
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500 focus:bg-white"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Form Specific Properties (F-178) */}
                    {selectedElementAny.type === "form" && (
                      <div className="space-y-4">
                        {/* Header Title & Subtitle */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Form Header
                          </span>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Header Title
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.formTitle !== undefined ? selectedElementAny.formTitle : "Get in Touch"}
                              onChange={(e) => updateSelectedProp("formTitle", e.target.value)}
                              placeholder="e.g. Get in Touch"
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Header Subtitle
                            </label>
                            <textarea
                              rows={2}
                              value={selectedElementAny.formSubtitle !== undefined ? selectedElementAny.formSubtitle : "Fill out the form below and our team will get back to you within 24 hours."}
                              onChange={(e) => updateSelectedProp("formSubtitle", e.target.value)}
                              placeholder="Brief description..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        {/* Layout Columns */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Form Grid Layout
                          </label>
                          <select
                            value={selectedElementAny.formLayoutColumns || 2}
                            onChange={(e) => updateSelectedProp("formLayoutColumns", Number(e.target.value))}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                          >
                            <option value={1}>1 Column (Stacked)</option>
                            <option value={2}>2 Columns (Grid)</option>
                          </select>
                        </div>

                        {/* Field Gap Spacing */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-semibold text-slate-700">
                              Field Spacing (Gap)
                            </label>
                            <span className="text-[11px] font-mono text-slate-500">
                              {selectedElementAny.formFieldGap ?? 16}px
                            </span>
                          </div>
                          <input
                            type="range"
                            min={8}
                            max={32}
                            step={2}
                            value={selectedElementAny.formFieldGap ?? 16}
                            onChange={(e) => updateSelectedProp("formFieldGap", Number(e.target.value))}
                            className="w-full accent-emerald-600"
                          />
                        </div>

                        {/* Show Labels Toggle */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                            <span className="font-bold text-slate-700">Display Field Labels</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.formShowLabels !== false}
                              onChange={(e) => updateSelectedProp("formShowLabels", e.target.checked)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          </label>
                        </div>

                        {/* Submit Button & Messages */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Submit Button Settings
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Button Text
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.formSubmitText || "Send Message"}
                              onChange={(e) => updateSelectedProp("formSubmitText", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Success Message
                            </label>
                            <textarea
                              rows={2}
                              value={selectedElementAny.formSubmitSuccessMsg || "Thank you! Your message has been sent successfully."}
                              onChange={(e) => updateSelectedProp("formSubmitSuccessMsg", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Background
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="color"
                                  value={selectedElementAny.formSubmitBtnBg || "#2563eb"}
                                  onChange={(e) => updateSelectedProp("formSubmitBtnBg", e.target.value)}
                                  className="h-6 w-7 cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.formSubmitBtnBg || "#2563eb"}
                                  onChange={(e) => updateSelectedProp("formSubmitBtnBg", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Text Color
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="color"
                                  value={selectedElementAny.formSubmitBtnColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("formSubmitBtnColor", e.target.value)}
                                  className="h-6 w-7 cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.formSubmitBtnColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("formSubmitBtnColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.formSubmitBtnFullWidth !== false}
                              onChange={(e) => updateSelectedProp("formSubmitBtnFullWidth", e.target.checked)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>Full Width Button</span>
                          </label>
                        </div>

                        {/* Form Mode & Multi-Step (F-275) */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Form Mode & Steps
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => updateSelectedProp("formMode", "standard")}
                              className={`rounded-lg py-1.5 text-xs font-bold transition ${
                                selectedElementAny.formMode !== "step-by-step"
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              Standard
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updateSelectedProp("formMode", "step-by-step");
                                if (!selectedElementAny.formSteps || selectedElementAny.formSteps.length === 0) {
                                  updateSelectedProp("formSteps", [
                                    { id: "step_1", title: "Step 1: Contact Info" },
                                    { id: "step_2", title: "Step 2: Details" },
                                  ]);
                                }
                              }}
                              className={`rounded-lg py-1.5 text-xs font-bold transition ${
                                selectedElementAny.formMode === "step-by-step"
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              Step-by-Step
                            </button>
                          </div>

                          {selectedElementAny.formMode === "step-by-step" && (
                            <div className="space-y-2 pt-2 border-t border-slate-200">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-700">Steps ({selectedElementAny.formSteps?.length || 0})</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentSteps = selectedElementAny.formSteps || [];
                                    const newStep = {
                                      id: `step_${Date.now()}`,
                                      title: `Step ${currentSteps.length + 1}: Details`,
                                    };
                                    updateSelectedProp("formSteps", [...currentSteps, newStep]);
                                  }}
                                  className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-700 cursor-pointer"
                                >
                                  + Add Step
                                </button>
                              </div>

                              <div className="space-y-1.5">
                                {(selectedElementAny.formSteps || []).map((step: any, sIdx: number) => (
                                  <div key={step.id} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5 shadow-2xs">
                                    <span className="text-[10px] font-bold text-slate-400 w-4 text-center">{sIdx + 1}</span>
                                    <input
                                      type="text"
                                      value={step.title}
                                      onChange={(e) => {
                                        const updated = (selectedElementAny.formSteps || []).map((s: any) =>
                                          s.id === step.id ? { ...s, title: e.target.value } : s
                                        );
                                        updateSelectedProp("formSteps", updated);
                                      }}
                                      className="flex-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-800 outline-none focus:border-emerald-500"
                                    />
                                    {sIdx > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const steps = [...(selectedElementAny.formSteps || [])];
                                          const temp = steps[sIdx];
                                          steps[sIdx] = steps[sIdx - 1];
                                          steps[sIdx - 1] = temp;
                                          updateSelectedProp("formSteps", steps);
                                        }}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-1 cursor-pointer"
                                        title="Move Step Up"
                                      >
                                        ↑
                                      </button>
                                    )}
                                    {sIdx < (selectedElementAny.formSteps?.length || 0) - 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const steps = [...(selectedElementAny.formSteps || [])];
                                          const temp = steps[sIdx];
                                          steps[sIdx] = steps[sIdx + 1];
                                          steps[sIdx + 1] = temp;
                                          updateSelectedProp("formSteps", steps);
                                        }}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-1 cursor-pointer"
                                        title="Move Step Down"
                                      >
                                        ↓
                                      </button>
                                    )}
                                    {(selectedElementAny.formSteps?.length || 0) > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = (selectedElementAny.formSteps || []).filter((s: any) => s.id !== step.id);
                                          updateSelectedProp("formSteps", updated);
                                        }}
                                        className="text-[10px] font-bold text-red-500 hover:text-red-700 px-1 cursor-pointer"
                                        title="Delete Step"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Spam Protection (F-277) */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Spam Protection
                          </span>
                          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                            <div>
                              <span className="font-semibold text-slate-800">Honeypot Anti-Spam Trap</span>
                              <p className="text-[10px] text-slate-500 mt-0.5">Injects an invisible trap input field that silently flags bot submissions.</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.formEnableHoneypot !== false}
                              onChange={(e) => updateSelectedProp("formEnableHoneypot", e.target.checked)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          </label>
                        </div>

                        {/* Actions After Submit (F-274, F-276, F-278, F-280, F-281) */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Actions After Submit
                          </span>

                          {/* Save to Database */}
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.formActions?.saveToDb !== false}
                              onChange={(e) =>
                                updateSelectedProp("formActions", {
                                  ...(selectedElementAny.formActions || {}),
                                  saveToDb: e.target.checked,
                                })
                              }
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="font-semibold text-slate-800">Save to Database (Leads Viewer)</span>
                          </label>

                          {/* Send Notification Email */}
                          <div className="space-y-1.5 pt-1.5 border-t border-slate-200/80">
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!selectedElementAny.formActions?.sendEmail}
                                onChange={(e) =>
                                  updateSelectedProp("formActions", {
                                    ...(selectedElementAny.formActions || {}),
                                    sendEmail: e.target.checked,
                                  })
                                }
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="font-semibold text-slate-800">Send Notification Email</span>
                            </label>
                            {selectedElementAny.formActions?.sendEmail && (
                              <div className="space-y-2 pl-6 pt-1">
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                    Recipient Email (toEmail)
                                  </label>
                                  <input
                                    type="email"
                                    value={selectedElementAny.formActions?.toEmail || ""}
                                    onChange={(e) =>
                                      updateSelectedProp("formActions", {
                                        ...(selectedElementAny.formActions || {}),
                                        toEmail: e.target.value,
                                      })
                                    }
                                    placeholder="admin@example.com"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                    Email Subject
                                  </label>
                                  <input
                                    type="text"
                                    value={selectedElementAny.formActions?.emailSubject || ""}
                                    onChange={(e) =>
                                      updateSelectedProp("formActions", {
                                        ...(selectedElementAny.formActions || {}),
                                        emailSubject: e.target.value,
                                      })
                                    }
                                    placeholder="New Lead from Website Form"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* External Webhook */}
                          <div className="space-y-1.5 pt-1.5 border-t border-slate-200/80">
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!selectedElementAny.formActions?.webhook}
                                onChange={(e) =>
                                  updateSelectedProp("formActions", {
                                    ...(selectedElementAny.formActions || {}),
                                    webhook: e.target.checked,
                                  })
                                }
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="font-semibold text-slate-800">External Webhook</span>
                            </label>
                            {selectedElementAny.formActions?.webhook && (
                              <div className="pl-6 pt-1">
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                  Webhook URL
                                </label>
                                <input
                                  type="url"
                                  value={selectedElementAny.formActions?.webhookUrl || ""}
                                  onChange={(e) =>
                                    updateSelectedProp("formActions", {
                                      ...(selectedElementAny.formActions || {}),
                                      webhookUrl: e.target.value,
                                    })
                                  }
                                  placeholder="https://hooks.zapier.com/..."
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                />
                              </div>
                            )}
                          </div>

                          {/* Redirect URL */}
                          <div className="space-y-1.5 pt-1.5 border-t border-slate-200/80">
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!selectedElementAny.formActions?.redirect || !!selectedElementAny.formRedirectUrl}
                                onChange={(e) => {
                                  const enabled = e.target.checked;
                                  updateSelectedProp("formActions", {
                                    ...(selectedElementAny.formActions || {}),
                                    redirect: enabled,
                                  });
                                  if (!enabled) {
                                    updateSelectedProp("formRedirectUrl", "");
                                  }
                                }}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="font-semibold text-slate-800">Redirect URL (Thank You Page)</span>
                            </label>
                            {(selectedElementAny.formActions?.redirect || selectedElementAny.formRedirectUrl) && (
                              <div className="pl-6 pt-1">
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                  Destination URL
                                </label>
                                <input
                                  type="text"
                                  value={selectedElementAny.formActions?.redirectUrl || selectedElementAny.formRedirectUrl || ""}
                                  onChange={(e) => {
                                    updateSelectedProp("formRedirectUrl", e.target.value);
                                    updateSelectedProp("formActions", {
                                      ...(selectedElementAny.formActions || {}),
                                      redirect: true,
                                      redirectUrl: e.target.value,
                                    });
                                  }}
                                  placeholder="/thank-you or https://..."
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Form Fields Manager */}
                        <div className="pt-2 border-t border-slate-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700">Form Fields ({selectedElementAny.formFields?.length || 0})</span>
                            <div className="flex items-center gap-1">
                              <select
                                defaultValue="text"
                                className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 outline-none"
                                onChange={(e) => {
                                  const newType = e.target.value as FormFieldType;
                                  const defaultLabels: Record<FormFieldType, string> = {
                                    text: "New Text Field",
                                    email: "Email Address",
                                    number: "Age / Quantity",
                                    tel: "Phone Number",
                                    textarea: "Additional Comments",
                                    select: "Choose Option",
                                    checkbox: "I agree to the terms",
                                    radio: "Select Preference",
                                    date: "Select Date",
                                    file: "Attachment / File",
                                  };
                                  const newField: FormFieldItem = {
                                    id: generateId(),
                                    type: newType,
                                    label: defaultLabels[newType] || "New Field",
                                    placeholder: newType === "checkbox" ? "" : "Enter value...",
                                    required: false,
                                    width: newType === "textarea" ? "full" : "half",
                                    options: newType === "select" || newType === "radio" ? ["Option 1", "Option 2", "Option 3"] : undefined,
                                  };
                                  updateSelectedProp("formFields", [...(selectedElementAny.formFields || []), newField]);
                                  e.target.value = "text";
                                }}
                              >
                                <option value="text">+ Text Field</option>
                                <option value="email">+ Email</option>
                                <option value="number">+ Number</option>
                                <option value="tel">+ Telephone</option>
                                <option value="date">+ Date Picker</option>
                                <option value="file">+ File Upload</option>
                                <option value="textarea">+ Textarea</option>
                                <option value="select">+ Dropdown Select</option>
                                <option value="checkbox">+ Checkbox</option>
                                <option value="radio">+ Radio Group</option>
                              </select>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {(selectedElementAny.formFields || []).map((field, idx) => (
                              <div
                                key={field.id}
                                className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-2"
                              >
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <span className="text-xs font-bold text-slate-800 capitalize">
                                    #{idx + 1}: {field.label} ({field.type})
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {idx > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const items = [...(selectedElementAny.formFields || [])];
                                          const temp = items[idx];
                                          items[idx] = items[idx - 1];
                                          items[idx - 1] = temp;
                                          updateSelectedProp("formFields", items);
                                        }}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                                        title="Move Up"
                                      >
                                        ↑
                                      </button>
                                    )}
                                    {idx < (selectedElementAny.formFields?.length || 0) - 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const items = [...(selectedElementAny.formFields || [])];
                                          const temp = items[idx];
                                          items[idx] = items[idx + 1];
                                          items[idx + 1] = temp;
                                          updateSelectedProp("formFields", items);
                                        }}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                                        title="Move Down"
                                      >
                                        ↓
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = (selectedElementAny.formFields || []).filter((f) => f.id !== field.id);
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      className="text-[10px] font-bold text-red-500 hover:text-red-700 cursor-pointer"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Label
                                    </label>
                                    <input
                                      type="text"
                                      value={field.label}
                                      onChange={(e) => {
                                        const updated = (selectedElementAny.formFields || []).map((f) =>
                                          f.id === field.id ? { ...f, label: e.target.value } : f
                                        );
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Field Type
                                    </label>
                                    <select
                                      value={field.type}
                                      onChange={(e) => {
                                        const newType = e.target.value as FormFieldType;
                                        const updated = (selectedElementAny.formFields || []).map((f) =>
                                          f.id === field.id
                                            ? {
                                                ...f,
                                                type: newType,
                                                options: newType === "select" || newType === "radio" ? (f.options || ["Option 1", "Option 2"]) : f.options,
                                              }
                                            : f
                                        );
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                    >
                                      <option value="text">Text</option>
                                      <option value="email">Email</option>
                                      <option value="number">Number</option>
                                      <option value="tel">Telephone</option>
                                      <option value="date">Date Picker</option>
                                      <option value="file">File Upload</option>
                                      <option value="textarea">Textarea</option>
                                      <option value="select">Select Dropdown</option>
                                      <option value="checkbox">Checkbox</option>
                                      <option value="radio">Radio Group</option>
                                    </select>
                                  </div>
                                </div>

                                {selectedElementAny.formMode === "step-by-step" && (
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Assign to Step
                                    </label>
                                    <select
                                      value={field.stepId || (selectedElementAny.formSteps?.[0]?.id || "")}
                                      onChange={(e) => {
                                        const updated = (selectedElementAny.formFields || []).map((f) =>
                                          f.id === field.id ? { ...f, stepId: e.target.value } : f
                                        );
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                    >
                                      {(selectedElementAny.formSteps || []).map((st: any) => (
                                        <option key={st.id} value={st.id}>
                                          {st.title}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {field.type !== "checkbox" && field.type !== "file" && (
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Placeholder Text
                                    </label>
                                    <input
                                      type="text"
                                      value={field.placeholder || ""}
                                      onChange={(e) => {
                                        const updated = (selectedElementAny.formFields || []).map((f) =>
                                          f.id === field.id ? { ...f, placeholder: e.target.value } : f
                                        );
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                )}

                                {(field.type === "select" || field.type === "radio") && (
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Options (Comma Separated)
                                    </label>
                                    <input
                                      type="text"
                                      value={(field.options || []).join(", ")}
                                      onChange={(e) => {
                                        const opts = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                                        const updated = (selectedElementAny.formFields || []).map((f) =>
                                          f.id === field.id ? { ...f, options: opts } : f
                                        );
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      placeholder="Option 1, Option 2, Option 3"
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                )}

                                <div className="flex items-center justify-between pt-1">
                                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={!!field.required}
                                      onChange={(e) => {
                                        const updated = (selectedElementAny.formFields || []).map((f) =>
                                          f.id === field.id ? { ...f, required: e.target.checked } : f
                                        );
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>Required Field</span>
                                  </label>

                                  <div className="flex items-center gap-1 text-xs">
                                    <span className="text-[10px] text-slate-500">Span:</span>
                                    <select
                                      value={field.width || "half"}
                                      onChange={(e) => {
                                        const w = e.target.value as "full" | "half";
                                        const updated = (selectedElementAny.formFields || []).map((f) =>
                                          f.id === field.id ? { ...f, width: w } : f
                                        );
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[11px] font-medium text-slate-700 outline-none"
                                    >
                                      <option value="half">50% (Half Width)</option>
                                      <option value="full">100% (Full Width)</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Conditional Logic (X-788) */}
                                <div className="pt-2 border-t border-slate-100">
                                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={!!field.conditionalLogic}
                                      onChange={(e) => {
                                        const otherFields = (selectedElementAny.formFields || []).filter((f) => f.id !== field.id);
                                        const updated = (selectedElementAny.formFields || []).map((f) =>
                                          f.id === field.id
                                            ? {
                                                ...f,
                                                conditionalLogic: e.target.checked
                                                  ? {
                                                      action: "show" as const,
                                                      targetFieldId: otherFields[0]?.id || "",
                                                      operator: "equals" as const,
                                                      value: "",
                                                    }
                                                  : undefined,
                                              }
                                            : f
                                        );
                                        updateSelectedProp("formFields", updated);
                                      }}
                                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>Conditional Visibility</span>
                                  </label>
                                  {field.conditionalLogic && (
                                    <div className="mt-1.5 space-y-1.5 rounded-lg bg-slate-50 p-2 border border-slate-200 text-xs">
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <div>
                                          <label className="block text-[9px] text-slate-500">Action</label>
                                          <select
                                            value={field.conditionalLogic.action}
                                            onChange={(e) => {
                                              const updated = (selectedElementAny.formFields || []).map((f) =>
                                                f.id === field.id
                                                  ? { ...f, conditionalLogic: { ...f.conditionalLogic!, action: e.target.value as "show" | "hide" } }
                                                  : f
                                              );
                                              updateSelectedProp("formFields", updated);
                                            }}
                                            className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px]"
                                          >
                                            <option value="show">Show when</option>
                                            <option value="hide">Hide when</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-[9px] text-slate-500">Target Field</label>
                                          <select
                                            value={field.conditionalLogic.targetFieldId}
                                            onChange={(e) => {
                                              const updated = (selectedElementAny.formFields || []).map((f) =>
                                                f.id === field.id
                                                  ? { ...f, conditionalLogic: { ...f.conditionalLogic!, targetFieldId: e.target.value } }
                                                  : f
                                              );
                                              updateSelectedProp("formFields", updated);
                                            }}
                                            className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px]"
                                          >
                                            {(selectedElementAny.formFields || [])
                                              .filter((f) => f.id !== field.id)
                                              .map((of) => (
                                                <option key={of.id} value={of.id}>
                                                  {of.label}
                                                </option>
                                              ))}
                                          </select>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <div>
                                          <label className="block text-[9px] text-slate-500">Operator</label>
                                          <select
                                            value={field.conditionalLogic.operator}
                                            onChange={(e) => {
                                              const updated = (selectedElementAny.formFields || []).map((f) =>
                                                f.id === field.id
                                                  ? { ...f, conditionalLogic: { ...f.conditionalLogic!, operator: e.target.value as any } }
                                                  : f
                                              );
                                              updateSelectedProp("formFields", updated);
                                            }}
                                            className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px]"
                                          >
                                            <option value="equals">Equals</option>
                                            <option value="not_equals">Does Not Equal</option>
                                            <option value="contains">Contains</option>
                                            <option value="not_empty">Is Not Empty</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-[9px] text-slate-500">Match Value</label>
                                          <input
                                            type="text"
                                            value={field.conditionalLogic.value}
                                            onChange={(e) => {
                                              const updated = (selectedElementAny.formFields || []).map((f) =>
                                                f.id === field.id
                                                  ? { ...f, conditionalLogic: { ...f.conditionalLogic!, value: e.target.value } }
                                                  : f
                                              );
                                              updateSelectedProp("formFields", updated);
                                            }}
                                            placeholder="Value to match..."
                                            className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px]"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Login Specific Properties (F-179) */}
                    {selectedElementAny.type === "login" && (
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Login Header
                          </span>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Title
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.loginTitle !== undefined ? selectedElementAny.loginTitle : "Welcome Back"}
                              onChange={(e) => updateSelectedProp("loginTitle", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Subtitle
                            </label>
                            <textarea
                              rows={2}
                              value={selectedElementAny.loginSubtitle !== undefined ? selectedElementAny.loginSubtitle : "Sign in to your account to access your workspace."}
                              onChange={(e) => updateSelectedProp("loginSubtitle", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>

                        {/* Field Labels */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Field Labels & Placeholders
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Email Label
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.loginEmailLabel || "Email Address"}
                                onChange={(e) => updateSelectedProp("loginEmailLabel", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Email Placeholder
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.loginEmailPlaceholder || "name@example.com"}
                                onChange={(e) => updateSelectedProp("loginEmailPlaceholder", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Password Label
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.loginPasswordLabel || "Password"}
                                onChange={(e) => updateSelectedProp("loginPasswordLabel", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Password Placeholder
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.loginPasswordPlaceholder || "••••••••"}
                                onChange={(e) => updateSelectedProp("loginPasswordPlaceholder", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Features & Options */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Options & Links
                          </span>
                          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                            <span className="font-bold">Remember Me Option</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.loginShowRememberMe !== false}
                              onChange={(e) => updateSelectedProp("loginShowRememberMe", e.target.checked)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </label>

                          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                            <span className="font-bold">Forgot Password Link</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.loginShowForgotPassword !== false}
                              onChange={(e) => updateSelectedProp("loginShowForgotPassword", e.target.checked)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </label>

                          {selectedElementAny.loginShowForgotPassword !== false && (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                  Link Text
                                </label>
                                <input
                                  type="text"
                                  value={selectedElementAny.loginForgotPasswordText || "Forgot password?"}
                                  onChange={(e) => updateSelectedProp("loginForgotPasswordText", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                  Target URL
                                </label>
                                <input
                                  type="text"
                                  value={selectedElementAny.loginForgotPasswordUrl || "#"}
                                  onChange={(e) => updateSelectedProp("loginForgotPasswordUrl", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                />
                              </div>
                            </div>
                          )}

                          <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer pt-1">
                            <span className="font-bold">Show Social Login Options</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.loginShowSocialButtons !== false}
                              onChange={(e) => updateSelectedProp("loginShowSocialButtons", e.target.checked)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </label>
                        </div>

                        {/* Button Styling */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Button & Theme
                          </span>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Button Text
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.loginButtonText || "Sign In"}
                              onChange={(e) => updateSelectedProp("loginButtonText", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Background
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="color"
                                  value={selectedElementAny.loginButtonBg || "#2563eb"}
                                  onChange={(e) => updateSelectedProp("loginButtonBg", e.target.value)}
                                  className="h-6 w-7 cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.loginButtonBg || "#2563eb"}
                                  onChange={(e) => updateSelectedProp("loginButtonBg", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Text Color
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="color"
                                  value={selectedElementAny.loginButtonColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("loginButtonColor", e.target.value)}
                                  className="h-6 w-7 cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.loginButtonColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("loginButtonColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Nav Menu Specific Properties (F-180) */}
                    {selectedElementAny.type === "nav-menu" && (
                      <div className="space-y-4">
                        {/* Layout & Alignment */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Menu Layout & Alignment
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Orientation
                              </label>
                              <select
                                value={selectedElementAny.navLayout || "horizontal"}
                                onChange={(e) => updateSelectedProp("navLayout", e.target.value as "horizontal" | "vertical")}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              >
                                <option value="horizontal">Horizontal Row</option>
                                <option value="vertical">Vertical Column</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Alignment
                              </label>
                              <select
                                value={selectedElementAny.navAlignment || "left"}
                                onChange={(e) => updateSelectedProp("navAlignment", e.target.value as "left" | "center" | "right" | "between")}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              >
                                <option value="left">Left Align</option>
                                <option value="center">Center Align</option>
                                <option value="right">Right Align</option>
                                <option value="between">Space Between</option>
                              </select>
                            </div>
                          </div>

                          {/* Gap Spacing Slider */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-semibold text-slate-500">
                                Item Gap Spacing
                              </label>
                              <span className="text-[10px] font-mono text-slate-500">
                                {selectedElementAny.navGap ?? 24}px
                              </span>
                            </div>
                            <input
                              type="range"
                              min={8}
                              max={64}
                              step={4}
                              value={selectedElementAny.navGap ?? 24}
                              onChange={(e) => updateSelectedProp("navGap", Number(e.target.value))}
                              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                          </div>
                        </div>

                        {/* Typography & Item Styling */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Typography & Colors
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Font Size
                              </label>
                              <select
                                value={selectedElementAny.navFontSize || "14px"}
                                onChange={(e) => updateSelectedProp("navFontSize", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              >
                                <option value="12px">12px (Small)</option>
                                <option value="14px">14px (Medium)</option>
                                <option value="16px">16px (Large)</option>
                                <option value="18px">18px (XL)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Font Weight
                              </label>
                              <select
                                value={selectedElementAny.navFontWeight || "600"}
                                onChange={(e) => updateSelectedProp("navFontWeight", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              >
                                <option value="400">Normal (400)</option>
                                <option value="500">Medium (500)</option>
                                <option value="600">SemiBold (600)</option>
                                <option value="700">Bold (700)</option>
                              </select>
                            </div>
                          </div>

                          {/* States Text Colors */}
                          <span className="block text-[10px] font-bold text-slate-600 mt-2">
                            Text Colors (Normal / Hover / Active)
                          </span>
                          <div className="grid grid-cols-3 gap-1.5">
                            <div>
                              <label className="block text-[9px] text-slate-400 mb-0.5">Normal</label>
                              <input
                                type="color"
                                value={selectedElementAny.navItemColor || "#334155"}
                                onChange={(e) => updateSelectedProp("navItemColor", e.target.value)}
                                className="h-6 w-full cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] text-slate-400 mb-0.5">Hover</label>
                              <input
                                type="color"
                                value={selectedElementAny.navItemHoverColor || "#2563eb"}
                                onChange={(e) => updateSelectedProp("navItemHoverColor", e.target.value)}
                                className="h-6 w-full cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] text-slate-400 mb-0.5">Active</label>
                              <input
                                type="color"
                                value={selectedElementAny.navItemActiveColor || "#2563eb"}
                                onChange={(e) => updateSelectedProp("navItemActiveColor", e.target.value)}
                                className="h-6 w-full cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Menu Items Manager */}
                        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                              Menu Items ({selectedElementAny.navMenuItems?.length || 5})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const current = selectedElementAny.navMenuItems || [
                                  { id: "1", label: "Home", url: "/", isActive: true },
                                  { id: "2", label: "About", url: "/about" },
                                  { id: "3", label: "Services", url: "/services" },
                                  { id: "4", label: "Pricing", url: "/pricing" },
                                  { id: "5", label: "Contact", url: "/contact" },
                                ];
                                const newItem: NavMenuItem = {
                                  id: `nav_${Date.now()}`,
                                  label: `New Link ${current.length + 1}`,
                                  url: "#",
                                  linkType: "url",
                                  dropdownEnabled: true,
                                  trigger: "hover",
                                };
                                updateSelectedProp("navMenuItems", [...current, newItem]);
                              }}
                              className="rounded bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-amber-600 transition cursor-pointer shadow-xs"
                            >
                              + Add Item
                            </button>
                          </div>

                          <div className="space-y-3">
                            {(selectedElementAny.navMenuItems || [
                              { id: "1", label: "Home", url: "/", isActive: true },
                              { id: "2", label: "About", url: "/about" },
                              {
                                id: "3",
                                label: "Services",
                                url: "/services",
                                dropdownEnabled: true,
                                submenu: [
                                  { id: "s1", label: "Web Design", url: "/services/web-design", description: "Responsive web design" },
                                  { id: "s2", label: "App Development", url: "/services/app-dev", description: "Native & cross-platform apps" },
                                ],
                              },
                              { id: "4", label: "Pricing", url: "/pricing" },
                              { id: "5", label: "Contact", url: "/contact" },
                            ]).map((item, index, arr) => (
                              <div
                                key={item.id}
                                className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-2.5"
                              >
                                <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-100">
                                  <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                    <span className="text-amber-500">#{index + 1}</span>
                                    {item.icon && <span>{item.icon}</span>}
                                    <span>{item.label}</span>
                                  </span>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={index === 0}
                                      onClick={() => {
                                        const copy = [...arr];
                                        const temp = copy[index - 1];
                                        copy[index - 1] = copy[index];
                                        copy[index] = temp;
                                        updateSelectedProp("navMenuItems", copy);
                                      }}
                                      className="h-5 w-5 rounded border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                      title="Move Up"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      type="button"
                                      disabled={index === arr.length - 1}
                                      onClick={() => {
                                        const copy = [...arr];
                                        const temp = copy[index + 1];
                                        copy[index + 1] = copy[index];
                                        copy[index] = temp;
                                        updateSelectedProp("navMenuItems", copy);
                                      }}
                                      className="h-5 w-5 rounded border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                      title="Move Down"
                                    >
                                      ↓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const dupItem: NavMenuItem = {
                                          ...item,
                                          id: `nav_${Date.now()}`,
                                          label: `${item.label} (Copy)`,
                                        };
                                        const copy = [...arr];
                                        copy.splice(index + 1, 0, dupItem);
                                        updateSelectedProp("navMenuItems", copy);
                                      }}
                                      className="h-5 w-5 rounded border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                      title="Duplicate Item"
                                    >
                                      ⧉
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const filtered = arr.filter((i) => i.id !== item.id);
                                        updateSelectedProp("navMenuItems", filtered);
                                      }}
                                      className="h-5 w-5 rounded border border-red-200 bg-red-50 text-[10px] font-bold text-red-600 hover:bg-red-100 cursor-pointer"
                                      title="Delete Item"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>

                                {/* Label & Link Type */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Label</label>
                                    <input
                                      type="text"
                                      value={item.label}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, label: e.target.value } : i
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Link Type</label>
                                    <select
                                      value={item.linkType || "url"}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, linkType: e.target.value as any } : i
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                                    >
                                      <option value="url">External URL</option>
                                      <option value="page">Website Page</option>
                                      <option value="anchor">Anchor (#id)</option>
                                    </select>
                                  </div>
                                </div>

                                {/* URL Target / Page Picker */}
                                <div>
                                  <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">
                                    {item.linkType === "page" ? "Select Page" : "URL Destination"}
                                  </label>
                                  {item.linkType === "page" && pages.length > 0 ? (
                                    <select
                                      value={item.url}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, url: e.target.value } : i
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                                    >
                                      {pages.map((p) => (
                                        <option key={p.id} value={p.isHome ? "/" : `/${p.slug}`}>
                                          {p.name} ({p.isHome ? "/" : `/${p.slug}`})
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={item.url}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, url: e.target.value } : i
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      placeholder={item.linkType === "anchor" ? "#section-id" : "https://example.com"}
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-mono text-slate-800 outline-none focus:border-amber-500"
                                    />
                                  )}
                                </div>

                                {/* Target & Icon */}
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Target</label>
                                    <select
                                      value={item.target || "_self"}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, target: e.target.value as any } : i
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-medium text-slate-800 outline-none"
                                    >
                                      <option value="_self">Same Tab</option>
                                      <option value="_blank">New Tab</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Icon / Emoji</label>
                                    <input
                                      type="text"
                                      value={item.icon || ""}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, icon: e.target.value } : i
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      placeholder="e.g. 🏠"
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Icon Pos</label>
                                    <select
                                      value={item.iconPosition || "left"}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, iconPosition: e.target.value as any } : i
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-medium text-slate-800 outline-none"
                                    >
                                      <option value="left">Left</option>
                                      <option value="right">Right</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Toggles: Active, Disabled, Dropdown Enabled */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2 flex-wrap">
                                  <label className="flex items-center gap-1.5 text-[10px] text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={!!item.isActive}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, isActive: e.target.checked } : { ...i, isActive: false }
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      className="rounded border-slate-300 text-amber-500 cursor-pointer"
                                    />
                                    <span>Active</span>
                                  </label>

                                  <label className="flex items-center gap-1.5 text-[10px] text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={!!item.isDisabled}
                                      onChange={(e) => {
                                        const updated = arr.map((i) =>
                                          i.id === item.id ? { ...i, isDisabled: e.target.checked } : i
                                        );
                                        updateSelectedProp("navMenuItems", updated);
                                      }}
                                      className="rounded border-slate-300 text-amber-500 cursor-pointer"
                                    />
                                    <span>Disabled</span>
                                  </label>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const sub = item.submenu || [];
                                      const newSub: NavSubmenuItem = {
                                        id: `sub_${Date.now()}`,
                                        label: `Submenu ${sub.length + 1}`,
                                        url: "#",
                                      };
                                      const updated = arr.map((i) =>
                                        i.id === item.id ? { ...i, submenu: [...sub, newSub], dropdownEnabled: true } : i
                                      );
                                      updateSelectedProp("navMenuItems", updated);
                                    }}
                                    className="text-[10px] font-bold text-amber-600 hover:underline cursor-pointer ml-auto"
                                  >
                                    + Add Submenu
                                  </button>
                                </div>

                                {/* Submenu List */}
                                {item.submenu && item.submenu.length > 0 && (
                                  <div className="mt-2 pl-3 border-l-2 border-amber-300 space-y-2 bg-amber-50/30 p-2 rounded-r-xl">
                                    <span className="block text-[9px] font-bold text-amber-900 uppercase tracking-wider">
                                      Submenu Items ({item.submenu.length})
                                    </span>
                                    {item.submenu.map((sub, sIdx) => (
                                      <div key={sub.id} className="rounded-lg border border-slate-200 bg-white p-2 space-y-1.5">
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="text-[10px] font-bold text-slate-700">Sub #{sIdx + 1}</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newSub = item.submenu!.filter((s) => s.id !== sub.id);
                                              const updated = arr.map((i) =>
                                                i.id === item.id ? { ...i, submenu: newSub } : i
                                              );
                                              updateSelectedProp("navMenuItems", updated);
                                            }}
                                            className="h-4 w-4 shrink-0 rounded border border-red-200 bg-red-50 text-[9px] font-bold text-red-600 hover:bg-red-100 cursor-pointer flex items-center justify-center"
                                            title="Delete Submenu Item"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1">
                                          <input
                                            type="text"
                                            value={sub.label}
                                            onChange={(e) => {
                                              const newSub = item.submenu!.map((s) =>
                                                s.id === sub.id ? { ...s, label: e.target.value } : s
                                              );
                                              const updated = arr.map((i) =>
                                                i.id === item.id ? { ...i, submenu: newSub } : i
                                              );
                                              updateSelectedProp("navMenuItems", updated);
                                            }}
                                            placeholder="Submenu Label"
                                            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-800 outline-none"
                                          />
                                          <input
                                            type="text"
                                            value={sub.url}
                                            onChange={(e) => {
                                              const newSub = item.submenu!.map((s) =>
                                                s.id === sub.id ? { ...s, url: e.target.value } : s
                                              );
                                              const updated = arr.map((i) =>
                                                i.id === item.id ? { ...i, submenu: newSub } : i
                                              );
                                              updateSelectedProp("navMenuItems", updated);
                                            }}
                                            placeholder="URL"
                                            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-mono text-slate-800 outline-none"
                                          />
                                        </div>
                                        <div className="grid grid-cols-2 gap-1">
                                          <input
                                            type="text"
                                            value={sub.description || ""}
                                            onChange={(e) => {
                                              const newSub = item.submenu!.map((s) =>
                                                s.id === sub.id ? { ...s, description: e.target.value } : s
                                              );
                                              const updated = arr.map((i) =>
                                                i.id === item.id ? { ...i, submenu: newSub } : i
                                              );
                                              updateSelectedProp("navMenuItems", updated);
                                            }}
                                            placeholder="Description (optional)"
                                            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-700 outline-none"
                                          />
                                          <input
                                            type="text"
                                            value={sub.badge || ""}
                                            onChange={(e) => {
                                              const newSub = item.submenu!.map((s) =>
                                                s.id === sub.id ? { ...s, badge: e.target.value } : s
                                              );
                                              const updated = arr.map((i) =>
                                                i.id === item.id ? { ...i, submenu: newSub } : i
                                              );
                                              updateSelectedProp("navMenuItems", updated);
                                            }}
                                            placeholder="Badge (e.g. New)"
                                            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-700 outline-none"
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Animated Headline Specific Properties (F-181) */}
                    {selectedElementAny.type === "animated-headline" && (
                      <div className="space-y-4">
                        {/* HTML Tag & Text Parts */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Headline Text Content
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              HTML Tag
                            </label>
                            <select
                              value={selectedElementAny.headlineTag || "h2"}
                              onChange={(e) => updateSelectedProp("headlineTag", e.target.value as any)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-violet-500"
                            >
                              <option value="h1">H1 (Main Title)</option>
                              <option value="h2">H2 (Section Header)</option>
                              <option value="h3">H3 (Sub Header)</option>
                              <option value="h4">H4 (Small Header)</option>
                              <option value="p">P (Paragraph)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Prefix Text (Before Animation)
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.headlinePrefix ?? "Build Websites That Are"}
                              onChange={(e) => updateSelectedProp("headlinePrefix", e.target.value)}
                              placeholder="Prefix Text..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-violet-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Suffix Text (After Animation)
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.headlineSuffix ?? "With ForgeStudio"}
                              onChange={(e) => updateSelectedProp("headlineSuffix", e.target.value)}
                              placeholder="Suffix Text..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-violet-500"
                            />
                          </div>
                        </div>

                        {/* Animated Phrases List */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              Animated Phrases ({(selectedElementAny.headlineAnimatedTexts || []).length})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const current = selectedElementAny.headlineAnimatedTexts || ["Stunning", "Blazing Fast", "Ultra Flexible", "Powerful"];
                                updateSelectedProp("headlineAnimatedTexts", [...current, `Phrase ${current.length + 1}`]);
                              }}
                              className="rounded bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-violet-700 transition cursor-pointer"
                            >
                              + Add Word
                            </button>
                          </div>

                          <div className="space-y-2">
                            {(selectedElementAny.headlineAnimatedTexts || ["Stunning", "Blazing Fast", "Ultra Flexible", "Powerful"]).map((phrase, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={phrase}
                                  onChange={(e) => {
                                    const copy = [...(selectedElementAny.headlineAnimatedTexts || ["Stunning", "Blazing Fast", "Ultra Flexible", "Powerful"])];
                                    copy[idx] = e.target.value;
                                    updateSelectedProp("headlineAnimatedTexts", copy);
                                  }}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-700 outline-none focus:border-violet-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = (selectedElementAny.headlineAnimatedTexts || ["Stunning", "Blazing Fast", "Ultra Flexible", "Powerful"]).filter((_, i) => i !== idx);
                                    updateSelectedProp("headlineAnimatedTexts", copy);
                                  }}
                                  className="h-7 w-7 shrink-0 rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-red-600 hover:bg-red-100 cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Animation Style & Speed */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Animation Settings
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Animation Effect
                            </label>
                            <select
                              value={selectedElementAny.headlineAnimationType || "typing"}
                              onChange={(e) => updateSelectedProp("headlineAnimationType", e.target.value as AnimatedHeadlineStyle)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-violet-500"
                            >
                              <option value="typing">Typewriter Effect (| Cursor)</option>
                              <option value="fade">Smooth Fade In/Out</option>
                              <option value="slide-up">Slide Up & Fade</option>
                              <option value="zoom">Zoom Scale & Fade</option>
                              <option value="flip">3D Flip Rotation</option>
                              <option value="highlight">Brush Highlight Box</option>
                            </select>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-semibold text-slate-500">
                                Animation Interval Speed
                              </label>
                              <span className="text-[10px] font-mono text-slate-500">
                                {((selectedElementAny.headlineAnimationSpeed || 2500) / 1000).toFixed(1)}s
                              </span>
                            </div>
                            <input
                              type="range"
                              min={1000}
                              max={5000}
                              step={250}
                              value={selectedElementAny.headlineAnimationSpeed || 2500}
                              onChange={(e) => updateSelectedProp("headlineAnimationSpeed", Number(e.target.value))}
                              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                            />
                          </div>
                        </div>

                        {/* Highlighted Phrase Colors */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Animated Text Styling
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                Text Color
                              </label>
                              <input
                                type="color"
                                value={selectedElementAny.headlineHighlightColor || "#2563eb"}
                                onChange={(e) => updateSelectedProp("headlineHighlightColor", e.target.value)}
                                className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                Background / Highlight
                              </label>
                              <input
                                type="color"
                                value={selectedElementAny.headlineHighlightBg || "#eff6ff"}
                                onChange={(e) => updateSelectedProp("headlineHighlightBg", e.target.value)}
                                className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Price Table Specific Properties (F-182) */}
                    {selectedElementAny.type === "price-table" && (
                      <PriceTableWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Price List Specific Properties (F-183) */}
                    {selectedElementAny.type === "price-list" && (
                      <div className="space-y-4">
                        {/* List Styling & Layout */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            List & Separator Layout
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Item Spacing
                              </label>
                              <input
                                type="number"
                                min={8}
                                max={60}
                                value={selectedElementAny.priceListGap ?? 20}
                                onChange={(e) => updateSelectedProp("priceListGap", Number(e.target.value))}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-teal-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Leader Line Style
                              </label>
                              <select
                                value={selectedElementAny.priceListSeparatorStyle || "dotted"}
                                onChange={(e) => updateSelectedProp("priceListSeparatorStyle", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-teal-500"
                              >
                                <option value="dotted">Dotted Leader (...) </option>
                                <option value="dashed">Dashed Line (---)</option>
                                <option value="solid">Solid Line (___)</option>
                                <option value="none">None</option>
                              </select>
                            </div>
                          </div>

                          {/* Image settings */}
                          <div className="pt-2 border-t border-slate-200/60 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-semibold text-slate-700 cursor-pointer">
                                Show Thumbnail Images
                              </label>
                              <input
                                type="checkbox"
                                checked={selectedElementAny.priceListShowImages !== false}
                                onChange={(e) => updateSelectedProp("priceListShowImages", e.target.checked)}
                                className="accent-teal-600 rounded cursor-pointer"
                              />
                            </div>

                            {selectedElementAny.priceListShowImages !== false && (
                              <div>
                                <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-0.5">
                                  <span>Image Size</span>
                                  <span>{selectedElementAny.priceListImageSize || 48}px</span>
                                </div>
                                <input
                                  type="range"
                                  min={32}
                                  max={96}
                                  value={selectedElementAny.priceListImageSize || 48}
                                  onChange={(e) => updateSelectedProp("priceListImageSize", Number(e.target.value))}
                                  className="w-full accent-teal-600 cursor-pointer"
                                />
                              </div>
                            )}
                          </div>

                          {/* Color settings */}
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                Title Color
                              </label>
                              <input
                                type="color"
                                value={selectedElementAny.priceListTitleColor || "#0f172a"}
                                onChange={(e) => updateSelectedProp("priceListTitleColor", e.target.value)}
                                className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                Price Color
                              </label>
                              <input
                                type="color"
                                value={selectedElementAny.priceListPriceColor || "#2563eb"}
                                onChange={(e) => updateSelectedProp("priceListPriceColor", e.target.value)}
                                className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                                Price Pill Bg
                              </label>
                              <input
                                type="color"
                                value={selectedElementAny.priceListPriceBg || "#eff6ff"}
                                onChange={(e) => updateSelectedProp("priceListPriceBg", e.target.value)}
                                className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Price List Items Manager */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              Services / Products ({(selectedElementAny.priceListItems || []).length})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const arr = selectedElementAny.priceListItems || [];
                                const newItem: PriceListItem = {
                                  id: String(Date.now()),
                                  name: `Service Item ${arr.length + 1}`,
                                  price: "$25.00",
                                  description: "Item description goes here.",
                                  imageUrl: "",
                                };
                                updateSelectedProp("priceListItems", [...arr, newItem]);
                              }}
                              className="rounded bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-teal-700 transition cursor-pointer"
                            >
                              + Add Item
                            </button>
                          </div>

                          <div className="space-y-3">
                            {(selectedElementAny.priceListItems || []).map((item, itemIdx) => (
                              <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2">
                                <div className="flex items-center justify-between gap-1 border-b border-slate-100 pb-1.5">
                                  <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => {
                                      const copy = [...(selectedElementAny.priceListItems || [])];
                                      copy[itemIdx] = { ...copy[itemIdx], name: e.target.value };
                                      updateSelectedProp("priceListItems", copy);
                                    }}
                                    placeholder="Item Name..."
                                    className="w-full font-bold text-xs text-slate-900 outline-none border-b border-transparent focus:border-teal-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const filtered = (selectedElementAny.priceListItems || []).filter((i) => i.id !== item.id);
                                      updateSelectedProp("priceListItems", filtered);
                                    }}
                                    className="h-5 w-5 shrink-0 rounded border border-red-200 bg-red-50 text-[10px] font-bold text-red-600 hover:bg-red-100 cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>

                                {/* Price */}
                                <div>
                                  <label className="block text-[9px] font-semibold text-slate-400">Price Display</label>
                                  <input
                                    type="text"
                                    value={item.price}
                                    onChange={(e) => {
                                      const copy = [...(selectedElementAny.priceListItems || [])];
                                      copy[itemIdx] = { ...copy[itemIdx], price: e.target.value };
                                      updateSelectedProp("priceListItems", copy);
                                    }}
                                    placeholder="Price e.g. $49.00 or From $30"
                                    className="w-full rounded border border-slate-200 px-2 py-0.5 text-xs font-semibold outline-none"
                                  />
                                </div>

                                {/* Description */}
                                <div>
                                  <label className="block text-[9px] font-semibold text-slate-400">Description</label>
                                  <textarea
                                    rows={2}
                                    value={item.description || ""}
                                    onChange={(e) => {
                                      const copy = [...(selectedElementAny.priceListItems || [])];
                                      copy[itemIdx] = { ...copy[itemIdx], description: e.target.value };
                                      updateSelectedProp("priceListItems", copy);
                                    }}
                                    placeholder="Short item description..."
                                    className="w-full rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 outline-none"
                                  />
                                </div>

                                {/* Thumbnail URL */}
                                {selectedElementAny.priceListShowImages !== false && (
                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-400">Image URL</label>
                                    <input
                                      type="text"
                                      value={item.imageUrl || ""}
                                      onChange={(e) => {
                                        const copy = [...(selectedElementAny.priceListItems || [])];
                                        copy[itemIdx] = { ...copy[itemIdx], imageUrl: e.target.value };
                                        updateSelectedProp("priceListItems", copy);
                                      }}
                                      placeholder="https://images.unsplash.com/..."
                                      className="w-full rounded border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500 font-mono outline-none"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Gallery Specific Properties (F-184) */}
                    {selectedElementAny.type === "gallery" && (
                      <div className="space-y-4">
                        {/* Grid Layout & Aspect Ratio */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Grid & Image Layout
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Columns
                              </label>
                              <select
                                value={selectedElementAny.galleryColumns || 3}
                                onChange={(e) => updateSelectedProp("galleryColumns", Number(e.target.value))}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
                              >
                                <option value={1}>1 Column</option>
                                <option value={2}>2 Columns</option>
                                <option value={3}>3 Columns</option>
                                <option value={4}>4 Columns</option>
                                <option value={5}>5 Columns</option>
                                <option value={6}>6 Columns</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Image Gap
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={60}
                                value={selectedElementAny.galleryGap ?? 16}
                                onChange={(e) => updateSelectedProp("galleryGap", Number(e.target.value))}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Aspect Ratio
                              </label>
                              <select
                                value={selectedElementAny.galleryAspectRatio || "square"}
                                onChange={(e) => updateSelectedProp("galleryAspectRatio", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
                              >
                                <option value="square">Square (1:1)</option>
                                <option value="landscape">Landscape (16:9)</option>
                                <option value="portrait">Portrait (3:4)</option>
                                <option value="auto">Original / Auto</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Hover Effect
                              </label>
                              <select
                                value={selectedElementAny.galleryHoverEffect || "zoom"}
                                onChange={(e) => updateSelectedProp("galleryHoverEffect", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
                              >
                                <option value="zoom">Zoom Scale</option>
                                <option value="lift">Lift & Elevation</option>
                                <option value="fade">Subtle Fade</option>
                                <option value="none">None</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Border Radius
                              </label>
                              <select
                                value={selectedElementAny.galleryBorderRadius || "16px"}
                                onChange={(e) => updateSelectedProp("galleryBorderRadius", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
                              >
                                <option value="0px">Square (0px)</option>
                                <option value="8px">Rounded Small (8px)</option>
                                <option value="16px">Rounded Large (16px)</option>
                                <option value="24px">Extra Rounded (24px)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Caption Style
                              </label>
                              <select
                                value={selectedElementAny.galleryCaptionPosition || "overlay"}
                                onChange={(e) => updateSelectedProp("galleryCaptionPosition", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pink-500"
                              >
                                <option value="overlay">Overlay on Image</option>
                                <option value="below">Below Image</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                            <label className="text-[11px] font-semibold text-slate-700 cursor-pointer">
                              Show Image Captions
                            </label>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.galleryShowCaptions !== false}
                              onChange={(e) => updateSelectedProp("galleryShowCaptions", e.target.checked)}
                              className="accent-pink-600 rounded cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Gallery Images Manager */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200/80 pb-2">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              Gallery Images ({(selectedElementAny.galleryImages || []).length})
                            </span>

                            <div className="flex items-center gap-1.5">
                              {/* Bulk Upload Button */}
                              <label className="rounded-lg bg-pink-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-pink-700 transition cursor-pointer flex items-center gap-1 shadow-xs">
                                <span>📁</span>
                                <span>Upload Photos</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => {
                                    const files = e.target.files;
                                    if (!files || files.length === 0) return;
                                    const currentItems = selectedElementAny.galleryImages || [];
                                    const fileArray = Array.from(files);
                                    const newItems: GalleryImageItem[] = [];
                                    let loadedCount = 0;

                                    fileArray.forEach((file, idx) => {
                                      const reader = new FileReader();
                                      reader.onload = (ev) => {
                                        if (ev.target?.result) {
                                          newItems.push({
                                            id: String(Date.now() + idx + Math.random()),
                                            url: ev.target.result as string,
                                            caption: file.name.replace(/\.[^/.]+$/, ""),
                                            altText: file.name,
                                          });
                                        }
                                        loadedCount++;
                                        if (loadedCount === fileArray.length) {
                                          updateSelectedProp("galleryImages", [...currentItems, ...newItems]);
                                        }
                                      };
                                      reader.readAsDataURL(file);
                                    });
                                    e.target.value = "";
                                  }}
                                />
                              </label>

                              {/* Add URL Item Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  const arr = selectedElementAny.galleryImages || [];
                                  const newImg: GalleryImageItem = {
                                    id: String(Date.now()),
                                    url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&fit=crop&q=80",
                                    caption: `Gallery Image ${arr.length + 1}`,
                                    altText: "Gallery Image",
                                  };
                                  updateSelectedProp("galleryImages", [...arr, newImg]);
                                }}
                                className="rounded-lg bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-300 transition cursor-pointer"
                              >
                                + URL
                              </button>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {(selectedElementAny.galleryImages || []).map((img, imgIdx) => (
                              <div key={img.id} className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2 shadow-2xs">
                                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                                  {/* Thumbnail preview */}
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-slate-100 border border-slate-200 relative">
                                      {img.url ? (
                                        <img src={img.url} alt="Thumbnail" className="h-full w-full object-cover" />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">📷</div>
                                      )}
                                    </div>
                                    <span className="font-bold text-xs text-slate-800 truncate">Photo #{imgIdx + 1}</span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const filtered = (selectedElementAny.galleryImages || []).filter((i) => i.id !== img.id);
                                      updateSelectedProp("galleryImages", filtered);
                                    }}
                                    className="h-5 w-5 shrink-0 rounded border border-red-200 bg-red-50 text-[10px] font-bold text-red-600 hover:bg-red-100 cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>

                                {/* Image Upload / URL Controls */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <label className="block text-[9px] font-semibold text-slate-400">Photo File / Source URL</label>
                                    <label className="text-[9px] font-bold text-pink-600 hover:text-pink-700 cursor-pointer flex items-center gap-1">
                                      <span>📤 Replace Photo</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          const reader = new FileReader();
                                          reader.onload = (ev) => {
                                            if (ev.target?.result) {
                                              const copy = [...(selectedElementAny.galleryImages || [])];
                                              copy[imgIdx] = {
                                                ...copy[imgIdx],
                                                url: ev.target.result as string,
                                                caption: copy[imgIdx].caption || file.name.replace(/\.[^/.]+$/, ""),
                                              };
                                              updateSelectedProp("galleryImages", copy);
                                            }
                                          };
                                          reader.readAsDataURL(file);
                                          e.target.value = "";
                                        }}
                                      />
                                    </label>
                                  </div>

                                  <input
                                    type="text"
                                    value={img.url}
                                    onChange={(e) => {
                                      const copy = [...(selectedElementAny.galleryImages || [])];
                                      copy[imgIdx] = { ...copy[imgIdx], url: e.target.value };
                                      updateSelectedProp("galleryImages", copy);
                                    }}
                                    placeholder="Paste Image URL or select local file..."
                                    className="w-full rounded border border-slate-200 px-2 py-1 text-[10px] text-slate-700 font-mono outline-none focus:border-pink-500"
                                  />
                                </div>

                                {/* Caption */}
                                <div>
                                  <label className="block text-[9px] font-semibold text-slate-400">Caption Text</label>
                                  <input
                                    type="text"
                                    value={img.caption || ""}
                                    onChange={(e) => {
                                      const copy = [...(selectedElementAny.galleryImages || [])];
                                      copy[imgIdx] = { ...copy[imgIdx], caption: e.target.value };
                                      updateSelectedProp("galleryImages", copy);
                                    }}
                                    placeholder="Image caption..."
                                    className="w-full rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-700 outline-none"
                                  />
                                </div>

                                {/* Alt Text */}
                                <div>
                                  <label className="block text-[9px] font-semibold text-slate-400">Alt Description (SEO)</label>
                                  <input
                                    type="text"
                                    value={img.altText || ""}
                                    onChange={(e) => {
                                      const copy = [...(selectedElementAny.galleryImages || [])];
                                      copy[imgIdx] = { ...copy[imgIdx], altText: e.target.value };
                                      updateSelectedProp("galleryImages", copy);
                                    }}
                                    placeholder="Alt text for accessibility..."
                                    className="w-full rounded border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500 outline-none"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Flip Box Specific Properties (F-185) */}
                    {selectedElementAny.type === "flip-box" && (
                      <div className="space-y-4">
                        {/* Card Animation & Dimensions Settings */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              Card Settings & Effect
                            </span>
                            <button
                              type="button"
                              onClick={() => updateSelectedProp("flipIsFlippedManual", !selectedElementAny.flipIsFlippedManual)}
                              className={`rounded px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${selectedElementAny.flipIsFlippedManual
                                ? "bg-amber-600 text-white"
                                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                }`}
                            >
                              {selectedElementAny.flipIsFlippedManual ? "Viewing: BACK" : "Flip to Back"}
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Flip Direction
                              </label>
                              <select
                                value={selectedElementAny.flipDirection || "flip-right"}
                                onChange={(e) => updateSelectedProp("flipDirection", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              >
                                <option value="flip-right">Flip Right (0° → 180°)</option>
                                <option value="flip-left">Flip Left (0° → -180°)</option>
                                <option value="flip-up">Flip Up (-180° X)</option>
                                <option value="flip-down">Flip Down (180° X)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Animation Speed
                              </label>
                              <select
                                value={selectedElementAny.flipDuration || "0.6s"}
                                onChange={(e) => updateSelectedProp("flipDuration", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              >
                                <option value="0.3s">Fast (0.3s)</option>
                                <option value="0.6s">Normal (0.6s)</option>
                                <option value="0.9s">Slow (0.9s)</option>
                                <option value="1.2s">Very Slow (1.2s)</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Card Height
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.flipCardHeight || "320px"}
                                onChange={(e) => updateSelectedProp("flipCardHeight", e.target.value)}
                                placeholder="320px"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500 font-mono"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Border Radius
                              </label>
                              <select
                                value={selectedElementAny.flipBorderRadius || "20px"}
                                onChange={(e) => updateSelectedProp("flipBorderRadius", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              >
                                <option value="0px">Square (0px)</option>
                                <option value="12px">Rounded (12px)</option>
                                <option value="20px">Large Curved (20px)</option>
                                <option value="32px">Pill / Heavy (32px)</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Front Card Content */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Front Card Content
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Icon / Emoji
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.flipFrontIcon || "🚀"}
                                onChange={(e) => updateSelectedProp("flipFrontIcon", e.target.value)}
                                placeholder="🚀, 💡, ⚡..."
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                                Image URL (Optional)
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.flipFrontImage || ""}
                                onChange={(e) => updateSelectedProp("flipFrontImage", e.target.value)}
                                placeholder="https://..."
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-mono text-slate-700 outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Front Title
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.flipFrontTitle !== undefined ? selectedElementAny.flipFrontTitle : "Interactive Solutions"}
                              onChange={(e) => updateSelectedProp("flipFrontTitle", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Front Description
                            </label>
                            <textarea
                              rows={2}
                              value={selectedElementAny.flipFrontDescription !== undefined ? selectedElementAny.flipFrontDescription : "Hover or tap to flip card and explore custom features."}
                              onChange={(e) => updateSelectedProp("flipFrontDescription", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Background Color / Gradient
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.flipFrontBg || "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"}
                                onChange={(e) => updateSelectedProp("flipFrontBg", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-mono text-slate-800 outline-none focus:border-amber-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Text Color
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.flipFrontTextColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("flipFrontTextColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.flipFrontTextColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("flipFrontTextColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Back Card Content */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Back Card Content
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Back Title
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.flipBackTitle !== undefined ? selectedElementAny.flipBackTitle : "Ready to Start?"}
                              onChange={(e) => updateSelectedProp("flipBackTitle", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Back Description
                            </label>
                            <textarea
                              rows={2}
                              value={selectedElementAny.flipBackDescription !== undefined ? selectedElementAny.flipBackDescription : "Join thousands of creators building high-converting websites."}
                              onChange={(e) => updateSelectedProp("flipBackDescription", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Text
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.flipBackBtnText !== undefined ? selectedElementAny.flipBackBtnText : "Get Started Now"}
                                onChange={(e) => updateSelectedProp("flipBackBtnText", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Link URL
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.flipBackBtnUrl || "#"}
                                onChange={(e) => updateSelectedProp("flipBackBtnUrl", e.target.value)}
                                placeholder="#"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-mono text-slate-800 outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Back Background
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.flipBackBg || "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"}
                                onChange={(e) => updateSelectedProp("flipBackBg", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-mono text-slate-800 outline-none focus:border-amber-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Back Text Color
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.flipBackTextColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("flipBackTextColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.flipBackTextColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("flipBackTextColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Background
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.flipBackBtnBg || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("flipBackBtnBg", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.flipBackBtnBg || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("flipBackBtnBg", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none font-mono"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Text Color
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.flipBackBtnTextColor || "#4f46e5"}
                                  onChange={(e) => updateSelectedProp("flipBackBtnTextColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.flipBackBtnTextColor || "#4f46e5"}
                                  onChange={(e) => updateSelectedProp("flipBackBtnTextColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Call to Action Specific Properties (F-186) */}
                    {selectedElementAny.type === "call-to-action" && (
                      <CTAWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Media Carousel Specific Properties (F-187) */}
                    {selectedElementAny.type === "media-carousel" && (
                      <MediaCarouselWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Testimonial Carousel Specific Properties (F-188) */}
                    {selectedElementAny.type === "testimonial-carousel" && (
                      <TestimonialCarouselWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Nested Carousel Inspector Panel (F-189) */}
                    {selectedElementAny.type === "nested-carousel" && (
                      <NestedCarouselWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                        setSelectedId={setSelectedId}
                      />
                    )}

                    {/* Loop Carousel Inspector Panel (F-190) */}
                    {selectedElementAny.type === "loop-carousel" && (
                      <LoopCarouselWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Table of Contents Inspector Panel (F-191) */}
                    {selectedElementAny.type === "table-of-contents" && (
                      <TOCWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Countdown Inspector Panel (F-192) */}
                    {selectedElementAny.type === "countdown" && (
                      <div className="space-y-4">
                        {/* Target Date & Time */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Target Date & Time
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Target Date & Time
                            </label>
                            <input
                              type="datetime-local"
                              value={selectedElementAny.countdownTargetDate || ""}
                              onChange={(e) => updateSelectedProp("countdownTargetDate", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Expired Message
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.countdownExpiredMessage || "Event Has Ended!"}
                              onChange={(e) => updateSelectedProp("countdownExpiredMessage", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none"
                            />
                          </div>
                        </div>

                        {/* Display Units */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Displayed Units & Labels
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.countdownShowDays !== false}
                                  onChange={(e) => updateSelectedProp("countdownShowDays", e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <span>Days</span>
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.countdownDaysLabel || "Days"}
                                onChange={(e) => updateSelectedProp("countdownDaysLabel", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-800 outline-none"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.countdownShowHours !== false}
                                  onChange={(e) => updateSelectedProp("countdownShowHours", e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <span>Hours</span>
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.countdownHoursLabel || "Hours"}
                                onChange={(e) => updateSelectedProp("countdownHoursLabel", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-800 outline-none"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.countdownShowMinutes !== false}
                                  onChange={(e) => updateSelectedProp("countdownShowMinutes", e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <span>Minutes</span>
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.countdownMinutesLabel || "Minutes"}
                                onChange={(e) => updateSelectedProp("countdownMinutesLabel", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-800 outline-none"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.countdownShowSeconds !== false}
                                  onChange={(e) => updateSelectedProp("countdownShowSeconds", e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <span>Seconds</span>
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.countdownSecondsLabel || "Seconds"}
                                onChange={(e) => updateSelectedProp("countdownSecondsLabel", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-800 outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Layout & Styling */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Layout & Box Styling
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Alignment</label>
                              <select
                                value={selectedElementAny.countdownAlignment || "center"}
                                onChange={(e) => updateSelectedProp("countdownAlignment", e.target.value as "left" | "center" | "right")}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Box Gap (px)</label>
                              <input
                                type="number"
                                value={selectedElementAny.countdownGap ?? 16}
                                onChange={(e) => updateSelectedProp("countdownGap", Number(e.target.value))}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Number Size</label>
                              <input
                                type="text"
                                value={selectedElementAny.countdownNumberSize || "32px"}
                                onChange={(e) => updateSelectedProp("countdownNumberSize", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Label Size</label>
                              <input
                                type="text"
                                value={selectedElementAny.countdownLabelSize || "11px"}
                                onChange={(e) => updateSelectedProp("countdownLabelSize", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Box Background</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.countdownBoxBg || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("countdownBoxBg", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.countdownBoxBg || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("countdownBoxBg", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Number Color</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.countdownNumberColor || "#0f172a"}
                                  onChange={(e) => updateSelectedProp("countdownNumberColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.countdownNumberColor || "#0f172a"}
                                  onChange={(e) => updateSelectedProp("countdownNumberColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Border Color</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.countdownBoxBorder || "#e2e8f0"}
                                  onChange={(e) => updateSelectedProp("countdownBoxBorder", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.countdownBoxBorder || "#e2e8f0"}
                                  onChange={(e) => updateSelectedProp("countdownBoxBorder", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Label Color</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.countdownLabelColor || "#64748b"}
                                  onChange={(e) => updateSelectedProp("countdownLabelColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.countdownLabelColor || "#64748b"}
                                  onChange={(e) => updateSelectedProp("countdownLabelColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Facebook Page Inspector Panel (F-193) */}
                    {selectedElementAny.type === "facebook-page" && (
                      <div className="space-y-4">
                        {/* Page URL & Tabs */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Facebook Page Configuration
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Facebook Page URL
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.facebookPageUrl || ""}
                              onChange={(e) => updateSelectedProp("facebookPageUrl", e.target.value)}
                              placeholder="https://www.facebook.com/facebook"
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Displayed Tabs
                            </label>
                            <select
                              value={selectedElementAny.facebookTabs || "timeline"}
                              onChange={(e) => updateSelectedProp("facebookTabs", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                            >
                              <option value="timeline">Timeline</option>
                              <option value="events">Events</option>
                              <option value="messages">Messages</option>
                              <option value="timeline,events">Timeline & Events</option>
                              <option value="timeline,messages">Timeline & Messages</option>
                              <option value="events,messages">Events & Messages</option>
                              <option value="timeline,events,messages">Timeline, Events & Messages</option>
                            </select>
                          </div>
                        </div>

                        {/* Dimensions & Alignment */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Dimensions & Alignment
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Width (px)
                              </label>
                              <input
                                type="number"
                                min={180}
                                max={500}
                                value={selectedElementAny.facebookWidth ?? 340}
                                onChange={(e) => updateSelectedProp("facebookWidth", Number(e.target.value))}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Height (px)
                              </label>
                              <input
                                type="number"
                                min={130}
                                max={1000}
                                value={selectedElementAny.facebookHeight ?? 500}
                                onChange={(e) => updateSelectedProp("facebookHeight", Number(e.target.value))}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Alignment
                            </label>
                            <select
                              value={selectedElementAny.facebookAlignment || "center"}
                              onChange={(e) => updateSelectedProp("facebookAlignment", e.target.value as "left" | "center" | "right")}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                        </div>

                        {/* Display Options Toggles */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Display Controls
                          </span>

                          <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer py-1">
                            <span>Adapt Container Width</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.facebookAdaptContainerWidth !== false}
                              onChange={(e) => updateSelectedProp("facebookAdaptContainerWidth", e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </label>

                          <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer py-1 border-t border-slate-200/60">
                            <span>Use Small Header</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.facebookSmallHeader === true}
                              onChange={(e) => updateSelectedProp("facebookSmallHeader", e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </label>

                          <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer py-1 border-t border-slate-200/60">
                            <span>Hide Cover Photo</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.facebookHideCover === true}
                              onChange={(e) => updateSelectedProp("facebookHideCover", e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </label>

                          <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer py-1 border-t border-slate-200/60">
                            <span>Show Friend Faces</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.facebookShowFacepile !== false}
                              onChange={(e) => updateSelectedProp("facebookShowFacepile", e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Blockquote Inspector Panel (F-194) */}
                    {selectedElementAny.type === "blockquote" && (
                      <div className="space-y-4">
                        {/* Content & Citation */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Quote Content & Citation
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Quotation Text
                            </label>
                            <textarea
                              rows={3}
                              value={selectedElementAny.content || selectedElementAny.quoteContent || ""}
                              onChange={(e) => {
                                updateSelectedProp("content", e.target.value);
                                updateSelectedProp("quoteContent", e.target.value);
                              }}
                              placeholder="The only way to do great work is to love what you do."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Author Name
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.quoteAuthor || ""}
                                onChange={(e) => updateSelectedProp("quoteAuthor", e.target.value)}
                                placeholder="Steve Jobs"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Citation / Title
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.quoteCitation || ""}
                                onChange={(e) => updateSelectedProp("quoteCitation", e.target.value)}
                                placeholder="Co-founder, Apple Inc."
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Style Variant & Alignment */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Style Variant & Layout
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Style Variant
                              </label>
                              <select
                                value={selectedElementAny.quoteStyle || "accent-left"}
                                onChange={(e) => updateSelectedProp("quoteStyle", e.target.value as "accent-left" | "boxed" | "centered-clean" | "top-border")}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="accent-left">Left Accent Line</option>
                                <option value="boxed">Boxed Card</option>
                                <option value="top-border">Top Accent Line</option>
                                <option value="centered-clean">Centered Clean</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Text Alignment
                              </label>
                              <select
                                value={selectedElementAny.quoteAlignment || "left"}
                                onChange={(e) => updateSelectedProp("quoteAlignment", e.target.value as "left" | "center" | "right")}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Icon & Colors */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Appearance & Colors
                          </span>

                          <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer py-0.5">
                            <span>Show Decorative Quote Icon</span>
                            <input
                              type="checkbox"
                              checked={selectedElementAny.quoteShowIcon !== false}
                              onChange={(e) => updateSelectedProp("quoteShowIcon", e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </label>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Icon Color</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.quoteIconColor || "#6366f1"}
                                  onChange={(e) => updateSelectedProp("quoteIconColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.quoteIconColor || "#6366f1"}
                                  onChange={(e) => updateSelectedProp("quoteIconColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Border/Accent</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.quoteBorderColor || "#6366f1"}
                                  onChange={(e) => updateSelectedProp("quoteBorderColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.quoteBorderColor || "#6366f1"}
                                  onChange={(e) => updateSelectedProp("quoteBorderColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Quote Text Color</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.quoteTextColor || "#1e293b"}
                                  onChange={(e) => updateSelectedProp("quoteTextColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.quoteTextColor || "#1e293b"}
                                  onChange={(e) => updateSelectedProp("quoteTextColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Author Color</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.quoteAuthorColor || "#475569"}
                                  onChange={(e) => updateSelectedProp("quoteAuthorColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.quoteAuthorColor || "#475569"}
                                  onChange={(e) => updateSelectedProp("quoteAuthorColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Template Inspector Panel (F-195) */}
                    {selectedElementAny.type === "template" && (
                      <div className="space-y-4">
                        {/* Source Selection & Picker */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Template Source & Selection
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                              Template Source Type
                            </label>
                            <div className="grid grid-cols-2 gap-1 bg-slate-200/60 p-1 rounded-lg">
                              <button
                                type="button"
                                onClick={() => {
                                  updateSelectedProp("templateSource", "preset");
                                  updateSelectedProp("templateId", undefined);
                                  if (!selectedElementAny.templatePresetName) {
                                    updateSelectedProp("templatePresetName", "hero");
                                  }
                                }}
                                className={`py-1 text-xs font-bold rounded-md transition ${selectedElementAny.templateSource !== "custom"
                                  ? "bg-white text-purple-700 shadow-2xs"
                                  : "text-slate-600 hover:text-slate-900"
                                  }`}
                              >
                                Presets
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateSelectedProp("templateSource", "custom");
                                  updateSelectedProp("templatePresetName", undefined);
                                  const firstCompKey = Object.keys(components)[0];
                                  if (firstCompKey) {
                                    updateSelectedProp("templateId", firstCompKey);
                                  }
                                }}
                                className={`py-1 text-xs font-bold rounded-md transition ${selectedElementAny.templateSource === "custom"
                                  ? "bg-white text-purple-700 shadow-2xs"
                                  : "text-slate-600 hover:text-slate-900"
                                  }`}
                              >
                                Saved Components
                              </button>
                            </div>
                          </div>

                          {selectedElementAny.templateSource === "custom" ? (
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Select Saved Reusable Component
                              </label>
                              {Object.keys(components).length === 0 ? (
                                <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-2.5 text-center text-[10px] font-medium text-purple-700">
                                  No components saved yet. Select any element & click "Save as Comp".
                                </div>
                              ) : (
                                <select
                                  value={selectedElementAny.templateId || ""}
                                  onChange={(e) => updateSelectedProp("templateId", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500"
                                >
                                  <option value="">-- Choose Component --</option>
                                  {Object.entries(components).map(([compId, comp]) => (
                                    <option key={compId} value={compId}>
                                      {comp.name} ({comp.element.type})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Select Section Template Preset
                              </label>
                              <select
                                value={selectedElementAny.templatePresetName || "hero"}
                                onChange={(e) => updateSelectedProp("templatePresetName", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500"
                              >
                                {Object.entries(PRESET_SECTION_TEMPLATES).map(([key, tpl]) => (
                                  <option key={key} value={key}>
                                    {tpl.icon} {tpl.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleUnpackTemplate(selectedElementAny.id)}
                            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-purple-700 active:scale-98 mt-2"
                          >
                            <span>⚡</span>
                            <span>Unpack / Insert into Canvas</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Reviews Inspector Panel (F-196) */}
                    {selectedElementAny.type === "reviews" && (
                      <div className="space-y-4">
                        {/* Layout & Columns */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Layout & Alignment
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Layout Mode</label>
                              <select
                                value={selectedElementAny.reviewLayout || "grid"}
                                onChange={(e) => updateSelectedProp("reviewLayout", e.target.value as "grid" | "list")}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="grid">Grid Layout</option>
                                <option value="list">List Layout</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Grid Columns</label>
                              <select
                                value={selectedElementAny.reviewColumns || 3}
                                onChange={(e) => updateSelectedProp("reviewColumns", parseInt(e.target.value))}
                                disabled={selectedElementAny.reviewLayout === "list"}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none disabled:opacity-50"
                              >
                                <option value={1}>1 Column</option>
                                <option value={2}>2 Columns</option>
                                <option value={3}>3 Columns</option>
                                <option value={4}>4 Columns</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Text Alignment</label>
                            <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-1 rounded-lg">
                              {(["left", "center", "right"] as const).map((align) => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateSelectedProp("reviewAlignment", align)}
                                  className={`py-1 text-xs font-bold capitalize rounded-md transition ${(selectedElementAny.reviewAlignment || "left") === align
                                    ? "bg-white text-amber-700 shadow-2xs"
                                    : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Colors & Visual Features */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Color & Badges
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Star Rating Color</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.reviewStarColor || "#f59e0b"}
                                  onChange={(e) => updateSelectedProp("reviewStarColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.reviewStarColor || "#f59e0b"}
                                  onChange={(e) => updateSelectedProp("reviewStarColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Card Background</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.reviewCardBg || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("reviewCardBg", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.reviewCardBg || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("reviewCardBg", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedElementAny.reviewShowAvatar !== false}
                                onChange={(e) => updateSelectedProp("reviewShowAvatar", e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                              />
                              <span>Show Avatars</span>
                            </label>

                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedElementAny.reviewShowVerified !== false}
                                onChange={(e) => updateSelectedProp("reviewShowVerified", e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span>Show Verified Badge</span>
                            </label>
                          </div>
                        </div>

                        {/* Visitor Manual Submission Options */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Manual Review Submissions
                          </span>

                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.reviewAllowSubmission !== false}
                              onChange={(e) => updateSelectedProp("reviewAllowSubmission", e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                            <span>Enable "Write a Review" Button</span>
                          </label>

                          {selectedElementAny.reviewAllowSubmission !== false && (
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Submit Button Text
                              </label>
                              <input
                                type="text"
                                value={selectedElementAny.reviewSubmissionButtonText || "+ Write a Review"}
                                onChange={(e) => updateSelectedProp("reviewSubmissionButtonText", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>
                          )}
                        </div>

                        {/* Customer Review Items Manager */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              Customer Reviews ({selectedElementAny.reviewItems?.length || 0})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const current = selectedElementAny.reviewItems || [];
                                const newItem: ReviewItem = {
                                  id: "rev-" + Date.now(),
                                  reviewerName: "Alex Rivera",
                                  reviewerTitle: "Verified Customer",
                                  reviewText: "Fantastic experience! Highly recommended product.",
                                  rating: 5,
                                  avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
                                  verified: true,
                                };
                                updateSelectedProp("reviewItems", [...current, newItem]);
                              }}
                              className="flex items-center gap-1 rounded bg-amber-600 px-2 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-amber-700 transition"
                            >
                              <span>+</span> Add Review
                            </button>
                          </div>

                          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                            {(selectedElementAny.reviewItems || []).map((rev, idx) => (
                              <div key={rev.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5 shadow-2xs">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                  <span className="text-xs font-bold text-amber-800">
                                    Review #{idx + 1}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {idx > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const items = [...(selectedElementAny.reviewItems || [])];
                                          const temp = items[idx];
                                          items[idx] = items[idx - 1];
                                          items[idx - 1] = temp;
                                          updateSelectedProp("reviewItems", items);
                                        }}
                                        className="px-1 text-[10px] text-slate-500 hover:text-slate-900"
                                        title="Move Up"
                                      >
                                        ▲
                                      </button>
                                    )}
                                    {idx < (selectedElementAny.reviewItems?.length || 0) - 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const items = [...(selectedElementAny.reviewItems || [])];
                                          const temp = items[idx];
                                          items[idx] = items[idx + 1];
                                          items[idx + 1] = temp;
                                          updateSelectedProp("reviewItems", items);
                                        }}
                                        className="px-1 text-[10px] text-slate-500 hover:text-slate-900"
                                        title="Move Down"
                                      >
                                        ▼
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const items = (selectedElementAny.reviewItems || []).filter((i) => i.id !== rev.id);
                                        updateSelectedProp("reviewItems", items);
                                      }}
                                      className="ml-1 text-[10px] font-bold text-red-500 hover:text-red-700"
                                      title="Remove Review"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Name</label>
                                    <input
                                      type="text"
                                      value={rev.reviewerName}
                                      onChange={(e) => {
                                        const items = [...(selectedElementAny.reviewItems || [])];
                                        items[idx] = { ...items[idx], reviewerName: e.target.value };
                                        updateSelectedProp("reviewItems", items);
                                      }}
                                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Rating</label>
                                    <select
                                      value={rev.rating || 5}
                                      onChange={(e) => {
                                        const items = [...(selectedElementAny.reviewItems || [])];
                                        items[idx] = { ...items[idx], rating: parseInt(e.target.value) };
                                        updateSelectedProp("reviewItems", items);
                                      }}
                                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                                    >
                                      <option value={5}>5 Stars (★★★★★)</option>
                                      <option value={4}>4 Stars (★★★★☆)</option>
                                      <option value={3}>3 Stars (★★★☆☆)</option>
                                      <option value={2}>2 Stars (★★☆☆☆)</option>
                                      <option value={1}>1 Star (★☆☆☆☆)</option>
                                    </select>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Title / Role</label>
                                  <input
                                    type="text"
                                    value={rev.reviewerTitle || ""}
                                    onChange={(e) => {
                                      const items = [...(selectedElementAny.reviewItems || [])];
                                      items[idx] = { ...items[idx], reviewerTitle: e.target.value };
                                      updateSelectedProp("reviewItems", items);
                                    }}
                                    placeholder="Verified Buyer"
                                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Review Text</label>
                                  <textarea
                                    rows={2}
                                    value={rev.reviewText}
                                    onChange={(e) => {
                                      const items = [...(selectedElementAny.reviewItems || [])];
                                      items[idx] = { ...items[idx], reviewText: e.target.value };
                                      updateSelectedProp("reviewItems", items);
                                    }}
                                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-normal text-slate-800 outline-none"
                                  />
                                </div>

                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="block text-[10px] font-semibold text-slate-500">Avatar Image</label>
                                    <label className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded cursor-pointer border border-amber-200">
                                      <span>📁 Upload File</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                              if (typeof reader.result === "string") {
                                                const items = [...(selectedElementAny.reviewItems || [])];
                                                items[idx] = { ...items[idx], avatarUrl: reader.result };
                                                updateSelectedProp("reviewItems", items);
                                              }
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                      />
                                    </label>
                                  </div>
                                  <input
                                    type="text"
                                    value={rev.avatarUrl || ""}
                                    onChange={(e) => {
                                      const items = [...(selectedElementAny.reviewItems || [])];
                                      items[idx] = { ...items[idx], avatarUrl: e.target.value };
                                      updateSelectedProp("reviewItems", items);
                                    }}
                                    placeholder="https://..."
                                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                  />
                                </div>

                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-0.5">
                                  <input
                                    type="checkbox"
                                    checked={rev.verified ?? true}
                                    onChange={(e) => {
                                      const items = [...(selectedElementAny.reviewItems || [])];
                                      items[idx] = { ...items[idx], verified: e.target.checked };
                                      updateSelectedProp("reviewItems", items);
                                    }}
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                  />
                                  <span>Verified Customer Badge</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Facebook Button Inspector Panel (F-197) */}
                    {selectedElementAny.type === "facebook-button" && (
                      <div className="space-y-4">
                        {/* Facebook Button Configuration */}
                        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                            <FacebookButtonBoxIcon />
                            <span>Facebook Button Settings</span>
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Target Facebook URL *
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.fbButtonUrl || "https://facebook.com"}
                              onChange={(e) => updateSelectedProp("fbButtonUrl", e.target.value)}
                              placeholder="https://facebook.com/yourpage"
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Button Label *
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.fbButtonLabel || "Like Us on Facebook"}
                              onChange={(e) => updateSelectedProp("fbButtonLabel", e.target.value)}
                              placeholder="e.g. Like Us on Facebook, Share Page, Follow Us"
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Action
                              </label>
                              <select
                                value={selectedElementAny.fbButtonAction || "like"}
                                onChange={(e) => updateSelectedProp("fbButtonAction", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="like">Like</option>
                                <option value="share">Share</option>
                                <option value="follow">Follow</option>
                                <option value="custom">Custom</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Button Size
                              </label>
                              <select
                                value={selectedElementAny.fbButtonSize || "md"}
                                onChange={(e) => updateSelectedProp("fbButtonSize", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="sm">Small</option>
                                <option value="md">Medium</option>
                                <option value="lg">Large</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Alignment
                            </label>
                            <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-1 rounded-lg">
                              {(["left", "center", "right"] as const).map((align) => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateSelectedProp("fbButtonAlignment", align)}
                                  className={`py-1 text-xs font-bold capitalize rounded-md transition ${(selectedElementAny.fbButtonAlignment || "left") === align
                                    ? "bg-white text-blue-700 shadow-2xs"
                                    : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Color Customization */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                            Button Colors & Styling
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Background</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.fbButtonBgColor || "#1877F2"}
                                  onChange={(e) => updateSelectedProp("fbButtonBgColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.fbButtonBgColor || "#1877F2"}
                                  onChange={(e) => updateSelectedProp("fbButtonBgColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Hover Background</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.fbButtonHoverBgColor || "#0d65d9"}
                                  onChange={(e) => updateSelectedProp("fbButtonHoverBgColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.fbButtonHoverBgColor || "#0d65d9"}
                                  onChange={(e) => updateSelectedProp("fbButtonHoverBgColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Text & Icon Color</label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={selectedElementAny.fbButtonTextColor || "#ffffff"}
                                onChange={(e) => updateSelectedProp("fbButtonTextColor", e.target.value)}
                                className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                              />
                              <input
                                type="text"
                                value={selectedElementAny.fbButtonTextColor || "#ffffff"}
                                onChange={(e) => updateSelectedProp("fbButtonTextColor", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Facebook Embed Inspector Panel (F-198) */}
                    {selectedElementAny.type === "facebook-embed" && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                            <FacebookEmbedBoxIcon />
                            <span>Facebook Embed Settings</span>
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Post or Video URL *
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.fbEmbedUrl || "https://www.facebook.com/facebook"}
                              onChange={(e) => updateSelectedProp("fbEmbedUrl", e.target.value)}
                              placeholder="https://www.facebook.com/username/posts/123"
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Width</label>
                              <input
                                type="text"
                                value={selectedElementAny.fbEmbedWidth || "100%"}
                                onChange={(e) => updateSelectedProp("fbEmbedWidth", e.target.value)}
                                placeholder="e.g. 100% or 500px"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Height</label>
                              <input
                                type="text"
                                value={selectedElementAny.fbEmbedHeight || "450px"}
                                onChange={(e) => updateSelectedProp("fbEmbedHeight", e.target.value)}
                                placeholder="e.g. 450px"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Alignment</label>
                            <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-1 rounded-lg">
                              {(["left", "center", "right"] as const).map((align) => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateSelectedProp("fbEmbedAlignment", align)}
                                  className={`py-1 text-xs font-bold capitalize rounded-md transition ${(selectedElementAny.fbEmbedAlignment || "center") === align
                                    ? "bg-white text-blue-700 shadow-2xs"
                                    : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Facebook Comments Inspector Panel (F-199) */}
                    {selectedElementAny.type === "facebook-comments" && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                            <FacebookCommentsBoxIcon />
                            <span>Facebook Comments Settings</span>
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Target Discussion URL *
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.fbCommentsUrl || "https://facebook.com"}
                              onChange={(e) => updateSelectedProp("fbCommentsUrl", e.target.value)}
                              placeholder="https://yourwebsite.com/blog/article-1"
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Number of Posts</label>
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={selectedElementAny.fbCommentsNumPosts || 5}
                                onChange={(e) => updateSelectedProp("fbCommentsNumPosts", parseInt(e.target.value) || 5)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Container Width</label>
                              <input
                                type="text"
                                value={selectedElementAny.fbCommentsWidth || "100%"}
                                onChange={(e) => updateSelectedProp("fbCommentsWidth", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Alignment</label>
                            <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-1 rounded-lg">
                              {(["left", "center", "right"] as const).map((align) => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateSelectedProp("fbCommentsAlignment", align)}
                                  className={`py-1 text-xs font-bold capitalize rounded-md transition ${(selectedElementAny.fbCommentsAlignment || "center") === align
                                    ? "bg-white text-blue-700 shadow-2xs"
                                    : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PayPal Button Inspector Panel (F-200 / F-217) */}
                    {selectedElementAny.type === "paypal-button" && (
                      <PayPalWidgetInspector
                        el={selectedElementAny}
                        updateProp={updateSelectedProp}
                      />
                    )}

                    {/* Stripe Button Inspector Panel (F-201) */}
                    {selectedElementAny.type === "stripe-button" && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                            <StripeButtonBoxIcon />
                            <span>Stripe Checkout Settings</span>
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Button Text
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.stripeText || "Checkout with Stripe"}
                              onChange={(e) => updateSelectedProp("stripeText", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Stripe Payment Link URL *
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.stripeCheckoutUrl || "https://buy.stripe.com"}
                              onChange={(e) => updateSelectedProp("stripeCheckoutUrl", e.target.value)}
                              placeholder="https://buy.stripe.com/..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Display Amount</label>
                              <input
                                type="text"
                                value={selectedElementAny.stripeAmount || "$49.00"}
                                onChange={(e) => updateSelectedProp("stripeAmount", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Size</label>
                              <select
                                value={selectedElementAny.stripeButtonSize || "md"}
                                onChange={(e) => updateSelectedProp("stripeButtonSize", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="sm">Small</option>
                                <option value="md">Medium</option>
                                <option value="lg">Large</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">Colors</span>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Background</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.stripeBgColor || "#635BFF"}
                                  onChange={(e) => updateSelectedProp("stripeBgColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.stripeBgColor || "#635BFF"}
                                  onChange={(e) => updateSelectedProp("stripeBgColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Text Color</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={selectedElementAny.stripeTextColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("stripeTextColor", e.target.value)}
                                  className="h-6 w-6 rounded cursor-pointer border border-slate-200 p-0.5"
                                />
                                <input
                                  type="text"
                                  value={selectedElementAny.stripeTextColor || "#ffffff"}
                                  onChange={(e) => updateSelectedProp("stripeTextColor", e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Lottie Inspector Panel (F-202) */}
                    {selectedElementAny.type === "lottie" && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                            <LottieBoxIcon />
                            <span>Lottie Animation Settings</span>
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Lottie JSON Animation URL *
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.lottieUrl || ""}
                              onChange={(e) => updateSelectedProp("lottieUrl", e.target.value)}
                              placeholder="https://assets9.lottiefiles.com/..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 outline-none focus:border-teal-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Width</label>
                              <input
                                type="text"
                                value={selectedElementAny.lottieWidth || "280px"}
                                onChange={(e) => updateSelectedProp("lottieWidth", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Height</label>
                              <input
                                type="text"
                                value={selectedElementAny.lottieHeight || "280px"}
                                onChange={(e) => updateSelectedProp("lottieHeight", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedElementAny.lottieAutoplay ?? true}
                                onChange={(e) => updateSelectedProp("lottieAutoplay", e.target.checked)}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              />
                              <span>Autoplay</span>
                            </label>

                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedElementAny.lottieLoop ?? true}
                                onChange={(e) => updateSelectedProp("lottieLoop", e.target.checked)}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              />
                              <span>Loop</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Code Highlight Inspector Panel (F-203) */}
                    {selectedElementAny.type === "code-highlight" && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                            <CodeHighlightBoxIcon />
                            <span>Code Highlight Settings</span>
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Language
                            </label>
                            <select
                              value={selectedElementAny.codeLanguage || "typescript"}
                              onChange={(e) => updateSelectedProp("codeLanguage", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none"
                            >
                              <option value="typescript">TypeScript</option>
                              <option value="javascript">JavaScript</option>
                              <option value="python">Python</option>
                              <option value="html">HTML</option>
                              <option value="css">CSS</option>
                              <option value="json">JSON</option>
                              <option value="bash">Bash / Shell</option>
                              <option value="sql">SQL</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                              Code Snippet Content
                            </label>
                            <textarea
                              rows={6}
                              value={selectedElementAny.codeSnippet || ""}
                              onChange={(e) => updateSelectedProp("codeSnippet", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 outline-none leading-relaxed"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Theme Mode</label>
                              <select
                                value={selectedElementAny.codeTheme || "dark"}
                                onChange={(e) => updateSelectedProp("codeTheme", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="dark">Dark (Vs Code Dark)</option>
                                <option value="light">Light (Vs Code Light)</option>
                              </select>
                            </div>

                            <div className="flex items-center pt-4">
                              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.codeShowLineNumbers ?? true}
                                  onChange={(e) => updateSelectedProp("codeShowLineNumbers", e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span>Line Numbers</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Video Playlist Inspector Panel (F-204) */}
                    {selectedElementAny.type === "video-playlist" && (() => {
                      const items: PlaylistItem[] = selectedElementAny.playlistItems?.length
                        ? selectedElementAny.playlistItems
                        : [
                          {
                            id: "1",
                            title: "ForgeStudio Platform Overview & Quick Start Guide",
                            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                            videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                            duration: "3:45",
                            thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80",
                            thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80",
                          },
                          {
                            id: "2",
                            title: "Designing Responsive SaaS Layouts in Record Time",
                            url: "https://vimeo.com/76979871",
                            videoUrl: "https://vimeo.com/76979871",
                            duration: "5:12",
                            thumbnail: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=400&q=80",
                            thumbnailUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=400&q=80",
                          },
                        ];

                      return (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 space-y-3">
                            <span className="block text-[11px] font-bold text-red-900 uppercase tracking-wider flex items-center gap-1.5">
                              <VideoPlaylistBoxIcon />
                              <span>Video Playlist Settings</span>
                            </span>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                                Playlist Layout Position
                              </label>
                              <div className="grid grid-cols-2 gap-1 bg-slate-200/60 p-1 rounded-lg">
                                {(["right", "bottom"] as const).map((pos) => (
                                  <button
                                    key={pos}
                                    type="button"
                                    onClick={() => updateSelectedProp("playlistPosition", pos)}
                                    className={`py-1 text-xs font-bold capitalize rounded-md transition ${(selectedElementAny.playlistPosition || "right") === pos
                                      ? "bg-white text-red-700 shadow-2xs"
                                      : "text-slate-600 hover:text-slate-900"
                                      }`}
                                  >
                                    {pos}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Dynamic Video Playlist Editor */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                Playlist Videos ({items.length})
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newItem: PlaylistItem = {
                                    id: `v_${Date.now()}`,
                                    title: `New Video ${items.length + 1}`,
                                    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                                    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                                    duration: "2:30",
                                    thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80",
                                    thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80",
                                  };
                                  updateSelectedProp("playlistItems", [...items, newItem]);
                                }}
                                className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-red-700 transition cursor-pointer"
                              >
                                + Add Video
                              </button>
                            </div>

                            <div className="space-y-3">
                              {items.map((item, idx) => (
                                <div
                                  key={item.id || idx}
                                  className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 shadow-2xs"
                                >
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                    <span className="text-xs font-bold text-red-700">Video #{idx + 1}</span>
                                    {items.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = items.filter((_, i) => i !== idx);
                                          updateSelectedProp("playlistItems", updated);
                                        }}
                                        className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:underline"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Title</label>
                                    <input
                                      type="text"
                                      value={item.title || ""}
                                      onChange={(e) => {
                                        const updated = [...items];
                                        updated[idx] = { ...updated[idx], title: e.target.value };
                                        updateSelectedProp("playlistItems", updated);
                                      }}
                                      placeholder="Video Title"
                                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-red-500"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Video URL (YouTube, Vimeo, MP4 link) *
                                    </label>
                                    <input
                                      type="text"
                                      value={item.videoUrl || ""}
                                      onChange={(e) => {
                                        const updated = [...items];
                                        updated[idx] = { ...updated[idx], videoUrl: e.target.value };
                                        updateSelectedProp("playlistItems", updated);
                                      }}
                                      placeholder="https://www.youtube.com/watch?v=..."
                                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-800 outline-none focus:border-red-500"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Duration</label>
                                      <input
                                        type="text"
                                        value={item.duration || ""}
                                        onChange={(e) => {
                                          const updated = [...items];
                                          updated[idx] = { ...updated[idx], duration: e.target.value };
                                          updateSelectedProp("playlistItems", updated);
                                        }}
                                        placeholder="e.g. 4:15"
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                      />
                                    </div>

                                    <div>
                                      <div className="flex items-center justify-between mb-0.5">
                                        <label className="block text-[10px] font-semibold text-slate-500">Thumbnail</label>
                                        <label className="text-[9px] font-bold text-red-600 hover:text-red-800 cursor-pointer">
                                          📁 Upload
                                          <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                  if (typeof reader.result === "string") {
                                                    const updated = [...items];
                                                    updated[idx] = { ...updated[idx], thumbnail: reader.result };
                                                    updateSelectedProp("playlistItems", updated);
                                                  }
                                                };
                                                reader.readAsDataURL(file);
                                              }
                                            }}
                                          />
                                        </label>
                                      </div>
                                      <input
                                        type="text"
                                        value={item.thumbnail || ""}
                                        onChange={(e) => {
                                          const updated = [...items];
                                          updated[idx] = { ...updated[idx], thumbnail: e.target.value };
                                          updateSelectedProp("playlistItems", updated);
                                        }}
                                        placeholder="https://..."
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Mega Menu Inspector Panel (F-205) */}
                    {selectedElementAny.type === "mega-menu" && (
                      <div className="space-y-4">
                        {/* General Settings */}
                        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                            <MegaMenuBoxIcon />
                            <span>Mega Menu Navigation Settings</span>
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Background</label>
                              <input
                                type="color"
                                value={selectedElementAny.megaMenuBgColor || "#ffffff"}
                                onChange={(e) => updateSelectedProp("megaMenuBgColor", e.target.value)}
                                className="h-8 w-full cursor-pointer rounded border border-slate-200 p-0.5 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Text Color</label>
                              <input
                                type="color"
                                value={selectedElementAny.megaMenuTextColor || "#0f172a"}
                                onChange={(e) => updateSelectedProp("megaMenuTextColor", e.target.value)}
                                className="h-8 w-full cursor-pointer rounded border border-slate-200 p-0.5 bg-white"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Alignment</label>
                              <select
                                value={selectedElementAny.megaMenuAlignment || "center"}
                                onChange={(e) => updateSelectedProp("megaMenuAlignment", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                              >
                                <option value="left">Left Align</option>
                                <option value="center">Center Align</option>
                                <option value="right">Right Align</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Menu Trigger</label>
                              <select
                                value={selectedElementAny.megaMenuTrigger || "hover"}
                                onChange={(e) => updateSelectedProp("megaMenuTrigger", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                              >
                                <option value="hover">On Hover</option>
                                <option value="click">On Click</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Mega Menu Items Manager */}
                        <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="block text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                              Categories ({selectedElementAny.megaMenuItems?.length || 3})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const defaultItems: MegaMenuItem[] = [
                                  { id: "1", title: "Products" },
                                  { id: "2", title: "Resources" },
                                  { id: "3", title: "Pricing", href: "#pricing" },
                                ];
                                const current = selectedElementAny.megaMenuItems?.length ? selectedElementAny.megaMenuItems : defaultItems;
                                const newItem: MegaMenuItem = {
                                  id: `mega_${Date.now()}`,
                                  title: `New Category ${current.length + 1}`,
                                  trigger: "hover",
                                  columns: [
                                    {
                                      id: `col_${Date.now()}`,
                                      title: "Category Section",
                                      links: [
                                        { label: "New Link 1", href: "#" },
                                        { label: "New Link 2", href: "#" },
                                      ],
                                    },
                                  ],
                                };
                                updateSelectedProp("megaMenuItems", [...current, newItem]);
                              }}
                              className="rounded bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-blue-700 transition cursor-pointer shadow-xs"
                            >
                              + Add Category
                            </button>
                          </div>

                          <div className="space-y-3">
                            {(selectedElementAny.megaMenuItems || [
                              {
                                id: "1",
                                title: "Products",
                                columns: [
                                  {
                                    id: "col_1",
                                    title: "Core Platform",
                                    links: [
                                      { label: "Visual Builder", href: "#", badge: "New", description: "Drag & drop visual builder" },
                                      { label: "Design System", href: "#", description: "Design tokens & components" },
                                    ],
                                  },
                                  {
                                    id: "col_2",
                                    title: "Solutions",
                                    links: [
                                      { label: "SaaS Agencies", href: "#", description: "White-label builder" },
                                      { label: "E-Commerce Stores", href: "#", badge: "Pro", description: "Product & Woo integration" },
                                    ],
                                  },
                                ],
                              },
                              {
                                id: "2",
                                title: "Resources",
                                columns: [
                                  {
                                    id: "col_3",
                                    title: "Documentation",
                                    links: [
                                      { label: "Getting Started Guide", href: "#" },
                                      { label: "API Reference", href: "#" },
                                    ],
                                  },
                                ],
                              },
                              { id: "3", title: "Pricing", href: "#pricing" },
                            ]).map((catItem, cIdx, catArr) => (
                              <div
                                key={catItem.id}
                                className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-2.5"
                              >
                                <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-100">
                                  <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                    <span className="text-blue-600">#{cIdx + 1}</span>
                                    {catItem.icon && <span>{catItem.icon}</span>}
                                    <span>{catItem.title}</span>
                                  </span>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={cIdx === 0}
                                      onClick={() => {
                                        const copy = [...catArr];
                                        const temp = copy[cIdx - 1];
                                        copy[cIdx - 1] = copy[cIdx];
                                        copy[cIdx] = temp;
                                        updateSelectedProp("megaMenuItems", copy);
                                      }}
                                      className="h-5 w-5 rounded border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                      title="Move Up"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      type="button"
                                      disabled={cIdx === catArr.length - 1}
                                      onClick={() => {
                                        const copy = [...catArr];
                                        const temp = copy[cIdx + 1];
                                        copy[cIdx + 1] = copy[cIdx];
                                        copy[cIdx] = temp;
                                        updateSelectedProp("megaMenuItems", copy);
                                      }}
                                      className="h-5 w-5 rounded border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                      title="Move Down"
                                    >
                                      ↓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const dup: MegaMenuItem = {
                                          ...catItem,
                                          id: `mega_${Date.now()}`,
                                          title: `${catItem.title} (Copy)`,
                                        };
                                        const copy = [...catArr];
                                        copy.splice(cIdx + 1, 0, dup);
                                        updateSelectedProp("megaMenuItems", copy);
                                      }}
                                      className="h-5 w-5 rounded border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                      title="Duplicate Category"
                                    >
                                      ⧉
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const filtered = catArr.filter((i) => i.id !== catItem.id);
                                        updateSelectedProp("megaMenuItems", filtered);
                                      }}
                                      className="h-5 w-5 rounded border border-red-200 bg-red-50 text-[10px] font-bold text-red-600 hover:bg-red-100 cursor-pointer"
                                      title="Delete Category"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>

                                {/* Category Details */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Category Title</label>
                                    <input
                                      type="text"
                                      value={catItem.title}
                                      onChange={(e) => {
                                        const updated = catArr.map((i) =>
                                          i.id === catItem.id ? { ...i, title: e.target.value } : i
                                        );
                                        updateSelectedProp("megaMenuItems", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Destination Type</label>
                                    <select
                                      value={catItem.destinationType || (catItem.pageId ? "page" : catItem.productId ? "product" : "url")}
                                      onChange={(e) => {
                                        const val = e.target.value as "url" | "page" | "product";
                                        const updated = catArr.map((i) =>
                                          i.id === catItem.id ? { ...i, destinationType: val, linkType: val } : i
                                        );
                                        updateSelectedProp("megaMenuItems", updated);
                                      }}
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                                    >
                                      <option value="url">URL / Anchor</option>
                                      <option value="page">📄 Site Page</option>
                                      <option value="product">🛍️ Product</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Category Dynamic Destination Target */}
                                {(catItem.destinationType === "page" || (!catItem.destinationType && catItem.pageId)) && (
                                  <div className="space-y-1 rounded-lg border border-blue-100 bg-blue-50/40 p-2">
                                    <div className="flex items-center justify-between">
                                      <label className="block text-[9px] font-bold text-blue-900 uppercase">Target Page</label>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const created = handleCreatePageQuick();
                                          const updated = catArr.map((i) =>
                                            i.id === catItem.id ? { ...i, pageId: created.id, href: created.slug, destinationType: "page" } : i
                                          );
                                          updateSelectedProp("megaMenuItems", updated);
                                        }}
                                        className="text-[9px] font-bold text-blue-600 hover:underline cursor-pointer"
                                      >
                                        + Create Page
                                      </button>
                                    </div>
                                    <select
                                      value={catItem.pageId || ""}
                                      onChange={(e) => {
                                        const pId = e.target.value;
                                        const pObj = pages.find(p => p.id === pId);
                                        const updated = catArr.map((i) =>
                                          i.id === catItem.id ? { ...i, pageId: pId, href: pObj?.slug || i.href, destinationType: "page" } : i
                                        );
                                        updateSelectedProp("megaMenuItems", updated);
                                      }}
                                      className="w-full rounded border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                                    >
                                      <option value="">-- Select Page --</option>
                                      {pages.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.slug})</option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {(catItem.destinationType === "product" || (!catItem.destinationType && catItem.productId)) && (
                                  <div className="space-y-1 rounded-lg border border-purple-100 bg-purple-50/40 p-2">
                                    <label className="block text-[9px] font-bold text-purple-900 uppercase">Target Product</label>
                                    <select
                                      value={catItem.productId || ""}
                                      onChange={(e) => {
                                        const prId = e.target.value;
                                        const prObj = siteProducts.find(p => p.id === prId);
                                        const updated = catArr.map((i) =>
                                          i.id === catItem.id ? { ...i, productId: prId, href: prObj?.url || i.href, destinationType: "product" } : i
                                        );
                                        updateSelectedProp("megaMenuItems", updated);
                                      }}
                                      className="w-full rounded border border-purple-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                                    >
                                      <option value="">-- Select Product --</option>
                                      {siteProducts.map((prod) => (
                                        <option key={prod.id} value={prod.id}>{prod.name} ({prod.price})</option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {(!catItem.destinationType || catItem.destinationType === "url") && (
                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Link Href / URL</label>
                                    <input
                                      type="text"
                                      value={catItem.href || ""}
                                      onChange={(e) => {
                                        const updated = catArr.map((i) =>
                                          i.id === catItem.id ? { ...i, href: e.target.value } : i
                                        );
                                        updateSelectedProp("megaMenuItems", updated);
                                      }}
                                      placeholder="# (optional direct link)"
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                                    />
                                  </div>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Badge (e.g. New)</label>
                                    <input
                                      type="text"
                                      value={catItem.badge || ""}
                                      onChange={(e) => {
                                        const updated = catArr.map((i) =>
                                          i.id === catItem.id ? { ...i, badge: e.target.value } : i
                                        );
                                        updateSelectedProp("megaMenuItems", updated);
                                      }}
                                      placeholder="New / Pro"
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[9px] font-semibold text-slate-500 mb-0.5">Icon / Emoji</label>
                                    <input
                                      type="text"
                                      value={catItem.icon || ""}
                                      onChange={(e) => {
                                        const updated = catArr.map((i) =>
                                          i.id === catItem.id ? { ...i, icon: e.target.value } : i
                                        );
                                        updateSelectedProp("megaMenuItems", updated);
                                      }}
                                      placeholder="e.g. 📦"
                                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none"
                                    />
                                  </div>
                                </div>

                                {/* Columns Manager */}
                                <div className="mt-3 pl-3 border-l-2 border-blue-400 space-y-2 bg-blue-50/20 p-2.5 rounded-r-xl">
                                  <div className="flex items-center justify-between">
                                    <span className="block text-[10px] font-bold text-blue-900 uppercase tracking-wider">
                                      Mega Columns ({catItem.columns?.length || 0})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cols = catItem.columns || [];
                                        const newCol: MegaMenuColumn = {
                                          id: `col_${Date.now()}`,
                                          title: `Column ${cols.length + 1}`,
                                          links: [
                                            { label: "New Column Link", href: "#" },
                                          ],
                                        };
                                        const updated = catArr.map((i) =>
                                          i.id === catItem.id ? { ...i, columns: [...cols, newCol] } : i
                                        );
                                        updateSelectedProp("megaMenuItems", updated);
                                      }}
                                      className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                                    >
                                      + Add Column
                                    </button>
                                  </div>

                                  {catItem.columns?.map((col, colIdx) => (
                                    <div key={col.id || `col_${colIdx}`} className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-2">
                                      <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-700">Column #{colIdx + 1}</span>
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            disabled={colIdx === 0}
                                            onClick={() => {
                                              const cols = [...catItem.columns!];
                                              const temp = cols[colIdx - 1];
                                              cols[colIdx - 1] = cols[colIdx];
                                              cols[colIdx] = temp;
                                              const updated = catArr.map((i) =>
                                                i.id === catItem.id ? { ...i, columns: cols } : i
                                              );
                                              updateSelectedProp("megaMenuItems", updated);
                                            }}
                                            className="h-4 w-4 rounded border border-slate-200 text-[9px] text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                          >
                                            ↑
                                          </button>
                                          <button
                                            type="button"
                                            disabled={colIdx === catItem.columns!.length - 1}
                                            onClick={() => {
                                              const cols = [...catItem.columns!];
                                              const temp = cols[colIdx + 1];
                                              cols[colIdx + 1] = cols[colIdx];
                                              cols[colIdx] = temp;
                                              const updated = catArr.map((i) =>
                                                i.id === catItem.id ? { ...i, columns: cols } : i
                                              );
                                              updateSelectedProp("megaMenuItems", updated);
                                            }}
                                            className="h-4 w-4 rounded border border-slate-200 text-[9px] text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                          >
                                            ↓
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const cols = catItem.columns!.filter((_, idx) => idx !== colIdx);
                                              const updated = catArr.map((i) =>
                                                i.id === catItem.id ? { ...i, columns: cols } : i
                                              );
                                              updateSelectedProp("megaMenuItems", updated);
                                            }}
                                            className="h-4 w-4 shrink-0 rounded border border-red-200 bg-red-50 text-[9px] font-bold text-red-600 hover:bg-red-100 cursor-pointer flex items-center justify-center"
                                            title="Delete Column"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Column Header Title</label>
                                        <input
                                          type="text"
                                          value={col.title}
                                          onChange={(e) => {
                                            const cols = catItem.columns!.map((c, idx) =>
                                              idx === colIdx ? { ...c, title: e.target.value } : c
                                            );
                                            const updated = catArr.map((i) =>
                                              i.id === catItem.id ? { ...i, columns: cols } : i
                                            );
                                            updateSelectedProp("megaMenuItems", updated);
                                          }}
                                          className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-800 outline-none"
                                        />
                                      </div>

                                      {/* Column Links */}
                                      <div className="space-y-1.5 pt-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[9px] font-bold text-slate-500 uppercase">
                                            Links ({col.links.length})
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newLink: MegaMenuColumnLink = {
                                                id: `link_${Date.now()}`,
                                                label: `New Link ${col.links.length + 1}`,
                                                href: "#",
                                              };
                                              const cols = catItem.columns!.map((c, idx) =>
                                                idx === colIdx ? { ...c, links: [...c.links, newLink] } : c
                                              );
                                              const updated = catArr.map((i) =>
                                                i.id === catItem.id ? { ...i, columns: cols } : i
                                              );
                                              updateSelectedProp("megaMenuItems", updated);
                                            }}
                                            className="text-[9px] font-bold text-blue-600 hover:underline cursor-pointer"
                                          >
                                            + Add Link
                                          </button>
                                        </div>

                                        {col.links.map((link, lIdx) => (
                                          <div key={link.id || `l_${lIdx}`} className="rounded border border-slate-100 bg-slate-50 p-2 space-y-1">
                                            <div className="flex items-center justify-between gap-1">
                                              <span className="text-[9px] font-bold text-slate-600">Link #{lIdx + 1}</span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newLinks = col.links.filter((_, idx) => idx !== lIdx);
                                                  const cols = catItem.columns!.map((c, idx) =>
                                                    idx === colIdx ? { ...c, links: newLinks } : c
                                                  );
                                                  const updated = catArr.map((i) =>
                                                    i.id === catItem.id ? { ...i, columns: cols } : i
                                                  );
                                                  updateSelectedProp("megaMenuItems", updated);
                                                }}
                                                className="h-3.5 w-3.5 rounded border border-red-200 bg-red-50 text-[8px] text-red-600 hover:bg-red-100 cursor-pointer flex items-center justify-center"
                                                title="Delete Link"
                                              >
                                                ✕
                                              </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1">
                                              <input
                                                type="text"
                                                value={link.label}
                                                onChange={(e) => {
                                                  const newLinks = col.links.map((l, idx) =>
                                                    idx === lIdx ? { ...l, label: e.target.value } : l
                                                  );
                                                  const cols = catItem.columns!.map((c, idx) =>
                                                    idx === colIdx ? { ...c, links: newLinks } : c
                                                  );
                                                  const updated = catArr.map((i) =>
                                                    i.id === catItem.id ? { ...i, columns: cols } : i
                                                  );
                                                  updateSelectedProp("megaMenuItems", updated);
                                                }}
                                                placeholder="Link Label"
                                                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-800 outline-none"
                                              />
                                              <select
                                                value={link.destinationType || (link.pageId ? "page" : link.productId ? "product" : "url")}
                                                onChange={(e) => {
                                                  const val = e.target.value as "url" | "page" | "product";
                                                  const newLinks = col.links.map((l, idx) =>
                                                    idx === lIdx ? { ...l, destinationType: val, linkType: val } : l
                                                  );
                                                  const cols = catItem.columns!.map((c, idx) =>
                                                    idx === colIdx ? { ...c, links: newLinks } : c
                                                  );
                                                  const updated = catArr.map((i) =>
                                                    i.id === catItem.id ? { ...i, columns: cols } : i
                                                  );
                                                  updateSelectedProp("megaMenuItems", updated);
                                                }}
                                                className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-semibold text-slate-800 outline-none"
                                              >
                                                <option value="url">URL</option>
                                                <option value="page">Page</option>
                                                <option value="product">Product</option>
                                              </select>
                                            </div>

                                            {link.destinationType === "page" ? (
                                              <select
                                                value={link.pageId || ""}
                                                onChange={(e) => {
                                                  const pId = e.target.value;
                                                  const pObj = pages.find(p => p.id === pId);
                                                  const newLinks = col.links.map((l, idx) =>
                                                    idx === lIdx ? { ...l, pageId: pId, href: pObj?.slug || l.href } : l
                                                  );
                                                  const cols = catItem.columns!.map((c, idx) =>
                                                    idx === colIdx ? { ...c, links: newLinks } : c
                                                  );
                                                  const updated = catArr.map((i) =>
                                                    i.id === catItem.id ? { ...i, columns: cols } : i
                                                  );
                                                  updateSelectedProp("megaMenuItems", updated);
                                                }}
                                                className="w-full rounded border border-blue-200 bg-blue-50/50 px-1.5 py-0.5 text-[10px] font-medium text-slate-800 outline-none"
                                              >
                                                <option value="">-- Select Page --</option>
                                                {pages.map((p) => (
                                                  <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                              </select>
                                            ) : link.destinationType === "product" ? (
                                              <select
                                                value={link.productId || ""}
                                                onChange={(e) => {
                                                  const prId = e.target.value;
                                                  const prObj = siteProducts.find(p => p.id === prId);
                                                  const newLinks = col.links.map((l, idx) =>
                                                    idx === lIdx ? { ...l, productId: prId, href: prObj?.url || l.href } : l
                                                  );
                                                  const cols = catItem.columns!.map((c, idx) =>
                                                    idx === colIdx ? { ...c, links: newLinks } : c
                                                  );
                                                  const updated = catArr.map((i) =>
                                                    i.id === catItem.id ? { ...i, columns: cols } : i
                                                  );
                                                  updateSelectedProp("megaMenuItems", updated);
                                                }}
                                                className="w-full rounded border border-purple-200 bg-purple-50/50 px-1.5 py-0.5 text-[10px] font-medium text-slate-800 outline-none"
                                              >
                                                <option value="">-- Select Product --</option>
                                                {siteProducts.map((p) => (
                                                  <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                              </select>
                                            ) : (
                                              <input
                                                type="text"
                                                value={link.href}
                                                onChange={(e) => {
                                                  const newLinks = col.links.map((l, idx) =>
                                                    idx === lIdx ? { ...l, href: e.target.value } : l
                                                  );
                                                  const cols = catItem.columns!.map((c, idx) =>
                                                    idx === colIdx ? { ...c, links: newLinks } : c
                                                  );
                                                  const updated = catArr.map((i) =>
                                                    i.id === catItem.id ? { ...i, columns: cols } : i
                                                  );
                                                  updateSelectedProp("megaMenuItems", updated);
                                                }}
                                                placeholder="Href / URL"
                                                className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-mono text-slate-800 outline-none"
                                              />
                                            )}

                                            <div className="grid grid-cols-2 gap-1">
                                              <input
                                                type="text"
                                                value={link.description || ""}
                                                onChange={(e) => {
                                                  const newLinks = col.links.map((l, idx) =>
                                                    idx === lIdx ? { ...l, description: e.target.value } : l
                                                  );
                                                  const cols = catItem.columns!.map((c, idx) =>
                                                    idx === colIdx ? { ...c, links: newLinks } : c
                                                  );
                                                  const updated = catArr.map((i) =>
                                                    i.id === catItem.id ? { ...i, columns: cols } : i
                                                  );
                                                  updateSelectedProp("megaMenuItems", updated);
                                                }}
                                                placeholder="Description (optional)"
                                                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-700 outline-none"
                                              />
                                              <input
                                                type="text"
                                                value={link.badge || ""}
                                                onChange={(e) => {
                                                  const newLinks = col.links.map((l, idx) =>
                                                    idx === lIdx ? { ...l, badge: e.target.value } : l
                                                  );
                                                  const cols = catItem.columns!.map((c, idx) =>
                                                    idx === colIdx ? { ...c, links: newLinks } : c
                                                  );
                                                  const updated = catArr.map((i) =>
                                                    i.id === catItem.id ? { ...i, columns: cols } : i
                                                  );
                                                  updateSelectedProp("megaMenuItems", updated);
                                                }}
                                                placeholder="Badge (e.g. New)"
                                                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-700 outline-none"
                                              />
                                            </div>

                                            <input
                                              type="text"
                                              value={link.image || ""}
                                              onChange={(e) => {
                                                const newLinks = col.links.map((l, idx) =>
                                                  idx === lIdx ? { ...l, image: e.target.value } : l
                                                );
                                                const cols = catItem.columns!.map((c, idx) =>
                                                  idx === colIdx ? { ...c, links: newLinks } : c
                                                );
                                                const updated = catArr.map((i) =>
                                                  i.id === catItem.id ? { ...i, columns: cols } : i
                                                );
                                                updateSelectedProp("megaMenuItems", updated);
                                              }}
                                              placeholder="Image URL (optional)"
                                              className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-700 outline-none"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Off Canvas Inspector Panel (F-206) */}
                    {selectedElementAny.type === "off-canvas" && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-3">
                          <span className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                            <OffCanvasBoxIcon />
                            <span>Off Canvas Panel Settings</span>
                          </span>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">Trigger Button Text</label>
                            <input
                              type="text"
                              value={selectedElementAny.offCanvasButtonText || "Open Panel"}
                              onChange={(e) => updateSelectedProp("offCanvasButtonText", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">Panel Title</label>
                            <input
                              type="text"
                              value={selectedElementAny.offCanvasTitle || "Navigation & Tools"}
                              onChange={(e) => updateSelectedProp("offCanvasTitle", e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Position</label>
                              <select
                                value={selectedElementAny.offCanvasPosition || "right"}
                                onChange={(e) => updateSelectedProp("offCanvasPosition", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="right">Slide Right</option>
                                <option value="left">Slide Left</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Panel Width</label>
                              <input
                                type="text"
                                value={selectedElementAny.offCanvasWidth || "340px"}
                                onChange={(e) => updateSelectedProp("offCanvasWidth", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Image Carousel Inspector Panel (F-210) */}
                    {selectedElementAny.type === "image-carousel" && (() => {
                      const items: ImageCarouselItem[] = selectedElementAny.imageCarouselItems || [];
                      return (
                        <div className="space-y-4">
                          {/* CONTENT SECTION */}
                          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-3">
                            <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                              <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                                <span>🖼️</span>
                                <span>CONTENT — Images ({items.length})</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newItem: ImageCarouselItem = {
                                    id: "img_" + Math.random().toString(36).substring(2, 9),
                                    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
                                    title: `Image Slide ${items.length + 1}`,
                                    caption: "New Carousel Image",
                                    alt: "Carousel Image",
                                  };
                                  updateSelectedProp("imageCarouselItems", [...items, newItem]);
                                }}
                                className="rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-blue-700 transition cursor-pointer"
                              >
                                + Add Image
                              </button>
                            </div>

                            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                              {items.map((item, idx) => (
                                <div key={item.id || idx} className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-100 text-[10px] font-bold text-blue-700">
                                        {idx + 1}
                                      </span>
                                      {item.url && (
                                        <img src={item.url} alt={item.title || "thumbnail"} className="h-6 w-8 object-cover rounded border border-slate-200" />
                                      )}
                                      <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
                                        {item.title || `Image ${idx + 1}`}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => {
                                          const updated = [...items];
                                          const temp = updated[idx];
                                          updated[idx] = updated[idx - 1];
                                          updated[idx - 1] = temp;
                                          updateSelectedProp("imageCarouselItems", updated);
                                        }}
                                        className="px-1 py-0.5 text-[10px] font-bold text-slate-500 hover:text-blue-600 disabled:opacity-30 cursor-pointer"
                                        title="Move Up"
                                      >
                                        ▲
                                      </button>
                                      <button
                                        type="button"
                                        disabled={idx === items.length - 1}
                                        onClick={() => {
                                          const updated = [...items];
                                          const temp = updated[idx];
                                          updated[idx] = updated[idx + 1];
                                          updated[idx + 1] = temp;
                                          updateSelectedProp("imageCarouselItems", updated);
                                        }}
                                        className="px-1 py-0.5 text-[10px] font-bold text-slate-500 hover:text-blue-600 disabled:opacity-30 cursor-pointer"
                                        title="Move Down"
                                      >
                                        ▼
                                      </button>
                                      {items.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = items.filter((_, i) => i !== idx);
                                            updateSelectedProp("imageCarouselItems", updated);
                                          }}
                                          className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:underline ml-1 cursor-pointer"
                                        >
                                          Remove
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="flex items-center justify-between mb-0.5">
                                      <label className="block text-[10px] font-semibold text-slate-500">Image Source URL *</label>
                                      <label className="text-[9px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer">
                                        📁 Upload File
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              const reader = new FileReader();
                                              reader.onloadend = () => {
                                                if (typeof reader.result === "string") {
                                                  const updated = [...items];
                                                  updated[idx] = { ...updated[idx], url: reader.result };
                                                  updateSelectedProp("imageCarouselItems", updated);
                                                }
                                              };
                                              reader.readAsDataURL(file);
                                            }
                                          }}
                                        />
                                      </label>
                                    </div>
                                    <input
                                      type="text"
                                      value={item.url || ""}
                                      onChange={(e) => {
                                        const updated = [...items];
                                        updated[idx] = { ...updated[idx], url: e.target.value };
                                        updateSelectedProp("imageCarouselItems", updated);
                                      }}
                                      placeholder="https://images.unsplash.com/..."
                                      className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Title</label>
                                      <input
                                        type="text"
                                        value={item.title || ""}
                                        onChange={(e) => {
                                          const updated = [...items];
                                          updated[idx] = { ...updated[idx], title: e.target.value };
                                          updateSelectedProp("imageCarouselItems", updated);
                                        }}
                                        placeholder="Slide Title"
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Alt Text</label>
                                      <input
                                        type="text"
                                        value={item.alt || ""}
                                        onChange={(e) => {
                                          const updated = [...items];
                                          updated[idx] = { ...updated[idx], alt: e.target.value };
                                          updateSelectedProp("imageCarouselItems", updated);
                                        }}
                                        placeholder="Image Alt Text"
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Caption Overlay</label>
                                      <input
                                        type="text"
                                        value={item.caption || ""}
                                        onChange={(e) => {
                                          const updated = [...items];
                                          updated[idx] = { ...updated[idx], caption: e.target.value };
                                          updateSelectedProp("imageCarouselItems", updated);
                                        }}
                                        placeholder="Short Caption"
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Click Link URL</label>
                                      <input
                                        type="text"
                                        value={item.linkUrl || ""}
                                        onChange={(e) => {
                                          const updated = [...items];
                                          updated[idx] = { ...updated[idx], linkUrl: e.target.value };
                                          updateSelectedProp("imageCarouselItems", updated);
                                        }}
                                        placeholder="https://..."
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* SLIDES SECTION */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">SLIDES — Sizing & Ratio</span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Image Sizing</label>
                                <select
                                  value={selectedElementAny.imageCarouselImageSizing || "cover"}
                                  onChange={(e) => updateSelectedProp("imageCarouselImageSizing", e.target.value as any)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                                >
                                  <option value="cover">Cover (Fill & Crop)</option>
                                  <option value="contain">Contain (Fit inside)</option>
                                  <option value="fill">Fill (Stretch)</option>
                                  <option value="auto">Auto Original</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Aspect Ratio</label>
                                <select
                                  value={selectedElementAny.imageCarouselAspectRatio || "landscape"}
                                  onChange={(e) => updateSelectedProp("imageCarouselAspectRatio", e.target.value as any)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                                >
                                  <option value="landscape">Landscape (16:10)</option>
                                  <option value="video">Video (16:9)</option>
                                  <option value="square">Square (1:1)</option>
                                  <option value="portrait">Portrait (3:4)</option>
                                  <option value="auto">Custom Height</option>
                                </select>
                              </div>
                            </div>

                            {selectedElementAny.imageCarouselAspectRatio === "auto" && (
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Slide Fixed Height</label>
                                <input
                                  type="text"
                                  value={selectedElementAny.imageCarouselHeight || "320px"}
                                  onChange={(e) => updateSelectedProp("imageCarouselHeight", e.target.value)}
                                  placeholder="e.g. 320px or 40vh"
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                                />
                              </div>
                            )}

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Slide Corner Radius</label>
                              <input
                                type="text"
                                value={selectedElementAny.imageCarouselBorderRadius || "16px"}
                                onChange={(e) => updateSelectedProp("imageCarouselBorderRadius", e.target.value)}
                                placeholder="e.g. 16px"
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                              />
                            </div>
                          </div>

                          {/* NAVIGATION SECTION */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">NAVIGATION</span>
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.imageCarouselShowNav !== false}
                                  onChange={(e) => updateSelectedProp("imageCarouselShowNav", e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span>Show Previous / Next Arrows</span>
                              </label>
                            </div>

                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.imageCarouselShowDots !== false}
                                  onChange={(e) => updateSelectedProp("imageCarouselShowDots", e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span>Show Pagination Dots</span>
                              </label>
                            </div>
                          </div>

                          {/* AUTOPLAY SECTION */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">AUTOPLAY & LOOP</span>
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.imageCarouselAutoplay !== false}
                                  onChange={(e) => updateSelectedProp("imageCarouselAutoplay", e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span>Enable Autoplay</span>
                              </label>
                            </div>

                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedElementAny.imageCarouselLoop !== false}
                                  onChange={(e) => updateSelectedProp("imageCarouselLoop", e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span>Infinite Loop Rotation</span>
                              </label>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Autoplay Speed ({selectedElementAny.imageCarouselAutoplaySpeed ?? 3000} ms)
                              </label>
                              <input
                                type="range"
                                min={1000}
                                max={8000}
                                step={500}
                                value={selectedElementAny.imageCarouselAutoplaySpeed ?? 3000}
                                onChange={(e) => updateSelectedProp("imageCarouselAutoplaySpeed", parseInt(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Transition Type</label>
                              <select
                                value={selectedElementAny.imageCarouselTransition || "slide"}
                                onChange={(e) => updateSelectedProp("imageCarouselTransition", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                              >
                                <option value="slide">Slide Track</option>
                                <option value="fade">Fade In/Out</option>
                              </select>
                            </div>
                          </div>

                          {/* LAYOUT SECTION */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">LAYOUT & RESPONSIVE</span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Slides Per View (Desktop)</label>
                                <select
                                  value={selectedElementAny.imageCarouselSlidesPerView ?? 3}
                                  onChange={(e) => updateSelectedProp("imageCarouselSlidesPerView", parseInt(e.target.value))}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                                >
                                  <option value={1}>1 Slide</option>
                                  <option value={2}>2 Slides</option>
                                  <option value={3}>3 Slides</option>
                                  <option value={4}>4 Slides</option>
                                  <option value={5}>5 Slides</option>
                                  <option value={6}>6 Slides</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Gap Between Slides (px)</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={40}
                                  value={selectedElementAny.imageCarouselGap ?? 16}
                                  onChange={(e) => updateSelectedProp("imageCarouselGap", parseInt(e.target.value) || 0)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Widget Alignment</label>
                              <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-1 rounded-lg">
                                {(["left", "center", "right"] as const).map((align) => (
                                  <button
                                    key={align}
                                    type="button"
                                    onClick={() => updateSelectedProp("imageCarouselAlignment", align)}
                                    className={`py-1 text-xs font-bold capitalize rounded-md transition cursor-pointer ${(selectedElementAny.imageCarouselAlignment || "center") === align
                                      ? "bg-white text-blue-700 shadow-2xs"
                                      : "text-slate-600 hover:text-slate-900"
                                      }`}
                                  >
                                    {align}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Heading Level Selector (F-191) */}
                    {selectedElementAny.type === "heading" && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Heading Level Tag
                        </label>
                        <select
                          value={selectedElementAny.headingLevel || "h2"}
                          onChange={(e) => updateSelectedProp("headingLevel", e.target.value as "h1" | "h2" | "h3" | "h4" | "h5" | "h6")}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="h1">H1 - Main Page Heading</option>
                          <option value="h2">H2 - Section Heading</option>
                          <option value="h3">H3 - Sub-section Heading</option>
                          <option value="h4">H4 - Minor Heading</option>
                          <option value="h5">H5 - Small Heading</option>
                          <option value="h6">H6 - Tiny Heading</option>
                        </select>
                      </div>
                    )}

                    {/* Content Input */}
                    {selectedElementAny.type !== "image" && selectedElementAny.type !== "video" && selectedElementAny.type !== "container" && selectedElementAny.type !== "posts" && selectedElementAny.type !== "share-buttons" && selectedElementAny.type !== "portfolio" && selectedElementAny.type !== "slides" && selectedElementAny.type !== "form" && selectedElementAny.type !== "login" && selectedElementAny.type !== "nav-menu" && selectedElementAny.type !== "animated-headline" && selectedElementAny.type !== "price-table" && selectedElementAny.type !== "price-list" && selectedElementAny.type !== "gallery" && selectedElementAny.type !== "flip-box" && selectedElementAny.type !== "call-to-action" && selectedElementAny.type !== "media-carousel" && selectedElementAny.type !== "testimonial-carousel" && selectedElementAny.type !== "nested-carousel" && selectedElementAny.type !== "loop-carousel" && selectedElementAny.type !== "table-of-contents" && selectedElementAny.type !== "countdown" && selectedElementAny.type !== "facebook-page" && selectedElementAny.type !== "blockquote" && selectedElementAny.type !== "template" && selectedElementAny.type !== "reviews" && selectedElementAny.type !== "facebook-button" && selectedElementAny.type !== "facebook-embed" && selectedElementAny.type !== "facebook-comments" && selectedElementAny.type !== "paypal-button" && selectedElementAny.type !== "stripe-button" && selectedElementAny.type !== "lottie" && selectedElementAny.type !== "code-highlight" && selectedElementAny.type !== "video-playlist" && selectedElementAny.type !== "mega-menu" && selectedElementAny.type !== "off-canvas" && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Text
                        </label>
                        <textarea
                          rows={selectedElementAny.type === "text" ? 3 : 2}
                          value={selectedElementAny.content}
                          onChange={(e) => updateSelectedProp("content", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {/* Advanced Typography Section */}
                    {renderTypographySection()}

                    {/* Text Color Input */}
                    {selectedElementAny.type !== "image" && selectedElementAny.type !== "video" && selectedElementAny.type !== "video-playlist" && selectedElementAny.type !== "posts" && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700">
                            Text Color
                          </label>
                          {isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "color") && (
                            <button
                              type="button"
                              onClick={() => resetSelectedStyle("color")}
                              title="Reset Text Color to Default"
                              className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:underline"
                            >
                              ↺ Reset
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "color") || "#0f172a"}
                            onChange={(e) => updateSelectedStyle("color", e.target.value)}
                            className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-transparent p-0.5"
                          />
                          <input
                            type="text"
                            value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "color") || "#0f172a"}
                            onChange={(e) => updateSelectedStyle("color", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSampleColor((hex) => updateSelectedStyle("color", hex))}
                            title="Sample Color from Screen / Image"
                            className="h-8 px-2 rounded border border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-xs font-bold text-slate-700 hover:text-blue-600 transition flex items-center gap-1 shrink-0"
                          >
                            <span>🧪</span>
                            <span className="text-[10px]">Sample</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Alignment */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Alignment
                      </label>
                      <select
                        value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "textAlign") || "left"}
                        onChange={(e) => updateSelectedStyle("textAlign", e.target.value as any)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                        <option value="justify">Justify</option>
                      </select>
                    </div>

                    {/* Button Href Link */}
                    {selectedElementAny.type === "button" && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Button Link (URL)
                        </label>
                        <input
                          type="text"
                          value={selectedElementAny.href || "#"}
                          onChange={(e) => updateSelectedProp("href", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                        />
                      </div>
                    )}

                    {/* Button Background Color */}
                    {selectedElementAny.type === "button" && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700">
                            Button Color
                          </label>
                          {isControlStyleConfigured(selectedElementAny, activeDevice, activeElementState, "backgroundColor") && (
                            <button
                              type="button"
                              onClick={() => resetSelectedStyle("backgroundColor")}
                              title="Reset Button Color to Default"
                              className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 hover:underline"
                            >
                              ↺ Reset
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "backgroundColor") || "#2563eb"}
                            onChange={(e) => updateSelectedStyle("backgroundColor", e.target.value)}
                            className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-transparent p-0.5"
                          />
                          <input
                            type="text"
                            value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "backgroundColor") || "#2563eb"}
                            onChange={(e) => updateSelectedStyle("backgroundColor", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSampleColor((hex) => updateSelectedStyle("backgroundColor", hex))}
                            title="Sample Color from Screen / Image"
                            className="h-8 px-2 rounded border border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-xs font-bold text-slate-700 hover:text-blue-600 transition flex items-center gap-1 shrink-0"
                          >
                            <span>🧪</span>
                            <span className="text-[10px]">Sample</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Video Widget Inspector Panel (F-208) */}
                    {selectedElementAny.type === "video" && (
                      <div className="space-y-6 pt-2 border-t border-slate-100">
                        {/* Hidden file input for video file */}
                        <input
                          id="video-file-input"
                          type="file"
                          accept="video/mp4,video/webm,video/ogg,video/quicktime"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleVideoFileSelect(e.target.files[0]);
                            }
                          }}
                        />

                        {/* Hidden file input for video poster image */}
                        <input
                          id="video-poster-input"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleVideoPosterSelect(e.target.files[0]);
                            }
                          }}
                        />

                        {/* CONTENT SECTION */}
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1 flex items-center justify-between">
                            <span>Content</span>
                            <span className="text-[10px] text-blue-600 font-normal">Source & Poster</span>
                          </h3>

                          {/* Video Source Input & Upload Trigger */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-semibold text-slate-700">
                                Video Source URL
                              </label>
                              <button
                                type="button"
                                disabled={isUploading}
                                onClick={() => document.getElementById("video-file-input")?.click()}
                                className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                              >
                                <span>📁</span>
                                <span>{isUploading ? "Uploading..." : "Browse Video File"}</span>
                              </button>
                            </div>
                            <input
                              type="text"
                              value={selectedElementAny.src || ""}
                              onChange={(e) => updateSelectedProp("src", e.target.value)}
                              placeholder="YouTube, Vimeo, or MP4 URL..."
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                            />
                            <p className="mt-1 text-[10px] text-slate-400">
                              Supports YouTube (`youtu.be`), Vimeo (`vimeo.com`), and direct `.mp4` video files
                            </p>
                          </div>

                          {/* Video Poster Image Input */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-semibold text-slate-700">
                                Poster Image URL (HTML5)
                              </label>
                              <button
                                type="button"
                                disabled={isUploading}
                                onClick={() => document.getElementById("video-poster-input")?.click()}
                                className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                              >
                                <span>🖼️</span>
                                <span>{isUploading ? "Uploading..." : "Browse Image"}</span>
                              </button>
                            </div>
                            <input
                              type="text"
                              value={selectedElementAny.videoPoster || ""}
                              onChange={(e) => updateSelectedProp("videoPoster", e.target.value)}
                              placeholder="https://.../poster.jpg"
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                            />
                            {selectedElementAny.videoPoster && (
                              <div className="mt-2 flex items-center gap-2">
                                <img
                                  src={resolveImageUrl(selectedElementAny.videoPoster, apiUrl)}
                                  alt="Poster preview"
                                  className="h-10 w-16 object-cover rounded border border-slate-200 bg-slate-100"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateSelectedProp("videoPoster", "")}
                                  className="text-[10px] font-bold text-red-500 hover:underline"
                                >
                                  Remove Poster
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* PLAYBACK SECTION */}
                        <div className="space-y-3 pt-3 border-t border-slate-200">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                            Playback Controls
                          </h3>

                          <div className="grid grid-cols-2 gap-3">
                            {/* Show Controls */}
                            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 cursor-pointer hover:bg-slate-100 transition">
                              <input
                                type="checkbox"
                                checked={selectedElementAny.videoControls !== false}
                                onChange={(e) => updateSelectedProp("videoControls", e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs font-medium text-slate-700">Show Controls</span>
                            </label>

                            {/* Autoplay */}
                            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 cursor-pointer hover:bg-slate-100 transition">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedElementAny.videoAutoplay)}
                                onChange={(e) => updateSelectedProp("videoAutoplay", e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs font-medium text-slate-700">Autoplay</span>
                            </label>

                            {/* Loop */}
                            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 cursor-pointer hover:bg-slate-100 transition">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedElementAny.videoLoop)}
                                onChange={(e) => updateSelectedProp("videoLoop", e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs font-medium text-slate-700">Loop</span>
                            </label>

                            {/* Muted */}
                            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 cursor-pointer hover:bg-slate-100 transition">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedElementAny.videoMuted)}
                                onChange={(e) => updateSelectedProp("videoMuted", e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs font-medium text-slate-700">Muted</span>
                            </label>
                          </div>
                        </div>

                        {/* LAYOUT SECTION */}
                        <div className="space-y-3 pt-3 border-t border-slate-200">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                            Layout & Alignment
                          </h3>

                          {/* Width & Height */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Width
                              </label>
                              <select
                                value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "width") || "100%"}
                                onChange={(e) => updateSelectedStyle("width", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              >
                                <option value="100%">100% (Full Width)</option>
                                <option value="80%">80%</option>
                                <option value="60%">60%</option>
                                <option value="50%">50%</option>
                                <option value="auto">Auto</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Height
                              </label>
                              <select
                                value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "height") || "auto"}
                                onChange={(e) => updateSelectedStyle("height", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              >
                                <option value="auto">Auto (16:9 Aspect)</option>
                                <option value="250px">250px</option>
                                <option value="350px">350px</option>
                                <option value="450px">450px</option>
                                <option value="550px">550px</option>
                              </select>
                            </div>
                          </div>

                          {/* Alignment */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Alignment
                            </label>
                            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                              {(["left", "center", "right"] as const).map((align) => {
                                const currentAlign = getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "textAlign") || "left";
                                const isActive = currentAlign === align;
                                return (
                                  <button
                                    key={align}
                                    type="button"
                                    onClick={() => updateSelectedStyle("textAlign", align)}
                                    className={`rounded-md py-1 text-xs font-semibold capitalize transition ${isActive
                                      ? "bg-white text-blue-600 shadow-xs"
                                      : "text-slate-600 hover:text-slate-900"
                                      }`}
                                  >
                                    {align}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* STYLE SECTION */}
                        <div className="space-y-3 pt-3 border-t border-slate-200">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                            Style & Border
                          </h3>

                          {/* Border Radius */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Border Radius
                            </label>
                            <select
                              value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "borderRadius") || "8px"}
                              onChange={(e) => updateSelectedStyle("borderRadius", e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                            >
                              <option value="0px">0px (Square Sharp)</option>
                              <option value="4px">4px (Small)</option>
                              <option value="8px">8px (Medium Rounded)</option>
                              <option value="16px">16px (Large Rounded)</option>
                              <option value="24px">24px (Extra Rounded)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Video Playlist Inspector Panel (F-209) */}
                    {selectedElementAny.type === "video-playlist" && (
                      <div className="space-y-6 pt-2 border-t border-slate-100">
                        {/* PLAYLIST ITEMS MANAGEMENT */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                              <span>📺</span>
                              <span>Playlist Videos</span>
                            </h3>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {(selectedElementAny.playlistItems || []).length} items
                            </span>
                          </div>

                          {/* Add Video Button */}
                          <button
                            type="button"
                            onClick={() => {
                              const items = selectedElementAny.playlistItems || [];
                              const newItemId = `vp_${Date.now()}`;
                              const newItem: PlaylistItem = {
                                id: newItemId,
                                title: `New Video ${items.length + 1}`,
                                url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                                videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                                duration: "03:00",
                              };
                              const updated = [...items, newItem];
                              updateSelectedProp("playlistItems", updated);
                              if (!selectedElementAny.playlistActiveId) {
                                updateSelectedProp("playlistActiveId", newItemId);
                              }
                            }}
                            className="w-full rounded-lg border border-dashed border-blue-400 bg-blue-50/50 py-2 text-xs font-bold text-blue-600 hover:bg-blue-100/60 transition flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <span>➕</span>
                            <span>Add Video to Playlist</span>
                          </button>

                          {/* Playlist Item Cards */}
                          <div className="space-y-3 pt-1">
                            {(selectedElementAny.playlistItems || []).map((item: any, index: number) => {
                              const isActive = item.id === (selectedElementAny.playlistActiveId || selectedElementAny.playlistItems?.[0]?.id);
                              return (
                                <div
                                  key={item.id || index}
                                  className={`rounded-xl border p-3 transition space-y-2.5 ${isActive
                                    ? "border-blue-400 bg-blue-50/40 ring-1 ring-blue-400/50 shadow-xs"
                                    : "border-slate-200 bg-white hover:border-slate-300"
                                    }`}
                                >
                                  {/* Header & Item Actions */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => updateSelectedProp("playlistActiveId", item.id)}
                                        title={isActive ? "Currently Active Video" : "Set as Active Video"}
                                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition ${isActive
                                          ? "bg-blue-600 text-white"
                                          : "bg-slate-200 text-slate-600 hover:bg-blue-500 hover:text-white"
                                          }`}
                                      >
                                        {isActive ? "▶" : index + 1}
                                      </button>
                                      <span className="text-xs font-bold text-slate-800">
                                        Video #{index + 1}
                                      </span>
                                      {isActive && (
                                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                                          Active
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1">
                                      {/* Move Up */}
                                      <button
                                        type="button"
                                        disabled={index === 0}
                                        onClick={() => {
                                          const items = [...(selectedElementAny.playlistItems || [])];
                                          if (index > 0) {
                                            const temp = items[index];
                                            items[index] = items[index - 1];
                                            items[index - 1] = temp;
                                            updateSelectedProp("playlistItems", items);
                                          }
                                        }}
                                        title="Move Up"
                                        className="h-6 w-6 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white flex items-center justify-center text-xs"
                                      >
                                        ↑
                                      </button>

                                      {/* Move Down */}
                                      <button
                                        type="button"
                                        disabled={index === (selectedElementAny.playlistItems || []).length - 1}
                                        onClick={() => {
                                          const items = [...(selectedElementAny.playlistItems || [])];
                                          if (index < items.length - 1) {
                                            const temp = items[index];
                                            items[index] = items[index + 1];
                                            items[index + 1] = temp;
                                            updateSelectedProp("playlistItems", items);
                                          }
                                        }}
                                        title="Move Down"
                                        className="h-6 w-6 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white flex items-center justify-center text-xs"
                                      >
                                        ↓
                                      </button>

                                      {/* Delete */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const items = (selectedElementAny.playlistItems || []).filter(
                                            (_: any, i: number) => i !== index
                                          );
                                          updateSelectedProp("playlistItems", items);
                                          if (selectedElementAny.playlistActiveId === item.id && items.length > 0) {
                                            updateSelectedProp("playlistActiveId", items[0].id);
                                          }
                                        }}
                                        title="Delete Video Item"
                                        className="h-6 w-6 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center text-xs ml-1"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </div>

                                  {/* Title Input */}
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Video Title
                                    </label>
                                    <input
                                      type="text"
                                      value={item.title || ""}
                                      onChange={(e) => {
                                        const items = [...(selectedElementAny.playlistItems || [])];
                                        items[index] = { ...items[index], title: e.target.value };
                                        updateSelectedProp("playlistItems", items);
                                      }}
                                      placeholder="e.g. 01. Introduction Overview"
                                      className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                                    />
                                  </div>

                                  {/* URL Input */}
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                      Video URL (YouTube, Vimeo, MP4)
                                    </label>
                                    <input
                                      type="text"
                                      value={item.url || ""}
                                      onChange={(e) => {
                                        const items = [...(selectedElementAny.playlistItems || [])];
                                        items[index] = { ...items[index], url: e.target.value };
                                        updateSelectedProp("playlistItems", items);
                                      }}
                                      placeholder="https://www.youtube.com/watch?v=..."
                                      className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                                    />
                                  </div>

                                  {/* Duration & Thumbnail URL Row */}
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                        Duration
                                      </label>
                                      <input
                                        type="text"
                                        value={item.duration || ""}
                                        onChange={(e) => {
                                          const items = [...(selectedElementAny.playlistItems || [])];
                                          items[index] = { ...items[index], duration: e.target.value };
                                          updateSelectedProp("playlistItems", items);
                                        }}
                                        placeholder="e.g. 04:30"
                                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                        Thumbnail URL
                                      </label>
                                      <input
                                        type="text"
                                        value={item.thumbnailUrl || ""}
                                        onChange={(e) => {
                                          const items = [...(selectedElementAny.playlistItems || [])];
                                          items[index] = { ...items[index], thumbnailUrl: e.target.value };
                                          updateSelectedProp("playlistItems", items);
                                        }}
                                        placeholder="https://.../thumb.jpg"
                                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none focus:border-blue-500"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* LAYOUT SECTION */}
                        <div className="space-y-3 pt-3 border-t border-slate-200">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                            Layout & Position
                          </h3>

                          {/* Playlist Position Selector */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Playlist Position
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => updateSelectedProp("playlistPosition", "right")}
                                className={`rounded-lg border p-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${(selectedElementAny.playlistPosition || "right") === "right"
                                  ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                  }`}
                              >
                                <span>▶️</span>
                                <span>Right Sidebar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => updateSelectedProp("playlistPosition", "bottom")}
                                className={`rounded-lg border p-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${selectedElementAny.playlistPosition === "bottom"
                                  ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                  }`}
                              >
                                <span>🔽</span>
                                <span>Bottom List</span>
                              </button>
                            </div>
                          </div>

                          {/* Player Width Selector (Right Sidebar mode) */}
                          {(selectedElementAny.playlistPosition || "right") === "right" && (
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Player Portion Width
                              </label>
                              <select
                                value={selectedElementAny.playlistPlayerWidth || "65%"}
                                onChange={(e) => updateSelectedProp("playlistPlayerWidth", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              >
                                <option value="60%">60% Player / 40% Playlist</option>
                                <option value="65%">65% Player / 35% Playlist (Standard)</option>
                                <option value="70%">70% Player / 30% Playlist</option>
                                <option value="75%">75% Player / 25% Playlist</option>
                              </select>
                            </div>
                          )}

                          {/* Alignment */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Alignment
                            </label>
                            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                              {(["left", "center", "right"] as const).map((align) => {
                                const currentAlign = getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "textAlign") || "left";
                                const isActive = currentAlign === align;
                                return (
                                  <button
                                    key={align}
                                    type="button"
                                    onClick={() => updateSelectedStyle("textAlign", align)}
                                    className={`rounded-md py-1 text-xs font-semibold capitalize transition ${isActive
                                      ? "bg-white text-blue-600 shadow-xs"
                                      : "text-slate-600 hover:text-slate-900"
                                      }`}
                                  >
                                    {align}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* STYLE SECTION */}
                        <div className="space-y-3 pt-3 border-t border-slate-200">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                            Style & Border
                          </h3>

                          {/* Border Radius */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Border Radius
                            </label>
                            <select
                              value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "borderRadius") || "12px"}
                              onChange={(e) => updateSelectedStyle("borderRadius", e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                            >
                              <option value="0px">0px (Square Sharp)</option>
                              <option value="8px">8px (Small Rounded)</option>
                              <option value="12px">12px (Medium Rounded)</option>
                              <option value="16px">16px (Large Rounded)</option>
                              <option value="24px">24px (Extra Rounded)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Image Widget Inspector Panel (F-207) */}
                    {selectedElementAny.type === "image" && (
                      <div className="space-y-6 pt-2 border-t border-slate-100">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleImageFileSelect(e.target.files[0]);
                            }
                          }}
                        />

                        {/* CONTENT SECTION */}
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1 flex items-center justify-between">
                            <span>Content</span>
                            <span className="text-[10px] text-blue-600 font-normal">Source & Alt Text</span>
                          </h3>

                          {/* Image Source Selection / Active Thumbnail */}
                          <div className="space-y-2">
                            <label className="block text-xs font-semibold text-slate-700">
                              Image Source
                            </label>

                            {selectedElementAny.src ? (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-slate-600">Preview</span>
                                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    Active Image
                                  </span>
                                </div>
                                <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                                  <img
                                    src={resolveImageUrl(selectedElementAny.src, apiUrl)}
                                    alt="Thumbnail preview"
                                    className="h-28 w-full object-cover"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={isUploading}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 rounded-lg border border-slate-300 bg-white py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition flex items-center justify-center gap-1 shadow-2xs disabled:opacity-50"
                                  >
                                    <span>🔄</span>
                                    <span>{isUploading ? "Uploading..." : "Replace Image"}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateSelectedProp("src", "")}
                                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                                  >
                                    Remove
                                  </button>
                                </div>

                                {/* Extracted Image Color Palette (F-034) */}
                                {extractedColors.length > 0 && (
                                  <div className="pt-2 border-t border-slate-200">
                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                                      Extracted Palette
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      {extractedColors.map((hex, idx) => (
                                        <button
                                          key={idx}
                                          type="button"
                                          onClick={() => updateSelectedStyle("backgroundColor", hex)}
                                          title={`Apply extracted color ${hex}`}
                                          className="h-6 w-6 rounded-full border border-slate-300 shadow-xs hover:scale-110 transition shrink-0"
                                          style={{ backgroundColor: hex }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setDragOver(true);
                                }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition ${dragOver
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-slate-300 bg-slate-50/50 hover:border-slate-400"
                                  }`}
                              >
                                <UploadCloudIcon />
                                <p className="mt-2 text-xs font-bold text-slate-700">
                                  No image selected
                                </p>
                                <p className="mt-0.5 text-[10px] text-slate-400">
                                  Choose local file or drop image here
                                </p>

                                <button
                                  type="button"
                                  disabled={isUploading}
                                  onClick={() => fileInputRef.current?.click()}
                                  className="mt-3 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                  {isUploading ? "Uploading..." : "Select Image"}
                                </button>
                              </div>
                            )}

                            {uploadError && (
                              <p className="text-xs font-semibold text-red-500">{uploadError}</p>
                            )}
                          </div>

                          {/* Direct Image URL input */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Image Web URL / Source
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.src || ""}
                              onChange={(e) => updateSelectedProp("src", e.target.value)}
                              placeholder="https://images.unsplash.com/..."
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>

                          {/* Alt Text */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Alt Text (SEO & Accessibility)
                            </label>
                            <input
                              type="text"
                              value={selectedElementAny.alt || ""}
                              onChange={(e) => updateSelectedProp("alt", e.target.value)}
                              placeholder="Describe the image content..."
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>

                        {/* LAYOUT SECTION */}
                        <div className="space-y-3 pt-3 border-t border-slate-200">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                            Layout & Alignment
                          </h3>

                          {/* Width & Height */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Width
                              </label>
                              <select
                                value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "width") || "100%"}
                                onChange={(e) => updateSelectedStyle("width", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              >
                                <option value="100%">100% (Full Width)</option>
                                <option value="75%">75%</option>
                                <option value="50%">50% (Half Width)</option>
                                <option value="33%">33%</option>
                                <option value="25%">25%</option>
                                <option value="auto">Auto</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Height
                              </label>
                              <select
                                value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "height") || "auto"}
                                onChange={(e) => updateSelectedStyle("height", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              >
                                <option value="auto">Auto</option>
                                <option value="150px">150px</option>
                                <option value="200px">200px</option>
                                <option value="300px">300px</option>
                                <option value="400px">400px</option>
                                <option value="500px">500px</option>
                              </select>
                            </div>
                          </div>

                          {/* Object Fit & Object Position */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Object Fit
                              </label>
                              <select
                                value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "objectFit") || "cover"}
                                onChange={(e) => updateSelectedStyle("objectFit", e.target.value as any)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              >
                                <option value="cover">Cover (Fill Container)</option>
                                <option value="contain">Contain (Fit Whole Image)</option>
                                <option value="fill">Fill (Stretch)</option>
                                <option value="none">None (Original Size)</option>
                                <option value="scale-down">Scale Down</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Object Position
                              </label>
                              <select
                                value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "objectPosition") || "center"}
                                onChange={(e) => updateSelectedStyle("objectPosition", e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                              >
                                <option value="center">Center</option>
                                <option value="top">Top</option>
                                <option value="bottom">Bottom</option>
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                                <option value="top left">Top Left</option>
                                <option value="top right">Top Right</option>
                                <option value="bottom left">Bottom Left</option>
                                <option value="bottom right">Bottom Right</option>
                              </select>
                            </div>
                          </div>

                          {/* Alignment */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Alignment
                            </label>
                            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                              {(["left", "center", "right"] as const).map((align) => {
                                const currentAlign = getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "textAlign") || "left";
                                const isActive = currentAlign === align;
                                return (
                                  <button
                                    key={align}
                                    type="button"
                                    onClick={() => updateSelectedStyle("textAlign", align)}
                                    className={`rounded-md py-1 text-xs font-semibold capitalize transition ${isActive
                                      ? "bg-white text-blue-600 shadow-xs"
                                      : "text-slate-600 hover:text-slate-900"
                                      }`}
                                  >
                                    {align}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* STYLE SECTION */}
                        <div className="space-y-3 pt-3 border-t border-slate-200">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1">
                            Style & Effects
                          </h3>

                          {/* Border Radius */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Border Radius
                            </label>
                            <select
                              value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "borderRadius") || "8px"}
                              onChange={(e) => updateSelectedStyle("borderRadius", e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                            >
                              <option value="0px">0px (Square Sharp)</option>
                              <option value="4px">4px (Small)</option>
                              <option value="8px">8px (Medium Rounded)</option>
                              <option value="16px">16px (Large Rounded)</option>
                              <option value="24px">24px (Extra Rounded)</option>
                              <option value="9999px">9999px (Pill / Circle)</option>
                            </select>
                          </div>

                          {/* Opacity */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-semibold text-slate-700">
                                Opacity
                              </label>
                              <span className="text-xs font-mono font-bold text-slate-600">
                                {Math.round(Number(getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "opacity") ?? 1) * 100)}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "opacity") ?? 1}
                              onChange={(e) => updateSelectedStyle("opacity", parseFloat(e.target.value))}
                              className="w-full accent-blue-600 cursor-pointer"
                            />
                          </div>
                          {/* F-220: Image Mask Shape */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Image Mask Shape (F-220)
                            </label>
                            <select
                              value={selectedElementAny.imageMaskShape || "none"}
                              onChange={(e) => updateSelectedProp("imageMaskShape", e.target.value as any)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                            >
                              <option value="none">None (Rectangular)</option>
                              <option value="circle">⚪ Circle</option>
                              <option value="rounded">▢ Smooth Rounded</option>
                              <option value="blob">🫧 Organic Blob</option>
                              <option value="hexagon">⬡ Hexagon</option>
                              <option value="star">⭐ Star</option>
                              <option value="diamond">◆ Diamond</option>
                              <option value="squircle">⭕ Squircle</option>
                              <option value="heart">💖 Heart</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* F-212: Basic Media Carousel Inspector */}
                    {selectedElementAny.type === "basic-media-carousel" && (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                          🎠 Media Carousel Settings
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Slides Per View</label>
                            <input
                              type="number"
                              min={1}
                              max={6}
                              value={selectedElementAny.mediaCarouselSlidesPerView || 2}
                              onChange={(e) => updateSelectedProp("mediaCarouselSlidesPerView", Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Gap (px)</label>
                            <input
                              type="number"
                              min={0}
                              max={40}
                              value={selectedElementAny.mediaCarouselGap ?? 12}
                              onChange={(e) => updateSelectedProp("mediaCarouselGap", Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.mediaCarouselShowNav !== false}
                              onChange={(e) => updateSelectedProp("mediaCarouselShowNav", e.target.checked)}
                            />
                            Nav Arrows
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.mediaCarouselShowDots !== false}
                              onChange={(e) => updateSelectedProp("mediaCarouselShowDots", e.target.checked)}
                            />
                            Pagination Dots
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedElementAny.mediaCarouselAutoplay ?? true}
                              onChange={(e) => updateSelectedProp("mediaCarouselAutoplay", e.target.checked)}
                            />
                            Autoplay
                          </label>
                        </div>
                      </div>
                    )}

                    {/* F-214: Basic Gallery Inspector */}
                    {selectedElementAny.type === "basic-gallery" && (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                          🖼️ Basic Gallery Settings
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Columns</label>
                            <select
                              value={selectedElementAny.basicGalleryColumns || 3}
                              onChange={(e) => updateSelectedProp("basicGalleryColumns", Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold outline-none"
                            >
                              <option value={1}>1 Column</option>
                              <option value={2}>2 Columns</option>
                              <option value={3}>3 Columns</option>
                              <option value={4}>4 Columns</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Gap (px)</label>
                            <input
                              type="number"
                              min={0}
                              max={40}
                              value={selectedElementAny.basicGalleryGap ?? 12}
                              onChange={(e) => updateSelectedProp("basicGalleryGap", Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* F-215: Audio Playlist Inspector */}
                    {selectedElementAny.type === "audio-playlist" && (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                          🎵 Audio Playlist Colors & Tracks
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Card Background</label>
                            <input
                              type="color"
                              value={selectedElementAny.audioPlaylistCardBg || "#0f172a"}
                              onChange={(e) => updateSelectedProp("audioPlaylistCardBg", e.target.value)}
                              className="h-8 w-full cursor-pointer rounded border border-slate-300 p-0.5"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Accent Color</label>
                            <input
                              type="color"
                              value={selectedElementAny.audioPlaylistAccentColor || "#38bdf8"}
                              onChange={(e) => updateSelectedProp("audioPlaylistAccentColor", e.target.value)}
                              className="h-8 w-full cursor-pointer rounded border border-slate-300 p-0.5"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* F-219: Dynamic Lightbox Inspector */}
                    {selectedElementAny.type === "dynamic-lightbox" && (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                          🔍 Dynamic Lightbox Settings
                        </span>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-1">Trigger Button Label</label>
                          <input
                            type="text"
                            value={selectedElementAny.lightboxTriggerText || "🔍 Open Dynamic Lightbox"}
                            onChange={(e) => updateSelectedProp("lightboxTriggerText", e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* F-221: Custom SVG Inspector */}
                    {selectedElementAny.type === "custom-svg" && (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                          ⚡ Custom SVG Markup & Styling
                        </span>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-1">Raw SVG Markup Code</label>
                          <textarea
                            rows={4}
                            value={selectedElementAny.svgRawContent || ""}
                            onChange={(e) => updateSelectedProp("svgRawContent", e.target.value)}
                            placeholder="<svg viewBox='0 0 24 24'>...</svg>"
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">SVG Fill / Stroke Color</label>
                            <input
                              type="color"
                              value={selectedElementAny.svgColor || "#0284c7"}
                              onChange={(e) => updateSelectedProp("svgColor", e.target.value)}
                              className="h-8 w-full cursor-pointer rounded border border-slate-300 p-0.5"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Alignment</label>
                            <select
                              value={selectedElementAny.svgAlignment || "center"}
                              onChange={(e) => updateSelectedProp("svgAlignment", e.target.value as any)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold outline-none"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* F-222: Icon Library Inspector */}
                    {selectedElementAny.type === "icon-library" && (
                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                          ✨ Icon Library Styling
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Icon Size (px)</label>
                            <input
                              type="number"
                              value={selectedElementAny.iconSize || 48}
                              onChange={(e) => updateSelectedProp("iconSize", Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Icon Color</label>
                            <input
                              type="color"
                              value={selectedElementAny.iconColor || "#e11d48"}
                              onChange={(e) => updateSelectedProp("iconColor", e.target.value)}
                              className="h-8 w-full cursor-pointer rounded border border-slate-300 p-0.5"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Advanced Spacing Controls for non-container elements */}
                    {selectedElementAny.type !== "container" && (
                      <div className="space-y-4 pt-4 border-t border-slate-200">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Advanced Spacing
                        </h3>
                        {render4SideSpacingControl("Margin", "margin", isMarginLinked, setIsMarginLinked)}
                        {render4SideSpacingControl("Padding", "padding", isPaddingLinked, setIsPaddingLinked)}
                      </div>
                    )}

                    {/* Background & Border Controls */}
                    {renderBackgroundAndBorderControls()}

                    {/* Positioning & Layering Controls */}
                    {renderPositioningControls()}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Page Settings Section (F-018 & F-019) */}
                    {/* See inspector/noSelection/siteSettingsFirstBlock (moved verbatim) */}
                    {renderSiteSettingsFirstBlock({
                      globalSettings,
                      isMarginLinked,
                      isPaddingLinked,
                      pageSettings,
                      render4SideSpacingControl,
                      renderBackgroundAndBorderControls,
                      selectedElementAny,
                      setGlobalSettings,
                      setIsMarginLinked,
                      setIsPaddingLinked,
                      setIsSeoModalOpen,
                      setPageSettings,
                      t,
                      updateSelectedProp,
                    })}

                {/* Extended Page & Site Controls */}
                {/* Page Settings Section (F-018 & F-019) */}
                {/* See inspector/noSelection/siteSettingsSecondBlock (moved verbatim) */}
                {renderSiteSettingsSecondBlock({
                  globalSettings,
                  handleGenerateSupportToken,
                  handleRevokeSupportTokens,
                  isGeneratingToken,
                  pageSettings,
                  setGlobalSettings,
                  setIsMultilingualModalOpen,
                  setIsSeoAnalyzerOpen,
                  setIsSeoModalOpen,
                  setIsSupportCredentialsOpen,
                  setPageSettings,
                  setSupportCopied,
                  supportCopied,
                  supportExpiresAt,
                  supportMessage,
                  supportToken,
                  t,
                  updatePreference,
                  userPreferences,
                })}
                  </div>
                )}
              </>
            )}
          </aside>
        )}
      </div>

      {/* Contextual Action Menu Overlay (F-010) */}
      {/* See shell/overlays/elementContextMenu (moved verbatim) */}
      {renderElementContextMenu({
        contextMenu,
        copiedStyles,
        handleCopyElement,
        handleCopyStyle,
        handleDeleteElement,
        handleDuplicateElement,
        handlePasteStyle,
        handleReorderElement,
        handleSaveAsComponent,
        isPreview,
        setContextMenu,
      })}

      {/* Finder Command Palette Modal (F-027) */}
      {/* See shell/overlays/finderOverlay (moved verbatim) */}
      {renderFinderOverlay({
        finderQuery,
        handleAddElement,
        handleGenerateSupportToken,
        handleQuitEditor,
        handleRedo,
        handleReorderElement,
        handleSave,
        handleUndo,
        isFinderOpen,
        isPreview,
        isShortcutsHelpOpen,
        selectedId,
        setFinderQuery,
        setIsFinderOpen,
        setIsPreview,
        setIsShortcutsHelpOpen,
        setLeftSidebarTab,
        setSelectedId,
        updatePreference,
        userPreferences,
      })}
      {/* ========================================== */}
      {/* Keyboard Shortcuts Help Modal (F-031)      */}
      {/* ========================================== */}
      {/* See shell/overlays/shortcutsHelpOverlay (moved verbatim) */}
      {renderShortcutsHelpOverlay({
        isShortcutsHelpOpen,
        setIsShortcutsHelpOpen,
      })}
      {/* ========================================== */}
      {/* Manage Widgets & Visibility Modal (F-032)  */}
      {/* ========================================== */}
      {/* See shell/overlays/elementManagerOverlay (moved verbatim) */}
      {renderElementManagerOverlay({
        disabledWidgets,
        enableAllWidgets,
        isElementManagerOpen,
        managerCategoryFilter,
        managerSearchQuery,
        resetWidgetsToDefault,
        setIsElementManagerOpen,
        setManagerCategoryFilter,
        setManagerSearchQuery,
        toggleWidgetAvailability,
      })}

      {/* Popup Manager Modal */}
      <PopupManagerModal
        isOpen={isPopupManagerOpen}
        onClose={() => setIsPopupManagerOpen(false)}
        popups={popups}
        onSelectPopupForEdit={handleSelectPopupForEdit}
        onCreatePopup={handleCreatePopup}
        onUpdatePopup={handleUpdatePopup}
        onDeletePopup={handleDeletePopup}
        onDuplicatePopup={handleDuplicatePopup}
      />

      {/* Runtime Simulation in Preview Mode (F-282 - F-291) */}
      {isPreview && (
        <PopupRuntimePreview
          popups={popups}
          renderElementTree={renderElementTree}
          onTrackView={handleTrackPopupView}
          onTrackClick={handleTrackPopupClick}
          isPreviewMode={true}
          globalSettings={globalSettings}
        />
      )}

      {/* Developer Modal (F-102 - F-109) */}
      {devModalMode && <Suspense fallback={null}><DeveloperModal
        isOpen={!!devModalMode}
        onClose={() => setDevModalMode(null)}
        mode={devModalMode}
        websiteId={websiteId}
        targetElement={selectedElement || elements[0]}
        initialValue={
          devModalMode === "element-css" ? selectedElement?.customCss :
            devModalMode === "css-selectors" ? selectedElement?.customSelectors :
              devModalMode === "custom-attributes" ? selectedElement?.customAttributes :
                devModalMode === "page-css" ? pageCss :
                  devModalMode === "global-css" ? globalSettings?.customCss :
                    ""
        }
        onSave={(val) => {
          if (devModalMode === "element-css" && selectedElement) {
            updateSelectedProp("customCss", val);
          } else if (devModalMode === "css-selectors" && selectedElement) {
            updateSelectedProp("customSelectors", val);
          } else if (devModalMode === "custom-attributes" && selectedElement) {
            updateSelectedProp("customAttributes", val);
          } else if (devModalMode === "page-css") {
            setPageCss(val);
          } else if (devModalMode === "global-css") {
            setGlobalSettings((prev: any) => ({ ...prev, customCss: val }));
          } else if (devModalMode === "export-code") {
            const target = selectedElement || elements[0];
            if (target && val) {
              setElements((prev) => updateTreeElement(prev, target.id, () => val));
              setSelectedId(val.id);
            }
          }
        }}
      /></Suspense>}

      {/* F-322 / F-334 Save as Template / Update Template Dialog Modal */}
      <SaveTemplateDialog
        isOpen={isSaveTemplateOpen}
        isUpdateMode={isSaveTemplateUpdateMode}
        name={saveTemplateName}
        setName={setSaveTemplateName}
        description={saveTemplateDescription}
        setDescription={setSaveTemplateDescription}
        type={saveTemplateType}
        setType={setSaveTemplateType}
        category={saveTemplateCategory}
        setCategory={setSaveTemplateCategory}
        isSaving={isSavingTemplate}
        error={saveTemplateError}
        validationError={saveTemplateValidationError}
        onClose={closeSaveTemplateDialog}
        onSave={handleSaveTemplateSubmit}
        elements={elements}
        pageSettings={pageSettings}
      />

      {/* F-332 Replace Template Dialog Modal */}
      <ReplaceTemplateDialog
        isOpen={isReplaceTemplateOpen}
        targetElementName={selectedElement ? selectedElement.content || selectedElement.type : "Selected Element"}
        templates={libraryTemplates}
        onClose={() => setIsReplaceTemplateOpen(false)}
        onConfirmReplace={handleConfirmReplaceTemplate}
      />

      {/* F-336 Import Website Kit Dialog Modal */}
      <ImportWebsiteKitDialog
        isOpen={isImportWebsiteKitOpen}
        onClose={() => setIsImportWebsiteKitOpen(false)}
        onImportKit={handleConfirmImportWebsiteKit}
      />

      {/* AI Studio Floating Trigger - Matching Accessibility Widget Geometry & Style */}
      {/* See shell/modals/aiAssistantLauncher (moved verbatim) */}
      {renderAiAssistantLauncher({
        setIsUnifiedAiOpen,
        userAccess,
        websiteId,
      })}

      {/* See shell/modals/unifiedAiAssistantSection (moved verbatim) */}
      {renderUnifiedAiAssistantSection({
        activePageId,
        apiUrl,
        documentWriter,
        handleSave,
        hasUnsavedDocumentChanges,
        isUnifiedAiOpen,
        pendingDesignApplyKey,
        selectedElement,
        selectedId,
        setIsUnifiedAiOpen,
        websiteId,
      })}
      {/* See shell/modals/designAssistantSection (moved verbatim) */}
      {renderDesignAssistantSection({
        activePageId,
        apiUrl,
        documentWriter,
        handleSave,
        hasUnsavedDocumentChanges,
        isDesignAssistantOpen,
        pendingDesignApplyKey,
        selectedId,
        setIsDesignAssistantOpen,
        websiteId,
      })}
      <RevisionHistoryPanel
        isOpen={isRevisionHistoryOpen}
        onClose={() => setIsRevisionHistoryOpen(false)}
        websiteId={websiteId || ""}
        apiUrl={apiUrl}
        onRestore={handleRestoreRevision}
        currentWorkingState={{
          elements,
          pageSettings,
          pages,
          siteParts,
          globalSettings,
          breakpoints,
          popups,
          pageCss,
          homePageId,
        }}
      />

      {/* Modal for Adding New Page */}
      {/* Add Page modal: see shell/addPageModal (moved verbatim) */}
      {renderAddPageModal({
        handleCreateNewPage,
        isAddPageModalOpen,
        newPageName,
        newPageSlug,
        setIsAddPageModalOpen,
        setNewPageName,
        setNewPageSlug,
      })}

      {/* Modal for Editing Existing Page */}
      {/* See shell/modals/editPageModal (moved verbatim) */}
      {renderEditPageModal({
        editPageName,
        editPageSlug,
        handleSaveEditPage,
        isEditPageModalOpen,
        setEditPageName,
        setEditPageSlug,
        setIsEditPageModalOpen,
      })}

      {/* Multi-Page Management Modal (Comments 10, 11, 23, 36, 37) */}
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

      {/* Website Publishing & Deployment Modal (Comment 8) */}
      <PublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        publishing={publishing}
        deployment={deployment}
        pages={pages}
        websiteName={website?.name || "ForgeStudio Project"}
        websiteId={websiteId || ""}
        approvalWorkflowEnabled={Boolean((website as any)?.approvalWorkflowEnabled)}
        onPublish={handlePublishWebsite}
        onRollback={handleRollbackDeployment}
        onUpdateDeployment={(updatedDep) => setDeployment(updatedDep)}
        onOpenPreview={() => {
          setIsPublishModalOpen(false);
          setIsPreview(true);
        }}
      />

      {/* SEO & Quality Analyzer Modal */}
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

      {/* Advanced Icon Library Modal */}
      <IconPickerModal
        isOpen={isIconPickerOpen}
        onClose={() => setIsIconPickerOpen(false)}
        currentIcon={
          selectedElementAny
            ? (selectedElementAny as any)[iconPickerTargetField] || selectedElementAny.iconName || selectedElementAny.icon || ""
            : ""
        }
        onSelectIcon={(iconName, iconProvider) => {
          if (selectedElementAny) {
            updateSelectedProp((iconPickerTargetField || "iconName") as keyof EditorElement, iconName);
            if (iconProvider) {
              updateSelectedProp("iconProvider", iconProvider);
            }
            updateSelectedProp("icon", iconName);
          }
        }}
        onRemoveIcon={() => {
          if (selectedElementAny) {
            updateSelectedProp((iconPickerTargetField || "iconName") as keyof EditorElement, "");
            updateSelectedProp("icon", "");
          }
        }}
      />

      {/* Dynamic Font System Modal */}
      <FontPickerModal
        isOpen={isFontPickerModalOpen}
        onClose={() => setIsFontPickerModalOpen(false)}
        selectedFont={getControlStyleValue(selectedElementAny, activeDevice, activeElementState, "fontFamily")}
        onSelectFont={(fontFamily) => {
          if (fontPickerCallback) {
            fontPickerCallback(fontFamily);
          } else {
            updateSelectedStyle("fontFamily", fontFamily);
          }
          setIsFontPickerModalOpen(false);
        }}
      />

      {/* F-339: Variables Manager Modal */}
      <VariablesManagerModal
        isOpen={isVariablesModalOpen}
        onClose={() => setIsVariablesModalOpen(false)}
        variables={globalVariables}
        onSaveVariables={(updated) => {
          setGlobalVariables(updated);
          handleSave();
        }}
      />

      {/* F-340: Global Class Manager Modal */}
      <ClassManagerModal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        classes={globalClasses}
        userRole="OWNER"
        onSaveClasses={(updated) => {
          setGlobalClasses(updated);
          handleSave();
        }}
      />

{/* Phase 3: A/B Split Testing & Conversion Experiments Modal */}
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

      {/* F-364 & F-376: Visitor Accessibility Usability Toolbar & Reading Guide */}
      <ReadingGuideBar />
      <AccessibilityWidget
        config={globalSettings?.accessibilityWidget}
        onOpenStatement={() => setIsStatementOpen(true)}
      />
      <AccessibilityStatementModal
        isOpen={isStatementOpen}
        onClose={() => setIsStatementOpen(false)}
        organizationName={globalSettings?.siteIdentity?.name || website?.name || "Website"}
      />

      {/* F-020 Temporary Support Credentials Modal */}
      <SupportCredentialsModal
        isOpen={isSupportCredentialsOpen}
        onClose={() => setIsSupportCredentialsOpen(false)}
      />
    </div>
    </WooCommerceProvider>
  );
}
