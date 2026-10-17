/**
 * NavMenuWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useRef } from "react";
import type { EditorElement, ElementStyles, PageConfig, SiteProduct, NavMenuItem, NavSubmenuItem } from "../../../types";
import { resolveForgeLink } from "../links";

export const NavMenuWidgetRenderer = ({
  el,
  isPreview,
  mergedStyles,
  pages = [],
  homePageId,
  siteProducts = [],
  onNavigatePage,
  onUpdateElement,
  websiteId,
  isPublicSite,
}: {
  el: EditorElement;
  isPreview?: boolean;
  mergedStyles?: ElementStyles | any;
  pages?: PageConfig[];
  homePageId?: string;
  siteProducts?: SiteProduct[];
  onNavigatePage?: (pageIdOrSlug: string) => void;
  onUpdateElement?: (updater: (prev: EditorElement) => EditorElement) => void;
  websiteId?: string;
  isPublicSite?: boolean;
}) => {
  const defaultNavItems: NavMenuItem[] = [
    { id: "1", label: "Home", url: "/", isActive: true },
    { id: "2", label: "About", url: "/about" },
    {
      id: "3",
      label: "Services",
      url: "/services",
      dropdownEnabled: true,
      submenu: [
        { id: "s1", label: "Web Design", url: "/services/web-design", description: "Modern responsive web designs" },
        { id: "s2", label: "App Development", url: "/services/app-dev", description: "iOS and Android apps" },
        { id: "s3", label: "SEO & Growth", url: "/services/seo", description: "Search engine optimization" },
      ],
    },
    { id: "4", label: "Pricing", url: "/pricing" },
    { id: "5", label: "Contact", url: "/contact" },
  ];

  const pagesNavItems: NavMenuItem[] =
    pages && pages.length > 0
      ? pages.map((p) => ({
        id: p.id,
        label: p.name,
        url: p.slug || (p.isHome ? "/" : `/${p.name.toLowerCase()}`),
        pageId: p.id,
        isActive: p.isHome || p.id === homePageId,
      }))
      : defaultNavItems;

  const items: NavMenuItem[] =
    el.navMenuItems && el.navMenuItems.length > 0 ? el.navMenuItems : pagesNavItems;

  const isVertical = el.navLayout === "vertical";
  const alignment = el.navAlignment || mergedStyles?.textAlign || mergedStyles?.justifyContent || "left";
  const gap = el.navGap ?? 24;
  const itemColor = el.navItemColor || "#334155";
  const itemHoverColor = el.navItemHoverColor || "#2563eb";
  const itemActiveColor = el.navItemActiveColor || "#2563eb";
  const itemBg = el.navItemBg || "transparent";
  const itemHoverBg = el.navItemHoverBg || "rgba(241, 245, 249, 0.8)";
  const itemActiveBg = el.navItemActiveBg || "rgba(37, 99, 235, 0.1)";
  const fontSize = el.navFontSize || "14px";
  const fontWeight = el.navFontWeight || "600";
  const textTransform = el.navTextTransform || "none";
  const submenuBg = el.navSubmenuBg || "#ffffff";
  const submenuTextColor = el.navSubmenuTextColor || "#334155";
  const globalTrigger = el.navTrigger || "hover";

  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(
    items.find((i) => i.isActive)?.id || items[0]?.id || null
  );
  const [itemDragState, setItemDragState] = useState<{ id: string; x: number; y: number } | null>(null);
  const navListRef = useRef<HTMLUListElement | null>(null);

  let justifyClass = "justify-start";
  if (alignment === "center") justifyClass = "justify-center";
  else if (alignment === "right" || alignment === "flex-end") justifyClass = "justify-end";
  else if (alignment === "between" || alignment === "space-between") justifyClass = "justify-between";

  const resolveItem = (item: NavMenuItem | NavSubmenuItem) => {
    let displayLabel = item.label;
    let isOrphaned = false;

    const { resolvedUrl, targetPage } = resolveForgeLink(
      item.url,
      item.pageId,
      item.destinationType || item.linkType,
      { pages, homePageId, websiteId, isPublicSite }
    );

    if (item.destinationType === "page" || item.linkType === "page" || item.pageId) {
      if (item.pageId && !targetPage) {
        isOrphaned = true;
        displayLabel = `${item.label || "Page"} (Unavailable)`;
      } else if (targetPage) {
        displayLabel = item.label || targetPage.name;
      }
    } else if (item.destinationType === "product" || item.linkType === "product" || item.productId) {
      if (item.productId) {
        const found = siteProducts?.find((p) => p.id === item.productId);
        if (found) {
          displayLabel = item.label || found.name;
          return { displayLabel, displayUrl: found.url || `#product-${found.id}`, isOrphaned: false, targetPage: undefined };
        } else {
          isOrphaned = true;
          displayLabel = `${item.label || "Product"} (Unavailable)`;
        }
      }
    }

    return { displayLabel, displayUrl: resolvedUrl, isOrphaned, targetPage };
  };

  const handleItemPointerDown = (
    e: React.PointerEvent<HTMLLIElement>,
    item: NavMenuItem,
    idx: number
  ) => {
    if (isPreview) return;
    if (e.button !== 0) return;

    // Prevent level 1 canvas widget dragging from catching this event
    e.stopPropagation();

    const li = e.currentTarget;
    const ul = navListRef.current || (li.parentElement as HTMLElement);
    if (!ul) return;

    const ulRect = ul.getBoundingClientRect();
    const liRect = li.getBoundingClientRect();

    const currentX = item.position?.x ?? Math.round(liRect.left - ulRect.left);
    const currentY = item.position?.y ?? Math.round(liRect.top - ulRect.top);

    const startPointerX = e.clientX;
    const startPointerY = e.clientY;
    let isDragging = false;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - startPointerX;
      const dy = moveEv.clientY - startPointerY;

      if (!isDragging && Math.hypot(dx, dy) > 4) {
        isDragging = true;
      }

      if (isDragging) {
        let nextX = currentX + dx;
        let nextY = currentY + dy;

        const maxX = Math.max(0, ulRect.width - liRect.width);
        const maxY = Math.max(0, Math.max(ulRect.height, 120) - liRect.height);

        nextX = Math.max(0, Math.min(maxX, nextX));
        nextY = Math.max(0, Math.min(maxY, nextY));

        setItemDragState({ id: item.id, x: Math.round(nextX), y: Math.round(nextY) });
      }
    };

    const onPointerUp = (upEv: PointerEvent) => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      if (isDragging) {
        const dx = upEv.clientX - startPointerX;
        const dy = upEv.clientY - startPointerY;

        let finalX = currentX + dx;
        let finalY = currentY + dy;

        const maxX = Math.max(0, ulRect.width - liRect.width);
        const maxY = Math.max(0, Math.max(ulRect.height, 120) - liRect.height);

        finalX = Math.round(Math.max(0, Math.min(maxX, finalX)));
        finalY = Math.round(Math.max(0, Math.min(maxY, finalY)));

        setItemDragState(null);

        const copy = items.map((it, i) =>
          i === idx ? { ...it, position: { x: finalX, y: finalY } } : it
        );

        if (onUpdateElement) {
          onUpdateElement((prev) => ({
            ...prev,
            navMenuItems: copy,
            content: JSON.stringify(copy),
          }));
        }
      } else {
        setItemDragState(null);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleLinkClick = (e: React.MouseEvent, item: NavMenuItem) => {
    const { displayUrl, targetPage } = resolveItem(item);
    setActiveItemId(item.id);

    const hasSubmenu = (item.dropdownEnabled ?? true) && item.submenu && item.submenu.length > 0;
    const triggerMode = item.trigger || globalTrigger;

    if (!isPreview) {
      e.preventDefault();
      e.stopPropagation();
    } else {
      if (targetPage && onNavigatePage) {
        e.preventDefault();
        onNavigatePage(targetPage.id);
        const hashMatch = displayUrl.match(/#([^?&]+)/);
        if (hashMatch) {
          setTimeout(() => {
            const anchorEl = document.getElementById(hashMatch[1]) || document.querySelector(`#${hashMatch[1]}`);
            if (anchorEl) anchorEl.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }
      } else if (displayUrl.startsWith("#") && displayUrl.length > 1) {
        const targetEl = document.querySelector(displayUrl);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: "smooth" });
        }
      }
    }

    if (hasSubmenu && (triggerMode === "click" || !isPreview)) {
      setOpenSubmenuId(openSubmenuId === item.id ? null : item.id);
    }
  };

  return (
    <nav className={`w-full flex ${justifyClass} relative transition-all`} style={{ boxSizing: "border-box", fontFamily: mergedStyles?.fontFamily, ...mergedStyles }}>
      {/* Mobile Hamburger Button */}
      <div className="flex sm:hidden items-center justify-between p-2 w-full">
        <span className="text-xs font-bold text-slate-700">Navigation Menu</span>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition cursor-pointer"
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Main Desktop & Tablet Nav List */}
      <ul
        ref={navListRef}
        className={`flex w-full ${mobileMenuOpen
            ? "flex-col items-stretch mt-2"
            : isVertical
              ? "flex-col items-stretch"
              : `hidden sm:flex flex-row items-center ${justifyClass}`
          } wrap relative`}
        style={{
          gap: `${gap}px`,
          position: "relative",
          minHeight: items.some((i) => i.position) || itemDragState ? "80px" : "44px",
        }}
      >
        {items.map((item, idx) => {
          const { displayLabel, displayUrl, isOrphaned } = resolveItem(item);
          const hasSubmenu = (item.dropdownEnabled ?? true) && item.submenu && item.submenu.length > 0;
          const triggerMode = item.trigger || globalTrigger;
          const isItemHovered = hoveredItemId === item.id;
          const isOpen = openSubmenuId === item.id || (triggerMode === "hover" && isItemHovered);
          const isItemActive = item.isActive || activeItemId === item.id;

          const currentBg = isItemActive ? itemActiveBg : isItemHovered ? itemHoverBg : itemBg;
          const currentColor = isItemActive ? itemActiveColor : isItemHovered ? itemHoverColor : itemColor;

          const activePos = itemDragState?.id === item.id
            ? { x: itemDragState.x, y: itemDragState.y }
            : item.position;

          const isPositioned = !!activePos;

          return (
            <li
              key={item.id}
              onPointerDown={(e) => handleItemPointerDown(e, item, idx)}
              className={`group list-none ${item.isDisabled ? "opacity-50 pointer-events-none" : ""} ${!isPreview ? "cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-blue-400/80 rounded-xl" : ""
                }`}
              style={{
                position: isPositioned ? "absolute" : "relative",
                left: isPositioned ? `${activePos.x}px` : undefined,
                top: isPositioned ? `${activePos.y}px` : undefined,
                zIndex: itemDragState?.id === item.id ? 40 : isOpen ? 30 : 10,
                transition: itemDragState?.id === item.id ? "none" : "all 0.15s ease-out",
              }}
              onMouseEnter={() => {
                setHoveredItemId(item.id);
                if (hasSubmenu && triggerMode === "hover") setOpenSubmenuId(item.id);
              }}
              onMouseLeave={() => {
                setHoveredItemId(null);
                if (hasSubmenu && triggerMode === "hover") setOpenSubmenuId(null);
              }}
            >
              <a
                href={displayUrl}
                target={item.target || "_self"}
                rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                onClick={(e) => handleLinkClick(e, item)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all duration-200 cursor-pointer select-none ${
                  isOrphaned ? "border border-amber-300 bg-amber-50 text-amber-800" : ""
                }`}
                style={{
                  backgroundColor: isOrphaned ? undefined : currentBg,
                  color: isOrphaned ? undefined : currentColor,
                  fontSize: fontSize,
                  fontWeight: fontWeight,
                  textTransform: textTransform as any,
                  fontFamily: mergedStyles?.fontFamily,
                }}
              >
                {item.icon && item.iconPosition !== "right" && (
                  <span className="text-base">{item.icon}</span>
                )}
                <span>{displayLabel}</span>
                {item.icon && item.iconPosition === "right" && (
                  <span className="text-base">{item.icon}</span>
                )}
                {hasSubmenu && (
                  <svg
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                )}
              </a>

              {/* Submenu Dropdown */}
              {hasSubmenu && isOpen && (
                <div
                  className={`z-50 min-w-[220px] rounded-2xl border border-slate-100 p-2 shadow-xl backdrop-blur-md transition-all duration-200 ${
                    isVertical || mobileMenuOpen
                      ? "static mt-1 ml-4"
                      : alignment === "right" || alignment === "flex-end"
                      ? "absolute right-0 top-full mt-1.5 animate-fadeIn"
                      : "absolute left-0 top-full mt-1.5 animate-fadeIn"
                  }`}
                  style={{ backgroundColor: submenuBg }}
                >
                  <div className="flex flex-col gap-1">
                    {item.submenu!.map((subItem) => {
                      const subRes = resolveItem(subItem);
                      return (
                        <a
                          key={subItem.id}
                          href={subRes.displayUrl}
                          target={subItem.target || "_self"}
                          rel={subItem.target === "_blank" ? "noopener noreferrer" : undefined}
                          onClick={(e) => {
                            if (!isPreview) {
                              e.preventDefault();
                              e.stopPropagation();
                            } else if (subRes.targetPage && onNavigatePage) {
                              e.preventDefault();
                              onNavigatePage(subRes.targetPage.id);
                              const hashMatch = subRes.displayUrl.match(/#([^?&]+)/);
                              if (hashMatch) {
                                setTimeout(() => {
                                  const anchorEl = document.getElementById(hashMatch[1]) || document.querySelector(`#${hashMatch[1]}`);
                                  if (anchorEl) anchorEl.scrollIntoView({ behavior: "smooth" });
                                }, 100);
                              }
                            } else if (subRes.displayUrl.startsWith("#") && subRes.displayUrl.length > 1) {
                              const targetEl = document.querySelector(subRes.displayUrl);
                              if (targetEl) {
                                e.preventDefault();
                                targetEl.scrollIntoView({ behavior: "smooth" });
                              }
                            }
                          }}
                          className={`group/sub flex items-center justify-between rounded-xl p-2.5 transition duration-150 cursor-pointer ${
                            subItem.isDisabled ? "opacity-50 pointer-events-none" : "hover:bg-slate-100/80"
                          } ${subRes.isOrphaned ? "bg-amber-50 text-amber-800" : ""}`}
                          style={{
                            color: subRes.isOrphaned ? undefined : submenuTextColor,
                            fontFamily: mergedStyles?.fontFamily,
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {subItem.icon && <span className="text-base">{subItem.icon}</span>}
                            <div>
                              <span className="block text-xs font-semibold">{subRes.displayLabel}</span>
                              {subItem.description && (
                                <span className="block text-[10px] text-slate-400 font-normal">{subItem.description}</span>
                              )}
                            </div>
                          </div>
                          {subItem.badge && (
                            <span className="text-[9px] font-extrabold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                              {subItem.badge}
                            </span>
                          )}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
