import { useEffect, useRef, useState } from "react";

/**
 * Number input with a drag handle that scrubs the value horizontally (Shift x10, Alt/Ctrl x0.1).
 * Moved from WebsiteEditor.tsx (Phase 5B-2), where it was declared inside the editor's render
 * function and therefore remounted on every editor render: typing lost focus after each keystroke and
 * the drag highlight vanished on the first step. As a module-level component its identity is stable;
 * the drag's window listeners are removed on mouseup and on unmount. Props are unchanged.
 */
export function ScrubbableNumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder = "0",
  className = "w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500",
}: {
  value: string | number;
  onChange: (val: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
}) {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const startXRef = useRef(0);
  const startValRef = useRef(0);
  // Phase 5B-2: the active drag's window listeners, so they are also removed if the input unmounts
  // mid-drag (previously they stayed until the next mouseup).
  const dragListenersRef = useRef<{ move: (e: MouseEvent) => void; up: () => void } | null>(null);
  useEffect(() => () => {
    const active = dragListenersRef.current;
    if (!active) return;
    window.removeEventListener("mousemove", active.move);
    window.removeEventListener("mouseup", active.up);
    dragListenersRef.current = null;
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const initialVal = typeof value === "number" ? value : parseFloat(String(value)) || 0;
    startXRef.current = e.clientX;
    startValRef.current = initialVal;
    setIsScrubbing(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startXRef.current;
      let multiplier = step;
      if (moveEvent.shiftKey) multiplier = step * 10;
      if (moveEvent.altKey || moveEvent.ctrlKey) multiplier = step * 0.1;

      let newVal = startValRef.current + deltaX * multiplier;
      if (min !== undefined) newVal = Math.max(min, newVal);
      if (max !== undefined) newVal = Math.min(max, newVal);

      const roundedVal = step < 1 ? Math.round(newVal * 10) / 10 : Math.round(newVal);
      onChange(String(roundedVal));
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      dragListenersRef.current = null;
    };

    // Phase 5B-2: a drag that never received its mouseup must not leave its listeners behind.
    if (dragListenersRef.current) {
      window.removeEventListener("mousemove", dragListenersRef.current.move);
      window.removeEventListener("mouseup", dragListenersRef.current.up);
    }
    dragListenersRef.current = { move: handleMouseMove, up: handleMouseUp };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className="relative flex items-center w-full group">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${className} ${isScrubbing ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50/50" : ""}`}
      />
      <div
        onMouseDown={handleMouseDown}
        title="Drag horizontally to scrub value (Shift for 10x, Alt for 0.1x)"
        className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center cursor-ew-resize px-0.5 text-[9px] font-bold text-slate-400 hover:text-blue-600 transition select-none"
      >
        ↔
      </div>
    </div>
  );
}
