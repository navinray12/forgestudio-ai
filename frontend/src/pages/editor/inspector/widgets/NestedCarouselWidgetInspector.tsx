/**
 * NestedCarouselWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import React from "react";
import type { EditorElement } from "../../types";

// 23. Nested Carousel Inspector (F-189)
export function NestedCarouselWidgetInspector({
  el,
  updateProp,
  setSelectedId
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
  setSelectedId?: (id: string) => void;
}) {
  const children = el.children || [];
  const draggedSlideIdxRef = React.useRef<number | null>(null);
  const [draggedSlideIdx, setDraggedSlideIdx] = React.useState<number | null>(null);
  const [dragOverSlideIdx, setDragOverSlideIdx] = React.useState<number | null>(null);

  const handleSlidePointerStart = (startIdx: number, startEvent: React.MouseEvent) => {
    startEvent.stopPropagation();
    startEvent.preventDefault();

    let currentHoverIdx = startIdx;
    setDraggedSlideIdx(startIdx);
    setDragOverSlideIdx(startIdx);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const elUnder = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      if (!elUnder) return;

      const slideCard = elUnder.closest("[data-slide-index]");
      if (slideCard) {
        const targetIdxAttr = slideCard.getAttribute("data-slide-index");
        if (targetIdxAttr !== null) {
          const targetIdx = parseInt(targetIdxAttr, 10);
          if (!isNaN(targetIdx) && targetIdx !== currentHoverIdx) {
            currentHoverIdx = targetIdx;
            setDragOverSlideIdx(targetIdx);
          }
        }
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";

      if (currentHoverIdx !== startIdx && currentHoverIdx >= 0 && currentHoverIdx < children.length) {
        const copy = [...children];
        const [moved] = copy.splice(startIdx, 1);
        copy.splice(currentHoverIdx, 0, moved);
        updateProp("children", copy);
      }

      setDraggedSlideIdx(null);
      setDragOverSlideIdx(null);
    };

    document.body.style.cursor = "grabbing";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className="space-y-4">
      {/* Carousel Settings */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
        <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Carousel Controls & Layout
        </span>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Slides Per View
            </label>
            <select
              value={el.nestedCarouselSlidesPerView || 1}
              onChange={(e) => updateProp("nestedCarouselSlidesPerView", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
            >
              <option value={1}>1 Slide</option>
              <option value={2}>2 Slides</option>
              <option value={3}>3 Slides</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Card Gap (px)
            </label>
            <input
              type="number"
              value={el.nestedCarouselGap ?? 20}
              onChange={(e) => updateProp("nestedCarouselGap", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Border Radius
            </label>
            <select
              value={el.nestedCarouselBorderRadius || "16px"}
              onChange={(e) => updateProp("nestedCarouselBorderRadius", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
            >
              <option value="0px">Square (0px)</option>
              <option value="8px">Rounded (8px)</option>
              <option value="16px">Large (16px)</option>
              <option value="24px">X-Large (24px)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Autoplay Speed (ms)
            </label>
            <input
              type="number"
              step={500}
              min={1000}
              value={el.nestedCarouselAutoplaySpeed || 5000}
              onChange={(e) => updateProp("nestedCarouselAutoplaySpeed", Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700 cursor-pointer">
              Autoplay
            </label>
            <input
              type="checkbox"
              checked={el.nestedCarouselAutoplay !== false}
              onChange={(e) => updateProp("nestedCarouselAutoplay", e.target.checked)}
              className="accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700 cursor-pointer">
              Infinite Loop
            </label>
            <input
              type="checkbox"
              checked={el.nestedCarouselLoop !== false}
              onChange={(e) => updateProp("nestedCarouselLoop", e.target.checked)}
              className="accent-indigo-600 rounded cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700 cursor-pointer">
              Nav Arrows
            </label>
            <input
              type="checkbox"
              checked={el.nestedCarouselShowNav !== false}
              onChange={(e) => updateProp("nestedCarouselShowNav", e.target.checked)}
              className="accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700 cursor-pointer">
              Pagination Dots
            </label>
            <input
              type="checkbox"
              checked={el.nestedCarouselShowDots !== false}
              onChange={(e) => updateProp("nestedCarouselShowDots", e.target.checked)}
              className="accent-indigo-600 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Slide Containers Manager */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
          <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Slide Containers ({children.length})
          </span>

          <button
            type="button"
            onClick={() => {
              const genId = "cont_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
              const newSlide: EditorElement = {
                id: genId,
                type: "container",
                content: `Slide ${children.length + 1} Container`,
                layout: { direction: "column", justifyContent: "center", alignItems: "center", gap: 12 },
                styles: {
                  width: "100%",
                  backgroundColor: "#ffffff",
                  paddingTop: "32px",
                  paddingRight: "32px",
                  paddingBottom: "32px",
                  paddingLeft: "32px",
                  borderRadius: "16px",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "#e2e8f0",
                },
                children: [
                  {
                    id: "head_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
                    type: "heading",
                    content: `New Slide Container #${children.length + 1}`,
                    styles: { fontSize: "24px", fontWeight: "700", color: "#0f172a", textAlign: "center" },
                  },
                  {
                    id: "txt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
                    type: "text",
                    content: "Drop any elements or edit this container slide.",
                    styles: { fontSize: "14px", color: "#64748b", textAlign: "center", marginTop: "6px" },
                  },
                ],
              };
              updateProp("children", [...children, newSlide]);
            }}
            className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-indigo-700 transition cursor-pointer"
          >
            + Add Slide
          </button>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {children.map((slide, sIdx) => (
            <div
              key={slide.id}
              data-slide-index={sIdx}
              draggable={true}
              onDragStart={(e) => {
                e.stopPropagation();
                draggedSlideIdxRef.current = sIdx;
                try {
                  e.dataTransfer.setData("text/plain", sIdx.toString());
                  e.dataTransfer.effectAllowed = "move";
                } catch (err) {}
                setTimeout(() => setDraggedSlideIdx(sIdx), 0);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  e.dataTransfer.dropEffect = "move";
                } catch (err) {}
                if (dragOverSlideIdx !== sIdx) setDragOverSlideIdx(sIdx);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragOverSlideIdx !== sIdx) setDragOverSlideIdx(sIdx);
              }}
              onDragLeave={(e) => {
                e.stopPropagation();
                if (dragOverSlideIdx === sIdx) setDragOverSlideIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();

                let sourceIdx = draggedSlideIdxRef.current;
                if (sourceIdx === null) {
                  try {
                    const str = e.dataTransfer.getData("text/plain");
                    if (str) sourceIdx = parseInt(str, 10);
                  } catch (err) {}
                }

                if (sourceIdx !== null && !isNaN(sourceIdx) && sourceIdx !== sIdx && sourceIdx >= 0 && sourceIdx < children.length) {
                  const copy = [...children];
                  const [moved] = copy.splice(sourceIdx, 1);
                  copy.splice(sIdx, 0, moved);
                  updateProp("children", copy);
                }
                draggedSlideIdxRef.current = null;
                setDraggedSlideIdx(null);
                setDragOverSlideIdx(null);
              }}
              onDragEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                draggedSlideIdxRef.current = null;
                setDraggedSlideIdx(null);
                setDragOverSlideIdx(null);
              }}
              className={`flex items-center justify-between rounded-lg border bg-white p-2 text-xs transition-all duration-150 ${
                draggedSlideIdx === sIdx
                  ? "opacity-30 border-dashed border-indigo-400 bg-indigo-50/20 scale-[0.98]"
                  : dragOverSlideIdx === sIdx
                  ? "border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50/50 shadow-xs"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  draggable={true}
                  onMouseDown={(e) => handleSlidePointerStart(sIdx, e)}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    draggedSlideIdxRef.current = sIdx;
                    try {
                      e.dataTransfer.setData("text/plain", sIdx.toString());
                      e.dataTransfer.effectAllowed = "move";
                    } catch (err) {}
                    setTimeout(() => setDraggedSlideIdx(sIdx), 0);
                  }}
                  className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-100 transition shrink-0 flex items-center select-none"
                  title="Click & Drag mouse to reorder slide"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg className="w-3.5 h-3.5 pointer-events-none" fill="currentColor" viewBox="0 0 16 16">
                    <circle cx="5" cy="3" r="1.3"/>
                    <circle cx="11" cy="3" r="1.3"/>
                    <circle cx="5" cy="8" r="1.3"/>
                    <circle cx="11" cy="8" r="1.3"/>
                    <circle cx="5" cy="13" r="1.3"/>
                    <circle cx="11" cy="13" r="1.3"/>
                  </svg>
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-50 font-bold text-indigo-700 text-[10px] shrink-0">
                  #{sIdx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedId && setSelectedId(slide.id)}
                  className="font-semibold text-slate-800 hover:text-indigo-600 hover:underline text-left truncate max-w-[120px]"
                  title="Click to select & edit slide container"
                >
                  {slide.content || `Slide #${sIdx + 1}`}
                </button>
                <span className="text-[10px] text-slate-400">({(slide.children || []).length} items)</span>
              </div>

              <div className="flex items-center gap-1" onDragStart={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setSelectedId && setSelectedId(slide.id)}
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50"
                  title="Select Slide Container"
                >
                  Edit ✏️
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (children.length <= 1) return;
                    const copy = children.filter((_, idx) => idx !== sIdx);
                    updateProp("children", copy);
                  }}
                  disabled={children.length <= 1}
                  className="rounded p-1 text-[10px] font-bold text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  title="Delete Slide"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
