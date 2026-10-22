import React from "react";
import type { UserAccessContext } from "../../../../features/permissions/hooks/useComponentAccess";
import { Sparkles } from "lucide-react";

/** What renderAiAssistantLauncher reads: the editor values and callbacks the inline JSX used. */
export interface AiAssistantLauncherDeps {
  setIsUnifiedAiOpen: React.Dispatch<React.SetStateAction<boolean>>;
  userAccess: UserAccessContext;
  websiteId: string | undefined;
}

/**
 * Floating AI assistant launcher buttons (bottom right).
 * Moved verbatim from WebsiteEditor.tsx's JSX return (lines 14340-14361 before the move). A plain
 * function, not a component: the editor calls it in the same child slot during its own render, so the
 * element tree, element identity, focus and handlers are unchanged.
 */
export function renderAiAssistantLauncher({
  setIsUnifiedAiOpen,
  userAccess,
  websiteId,
}: AiAssistantLauncherDeps): React.ReactNode {
  return (
      websiteId && userAccess.canEditDesign && (
        <div className="fixed bottom-6 right-24 z-[99998] font-sans antialiased">
          <button
            type="button"
            id="ai-studio-floating-trigger-btn"
            aria-label="Open AI Studio & Full Design Engine"
            onClick={() => setIsUnifiedAiOpen(true)}
            className="group relative flex h-14 items-center gap-2.5 px-4 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-violet-700 text-white shadow-2xl hover:shadow-purple-500/40 hover:scale-105 active:scale-95 transition-all duration-300 border border-purple-400/30 focus:outline-none focus:ring-4 focus:ring-purple-400 cursor-pointer"
            title="Open AI Studio (Assistant, Full Design, Content, Sections, Images, Code, Audits)"
          >
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse transition-transform group-hover:rotate-12 group-hover:scale-110" />
            <div className="flex flex-col text-left">
              <span className="text-xs font-black tracking-wide leading-none">AI STUDIO</span>
              <span className="text-[10px] text-purple-200 font-medium leading-none mt-1">Design & Tools</span>
            </div>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-purple-400 border-2 border-slate-900"></span>
            </span>
          </button>
        </div>
      )
  );
}
