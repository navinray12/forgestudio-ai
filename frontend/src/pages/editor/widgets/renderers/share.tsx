/**
 * share. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import type { ShareNetworkType, PageConfig, ShareActionType, EditorElement, ShareNetworkItem } from "../../types";

export const NETWORK_BRAND_COLORS: Record<ShareNetworkType, { bg: string; text: string; hoverBg: string }> = {
  facebook: { bg: "#1877F2", text: "#ffffff", hoverBg: "#0d65d9" },
  twitter: { bg: "#000000", text: "#ffffff", hoverBg: "#1a1a1a" },
  linkedin: { bg: "#0A66C2", text: "#ffffff", hoverBg: "#084e96" },
  whatsapp: { bg: "#25D366", text: "#ffffff", hoverBg: "#1da851" },
  instagram: { bg: "#E4405F", text: "#ffffff", hoverBg: "#c13584" },
  pinterest: { bg: "#E60023", text: "#ffffff", hoverBg: "#ad001a" },
  reddit: { bg: "#FF4500", text: "#ffffff", hoverBg: "#cc3700" },
  email: { bg: "#EA4335", text: "#ffffff", hoverBg: "#c5221f" },
  copy: { bg: "#475569", text: "#ffffff", hoverBg: "#334155" },
  custom: { bg: "#2563eb", text: "#ffffff", hoverBg: "#1d4ed8" },
};

export const renderSocialNetworkIcon = (network: ShareNetworkType, className: string = "h-4 w-4") => {
  switch (network) {
    case "facebook":
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case "twitter":
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.7a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24z" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.964 9.964 0 0 0 1.333 4.993L2 22l5.233-1.237a9.98 9.98 0 0 0 4.779 1.221h.004c5.505 0 9.988-4.478 9.989-9.985A9.985 9.985 0 0 0 12.012 2zm.004 16.541h-.003a8.28 8.28 0 0 1-4.223-1.163l-.303-.18-3.137.742.827-3.051-.197-.313a8.27 8.27 0 0 1-1.272-4.436c0-4.568 3.718-8.285 8.288-8.285 2.215 0 4.296.863 5.862 2.43 1.566 1.566 2.428 3.648 2.427 5.862 0 4.569-3.717 8.286-8.287 8.286z" />
        </svg>
      );
    case "instagram":
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      );
    case "pinterest":
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.618 0 12.017 0z" />
        </svg>
      );
    case "reddit":
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.192-.491.957 0 1.73.774 1.73 1.73 0 .741-.47 1.37-1.128 1.616.015.176.024.355.024.536 0 2.709-3.158 4.908-7.054 4.908-3.895 0-7.053-2.199-7.053-4.908 0-.174.008-.348.022-.519C4.12 13.36 3.666 12.738 3.666 12c0-.956.774-1.73 1.73-1.73.473 0 .899.19 1.21.503 1.189-.844 2.83-1.401 4.639-1.482l.987-4.63 3.39.715a1.248 1.248 0 0 1 1.388-.632zM9.54 13.064c-.66 0-1.196.536-1.196 1.196 0 .66.536 1.196 1.196 1.196.66 0 1.196-.536 1.196-1.196 0-.66-.536-1.196-1.196-1.196zm4.92 0c-.66 0-1.196.536-1.196 1.196 0 .66.536 1.196 1.196 1.196.66 0 1.196-.536 1.196-1.196 0-.66-.536-1.196-1.196-1.196zm-4.39 3.935a.394.394 0 0 0-.276.674c.78.78 2.05.992 3.197.992 1.147 0 2.417-.212 3.197-.992a.395.395 0 0 0-.558-.558c-.593.593-1.636.78-2.639.78-1.003 0-2.046-.187-2.639-.78a.392.392 0 0 0-.282-.116z" />
        </svg>
      );
    case "email":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case "copy":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case "custom":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      );
  }
};

/**
 * Validates whether a URL is safe to use in social share links.
 * Blocks javascript:, data:, vbscript:, and file: protocols.
 */
export const isSafeShareUrl = (url?: string): boolean => {
  if (!url) return true;
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("vbscript:") ||
    trimmed.startsWith("file:")
  ) {
    return false;
  }
  return true;
};

/**
 * Resolves current page URL from editor pages state or window.location
 */
export const getCurrentResolvedPageUrl = (pages?: PageConfig[], activePageId?: string): string => {
  if (pages && pages.length > 0) {
    const activePage = pages.find((p) => p.id === activePageId || p.slug === activePageId) || pages[0];
    if (activePage) {
      const pagePath = (activePage.slug === "home" || activePage.slug === "/" || activePage.isHome)
        ? "/"
        : (activePage.slug.startsWith("/") ? activePage.slug : `/${activePage.slug}`);
      if (typeof window !== "undefined" && window.location.origin) {
        return `${window.location.origin}${pagePath}`;
      }
      return pagePath;
    }
  }

  if (typeof window !== "undefined" && window.location && window.location.href) {
    return window.location.href;
  }

  return "https://example.com";
};

/**
 * Dynamically resolves target destination URL for Share Buttons element
 */
/**
 * Dynamically resolves target destination URL for Share Buttons element
 */
export interface ShareActionResult {
  network: ShareNetworkType;
  actionType: ShareActionType;
  targetUrl: string;
  shareUrl: string;
  target: "_blank" | "_self";
  shareText: string;
  hashtags: string;
  isCopyAction: boolean;
  isEmailAction: boolean;
  isPageNavigation: boolean;
  pageId?: string;
}

/**
 * Dynamically resolves target destination URL for Share Buttons element
 */
