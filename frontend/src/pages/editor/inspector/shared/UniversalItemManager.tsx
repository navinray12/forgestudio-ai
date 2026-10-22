/**
 * UniversalItemManager. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import React from "react";

// Universal Item Manager Wrapper Component
export function UniversalItemManager<T extends { id: string }>(props: {
  title: string;
  items: T[] | undefined;
  onUpdate: (newItems: T[]) => void;
  createDefaultItem: () => T;
  getItemHeaderLabel: (item: T, idx: number) => string;
  renderItemFields: (
    item: T,
    idx: number,
    updateItem: (updated: Partial<T>) => void
  ) => React.ReactNode;
}) {
  const { title, items, onUpdate, createDefaultItem, getItemHeaderLabel, renderItemFields } = props;
  const currentItems = items || [];

  const draggedIdxRef = React.useRef<number | null>(null);
  const [draggedIdx, setDraggedIdx] = React.useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = React.useState<number | null>(null);

  // Pointer Mouse Drag Handler (Guarantees smooth drag reordering in all webviews/iframes)
  const handlePointerStart = (startIdx: number, startEvent: React.MouseEvent) => {
    startEvent.stopPropagation();
    startEvent.preventDefault();

    let currentHoverIdx = startIdx;
    setDraggedIdx(startIdx);
    setDragOverIdx(startIdx);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const elUnder = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      if (!elUnder) return;

      const itemCard = elUnder.closest("[data-item-index]");
      if (itemCard) {
        const targetIdxAttr = itemCard.getAttribute("data-item-index");
        if (targetIdxAttr !== null) {
          const targetIdx = parseInt(targetIdxAttr, 10);
          if (!isNaN(targetIdx) && targetIdx !== currentHoverIdx) {
            currentHoverIdx = targetIdx;
            setDragOverIdx(targetIdx);
          }
        }
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";

      if (currentHoverIdx !== startIdx && currentHoverIdx >= 0 && currentHoverIdx < currentItems.length) {
        const copy = [...currentItems];
        const [movedItem] = copy.splice(startIdx, 1);
        copy.splice(currentHoverIdx, 0, movedItem);
        onUpdate(copy);
      }

      setDraggedIdx(null);
      setDragOverIdx(null);
    };

    document.body.style.cursor = "grabbing";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    draggedIdxRef.current = index;
    try {
      e.dataTransfer.setData("text/plain", index.toString());
      e.dataTransfer.effectAllowed = "move";
    } catch (err) {}

    setTimeout(() => {
      setDraggedIdx(index);
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.dataTransfer.dropEffect = "move";
    } catch (err) {}
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    e.stopPropagation();

    let sourceIdx = draggedIdxRef.current;
    if (sourceIdx === null) {
      try {
        const str = e.dataTransfer.getData("text/plain");
        if (str) sourceIdx = parseInt(str, 10);
      } catch (err) {}
    }

    if (
      sourceIdx !== null &&
      !isNaN(sourceIdx) &&
      sourceIdx !== targetIdx &&
      sourceIdx >= 0 &&
      sourceIdx < currentItems.length
    ) {
      const copy = [...currentItems];
      const [movedItem] = copy.splice(sourceIdx, 1);
      copy.splice(targetIdx, 0, movedItem);
      onUpdate(copy);
    }

    draggedIdxRef.current = null;
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggedIdxRef.current = null;
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="space-y-3 pt-3 border-t border-slate-100">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <span>⚙️</span> {title} ({currentItems.length})
        </h4>
        <button
          type="button"
          onClick={() => {
            const newItem = createDefaultItem();
            onUpdate([...currentItems, newItem]);
          }}
          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
        >
          <span>+ Add Item</span>
        </button>
      </div>

      {currentItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
          <p className="text-xs text-slate-500 font-medium">No items added yet</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Click "+ Add Item" to configure custom items.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {currentItems.map((item, idx) => {
            const updateItem = (updatedProps: Partial<T>) => {
              const updated = currentItems.map((it) => (it.id === item.id ? { ...it, ...updatedProps } : it));
              onUpdate(updated);
            };

            const handleMoveUp = () => {
              if (idx === 0) return;
              const copy = [...currentItems];
              const temp = copy[idx - 1];
              copy[idx - 1] = copy[idx];
              copy[idx] = temp;
              onUpdate(copy);
            };

            const handleMoveDown = () => {
              if (idx === currentItems.length - 1) return;
              const copy = [...currentItems];
              const temp = copy[idx + 1];
              copy[idx + 1] = copy[idx];
              copy[idx] = temp;
              onUpdate(copy);
            };

            const handleDuplicate = () => {
              const newId = "item_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
              const clone = { ...item, id: newId };
              const copy = [...currentItems];
              copy.splice(idx + 1, 0, clone);
              onUpdate(copy);
            };

            const handleDelete = () => {
              const updated = currentItems.filter((it) => it.id !== item.id);
              onUpdate(updated);
            };

            return (
              <div
                key={item.id}
                data-item-index={idx}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnter={(e) => handleDragEnter(e, idx)}
                onDragLeave={(e) => {
                  e.stopPropagation();
                  if (dragOverIdx === idx) setDragOverIdx(null);
                }}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`rounded-xl border bg-white p-3 shadow-xs space-y-2.5 transition-all duration-150 ${
                  draggedIdx === idx
                    ? "opacity-30 border-dashed border-blue-400 bg-blue-50/20 scale-[0.98]"
                    : dragOverIdx === idx
                    ? "border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/50 shadow-md transform translate-y-0.5"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                    <span
                      draggable={true}
                      onMouseDown={(e) => handlePointerStart(idx, e)}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-blue-600 p-0.5 rounded hover:bg-slate-100 transition shrink-0 flex items-center select-none"
                      title="Click & Drag mouse to reorder item"
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
                    <span className="text-[11px] font-bold text-slate-800 truncate">
                      #{idx + 1} {getItemHeaderLabel(item, idx)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()} onDragStart={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={handleMoveUp}
                      disabled={idx === 0}
                      title="Move Up"
                      className="p-1 text-[10px] font-bold text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={handleMoveDown}
                      disabled={idx === currentItems.length - 1}
                      title="Move Down"
                      className="p-1 text-[10px] font-bold text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={handleDuplicate}
                      title="Duplicate Item"
                      className="p-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      📋
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      title="Delete Item (Safe)"
                      className="p-1 text-[10px] font-bold text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div onMouseDown={(e) => e.stopPropagation()} onDragStart={(e) => e.stopPropagation()}>
                  {renderItemFields(item, idx, updateItem)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
