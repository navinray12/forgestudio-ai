/**
 * MegaMenuWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useRef } from "react";
import { MegaMenuBoxIcon } from "../../icons";
import type { EditorElement, ElementStyles, PageConfig, SiteProduct, MegaMenuItem, MegaMenuColumnLink } from "../../../types";
import { resolveForgeLink } from "../links";

/* F-205: Mega Menu Renderer */
export const MegaMenuWidgetRenderer = ({
  el,
  isPreview,
  mergedStyles,
  pages,
  siteProducts,
  onNavigatePage,
  onUpdateElement,
}: {
  el: EditorElement;
  isPreview?: boolean;
  mergedStyles?: ElementStyles | any;
  pages?: PageConfig[];
  siteProducts?: SiteProduct[];
  onNavigatePage?: (pageIdOrSlug: string) => void;
  onUpdateElement?: (updater: (prev: EditorElement) => EditorElement) => void;
}) => {
  const defaultItems: MegaMenuItem[] = [
    {
      id: "1",
      title: "Products",
      columns: [
        {
          id: "col_1",
          title: "Core Platform",
          links: [
            { id: "l1", label: "Visual Builder", href: "#", badge: "New", description: "Drag & drop visual builder" },
            { id: "l2", label: "Design System", href: "#", description: "Design tokens & components" },
            { id: "l3", label: "SEO & Analytics", href: "#", description: "Optimization & tracking" },
          ],
        },
        {
          id: "col_2",
          title: "Solutions",
          links: [
            { id: "l4", label: "SaaS Agencies", href: "#", description: "White-label builder" },
            { id: "l5", label: "E-Commerce Stores", href: "#", description: "Product & WooCommerce integration" },
            { id: "l6", label: "Enterprise Teams", href: "#", badge: "Pro", description: "Team collaboration" },
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
            { id: "l7", label: "Getting Started Guide", href: "#" },
            { id: "l8", label: "API Reference", href: "#" },
            { id: "l9", label: "Widget Showcase", href: "#" },
          ],
        },
      ],
    },
    { id: "3", title: "Pricing", href: "#pricing" },
  ];

  const items = el.megaMenuItems?.length ? el.megaMenuItems : defaultItems;
  const bgColor = el.megaMenuBgColor || "#ffffff";
  const textColor = el.megaMenuTextColor || "#0f172a";
  const alignment = el.megaMenuAlignment || mergedStyles?.textAlign || mergedStyles?.justifyContent || "center";
  const globalTrigger = el.megaMenuTrigger || "hover";

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [megaItemDragState, setMegaItemDragState] = useState<{ id: string; x: number; y: number } | null>(null);
  const megaNavListRef = useRef<HTMLUListElement | null>(null);

  const alignClass =
    alignment === "left" || alignment === "flex-start"
      ? "justify-start"
      : alignment === "right" || alignment === "flex-end"
      ? "justify-end"
      : alignment === "between" || alignment === "space-between"
      ? "justify-between"
      : "justify-center";

  const resolveMegaCategory = (cat: MegaMenuItem) => {
    let displayTitle = cat.title;
    const { resolvedUrl, targetPage } = resolveForgeLink(cat.href, cat.pageId, cat.destinationType || cat.linkType, { pages });

    if (cat.destinationType === "page" || cat.linkType === "page" || cat.pageId) {
      if (cat.pageId && targetPage) {
        displayTitle = cat.title || targetPage.name;
      }
    } else if (cat.destinationType === "product" || cat.linkType === "product" || cat.productId) {
      if (cat.productId) {
        const found = siteProducts?.find((p) => p.id === cat.productId);
        if (found) {
          displayTitle = cat.title || found.name;
          return { displayTitle, displayHref: found.url || `#product-${found.id}`, targetPage: undefined };
        }
      }
    }

    return { displayTitle, displayHref: resolvedUrl, targetPage };
  };

  const handleMegaItemPointerDown = (
    e: React.PointerEvent<HTMLLIElement>,
    item: MegaMenuItem,
    idx: number
  ) => {
    if (isPreview) return;
    if (e.button !== 0) return;

    // Prevent level 1 canvas widget dragging
    e.stopPropagation();

    const li = e.currentTarget;
    const ul = megaNavListRef.current || (li.parentElement as HTMLElement);
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
        const maxY = Math.max(0, Math.max(ulRect.height, 100) - liRect.height);

        nextX = Math.max(0, Math.min(maxX, nextX));
        nextY = Math.max(0, Math.min(maxY, nextY));

        setMegaItemDragState({ id: item.id, x: Math.round(nextX), y: Math.round(nextY) });
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
        const maxY = Math.max(0, Math.max(ulRect.height, 100) - liRect.height);

        finalX = Math.round(Math.max(0, Math.min(maxX, finalX)));
        finalY = Math.round(Math.max(0, Math.min(maxY, finalY)));

        setMegaItemDragState(null);

        const copy = items.map((it, i) =>
          i === idx ? { ...it, position: { x: finalX, y: finalY } } : it
        );

        if (onUpdateElement) {
          onUpdateElement((prev) => ({
            ...prev,
            megaMenuItems: copy,
            content: JSON.stringify(copy),
          }));
        }
      } else {
        setMegaItemDragState(null);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const resolveMegaLink = (link: MegaMenuColumnLink) => {
    let displayLabel = link.label;
    const displayDesc = link.description;
    const displayBadge = link.badge;
    const displayImage = link.image;

    const { resolvedUrl, targetPage } = resolveForgeLink(link.href, link.pageId, link.destinationType || link.linkType, { pages });

    if (link.destinationType === "page" || link.linkType === "page" || link.pageId) {
      if (link.pageId) {
        if (targetPage) {
          displayLabel = link.label || targetPage.name;
        } else {
          displayLabel = `${link.label || "Page"} (Unavailable)`;
        }
      }
    } else if (link.destinationType === "product" || link.linkType === "product" || link.productId) {
      if (link.productId) {
        const prod = siteProducts?.find((p) => p.id === link.productId);
        if (prod) {
          displayLabel = link.label || prod.name;
          return { displayLabel, displayUrl: prod.url || `#product-${prod.id}`, displayDesc: displayDesc || prod.description, displayBadge: displayBadge || prod.badge, displayImage: displayImage || prod.image, targetPage: undefined };
        } else {
          displayLabel = `${link.label || "Product"} (Unavailable)`;
        }
      }
    }

    return { displayLabel, displayUrl: resolvedUrl, displayDesc, displayBadge, displayImage, targetPage };
  };

  const handleCategoryClick = (e: React.MouseEvent, item: MegaMenuItem) => {
    const { displayHref, targetPage } = resolveMegaCategory(item);
    if (!isPreview) {
      e.preventDefault();
      e.stopPropagation();
    } else if (targetPage && onNavigatePage) {
      e.preventDefault();
      onNavigatePage(targetPage.id);
    } else if (displayHref.startsWith("#") && displayHref.length > 1) {
      const targetEl = document.querySelector(displayHref);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: "smooth" });
      }
    }

    const hasColumns = item.columns && item.columns.length > 0;
    const triggerMode = item.trigger || globalTrigger;

    if (hasColumns && (triggerMode === "click" || !isPreview)) {
      setActiveMenuId(activeMenuId === item.id ? null : item.id);
    }
  };

  return (
    <div
      className={`w-full flex ${alignClass} transition-all`}
      style={{
        marginTop: mergedStyles?.marginTop,
        marginBottom: mergedStyles?.marginBottom,
        paddingTop: mergedStyles?.paddingTop,
        paddingRight: mergedStyles?.paddingRight,
        paddingBottom: mergedStyles?.paddingBottom,
        paddingLeft: mergedStyles?.paddingLeft,
      }}
    >
      <nav
        className="relative w-full max-w-6xl rounded-2xl border border-slate-200 shadow-sm font-sans"
        style={{ backgroundColor: bgColor, color: textColor, borderRadius: mergedStyles?.borderRadius }}
      >
        <div className={`flex items-center ${alignClass} w-full px-6 py-3 gap-6`}>
          {el.showMegaMenuLogo && (
            <div className="flex items-center gap-3 font-extrabold text-sm tracking-tight text-blue-600 shrink-0">
              <MegaMenuBoxIcon />
              <span>MegaMenu</span>
            </div>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>

          {/* Desktop Navigation Categories */}
          <ul
            ref={megaNavListRef}
            className={`hidden sm:flex items-center ${alignClass} w-full gap-1 sm:gap-4 text-xs font-semibold relative`}
            style={{
              position: "relative",
              minHeight: items.some((i) => i.position) || megaItemDragState ? "60px" : "40px",
            }}
          >
            {items.map((item, idx) => {
              const { displayTitle, displayHref } = resolveMegaCategory(item);
              const hasColumns = item.columns && item.columns.length > 0;
              const triggerMode = item.trigger || globalTrigger;
              const isOpen = activeMenuId === item.id;

              const activePos = megaItemDragState?.id === item.id
                ? { x: megaItemDragState.x, y: megaItemDragState.y }
                : item.position;

              const isPositioned = !!activePos;

              return (
                <li
                  key={item.id}
                  onPointerDown={(e) => handleMegaItemPointerDown(e, item, idx)}
                  className={`py-2 px-3 rounded-lg hover:bg-slate-100/70 transition select-none ${!isPreview ? "cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-blue-400/80" : "cursor-pointer"
                    }`}
                  style={{
                    position: isPositioned ? "absolute" : "relative",
                    left: isPositioned ? `${activePos.x}px` : undefined,
                    top: isPositioned ? `${activePos.y}px` : undefined,
                    zIndex: megaItemDragState?.id === item.id ? 40 : isOpen ? 30 : 10,
                    transition: megaItemDragState?.id === item.id ? "none" : "all 0.15s ease-out",
                  }}
                  onMouseEnter={() => {
                    if (hasColumns && triggerMode === "hover") setActiveMenuId(item.id);
                  }}
                  onMouseLeave={() => {
                    if (hasColumns && triggerMode === "hover") setActiveMenuId(null);
                  }}
                >
                  <a
                    href={displayHref}
                    target={item.target || "_self"}
                    rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                    className="flex items-center gap-1.5"
                    onClick={(e) => handleCategoryClick(e, item)}
                  >
                    {item.icon && <span className="text-base">{item.icon}</span>}
                    <span>{displayTitle}</span>
                    {item.badge && (
                      <span className="text-[9px] font-extrabold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                    {hasColumns && <span className="text-[10px] opacity-60">▼</span>}
                  </a>

                  {/* Mega Dropdown Panel */}
                  {isOpen && hasColumns && (
                    <div
                      className={`absolute top-full ${
                        alignment === "right" || alignment === "flex-end"
                          ? "right-0 left-auto translate-x-0"
                          : alignment === "left" || alignment === "flex-start"
                          ? "left-0 right-auto translate-x-0"
                          : "left-1/2 -translate-x-1/2"
                      } mt-1 z-50 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl text-slate-800 gap-6 animate-fadeIn ${
                        (item.columns?.length || 0) === 1
                          ? "w-[300px] grid grid-cols-1"
                          : (item.columns?.length || 0) === 2
                          ? "w-[540px] grid grid-cols-2"
                          : (item.columns?.length || 0) === 3
                          ? "w-[720px] grid grid-cols-3"
                          : "w-[880px] grid grid-cols-4"
                      }`}
                      style={{ backgroundColor: "#ffffff" }}
                    >
                      {item.columns!.map((col, cIdx) => (
                        <div key={col.id || `col_${cIdx}`} className="flex flex-col gap-2">
                          <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 border-b pb-1.5 border-slate-100">
                            {col.title}
                          </h5>
                          <ul className="flex flex-col gap-2 mt-1">
                            {col.links.map((link, lIdx) => {
                              const lRes = resolveMegaLink(link);
                              return (
                                <li key={link.id || `link_${lIdx}`}>
                                  <a
                                    href={lRes.displayUrl}
                                    target={link.target || "_self"}
                                    rel={link.target === "_blank" ? "noopener noreferrer" : undefined}
                                    onClick={(e) => {
                                      if (!isPreview) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      } else if (lRes.targetPage && onNavigatePage) {
                                        e.preventDefault();
                                        onNavigatePage(lRes.targetPage.id);
                                        const hashMatch = lRes.displayUrl.match(/#([^?&]+)/);
                                        if (hashMatch) {
                                          setTimeout(() => {
                                            const anchorEl = document.getElementById(hashMatch[1]) || document.querySelector(`#${hashMatch[1]}`);
                                            if (anchorEl) anchorEl.scrollIntoView({ behavior: "smooth" });
                                          }, 100);
                                        }
                                      } else if (lRes.displayUrl.startsWith("#") && lRes.displayUrl.length > 1) {
                                        const targetEl = document.querySelector(lRes.displayUrl);
                                        if (targetEl) {
                                          e.preventDefault();
                                          targetEl.scrollIntoView({ behavior: "smooth" });
                                        }
                                      }
                                    }}
                                    className="flex items-start gap-3 p-2 rounded-xl hover:bg-blue-50/80 text-slate-700 hover:text-blue-700 transition group/link"
                                  >
                                    {lRes.displayImage ? (
                                      <img src={lRes.displayImage} alt={lRes.displayLabel} className="h-9 w-9 rounded-lg object-cover border border-slate-200 shrink-0" />
                                    ) : link.icon ? (
                                      <span className="text-lg shrink-0 mt-0.5">{link.icon}</span>
                                    ) : null}

                                    <div className="flex-1 overflow-hidden">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="text-xs font-bold text-slate-800 group-hover/link:text-blue-700">{lRes.displayLabel}</span>
                                        {lRes.displayBadge && (
                                          <span className="text-[9px] font-extrabold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                                            {lRes.displayBadge}
                                          </span>
                                        )}
                                      </div>
                                      {lRes.displayDesc && (
                                        <p className="text-[10px] text-slate-400 font-normal line-clamp-2 mt-0.5 leading-tight">
                                          {lRes.displayDesc}
                                        </p>
                                      )}
                                    </div>
                                  </a>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-100 p-4 space-y-3 bg-white rounded-b-2xl animate-fadeIn">
            {items.map((item) => {
              const { displayTitle, displayHref } = resolveMegaCategory(item);
              const hasColumns = item.columns && item.columns.length > 0;
              return (
                <div key={`m_${item.id}`} className="space-y-1.5">
                  <a
                    href={displayHref}
                    onClick={(e) => handleCategoryClick(e, item)}
                    className="flex items-center justify-between font-bold text-xs text-slate-800 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition"
                  >
                    <span className="flex items-center gap-1.5">
                      {item.icon && <span>{item.icon}</span>}
                      <span>{displayTitle}</span>
                    </span>
                    {hasColumns && <span>▼</span>}
                  </a>

                  {hasColumns && (
                    <div className="pl-3 space-y-2 border-l-2 border-blue-200">
                      {item.columns!.map((col) => (
                        <div key={`m_col_${col.id || col.title}`} className="space-y-1">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase">{col.title}</span>
                          {col.links.map((link) => {
                            const lRes = resolveMegaLink(link);
                            return (
                              <a
                                key={`m_link_${link.label}`}
                                href={lRes.displayUrl}
                                onClick={(e) => {
                                  if (!isPreview) {
                                    e.preventDefault();
                                  } else if (link.pageId && onNavigatePage) {
                                    e.preventDefault();
                                    onNavigatePage(link.pageId);
                                  }
                                }}
                                className="flex items-center gap-2 text-xs font-medium text-slate-700 p-1 rounded hover:bg-blue-50"
                              >
                                {link.icon && <span>{link.icon}</span>}
                                <span>{lRes.displayLabel}</span>
                              </a>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>
    </div>
  );
};
