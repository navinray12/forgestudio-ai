import React from "react";
import {
  Plus, FileText, Layout, Box, Grid, Sparkles, Settings, Layers, Atom
} from "lucide-react";

export type LeftRailActiveItem = "pages" | "blocks" | "templates" | "elements" | "navigator" | "atomic" | "ai" | "settings";

interface EditorLeftRailProps {
  activeItem: LeftRailActiveItem;
  onSelectItem: (item: LeftRailActiveItem) => void;
  onAddClick: () => void;
}

export const EditorLeftRail: React.FC<EditorLeftRailProps> = ({
  activeItem,
  onSelectItem,
  onAddClick,
}) => {
  const navItems: Array<{ id: LeftRailActiveItem; label: string; icon: React.ReactNode }> = [
    { id: "pages", label: "Pages", icon: <FileText className="w-4 h-4" /> },
    { id: "blocks", label: "Blocks", icon: <Layout className="w-4 h-4" /> },
    { id: "templates", label: "Templates", icon: <Box className="w-4 h-4" /> },
    { id: "elements", label: "Elements", icon: <Grid className="w-4 h-4" /> },
    { id: "navigator", label: "Navigator", icon: <Layers className="w-4 h-4" /> },
    { id: "atomic", label: "Atomic", icon: <Atom className="w-4 h-4" /> },
    { id: "ai", label: "AI", icon: <Sparkles className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-[58px] shrink-0 bg-[#0e0f19] border-r border-[#1c1d2e] flex flex-col items-center py-3 justify-between z-30 select-none">
      {/* Top Section: + Add Button and Navigation Icons */}
      <div className="flex flex-col items-center gap-4 w-full">
        {/* + Add Button (Purple Rounded Square from PDF) */}
        <button
          type="button"
          onClick={onAddClick}
          className="w-11 h-11 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-white flex flex-col items-center justify-center cursor-pointer shadow-lg shadow-purple-900/40 hover:scale-105 active:scale-95 transition"
          title="Add New Elements / Widgets"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span className="text-[9px] font-bold uppercase tracking-wider leading-none mt-0.5">
            Add
          </span>
        </button>

        {/* Rail Items List */}
        <nav className="flex flex-col items-center gap-1.5 w-full px-1">
          {navItems.map((item) => {
            const isActive = activeItem === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectItem(item.id)}
                className={`w-full py-2.5 flex flex-col items-center justify-center rounded-xl transition cursor-pointer group ${
                  isActive
                    ? "bg-[#1f2038] text-purple-300 font-semibold shadow-xs"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#161729]"
                }`}
                title={item.label}
              >
                <div className={`transition group-hover:scale-110 ${isActive ? "text-purple-400" : ""}`}>
                  {item.icon}
                </div>
                <span className="text-[10px] tracking-tight leading-none mt-1">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Settings */}
      <div className="w-full px-1">
        <button
          type="button"
          onClick={() => onSelectItem("settings")}
          className={`w-full py-2.5 flex flex-col items-center justify-center rounded-xl transition cursor-pointer group ${
            activeItem === "settings"
              ? "bg-[#1f2038] text-purple-300 font-semibold"
              : "text-slate-400 hover:text-slate-200 hover:bg-[#161729]"
          }`}
          title="Website & Editor Settings"
        >
          <Settings className="w-4 h-4 transition group-hover:scale-110" />
          <span className="text-[10px] tracking-tight leading-none mt-1">
            Settings
          </span>
        </button>
      </div>
    </aside>
  );
};
