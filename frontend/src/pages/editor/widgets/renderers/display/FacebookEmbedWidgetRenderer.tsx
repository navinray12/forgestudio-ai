/**
 * FacebookEmbedWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { FacebookEmbedBoxIcon } from "../../icons";
import type { EditorElement, ElementStyles } from "../../../types";

/* Facebook Button Widget Components (F-197) */

/* F-198: Facebook Embed Renderer */
export const FacebookEmbedWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const rawUrl = (el.fbEmbedUrl || "").trim();
  const width = el.fbEmbedWidth || "100%";
  const height = el.fbEmbedHeight || "450px";
  const alignment = el.fbEmbedAlignment || "center";

  const alignClass =
    alignment === "left" ? "justify-start" : alignment === "right" ? "justify-end" : "justify-center";

  const formattedUrl = rawUrl
    ? /^https?:\/\//i.test(rawUrl)
      ? rawUrl
      : `https://${rawUrl}`
    : "";

  const embedSrc = formattedUrl
    ? `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(formattedUrl)}&show_text=true&width=500`
    : "";

  return (
    <div
      className={`w-full flex ${alignClass} transition-all`}
      style={{
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
        paddingTop: mergedStyles.paddingTop,
        paddingRight: mergedStyles.paddingRight,
        paddingBottom: mergedStyles.paddingBottom,
        paddingLeft: mergedStyles.paddingLeft,
      }}
    >
      {!formattedUrl ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-blue-300 bg-blue-50/50 p-8 text-center max-w-lg w-full">
          <FacebookEmbedBoxIcon />
          <h4 className="mt-3 text-sm font-bold text-blue-900">Facebook Embed Widget</h4>
          <p className="mt-1 text-xs text-blue-700">
            Enter a Facebook post or video URL in the Inspector panel to embed live content.
          </p>
        </div>
      ) : (
        <div
          className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs max-w-full"
          style={{ width, height }}
        >
          <iframe
            title="Facebook Embed Content"
            src={embedSrc}
            width="100%"
            height="100%"
            style={{ border: "none", overflow: "hidden" }}
            scrolling="no"
            frameBorder="0"
            allowFullScreen={true}
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          />
        </div>
      )}
    </div>
  );
};
