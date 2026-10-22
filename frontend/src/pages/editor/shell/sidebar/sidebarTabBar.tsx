import React from "react";

/** What renderSidebarTabBar reads: the editor values and callbacks the inline JSX used. */
export interface SidebarTabBarDeps {
  leftSidebarTab: "elements" | "navigator" | "templates";
  setLeftSidebarTab: React.Dispatch<React.SetStateAction<"elements" | "navigator" | "templates">>;
  t: (key: string, fallback: string) => string;
}

/**
 * Left sidebar tab bar: Elements, Navigator, Templates, Atomic.
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 3434-3475 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderSidebarTabBar({
  leftSidebarTab,
  setLeftSidebarTab,
  t,
}: SidebarTabBarDeps): React.ReactNode {
  return (
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-2 mb-3">
              <button
                type="button"
                onClick={() => setLeftSidebarTab("elements")}
                className={`flex-1 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md transition ${leftSidebarTab === "elements"
                  ? "bg-slate-100 text-blue-600"
                  : "text-slate-400 hover:text-slate-600"
                  }`}
              >
                {t("elements", "Elements")}
              </button>
              <button
                type="button"
                onClick={() => setLeftSidebarTab("navigator")}
                className={`flex-1 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md transition ${leftSidebarTab === "navigator"
                  ? "bg-slate-100 text-blue-600"
                  : "text-slate-400 hover:text-slate-600"
                  }`}
              >
                {t("navigator", "Navigator")}
              </button>
              <button
                type="button"
                onClick={() => setLeftSidebarTab("templates")}
                className={`flex-1 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md transition ${leftSidebarTab === "templates"
                  ? "bg-purple-100 text-purple-700 font-bold"
                  : "text-slate-400 hover:text-slate-600"
                  }`}
              >
                {t("templates", "Templates")}
              </button>
              <button
                type="button"
                onClick={() => setLeftSidebarTab("atomic" as any)}
                className={`flex-1 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md transition ${leftSidebarTab === ("atomic" as any)
                  ? "bg-purple-100 text-purple-700 font-bold"
                  : "text-slate-400 hover:text-slate-600"
                  }`}
              >
                ⚛️ Atomic
              </button>
            </div>
  );
}
