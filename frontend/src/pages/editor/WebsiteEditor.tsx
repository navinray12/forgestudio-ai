
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
import { type SitePartsConfig, type PublishingState, type DeploymentConfig, type CanonicalWebsiteData, type ThemeBuilderScope, resolveDynamicTokens, type DynamicContext } from "./types";
import { useSaveTemplate, useTemplateLibrary, TemplateLibrary, exportWebsiteKitAsJson, type Template } from "../../features/templates";
import { revisionHistoryService } from "../../features/revision-history";
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
  UniversalIconControls,
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
  PricePlanFeature,
  PricingPlan,
  WidgetRegistryItem,
  DeviceMode,
  Breakpoint,
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
  EmptyPictureIcon,
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
import { renderPageCanvasContent } from "./canvas/pageCanvasContent";
import { renderScopeBanners } from "./canvas/scopeBanners";
import { renderPreviewPageBody } from "./canvas/previewPageBody";
import { renderPreviewHeader } from "./canvas/previewHeader";
import { renderCanvasThemeStyle } from "./canvas/canvasThemeStyle";
import { renderFullScreenExitButton } from "./canvas/fullScreenExitButton";
import { renderPeerCursors } from "./canvas/peerCursors";
import { renderAccessibilityAndSupport } from "./shell/modals/accessibilityAndSupport";
import { renderExperimentSeoMultilingualModals } from "./shell/modals/experimentSeoMultilingualModals";
import { renderDesignSystemModals } from "./shell/modals/designSystemModals";
import { renderSeoAndNotesModals } from "./shell/modals/seoAndNotesModals";
import { renderPageManagerSection } from "./shell/modals/pageManagerSection";
import { renderRevisionHistorySection } from "./shell/modals/revisionHistorySection";
import { renderTemplateDialogs } from "./shell/modals/templateDialogs";
import { renderPopupSections } from "./shell/modals/popupSections";
import { renderMultiSelectBanner } from "./inspector/multiSelectBanner";
import { renderRestrictedModeInspector } from "./inspector/restrictedModeInspector";
import { applyStyleReset, applyStyleUpdate } from "./core/elementStyles";
import { selectionRangeIds, toggleSelectedId } from "./core/elementSelection";
import { upsertImportedPage, wordpressImportedPage } from "./core/wordpressImport";
import { cloneWithFreshIds, insertElementsInOrder, instantiateTemplateComponent, replaceElementById, replaceElementWithMany, withTemplateSelection } from "./core/templateElements";
import { restoredRevisionState, revisionBaselineArgs } from "./core/revisionRestore";
import { resolveCustomAttrProps } from "./canvas/elementPresentation";
import { renderLeafElementChrome } from "./canvas/leafElementChrome";
import { renderAdvancedInspectorBranch } from "./inspector/legacy/advancedInspectorBranch";
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
      updateTreeElement(prev, elementId, (item) => withTemplateSelection(item, templateId, presetName))
    );
  };

  const handleUnpackTemplate = (elementId: string) => {
    const el = findTreeElement(elements, elementId);
    if (!el) return;

    let unpackedElements: EditorElement | null = null;

    if (el.templateId && components[el.templateId]) {
      const comp = components[el.templateId];
      unpackedElements = instantiateTemplateComponent(comp.element, generateId);
    } else if (el.templatePresetName && PRESET_SECTION_TEMPLATES[el.templatePresetName]) {
      unpackedElements = PRESET_SECTION_TEMPLATES[el.templatePresetName].getElements(generateId);
    }

    if (!unpackedElements) return;

    setElements((prev) => replaceElementById(prev, elementId, unpackedElements!));

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
        const updated = toggleSelectedId(prev, id);
        setSelectedId(updated.length > 0 ? updated[updated.length - 1] : null);
        return updated;
      });
    } else if (e && e.shiftKey && selectedId && elements.length > 0) {
      const rangeIds = selectionRangeIds(getAllElementIds(elements), selectedId, id);
      if (rangeIds) {
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
    const restored = restoredRevisionState(restoredElements, restoredPageSettings, fullRestoredState);
    if (restored.elements !== undefined) {
      setElements(restored.elements);
    }
    if (restored.pageSettings !== undefined) {
      setPageSettings(restored.pageSettings);
    }
    if (restored.pages !== undefined) {
      setPages(restored.pages);
    }
    if (restored.siteParts !== undefined) {
      setSiteParts(restored.siteParts);
    }
    if (updateAutosaveBaseline) {
      updateAutosaveBaseline(
        ...revisionBaselineArgs(restoredElements, restoredPageSettings, fullRestoredState, {
          pages,
          homePageId,
          siteParts,
          globalSettings,
          publishing,
          deployment,
          breakpoints,
          popups,
          pageCss,
        })
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

      const { newPageId, importedPage } = wordpressImportedPage(data);

      setPages((prev: any[]) => upsertImportedPage(prev, newPageId, importedPage, data));

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

    const freshElements = cloneWithFreshIds(templateElements, generateId);

    const updatedElements = replaceElementWithMany(elements, selectedId, freshElements);

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
    const freshElements = cloneWithFreshIds(templateElements, generateId);
    const { updatedElements, lastInsertedId } = insertElementsInOrder(elements, selectedId, freshElements);

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
        return applyStyleUpdate(el, key, value, activeElementState, activeDevice);
      })
    );
  };

  const resetSelectedStyle = (key: keyof ElementStyles) => {
    if (!selectedId) return;
    setElements((prev) =>
      updateTreeElement(prev, selectedId, (el) => {
        return applyStyleReset(el, key, activeElementState, activeDevice);
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

    const customAttrProps = resolveCustomAttrProps(el);

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
        {/* See canvas/leafElementChrome (moved verbatim) */}
        {renderLeafElementChrome({
          copiedStyles,
          dropPosition,
          el,
          handleCopyElement,
          handleCopyStyle,
          handleDeleteElement,
          handleDuplicateElement,
          handlePasteStyle,
          handleReorderElement,
          isDropTarget,
          isHovered,
          isPreview,
          isSelected,
          path,
          setSelectedId,
        })}

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
          {/* See canvas/peerCursors (moved verbatim) */}
          {renderPeerCursors({
            canvasPeers,
          })}

          {/* Floating Exit Full Screen Overlay Button (F-015) */}
          {/* See canvas/fullScreenExitButton (moved verbatim) */}
          {renderFullScreenExitButton({
            isFullScreenCanvas,
            setIsFullScreenCanvas,
          })}
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
            {/* See canvas/canvasThemeStyle (moved verbatim) */}
            {renderCanvasThemeStyle({
              globalSettings,
            })}

            {/* Dynamic Website Navigation Header in Preview Mode */}
            {isPreview ? (
              <div className="space-y-6">
                {/* See canvas/previewHeader (moved verbatim) */}
                {renderPreviewHeader({
                  activePreviewPageId,
                  globalSettings,
                  handlePreviewPageNavigate,
                  homePageId,
                  mobileMenuOpen,
                  pageSettings,
                  pages,
                  setMobileMenuOpen,
                  website,
                })}

                {/* Currently Selected Preview Page Content */}
                {/* See canvas/previewPageBody (moved verbatim) */}
                {renderPreviewPageBody({
                  activeDevice,
                  activePageId,
                  activePreviewPageId,
                  elements,
                  globalSettings,
                  handlePreviewPageNavigate,
                  handleSwitchCanvasMode,
                  pageSettings,
                  pages,
                  renderElementTree,
                  setIsPreview,
                  siteParts,
                  website,
                })}
              </div>
            ) : (
              <>
                {/* Canvas Target Banner: Header Mode */}
                {/* See canvas/scopeBanners (moved verbatim) */}
                {renderScopeBanners({
                  activePageId,
                  canvasMode,
                  handleSwitchCanvasMode,
                  pages,
                })}

                {/* Blank Page Layout Bar (F-016) - Page Mode */}
                {/* See canvas/pageCanvasContent (moved verbatim) */}
                {renderPageCanvasContent({
                  canvasMode,
                  elements,
                  handleSwitchCanvasMode,
                  renderElementTree,
                  siteParts,
                })}
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
              /* See inspector/restrictedModeInspector (moved verbatim) */ renderRestrictedModeInspector({
                selectedElementAny,
                setElements,
              })
            ) : (
              <>
                {/* See inspector/multiSelectBanner (moved verbatim) */}
                {renderMultiSelectBanner({
                  selectedIds,
                })}

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
                      websiteId,
                      apiUrl,
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
                  /* See inspector/legacy/advancedInspectorBranch (moved verbatim; unreachable, preserved) */ renderAdvancedInspectorBranch({
                    activeDevice,
                    activeElementState,
                    apiUrl,
                    components,
                    dragOver,
                    extractedColors,
                    fileInputRef,
                    handleCreatePageQuick,
                    handleDrop,
                    handleImageFileSelect,
                    handleSampleColor,
                    handleUnpackTemplate,
                    handleVideoFileSelect,
                    handleVideoPosterSelect,
                    isMarginLinked,
                    isPaddingLinked,
                    isUploading,
                    pages,
                    render4SideSpacingControl,
                    renderBackgroundAndBorderControls,
                    renderPositioningControls,
                    renderTypographySection,
                    resetSelectedStyle,
                    selectedElementAny,
                    setDevModalMode,
                    setDragOver,
                    setIsMarginLinked,
                    setIsPaddingLinked,
                    setSelectedId,
                    siteProducts,
                    updateSelectedProp,
                    updateSelectedStyle,
                    uploadError,
                  })
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
      {/* See shell/modals/popupSections (moved verbatim) */}
      {renderPopupSections({
        globalSettings,
        handleCreatePopup,
        handleDeletePopup,
        handleDuplicatePopup,
        handleSelectPopupForEdit,
        handleTrackPopupClick,
        handleTrackPopupView,
        handleUpdatePopup,
        isPopupManagerOpen,
        isPreview,
        popups,
        renderElementTree,
        setIsPopupManagerOpen,
      })}

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
      {/* See shell/modals/templateDialogs (moved verbatim) */}
      {renderTemplateDialogs({
        closeSaveTemplateDialog,
        elements,
        handleConfirmImportWebsiteKit,
        handleConfirmReplaceTemplate,
        handleSaveTemplateSubmit,
        isImportWebsiteKitOpen,
        isReplaceTemplateOpen,
        isSaveTemplateOpen,
        isSaveTemplateUpdateMode,
        isSavingTemplate,
        libraryTemplates,
        pageSettings,
        saveTemplateCategory,
        saveTemplateDescription,
        saveTemplateError,
        saveTemplateName,
        saveTemplateType,
        saveTemplateValidationError,
        selectedElement,
        setIsImportWebsiteKitOpen,
        setIsReplaceTemplateOpen,
        setSaveTemplateCategory,
        setSaveTemplateDescription,
        setSaveTemplateName,
        setSaveTemplateType,
      })}

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
      {/* See shell/modals/revisionHistorySection (moved verbatim) */}
      {renderRevisionHistorySection({
        apiUrl,
        breakpoints,
        elements,
        globalSettings,
        handleRestoreRevision,
        homePageId,
        isRevisionHistoryOpen,
        pageCss,
        pageSettings,
        pages,
        popups,
        setIsRevisionHistoryOpen,
        siteParts,
        websiteId,
      })}

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
      {/* See shell/modals/pageManagerSection (moved verbatim) */}
      {renderPageManagerSection({
        activePageId,
        handleSwitchEditingPage,
        homePageId,
        isPageManagerModalOpen,
        pages,
        setHomePageId,
        setIsPageManagerModalOpen,
        setPages,
        siteParts,
      })}

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
      {/* See shell/modals/seoAndNotesModals (moved verbatim) */}
      {renderSeoAndNotesModals({
        activePageId,
        elements,
        globalSettings,
        handleSelectElementFromAudit,
        handleUpdateElementPropById,
        isDesignNotesOpen,
        isSeoModalOpen,
        pages,
        selectedElementAny,
        setIsDesignNotesOpen,
        setIsSeoModalOpen,
        setPageSettings,
        website,
        websiteId,
      })}

      {/* Advanced Icon Library Modal */}
      {/* See shell/modals/designSystemModals (moved verbatim) */}
      {renderDesignSystemModals({
        activeDevice,
        activeElementState,
        fontPickerCallback,
        globalClasses,
        globalVariables,
        handleSave,
        iconPickerTargetField,
        isClassModalOpen,
        isFontPickerModalOpen,
        isIconPickerOpen,
        isVariablesModalOpen,
        selectedElementAny,
        setGlobalClasses,
        setGlobalVariables,
        setIsClassModalOpen,
        setIsFontPickerModalOpen,
        setIsIconPickerOpen,
        setIsVariablesModalOpen,
        updateSelectedProp,
        updateSelectedStyle,
      })}

{/* Phase 3: A/B Split Testing & Conversion Experiments Modal */}
      {/* See shell/modals/experimentSeoMultilingualModals (moved verbatim) */}
      {renderExperimentSeoMultilingualModals({
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
      })}

      {/* F-364 & F-376: Visitor Accessibility Usability Toolbar & Reading Guide */}
      {/* See shell/modals/accessibilityAndSupport (moved verbatim) */}
      {renderAccessibilityAndSupport({
        globalSettings,
        isStatementOpen,
        isSupportCredentialsOpen,
        setIsStatementOpen,
        setIsSupportCredentialsOpen,
        website,
      })}
    </div>
    </WooCommerceProvider>
  );
}
