import React from "react";
import type { DeviceMode } from "../../types";
import { Monitor, Smartphone, Tablet } from "lucide-react";

/** What renderHeaderCenterRegion reads: the editor values and callbacks the inline JSX used. */
export interface HeaderCenterRegionDeps {
  activeDevice: DeviceMode;
  setActiveDevice: React.Dispatch<React.SetStateAction<DeviceMode>>;
}

/**
 * Editor header, center region: the viewport (device) switcher.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3575-3614 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderHeaderCenterRegion({
  activeDevice,
  setActiveDevice,
}: HeaderCenterRegionDeps): React.ReactNode {
  return (
          <div className="hidden lg:flex items-center justify-center pointer-events-auto">
            <div className="flex items-center gap-0.5 bg-slate-900/80 p-0.5 rounded-lg border border-slate-700/80 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveDevice("desktop")}
                className={`w-7 h-7 flex items-center justify-center rounded-md transition cursor-pointer ${activeDevice === "desktop"
                  ? "bg-blue-600 text-white shadow-xs font-bold"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                title="Desktop View"
                aria-label="Desktop View"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveDevice("tablet")}
                className={`w-7 h-7 flex items-center justify-center rounded-md transition cursor-pointer ${activeDevice === "tablet"
                  ? "bg-blue-600 text-white shadow-xs font-bold"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                title="Tablet View"
                aria-label="Tablet View"
              >
                <Tablet className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveDevice("mobile")}
                className={`w-7 h-7 flex items-center justify-center rounded-md transition cursor-pointer ${activeDevice === "mobile"
                  ? "bg-blue-600 text-white shadow-xs font-bold"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                title="Mobile View"
                aria-label="Mobile View"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
  );
}