export const resolveShareDestinationUrl = (
  el: EditorElement,
  netItem?: ShareNetworkItem,
  pages?: PageConfig[],
  activePageId?: string
): string => {
  let target = "";

  // 1. Individual Button-level Custom URL or Page selection override
  if (netItem?.destinationType === "page" && netItem.pageId && pages && pages.length > 0) {
    const matchedPage = pages.find((p) => p.id === netItem.pageId);
    if (matchedPage) {
      target = (matchedPage.slug === "home" || matchedPage.slug === "/" || matchedPage.isHome)
        ? "/"
        : (matchedPage.slug.startsWith("/") ? matchedPage.slug : `/${matchedPage.slug}`);
    }
  }

  const buttonCustomUrl = netItem?.customUrl || netItem?.buttonUrl || netItem?.url;

  if (!target && buttonCustomUrl && buttonCustomUrl.trim() !== "") {
    target = buttonCustomUrl.trim();
  }
  // 2. Element-level Custom URL
  else if (!target && el.shareUrl && el.shareUrl.trim() !== "") {
    target = el.shareUrl.trim();
  }

  const currentPageUrl = getCurrentResolvedPageUrl(pages, activePageId);

  // 3. Fallback to Current Page URL if custom URL is empty or unsafe
  if (!target || !isSafeShareUrl(target)) {
    return currentPageUrl;
  }

  // Prepend https:// if user typed domain without protocol
  if (
    !target.startsWith("http://") &&
    !target.startsWith("https://") &&
    !target.startsWith("mailto:") &&
    !target.startsWith("/") &&
    !target.startsWith("#")
  ) {
    target = `https://${target}`;
  }

  // Convert relative page paths like "/about" to full origin URL if window is available
  if (target.startsWith("/") && typeof window !== "undefined" && window.location && window.location.origin) {
    target = `${window.location.origin}${target}`;
  }

  return target;
};

export const getSocialShareUrl = (
  network: ShareNetworkType,
  targetUrl: string,
  shareText?: string,
  hashtags?: string,
  actionType?: ShareActionType
): string => {
  const safeTarget = targetUrl && isSafeShareUrl(targetUrl) ? targetUrl.trim() : "https://example.com";
  const url = encodeURIComponent(safeTarget);
  
  const textVal = shareText ? shareText.trim() : "";
  const title = encodeURIComponent(textVal);

  const tagsVal = hashtags && hashtags.trim() !== ""
    ? hashtags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean).join(",")
    : "";
  const encodedTags = encodeURIComponent(tagsVal);

  if (actionType === "open-url" || actionType === "custom" || network === "instagram" || network === "custom") {
    return safeTarget;
  }

  switch (network) {
    case "facebook": {
      let fb = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
      if (textVal) fb += `&quote=${title}`;
      return fb;
    }
    case "twitter": {
      let tw = `https://twitter.com/intent/tweet?url=${url}`;
      if (textVal) tw += `&text=${title}`;
      if (tagsVal) tw += `&hashtags=${encodedTags}`;
      return tw;
    }
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    case "whatsapp": {
      const whatsappMsg = encodeURIComponent(textVal ? `${textVal}\n${safeTarget}` : safeTarget);
      return `https://api.whatsapp.com/send?text=${whatsappMsg}`;
    }
    case "pinterest": {
      let pin = `https://pinterest.com/pin/create/button/?url=${url}`;
      if (textVal) pin += `&description=${title}`;
      return pin;
    }
    case "reddit": {
      let rd = `https://www.reddit.com/submit?url=${url}`;
      if (textVal) rd += `&title=${title}`;
      return rd;
    }
    case "email": {
      const subject = textVal ? title : encodeURIComponent("Check out this page!");
      const body = encodeURIComponent(textVal ? `${textVal}\n\n${safeTarget}` : safeTarget);
      return `mailto:?subject=${subject}&body=${body}`;
    }
    case "copy":
      return safeTarget;
    default:
      return safeTarget;
  }
};

/**
 * Centralized share action resolver
 */
export const resolveShareAction = (
  el: EditorElement,
  netItem?: ShareNetworkItem,
  pages?: PageConfig[],
  activePageId?: string
): ShareActionResult => {
  const network: ShareNetworkType = netItem?.network || "facebook";

  let actionType: ShareActionType = netItem?.actionType || "open-url";
  if (!netItem?.actionType) {
    if (network === "copy") actionType = "copy";
    else if (network === "email") actionType = "email";
    else if (network === "instagram" || network === "custom") actionType = "open-url";
    else if ((netItem?.customUrl && netItem.customUrl.trim() !== "") || (netItem?.buttonUrl && netItem.buttonUrl.trim() !== "")) actionType = "open-url";
    else actionType = "share";
  }

  const target = netItem?.target || "_blank";
  const shareText = netItem?.shareText || el.shareText || "";
  const hashtags = netItem?.hashtags || el.shareHashtags || "";

  const targetUrl = resolveShareDestinationUrl(el, netItem, pages, activePageId);

  let isPageNavigation = false;
  const pageId = netItem?.pageId;
  if (netItem?.destinationType === "page" && netItem.pageId) {
    isPageNavigation = true;
  }

  const shareUrl = getSocialShareUrl(network, targetUrl, shareText, hashtags, actionType);
  const isCopyAction = actionType === "copy" || network === "copy";
  const isEmailAction = actionType === "email" || network === "email";

  return {
    network,
    actionType,
    targetUrl,
    shareUrl,
    target,
    shareText,
    hashtags,
    isCopyAction,
    isEmailAction,
    isPageNavigation,
    pageId,
  };
};
