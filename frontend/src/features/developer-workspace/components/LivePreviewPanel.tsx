import React, { useState, useEffect } from "react";
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
  ArrowRight,
} from "lucide-react";
import { forgeProjectService } from "../services/forgeProjectService";

interface LivePreviewPanelProps {
  projectId: string;
  websiteId?: string;
  onInspectElement?: (file: string, line: number) => void;
}

export const LivePreviewPanel: React.FC<LivePreviewPanelProps> = ({
  projectId,
  websiteId,
  onInspectElement,
}) => {
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile" | "custom">("desktop");
  const [customWidth, setCustomWidth] = useState(1280);
  const [route, setRoute] = useState("/");
  const [inspectMode, setInspectMode] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<any[]>([
    { type: "info", text: "[Live Preview] Fast Refresh & HMR connected", time: "12:00:00" },
  ]);

  const getViewportWidth = () => {
    switch (viewport) {
      case "mobile":
        return 375;
      case "tablet":
        return 768;
      case "desktop":
        return 1280;
      case "custom":
        return customWidth;
    }
  };

  const previewSrc = websiteId ? `/editor/${websiteId}` : `/api/v1/preview/session/mock`;

  // Listen for postMessage from preview iframe for element inspection
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "forge:preview:element:inspect") {
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
  }, [onInspectElement]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 select-none overflow-hidden">
      {/* Top Preview Controls Toolbar */}
      <div className="h-10 px-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
        {/* Navigation & Route Input */}
        <div className="flex items-center gap-1.5 flex-1 max-w-sm mr-2">
          <button
            onClick={() => setRoute("/")}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="Back to root"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          <input
            type="text"
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700/80 rounded px-2 py-0.5 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-blue-500"
          />

          <button
            onClick={() => {
              const iframe = document.getElementById("forge-preview-frame") as HTMLIFrameElement;
              if (iframe) iframe.src = iframe.src;
            }}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="Reload Preview"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Viewport Presets & Tools */}
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
          <button
            onClick={() => setViewport("desktop")}
            className={`p-1 rounded transition ${
              viewport === "desktop" ? "bg-slate-800 text-blue-400" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Desktop View (1280px)"
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

      {/* Main Iframe Canvas Container */}
      <div className="flex-1 bg-slate-950 flex items-center justify-center p-3 overflow-hidden relative">
        <div
          className="h-full bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-200 border border-slate-800"
          style={{ width: `${getViewportWidth()}px` }}
        >
          <iframe
            id="forge-preview-frame"
            title="Forge Live Preview"
            src={previewSrc}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            className="w-full h-full border-none"
          />
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
