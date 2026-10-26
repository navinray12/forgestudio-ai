import React, { useState } from "react";
import {
  Palette, Type, Move, Layers, Sparkles, Moon, Sun, Check, Plus,
  Download, Upload, Eye, EyeOff, MousePointer, Link as LinkIcon,
  Gauge, AlignJustify, ArrowRight, Settings2, Sliders, ChevronDown
} from "lucide-react";
import type { DesignVariable } from "../components/VariablesManagerModal";
import { useAccessibility } from "../../../context/AccessibilityContext";

interface DesignTokensPanelProps {
  globalSettings: any;
  onUpdateGlobalSettings: (updater: (prev: any) => any) => void;
  globalVariables: DesignVariable[];
  onSaveVariables: (updated: DesignVariable[]) => void;
  onOpenFontManager?: () => void;
  onOpenVariablesManager?: () => void;
  onOpenAccessibilityStatement?: () => void;
  onSaveTokens: () => Promise<any> | void;
  saving?: boolean;
  canvasTheme: "light" | "dark";
  onToggleCanvasTheme: () => void;
}

export const DesignTokensPanel: React.FC<DesignTokensPanelProps> = ({
  globalSettings,
  onUpdateGlobalSettings,
  globalVariables,
  onSaveVariables,
  onOpenFontManager,
  onOpenVariablesManager,
  onOpenAccessibilityStatement,
  onSaveTokens,
  saving = false,
  canvasTheme,
  onToggleCanvasTheme,
}) => {
  const {
    prefs,
    setContrastMode,
    toggleDyslexicFont,
    togglePauseAnimations,
    toggleReadingGuide,
    toggleHideImages,
    toggleBigCursor,
    toggleHighlightLinks,
  } = useAccessibility();

  const [activeTokenTab, setActiveTokenTab] = useState<"colors" | "typography" | "spacing" | "shadows" | "custom">("colors");
  const [selectedTheme, setSelectedTheme] = useState<string>("Dark");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Default color palette swatches (50 - 900)
  const defaultShades = [
    { step: "50", hex: "#faf5ff" },
    { step: "100", hex: "#f3e8ff" },
    { step: "200", hex: "#e9d5ff" },
    { step: "300", hex: "#d8b4fe" },
    { step: "400", hex: "#c084fc" },
    { step: "500", hex: "#a855f7" },
    { step: "600", hex: "#9333ea" },
    { step: "700", hex: "#7e22ce" },
    { step: "800", hex: "#6b21a8" },
    { step: "900", hex: "#581c87" },
  ];

  const [activeShade, setActiveShade] = useState("600");

  const [spacingScale, setSpacingScale] = useState<number[]>([4, 8, 12, 16, 24, 32, 48, 64]);
  const [selectedSpacingStep, setSelectedSpacingStep] = useState<number>(24);

  const [activeFontFamily, setActiveFontFamily] = useState<string>(
    globalSettings?.globalStyles?.headingFont || "Plus Jakarta Sans"
  );

  const typographyPresets = [
    { name: "H1", size: "56", lineHeight: "120" },
    { name: "H2", size: "40", lineHeight: "120" },
    { name: "H3", size: "32", lineHeight: "120" },
    { name: "H4", size: "24", lineHeight: "120" },
    { name: "Body", size: "16", lineHeight: "28" },
    { name: "Caption", size: "12", lineHeight: "20" },
  ];

  const handleApplyPaletteColor = (hex: string, step: string) => {
    setActiveShade(step);
    onUpdateGlobalSettings((prev: any) => ({
      ...prev,
      globalStyles: {
        ...(prev?.globalStyles || {}),
        primaryColor: hex,
      },
    }));
  };

  const handleSelectFont = (fontName: string) => {
    setActiveFontFamily(fontName);
    onUpdateGlobalSettings((prev: any) => ({
      ...prev,
      globalStyles: {
        ...(prev?.globalStyles || {}),
        headingFont: fontName,
        bodyFont: fontName,
      },
    }));
  };

  const handleSave = async () => {
    await onSaveTokens();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const isHighContrast = prefs.contrastMode === "high-contrast";

  return (
    <div className="flex flex-col h-full text-slate-200">
      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        {/* ========================================================= */}
        {/* + Accessibility Card (Exact PDF Layout)                  */}
        {/* ========================================================= */}
        <div className="rounded-xl border border-[#24263d] bg-[#1a1b2d] p-3.5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span className="text-purple-400 font-bold">+</span>
              <span>Accessibility</span>
            </h3>
            <button
              type="button"
              onClick={onOpenAccessibilityStatement}
              className="text-[11px] font-medium text-slate-400 hover:text-purple-300 transition flex items-center gap-1 cursor-pointer"
            >
              <span>Global Panel</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* 2x4 Quick Action Tiles Grid */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {/* 1. High Contrast */}
            <button
              type="button"
              onClick={() => setContrastMode(isHighContrast ? "normal" : "high-contrast")}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border transition cursor-pointer ${
                isHighContrast
                  ? "bg-purple-900/40 border-purple-500/70 text-purple-200 shadow-sm shadow-purple-900/20"
                  : "bg-[#141524] border-[#26283f] text-slate-300 hover:bg-[#1f2138] hover:text-white"
              }`}
              title="Toggle High Contrast Mode"
            >
              <div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-[10px] font-black mb-1">
                D
              </div>
              <span className="text-[10px] font-medium leading-tight">High<br />Contrast</span>
            </button>

            {/* 2. Dark Mode */}
            <button
              type="button"
              onClick={onToggleCanvasTheme}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border transition cursor-pointer ${
                canvasTheme === "dark"
                  ? "bg-purple-900/40 border-purple-500/70 text-purple-200 shadow-sm shadow-purple-900/20"
                  : "bg-[#141524] border-[#26283f] text-slate-300 hover:bg-[#1f2138] hover:text-white"
              }`}
              title="Toggle Dark Mode Theme"
            >
              <Moon className="w-4 h-4 mb-1.5 text-purple-400" />
              <span className="text-[10px] font-medium leading-tight">Dark<br />Mode</span>
            </button>

            {/* 3. Dyslexia Font */}
            <button
              type="button"
              onClick={toggleDyslexicFont}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border transition cursor-pointer ${
                prefs.dyslexicFont
                  ? "bg-purple-900/40 border-purple-500/70 text-purple-200 shadow-sm shadow-purple-900/20"
                  : "bg-[#141524] border-[#26283f] text-slate-300 hover:bg-[#1f2138] hover:text-white"
              }`}
              title="Toggle Dyslexia-Friendly Typography"
            >
              <span className="text-sm font-bold tracking-tight mb-0.5">Aa</span>
              <span className="text-[10px] font-medium leading-tight">Dyslexia<br />Font</span>
            </button>

            {/* 4. Large Cursor */}
            <button
              type="button"
              onClick={toggleBigCursor}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border transition cursor-pointer ${
                prefs.bigCursor
                  ? "bg-purple-900/40 border-purple-500/70 text-purple-200 shadow-sm shadow-purple-900/20"
                  : "bg-[#141524] border-[#26283f] text-slate-300 hover:bg-[#1f2138] hover:text-white"
              }`}
              title="Enlarge Mouse Pointer"
            >
              <MousePointer className="w-4 h-4 mb-1.5" />
              <span className="text-[10px] font-medium leading-tight">Large<br />Cursor</span>
            </button>

            {/* 5. Highlight Links */}
            <button
              type="button"
              onClick={toggleHighlightLinks}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border transition cursor-pointer ${
                prefs.highlightLinks
                  ? "bg-purple-900/40 border-purple-500/70 text-purple-200 shadow-sm shadow-purple-900/20"
                  : "bg-[#141524] border-[#26283f] text-slate-300 hover:bg-[#1f2138] hover:text-white"
              }`}
              title="Underline and Highlight All Canvas Links"
            >
              <LinkIcon className="w-4 h-4 mb-1.5" />
              <span className="text-[10px] font-medium leading-tight">Highlight<br />Links</span>
            </button>

            {/* 6. Reduce Motion */}
            <button
              type="button"
              onClick={togglePauseAnimations}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border transition cursor-pointer ${
                prefs.pauseAnimations
                  ? "bg-purple-900/40 border-purple-500/70 text-purple-200 shadow-sm shadow-purple-900/20"
                  : "bg-[#141524] border-[#26283f] text-slate-300 hover:bg-[#1f2138] hover:text-white"
              }`}
              title="Pause and Reduce Animations"
            >
              <Gauge className="w-4 h-4 mb-1.5" />
              <span className="text-[10px] font-medium leading-tight">Reduce<br />Motion</span>
            </button>

            {/* 7. Reading Guide */}
            <button
              type="button"
              onClick={toggleReadingGuide}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border transition cursor-pointer ${
                prefs.readingGuide
                  ? "bg-purple-900/40 border-purple-500/70 text-purple-200 shadow-sm shadow-purple-900/20"
                  : "bg-[#141524] border-[#26283f] text-slate-300 hover:bg-[#1f2138] hover:text-white"
              }`}
              title="Toggle Focused Reading Ruler Guide"
            >
              <AlignJustify className="w-4 h-4 mb-1.5" />
              <span className="text-[10px] font-medium leading-tight">Reading<br />Guide</span>
            </button>

            {/* 8. Hide Images */}
            <button
              type="button"
              onClick={toggleHideImages}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border transition cursor-pointer ${
                prefs.hideImages
                  ? "bg-purple-900/40 border-purple-500/70 text-purple-200 shadow-sm shadow-purple-900/20"
                  : "bg-[#141524] border-[#26283f] text-slate-300 hover:bg-[#1f2138] hover:text-white"
              }`}
              title="Hide Background and Content Images"
            >
              <EyeOff className="w-4 h-4 mb-1.5" />
              <span className="text-[10px] font-medium leading-tight">Hide<br />Images</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* Design Tokens Section                                    */}
        {/* ========================================================= */}
        <div className="rounded-xl border border-[#24263d] bg-[#1a1b2d] p-3.5 space-y-4 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span className="text-purple-400">❖</span>
              <span>Design Tokens</span>
            </h3>
          </div>

          {/* Sub-tabs: Colors | Typography | Spacing | Shadows | Custom */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-[#26283e] pb-2">
            {(["colors", "typography", "spacing", "shadows", "custom"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTokenTab(tab)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md capitalize transition cursor-pointer shrink-0 ${
                  activeTokenTab === tab
                    ? "bg-[#282a46] text-purple-300 font-semibold shadow-xs"
                    : "text-slate-400 hover:text-slate-200 hover:bg-[#202237]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* TAB 1: COLORS */}
          {activeTokenTab === "colors" && (
            <div className="space-y-4">
              {/* Theme Selector + Add Token */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Theme:</span>
                  <select
                    value={selectedTheme}
                    onChange={(e) => setSelectedTheme(e.target.value)}
                    className="bg-[#141524] border border-[#26283f] text-xs text-slate-200 rounded-lg px-2 py-1 outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="Dark">Dark</option>
                    <option value="Light">Light</option>
                    <option value="System">System</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onOpenVariablesManager}
                    className="w-7 h-7 rounded-lg border border-[#26283f] bg-[#141524] hover:bg-[#1f2138] text-slate-400 hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
                    title="Export Tokens"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onOpenVariablesManager}
                    className="w-7 h-7 rounded-lg border border-[#26283f] bg-[#141524] hover:bg-[#1f2138] text-slate-400 hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
                    title="Import Tokens"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onOpenVariablesManager}
                    className="h-7 px-2.5 rounded-lg bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Token</span>
                  </button>
                </div>
              </div>

              {/* Primary Palette 10 shades */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-300">Primary Palette</span>
                  <span className="text-slate-400">10 shades</span>
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {defaultShades.map((shade) => (
                    <button
                      key={shade.step}
                      type="button"
                      onClick={() => handleApplyPaletteColor(shade.hex, shade.step)}
                      className={`flex flex-col items-center gap-1 p-0.5 rounded cursor-pointer transition group`}
                      title={`${shade.step}: ${shade.hex}`}
                    >
                      <div
                        className={`w-full h-7 rounded-md transition shadow-xs group-hover:scale-105 ${
                          activeShade === shade.step ? "ring-2 ring-purple-400 scale-105" : "border border-white/10"
                        }`}
                        style={{ backgroundColor: shade.hex }}
                      />
                      <span className="text-[9px] text-slate-400 group-hover:text-slate-200">
                        {shade.step}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Semantic Colors */}
              <div className="space-y-2 pt-1 border-t border-[#26283e]">
                <span className="text-[11px] font-semibold text-slate-300">Semantic</span>
                <div className="grid grid-cols-4 gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="h-6 rounded-md bg-[#10b981] shadow-xs" />
                    <span className="text-[10px] text-slate-400 text-center font-medium">Success</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="h-6 rounded-md bg-[#f59e0b] shadow-xs" />
                    <span className="text-[10px] text-slate-400 text-center font-medium">Warning</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="h-6 rounded-md bg-[#ef4444] shadow-xs" />
                    <span className="text-[10px] text-slate-400 text-center font-medium">Error</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="h-6 rounded-md bg-[#06b6d4] shadow-xs" />
                    <span className="text-[10px] text-slate-400 text-center font-medium">Info</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TYPOGRAPHY */}
          {activeTokenTab === "typography" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <span className="font-bold">T</span>
                  <span>Typography</span>
                </span>
                <button
                  type="button"
                  onClick={onOpenFontManager}
                  className="text-[11px] text-purple-400 hover:text-purple-300 font-medium cursor-pointer"
                >
                  Manage Fonts
                </button>
              </div>

              {/* Font Picker Dropdown */}
              <select
                value={activeFontFamily}
                onChange={(e) => handleSelectFont(e.target.value)}
                className="w-full bg-[#141524] border border-[#26283f] text-xs text-slate-200 rounded-lg px-2.5 py-2 outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                <option value="Inter">Inter</option>
                <option value="Outfit">Outfit</option>
                <option value="Roboto">Roboto</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Playfair Display">Playfair Display</option>
                <option value="Open Sans">Open Sans</option>
              </select>

              {/* 2x3 Grid of Presets (H1 - Caption) */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {typographyPresets.map((preset) => (
                  <div
                    key={preset.name}
                    className="p-2 rounded-lg bg-[#141524] border border-[#26283f] text-center"
                  >
                    <span className="block text-xs font-bold text-slate-200">{preset.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{preset.size}/{preset.lineHeight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: SPACING */}
          {activeTokenTab === "spacing" && (
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <span>✛</span>
                <span>Spacing</span>
              </span>

              {/* Step Pills */}
              <div className="flex items-center gap-1 flex-wrap">
                {spacingScale.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSelectedSpacingStep(val)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition cursor-pointer ${
                      selectedSpacingStep === val
                        ? "bg-purple-600 text-white font-bold"
                        : "bg-[#141524] border border-[#26283f] text-slate-300 hover:bg-[#1f2138]"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-[#141524] border border-[#26283f] text-xs text-slate-400 space-y-1">
                <span className="text-slate-300 font-semibold block text-[11px]">Element Spacing Reference</span>
                <p className="text-[10px] leading-relaxed">
                  Design tokens scale from 4px to 64px. Selected element margin and padding are inspected and customized directly in the Element Properties inspector.
                </p>
              </div>

            </div>
          )}

          {/* TAB 4 & 5: SHADOWS & CUSTOM */}
          {(activeTokenTab === "shadows" || activeTokenTab === "custom") && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 capitalize">
                  {activeTokenTab} Variables ({globalVariables.filter(v => v.category === (activeTokenTab === "shadows" ? "shadow" : "custom")).length})
                </span>
                <button
                  type="button"
                  onClick={onOpenVariablesManager}
                  className="text-[11px] text-purple-400 hover:text-purple-300 font-medium cursor-pointer"
                >
                  Manage All
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {globalVariables
                  .filter((v) => v.category === (activeTokenTab === "shadows" ? "shadow" : "custom"))
                  .map((token) => (
                    <div
                      key={token.id}
                      className="p-2 rounded-lg bg-[#141524] border border-[#26283f] flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-200">{token.name}</span>
                      <span className="text-[11px] font-mono text-purple-300">{token.value}</span>
                    </div>
                  ))}
                {globalVariables.filter(v => v.category === (activeTokenTab === "shadows" ? "shadow" : "custom")).length === 0 && (
                  <div className="py-4 text-center text-xs text-slate-400 italic">
                    No {activeTokenTab} tokens defined yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* Sticky Bottom Action Buttons (PDF Alignment)              */}
      {/* ========================================================= */}
      <div className="pt-3 mt-2 border-t border-[#24263d] flex items-center justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
        >
          Apply to Website
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-[#9333ea] hover:bg-[#8b5cf6] text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-900/30 transition cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <span>Saving...</span>
          ) : saveSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-300" />
              <span>Saved!</span>
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Save Tokens</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
