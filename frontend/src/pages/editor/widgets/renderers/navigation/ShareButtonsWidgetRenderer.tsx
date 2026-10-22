/**
 * ShareButtonsWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState } from "react";
import type { EditorElement, ElementStyles, PageConfig, ShareNetworkItem } from "../../../types";
import { resolveShareAction, resolveShareDestinationUrl, NETWORK_BRAND_COLORS, renderSocialNetworkIcon } from "../share";

export const ShareButtonsWidgetRenderer = ({
  el,
  isPreview,
  mergedStyles,
  pages,
  activePageId,
  onNavigatePage,
}: {
  el: EditorElement;
  isPreview?: boolean;
  mergedStyles: ElementStyles;
  pages?: PageConfig[];
  activePageId?: string;
  onNavigatePage?: (pageIdOrSlug: string) => void;
}) => {
  const rawNetworks = el.shareNetworks && el.shareNetworks.length > 0 ? el.shareNetworks : [];
  const networks = rawNetworks.filter((n) => !n.isDisabled);
  const layout = el.shareLayout || "horizontal";
  const align = el.shareAlignment || mergedStyles?.textAlign || mergedStyles?.justifyContent || "left";
  const gap = el.shareGap ?? 10;
  const showLabels = el.shareShowLabels !== false;
  const buttonStyle = el.shareButtonStyle || "brand";
  const buttonSize = el.shareButtonSize || "md";

  const [copiedNetId, setCopiedNetId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  let sizePadding = "8px 16px";
  let sizeFontSize = "13px";
  let iconSizeClass = "h-4 w-4";

  if (buttonSize === "sm") {
    sizePadding = "6px 12px";
    sizeFontSize = "12px";
    iconSizeClass = "h-3.5 w-3.5";
  } else if (buttonSize === "lg") {
    sizePadding = "12px 22px";
    sizeFontSize = "15px";
    iconSizeClass = "h-5 w-5";
  }

  const getFlexJustify = (alignment: string) => {
    if (alignment === "center") return "center";
    if (alignment === "right" || alignment === "flex-end") return "flex-end";
    if (alignment === "between" || alignment === "space-between") return "space-between";
    return "flex-start";
  };

  const handleShareClick = async (net: ShareNetworkItem, e: React.MouseEvent) => {
    e.stopPropagation();

    const actionResult = resolveShareAction(el, net, pages, activePageId);

    if (actionResult.isCopyAction) {
      e.preventDefault();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(actionResult.targetUrl);
        } else {
          const textArea = document.createElement("textarea");
          textArea.value = actionResult.targetUrl;
          textArea.style.position = "fixed";
          textArea.style.opacity = "0";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
        }
        setCopiedNetId(net.id);
        setToastMessage(`Link copied! (${actionResult.targetUrl})`);
        setTimeout(() => {
          setCopiedNetId(null);
          setToastMessage(null);
        }, 2500);
      } catch {
        setToastMessage(`Link copied! (${actionResult.targetUrl})`);
        setTimeout(() => setToastMessage(null), 2500);
      }
      return;
    }

    if (actionResult.isEmailAction) {
      e.preventDefault();
      window.location.href = actionResult.shareUrl;
      return;
    }

    if (actionResult.isPageNavigation && actionResult.pageId && onNavigatePage) {
      e.preventDefault();
      onNavigatePage(actionResult.pageId);
      return;
    }

    if (actionResult.actionType === "share" && actionResult.shareUrl && actionResult.shareUrl.startsWith("http")) {
      e.preventDefault();
      const popupWindow = window.open(
        actionResult.shareUrl,
        "_blank",
        "width=650,height=550,scrollbars=yes,resizable=yes"
      );
      if (!popupWindow || popupWindow.closed || typeof popupWindow.closed === "undefined") {
        window.open(actionResult.shareUrl, "_blank");
      }
      return;
    }

    if (!isPreview) {
      e.preventDefault();
      const targetWindow = actionResult.target === "_self" ? "_self" : "_blank";
      if (actionResult.shareUrl && actionResult.shareUrl.startsWith("http")) {
        window.open(actionResult.shareUrl, targetWindow, targetWindow === "_blank" ? "noopener,noreferrer" : undefined);
      }
      return;
    }
  };

  const currentResolvedUrl = resolveShareDestinationUrl(el, undefined, pages, activePageId);

  return (
    <div style={{ width: "100%", boxSizing: "border-box" }} className={`w-full flex justify-${getFlexJustify(align) === "flex-end" ? "end" : getFlexJustify(align) === "center" ? "center" : getFlexJustify(align) === "space-between" ? "between" : "start"} relative select-none`}>
      {toastMessage && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-slate-900 text-white px-3 py-1 text-[11px] font-bold shadow-lg animate-in fade-in zoom-in-95">
          {toastMessage}
        </div>
      )}
      {networks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center bg-slate-50/50 w-full">
          <p className="text-xs font-bold text-slate-600">No Active Share Buttons</p>
          <p className="text-[10px] text-slate-400 mt-1">Use the properties inspector to add or enable social share buttons.</p>
        </div>
      ) : (
        <div className="space-y-1.5 w-full">
          {!isPreview && el.shareUrlSource === "custom" && (!el.shareUrl || !el.shareUrl.trim()) && (
            <div className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5 text-center">
              ⚠️ Custom URL is empty — using current page ({currentResolvedUrl})
            </div>
          )}

          <div
            className={`flex w-full ${layout === "vertical" ? "flex-col" : "flex-row flex-wrap"}`}
            style={{
              gap: `${gap}px`,
              justifyContent: getFlexJustify(align),
              alignItems: layout === "vertical" ? (align === "center" ? "center" : align === "right" || align === "flex-end" ? "flex-end" : "flex-start") : "center",
            }}
          >
            {networks.map((net) => {
              const brand = NETWORK_BRAND_COLORS[net.network] || { bg: "#475569", text: "#ffffff", hoverBg: "#334155" };

              let btnBg = brand.bg;
              let btnText = brand.text;
              let btnBorder = "1px solid transparent";

              if (buttonStyle === "solid") {
                btnBg = mergedStyles.backgroundColor || "#2563eb";
                btnText = mergedStyles.color || "#ffffff";
              } else if (buttonStyle === "outline") {
                btnBg = "transparent";
                btnText = brand.bg;
                btnBorder = `1px solid ${brand.bg}`;
              }

              const isCopied = net.id === copiedNetId;
              const defaultNetLabel =
                net.network === "twitter"
                  ? "Tweet"
                  : net.network === "copy"
                  ? "Copy Link"
                  : net.network === "instagram"
                  ? "Instagram"
                  : net.network === "custom"
                  ? "Visit Link"
                  : net.network.charAt(0).toUpperCase() + net.network.slice(1);
              const displayLabel = isCopied ? "Copied!" : net.label || defaultNetLabel;

              const actionResult = resolveShareAction(el, net, pages, activePageId);

              return (
                <a
                  key={net.id}
                  href={actionResult.shareUrl}
                  target={actionResult.target}
                  rel={actionResult.target === "_blank" ? "noopener noreferrer" : undefined}
                  onClick={(e) => handleShareClick(net, e)}
                  className="inline-flex items-center gap-2 rounded-lg font-semibold transition shadow-xs hover:opacity-90 active:scale-95 cursor-pointer"
                  style={{
                    padding: sizePadding,
                    fontSize: sizeFontSize,
                    backgroundColor: isCopied ? "#059669" : btnBg,
                    color: btnText,
                    border: btnBorder,
                    fontFamily: mergedStyles.fontFamily,
                    borderRadius: mergedStyles.borderRadius || "8px",
                    textDecoration: "none",
                  }}
                  title={isPreview ? `${displayLabel} (${actionResult.targetUrl})` : `Share Button: ${net.network}`}
                  aria-label={displayLabel}
                >
                  {renderSocialNetworkIcon(net.network, iconSizeClass)}
                  {showLabels && <span>{displayLabel}</span>}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
