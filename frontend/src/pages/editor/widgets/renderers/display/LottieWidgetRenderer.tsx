/**
 * LottieWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { LottieBoxIcon } from "../../icons";
import type { EditorElement, ElementStyles } from "../../../types";

/* F-202: Lottie Renderer */
export const LottieWidgetRenderer = ({
  el,
  isPreview: _isPreview,
  mergedStyles,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const rawUrl = (el.lottieUrl || "").trim();
  const width = el.lottieWidth || "280px";
  const height = el.lottieHeight || "280px";
  const alignment = el.lottieAlignment || "center";
  const autoplay = el.lottieAutoplay ?? true;
  const loop = el.lottieLoop ?? true;
  const speed = el.lottieSpeed || 1;

  const alignClass =
    alignment === "left" ? "justify-start" : alignment === "right" ? "justify-end" : "justify-center";

  // Lottie embed / player iframe source using official dotlottie player CDN
  const animId = rawUrl.split("/").pop()?.replace(".json", "").replace(".lottie", "") || "9844-loading";
  const playerSrc = `https://embed.lottiefiles.com/animation/${animId}?autoplay=${autoplay ? 1 : 0}&loop=${loop ? 1 : 0}&speed=${speed}`;

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
      <div
        className="relative overflow-hidden rounded-2xl border border-slate-100 bg-transparent flex items-center justify-center"
        style={{ width, height }}
      >
        {!rawUrl ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-slate-500 bg-slate-50/80 rounded-2xl w-full h-full border border-dashed border-slate-300">
            <LottieBoxIcon />
            <span className="mt-2 font-bold text-slate-700">Lottie Animation</span>
            <span className="mt-1 text-[11px] text-slate-500">Configure Lottie JSON URL in Inspector</span>
          </div>
        ) : (
          <iframe
            title="Lottie Animation Player"
            src={playerSrc}
            width="100%"
            height="100%"
            style={{ border: "none" }}
          />
        )}
      </div>
    </div>
  );
};
