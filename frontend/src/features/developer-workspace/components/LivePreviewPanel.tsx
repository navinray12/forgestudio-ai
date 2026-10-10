import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  RotateCw,
  ExternalLink,
  Crosshair,
  Terminal,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { forgeProjectService, type ProjectPage } from "../services/forgeProjectService";

interface LivePreviewPanelProps {
  projectId: string;
  websiteId?: string;
  /** Changes whenever the persisted source changed, so the preview rebuilds from it */
  refreshKey?: number;
  onInspectElement?: (file: string, line: number) => void;
  currentRoute?: string;
  onRouteChange?: (newRoute: string) => void;
  pages?: ProjectPage[];
}

/**
 * Preview of the project's persisted source files: the backend bundles the
 * saved source and this panel runs the result in a sandboxed frame. It shows
 * what the code does, not the Visual Editor's document.
 */
export const LivePreviewPanel: React.FC<LivePreviewPanelProps> = ({
  projectId,
  refreshKey = 0,
  onInspectElement,
  currentRoute,
  onRouteChange,
  pages = [],
}) => {
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile" | "custom">("desktop");
  const [customWidth] = useState(1280);
  // `route` is what the address field shows; `loadedRoute` is what the frame was built for
  const [route, setRoute] = useState(currentRoute || "/");
  const [loadedRoute, setLoadedRoute] = useState(currentRoute || "/");
  const [routes, setRoutes] = useState<string[]>([]);
  const [html, setHtml] = useState<string | null>(null);
  // Identifies the build the frame currently shows; a different request key means one is in flight
  const [settledKey, setSettledKey] = useState("");
  const [buildErrors, setBuildErrors] = useState<Array<{ file?: string; line?: number; message: string }>>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [inspectMode, setInspectMode] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<Array<{ type: string; text: string; time: string }>>([]);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const requestId = useRef(0);

  const getViewportStyle = () => {
    switch (viewport) {
      case "mobile":
        return { width: "375px", maxWidth: "100%" };
      case "tablet":
        return { width: "768px", maxWidth: "100%" };
      case "desktop":
        return { width: "100%", maxWidth: "100%" };
      case "custom":
        return { width: `${customWidth}px`, maxWidth: "100%" };
    }
  };

  const normalizeRoute = (value: string) => {
    const trimmed = value.trim();
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  };

  const requestKey = `${projectId}|${loadedRoute}|${refreshKey}|${reloadTick}`;
  const loading = settledKey !== requestKey;

  // Rebuild from the saved source whenever it changes, on reload, or when another route is opened
  useEffect(() => {
    const id = ++requestId.current;
    forgeProjectService
      .getSourcePreview(projectId, loadedRoute)
      .then(({ preview }) => {
        if (id !== requestId.current) return;
        setLoadError(null);
        setHtml(preview.html);
        setRoutes(preview.routes || []);
        setBuildErrors(preview.success ? [] : preview.errors || []);
        setConsoleLogs((prev) => [
          ...prev.slice(-100),
          {
            type: preview.success ? "info" : "error",
            text: preview.success
              ? `[Preview] Built from saved source (${preview.framework}, ${preview.mode === "cdn" ? "packages from esm.sh" : "bundled locally"})`
              : `[Preview] The saved source does not compile: ${preview.errors?.[0]?.message || "build failed"}`,
            time: new Date().toLocaleTimeString(),
          },
          ...(preview.warnings || []).map((text) => ({ type: "warn", text: `[Preview] ${text}`, time: new Date().toLocaleTimeString() })),
        ]);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setLoadError(err instanceof Error ? err.message : "The preview could not be built");
      })
      .finally(() => {
        if (id === requestId.current) setSettledKey(requestKey);
      });
  }, [projectId, loadedRoute, refreshKey, reloadTick, requestKey]);

  // Sync external currentRoute changes into the frame
  useEffect(() => {
    if (currentRoute) {
      const next = normalizeRoute(currentRoute);
      if (next !== loadedRoute) {
        setRoute(next);
        setLoadedRoute(next);
      }
    }
  }, [currentRoute, loadedRoute]);

  // Messages from the preview frame
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (frameRef.current && e.source !== frameRef.current.contentWindow) return;
      if (e.data?.type === "forge:preview:route-changed") {
        const next = normalizeRoute(e.data.route || "/");
        setRoute(next);
        setLoadedRoute(next);
        onRouteChange?.(next);
      } else if (e.data?.type === "forge:preview:element:inspect") {
        onInspectElement?.(e.data.file || "src/App.tsx", e.data.line || 12);
      } else if (e.data?.type === "forge:preview:console") {
        setConsoleLogs((prev) => [
          ...prev.slice(-100),
          { type: e.data.logType || "log", text: e.data.message, time: new Date().toLocaleTimeString() },
        ]);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onInspectElement, onRouteChange]);

  const openRoute = useCallback((value: string) => {
    const next = normalizeRoute(value);
    setRoute(next);
    setLoadedRoute(next);
    setReloadTick((tick) => tick + 1);
    onRouteChange?.(next);
  }, [onRouteChange]);

  const allAvailableRoutes = Array.from(
    new Set([
      "/",
      ...routes,
      ...(pages || []).map((p) => normalizeRoute(p.routePath || "/")),
    ])
  ).sort();

  const handleOpenInNewTab = () => {
    if (!html) return;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 select-none overflow-hidden">
      {/* Top Preview Controls Toolbar */}
      <div className="h-10 px-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
        {/* Navigation & Route Input */}
        <div className="flex items-center gap-1.5 flex-1 max-w-sm mr-2">
          <button
            onClick={() => openRoute("/")}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="Back to root page (/)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          <input
            type="text"
            value={route}
            list="forge-preview-routes"
            onChange={(e) => setRoute(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") openRoute(route);
            }}
            placeholder="/"
            className="flex-1 bg-slate-950 border border-slate-700/80 rounded px-2 py-0.5 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-blue-500"
          />
          <datalist id="forge-preview-routes">
            {allAvailableRoutes.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>

          <button
            onClick={() => openRoute(route)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="Rebuild the preview from the saved source"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleOpenInNewTab}
            disabled={!html}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition disabled:opacity-40"
            title="Open this preview in a new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Viewport Presets & Tools */}
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
          <button
            onClick={() => setViewport("desktop")}
            className={`p-1 rounded transition ${
              viewport === "desktop" ? "bg-slate-800 text-blue-400" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Desktop View (Responsive 100%)"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setViewport("tablet")}
            className={`p-1 rounded transition ${
              viewport === "tablet" ? "bg-slate-800 text-blue-400" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Tablet View (768px)"
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setViewport("mobile")}
            className={`p-1 rounded transition ${
              viewport === "mobile" ? "bg-slate-800 text-blue-400" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Mobile View (375px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-px bg-slate-800 mx-1" />

          {/* Inspect Element Mode */}
          <button
            onClick={() => setInspectMode(!inspectMode)}
            className={`p-1 rounded transition ${
              inspectMode
                ? "bg-purple-900/60 text-purple-300 border border-purple-500/50"
                : "text-slate-500 hover:text-slate-300"
            }`}
            title="Inspect Element: Click an element in preview to jump to source code"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>

          {/* Preview Console Drawer Toggle */}
          <button
            onClick={() => setConsoleOpen(!consoleOpen)}
            className={`p-1 rounded transition ${
              consoleOpen ? "bg-slate-800 text-emerald-400" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Preview Console Logs"
          >
            <Terminal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {buildErrors.length > 0 && (
        <div className="px-3 py-1.5 bg-rose-950/60 border-b border-rose-900/60 text-[11px] text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            Saved source does not compile
            {buildErrors[0].file ? ` (${buildErrors[0].file}${buildErrors[0].line ? `:${buildErrors[0].line}` : ""})` : ""}:{" "}
            {buildErrors[0].message}
          </span>
        </div>
      )}

      {/* Main Iframe Canvas Container */}
      <div className="flex-1 bg-slate-950 flex items-center justify-center p-3 overflow-hidden relative">
        <div
          className="h-full bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-200 border border-slate-800"
          style={getViewportStyle()}
        >
          {loadError ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 p-6 text-center bg-slate-900 text-slate-300">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
              <p className="text-xs font-semibold">The preview could not be built</p>
              <p className="text-[11px] text-slate-400 font-mono break-all">{loadError}</p>
            </div>
          ) : html === null ? (
            <div className="h-full flex items-center justify-center bg-slate-900 text-xs text-slate-400">
              Building preview from saved source...
            </div>
          ) : (
            <iframe
              id="forge-preview-frame"
              ref={frameRef}
              title="Forge Live Preview"
              srcDoc={html}
              sandbox="allow-scripts allow-forms allow-popups"
              className="w-full h-full border-none"
            />
          )}
        </div>
      </div>

      {/* Intercepted Console Drawer */}
      {consoleOpen && (
        <div className="h-36 bg-slate-950 border-t border-slate-800 flex flex-col font-mono text-xs">
          <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Browser Console Output</span>
            <button onClick={() => setConsoleLogs([])} className="text-slate-500 hover:text-slate-300">
              Clear
            </button>
          </div>
          <div className="flex-1 p-2 overflow-y-auto space-y-1 scrollbar-thin">
            {consoleLogs.map((log, idx) => (
              <div
                key={idx}
                className={`text-[11px] flex items-start gap-2 ${
                  log.type === "error"
                    ? "text-rose-400 font-semibold"
                    : log.type === "warn"
                    ? "text-amber-400"
                    : "text-slate-300"
                }`}
              >
                <span className="text-slate-600 select-none">{log.time}</span>
                <span>{log.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
