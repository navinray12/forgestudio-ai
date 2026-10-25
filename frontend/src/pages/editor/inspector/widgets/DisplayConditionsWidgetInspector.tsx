/**
 * DisplayConditionsWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import React from "react";
import type { EditorElement } from "../../types";
import { UniversalItemManager } from "../shared/UniversalItemManager";

// Display Conditions Clipboard Storage Fallback Key
export const FS_DISPLAY_CONDITIONS_CLIPBOARD_KEY = "fs_clipboard_display_conditions";

export interface DisplayConditionItem {
  id: string;
  type: "INCLUDE" | "EXCLUDE";
  condition: string;
}

/**
 * Validates clipboard payload for display conditions reuse (F-260)
 */
export function validateDisplayConditionsData(data: any): DisplayConditionItem[] | null {
  if (!data) return null;
  let parsed = data;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  const validItems: DisplayConditionItem[] = [];
  for (const item of parsed) {
    if (
      item &&
      typeof item === "object" &&
      (item.type === "INCLUDE" || item.type === "EXCLUDE") &&
      typeof item.condition === "string" &&
      item.condition.trim().length > 0
    ) {
      validItems.push({
        id: "rule_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        type: item.type,
        condition: item.condition.trim(),
      });
    }
  }

  return validItems.length > 0 ? validItems : null;
}

// Display Conditions Inspector (F-259, F-260, F-261)
export function DisplayConditionsWidgetInspector({
  el,
  updateProp
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
}) {
  const rules = el.displayConditions || [
    { id: "rule_1", type: "INCLUDE", condition: "ENTIRE_SITE" }
  ];

  const [clipboardStatus, setClipboardStatus] = React.useState<string | null>(null);
  const [confirmClear, setConfirmClear] = React.useState<boolean>(false);

  const handleCopyConditions = async () => {
    try {
      const json = JSON.stringify(rules, null, 2);
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(json);
      }
      try {
        localStorage.setItem(FS_DISPLAY_CONDITIONS_CLIPBOARD_KEY, json);
      } catch {}
      setClipboardStatus("Copied!");
      setTimeout(() => setClipboardStatus(null), 2500);
    } catch {
      setClipboardStatus("Failed to copy");
      setTimeout(() => setClipboardStatus(null), 2500);
    }
  };

  const handlePasteConditions = async () => {
    try {
      let rawText = "";
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        try {
          rawText = await navigator.clipboard.readText();
        } catch {}
      }
      if (!rawText) {
        try {
          rawText = localStorage.getItem(FS_DISPLAY_CONDITIONS_CLIPBOARD_KEY) || "";
        } catch {}
      }

      const validated = validateDisplayConditionsData(rawText);
      if (validated && validated.length > 0) {
        updateProp("displayConditions", validated);
        setClipboardStatus(`Pasted ${validated.length} rule(s)!`);
      } else {
        setClipboardStatus("No valid conditions in clipboard");
      }
      setTimeout(() => setClipboardStatus(null), 2500);
    } catch {
      setClipboardStatus("Paste error");
      setTimeout(() => setClipboardStatus(null), 2500);
    }
  };

  const handleClearConditions = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3500);
      return;
    }
    const defaultRule: DisplayConditionItem[] = [
      { id: "rule_" + Date.now(), type: "INCLUDE", condition: "ENTIRE_SITE" }
    ];
    updateProp("displayConditions", defaultRule);
    setConfirmClear(false);
    setClipboardStatus("Reset to default (Entire Site)");
    setTimeout(() => setClipboardStatus(null), 2500);
  };

  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-purple-600 flex items-center gap-1.5">
          <span>👁️</span> Display Conditions & Location Rules
        </h3>
        {clipboardStatus && (
          <span className="text-[10px] font-bold text-emerald-600 animate-pulse">
            {clipboardStatus}
          </span>
        )}
      </div>

      {/* F-260 & F-261 Action Toolbar: Copy, Paste, Clear */}
      <div className="flex items-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={handleCopyConditions}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition shadow-2xs cursor-pointer active:scale-95"
          title="Copy current display conditions to clipboard"
        >
          <span>📋</span>
          <span>Copy</span>
        </button>

        <button
          type="button"
          onClick={handlePasteConditions}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition shadow-2xs cursor-pointer active:scale-95"
          title="Paste display conditions from clipboard"
        >
          <span>📥</span>
          <span>Paste</span>
        </button>

        <button
          type="button"
          onClick={handleClearConditions}
          className={`flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg border transition shadow-2xs cursor-pointer ${
            confirmClear
              ? "bg-red-600 text-white border-red-600 font-bold animate-pulse"
              : "text-red-600 bg-red-50 hover:bg-red-100 border-red-200"
          }`}
          title={confirmClear ? "Click again to confirm reset" : "Clear all conditions and reset to Entire Website"}
        >
          <span>🗑️</span>
          <span>{confirmClear ? "Confirm?" : "Clear"}</span>
        </button>
      </div>

      <UniversalItemManager
        title="Conditions List"
        items={rules}
        onUpdate={(newRules) => updateProp("displayConditions", newRules)}
        createDefaultItem={() => ({
          id: "rule_" + Date.now(),
          type: "INCLUDE",
          condition: "ENTIRE_SITE"
        })}
        getItemHeaderLabel={(item) => `${item.type}: ${item.condition}`}
        renderItemFields={(item, idx, updateItem) => (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase">Action</label>
              <select
                value={item.type}
                onChange={(e) => updateItem({ type: e.target.value as any })}
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-bold"
              >
                <option value="INCLUDE">Include (Show)</option>
                <option value="EXCLUDE">Exclude (Hide)</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase">Location Rule</label>
              <select
                value={item.condition}
                onChange={(e) => updateItem({ condition: e.target.value as any })}
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-medium"
              >
                <option value="ENTIRE_SITE">Entire Website</option>
                <option value="FRONT_PAGE">Homepage Only</option>
                <option value="SINGULAR_POST">Single Posts</option>
                <option value="ARCHIVE">Archive Pages</option>
                <option value="SEARCH_RESULTS">Search Results</option>
                <option value="ERROR_404">404 Error Page</option>
              </select>
            </div>
          </div>
        )}
      />
    </div>
  );
}
