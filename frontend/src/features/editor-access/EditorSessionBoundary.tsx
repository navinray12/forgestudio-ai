import type { ReactNode } from "react";

export function EditorSessionBoundary({websiteId,children}:{websiteId:string;children:ReactNode}){
  return <div data-editor-session={websiteId} className="min-h-screen">
    <a href="#forge-editor-root" className="sr-only focus:not-sr-only focus:absolute focus:z-[10000] focus:bg-white focus:text-black focus:p-2">Skip to editor canvas</a>
    <div id="forge-editor-root" tabIndex={-1} aria-label="Website editor workspace">{children}</div>
    <div className="sr-only" role="status" aria-live="polite">Editor session loaded for website {websiteId}</div>
  </div>;
}
