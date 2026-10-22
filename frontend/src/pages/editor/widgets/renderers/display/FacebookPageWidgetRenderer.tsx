/**
 * FacebookPageWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, ElementStyles } from "../../../types";

export const FacebookPageWidgetRenderer = ({
  el,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const mode = el.facebookMode || (
    el.type === "facebook-button" ? "button" :
    el.type === "facebook-embed" ? "embed" :
    el.type === "facebook-comments" ? "comments" : "page"
  );

  const alignment = el.facebookAlignment || el.fbButtonAlignment || "center";
  const justifyClass = alignment === "left" ? "justify-start" : alignment === "right" ? "justify-end" : "justify-center";

  // MODE: LIKE / SHARE BUTTON
  if (mode === "button") {
    const targetUrl = el.fbButtonUrl || el.facebookUrl || "https://facebook.com";
    const action = el.fbButtonAction || "like";
    const label = el.fbButtonLabel || "Like Page";
    const size = el.fbButtonSize || "md";
    const sizeClasses = size === "sm" ? "px-3 py-1.5 text-xs" : size === "lg" ? "px-6 py-3 text-sm" : "px-4.5 py-2 text-xs";

    return (
      <div
        className={`w-full flex ${justifyClass}`}
        style={{
          marginTop: mergedStyles.marginTop,
          marginBottom: mergedStyles.marginBottom,
          fontFamily: mergedStyles.fontFamily,
        }}
      >
        <a
          href={targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition-all active:scale-95 ${sizeClasses}`}
        >
          <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span>{action === "share" ? "🔗 Share" : action === "follow" ? "➕ Follow" : `👍 ${label}`}</span>
        </a>
      </div>
    );
  }

  // MODE: POST EMBED
  if (mode === "embed") {
    const embedPostUrl = el.fbEmbedUrl || el.facebookUrl || "https://www.facebook.com/20531316728/posts/10154009968286729/";
    const embedWidth = el.fbEmbedWidth || "100%";
    const embedHeight = el.fbEmbedHeight || "450px";

    const pluginUrl = `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(embedPostUrl)}&show_text=true&width=500`;

    return (
      <div
        className={`w-full flex ${justifyClass}`}
        style={{
          marginTop: mergedStyles.marginTop,
          marginBottom: mergedStyles.marginBottom,
        }}
      >
        <div
          className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xs overflow-hidden"
          style={{ width: embedWidth, height: embedHeight, maxWidth: "100%" }}
        >
          <iframe
            src={pluginUrl}
            width="100%"
            height="100%"
            style={{ border: "none", overflow: "hidden" }}
            scrolling="no"
            frameBorder="0"
            allowFullScreen={true}
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            title="Facebook Post Embed"
          />
        </div>
      </div>
    );
  }

  // MODE: COMMENTS BOX
  if (mode === "comments") {
    const targetUrl = el.fbCommentsUrl || el.facebookUrl || "https://facebook.com";
    const numPosts = el.fbCommentsNumPosts || 5;
    const boxWidth = el.fbCommentsWidth || "100%";

    const pluginUrl = `https://www.facebook.com/plugins/comments.php?href=${encodeURIComponent(targetUrl)}&numposts=${numPosts}&width=100%25`;

    return (
      <div
        className={`w-full flex flex-col ${justifyClass}`}
        style={{
          marginTop: mergedStyles.marginTop,
          marginBottom: mergedStyles.marginBottom,
        }}
      >
        <div
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs overflow-hidden space-y-3"
          style={{ width: boxWidth, maxWidth: "100%" }}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>💬</span> Facebook Discussion Thread
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">Showing max {numPosts} comments</span>
          </div>
          <iframe
            src={pluginUrl}
            width="100%"
            height="350px"
            style={{ border: "none", overflow: "hidden" }}
            scrolling="no"
            frameBorder="0"
            title="Facebook Comments Box"
          />
        </div>
      </div>
    );
  }

  // MODE: PAGE FEED (DEFAULT)
  const url = el.facebookPageUrl ? el.facebookPageUrl.trim() : (el.facebookUrl ? el.facebookUrl.trim() : "");
  const tabs = el.facebookTabs || "timeline";
  const width = el.facebookWidth ?? 340;
  const height = el.facebookHeight ?? 500;
  const smallHeader = el.facebookSmallHeader ? true : false;
  const adaptContainerWidth = el.facebookAdaptContainerWidth !== false ? true : false;
  const hideCover = el.facebookHideCover ? true : false;
  const showFacepile = el.facebookShowFacepile !== false ? true : false;

  const isValidUrl = Boolean(
    url &&
      (url.startsWith("http://") || url.startsWith("https://")) &&
      (url.includes("facebook.com") || url.includes("fb.com"))
  );

  if (!isValidUrl) {
    return (
      <div
        className={`w-full flex ${justifyClass}`}
        style={{
          marginTop: mergedStyles.marginTop,
          marginBottom: mergedStyles.marginBottom,
          fontFamily: mergedStyles.fontFamily,
        }}
      >
        <div
          className="w-full max-w-md p-6 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 text-center flex flex-col items-center justify-center gap-3 shadow-xs"
          style={{
            borderColor: mergedStyles.borderColor || "#bfdbfe",
            borderRadius: mergedStyles.borderRadius || "16px",
          }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-md">
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">Facebook Page Embed</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              {url ? "Invalid Facebook Page URL provided." : "No Facebook Page URL configured."} Please enter a valid URL (e.g. <span className="font-mono text-blue-600">https://www.facebook.com/facebook</span>) in the inspector panel.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const embedParams = new URLSearchParams({
    href: url,
    tabs: tabs,
    width: String(width),
    height: String(height),
    small_header: String(smallHeader),
    adapt_container_width: String(adaptContainerWidth),
    hide_cover: String(hideCover),
    show_facepile: String(showFacepile),
    appId: "",
  });

  const embedUrl = `https://www.facebook.com/plugins/page.php?${embedParams.toString()}`;

  return (
    <div
      className={`w-full flex ${justifyClass} overflow-hidden`}
      style={{
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
        paddingTop: mergedStyles.paddingTop,
        paddingBottom: mergedStyles.paddingBottom,
        paddingLeft: mergedStyles.paddingLeft,
        paddingRight: mergedStyles.paddingRight,
        fontFamily: mergedStyles.fontFamily,
      }}
    >
      <div
        className="relative overflow-hidden rounded-xl border border-slate-200 shadow-xs bg-white"
        style={{
          width: adaptContainerWidth ? "100%" : `${width}px`,
          maxWidth: `${width}px`,
          height: `${height}px`,
          borderRadius: mergedStyles.borderRadius || "12px",
        }}
      >
        <iframe
          src={embedUrl}
          width="100%"
          height={height}
          style={{ border: "none", overflow: "hidden", minWidth: "180px" }}
          scrolling="no"
          frameBorder="0"
          allowFullScreen={true}
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          title="Facebook Page Embed"
        />
      </div>
    </div>
  );
};
