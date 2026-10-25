/**
 * NestedAccordionWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";
import { UniversalItemManager } from "../shared/UniversalItemManager";

/* F-167: Nested Accordion Inspector */
export function NestedAccordionWidgetInspector({
  el,
  updateProp,
}: {
  el: EditorElement;
  updateProp: (key: string, value: any) => void;
}) {
  const items = el.accordionItems || [
    { id: "acc1", title: "1. What features are included in ForgeStudio?", icon: "help-circle" },
    { id: "acc2", title: "2. How does document persistence work?", icon: "database" },
    { id: "acc3", title: "3. Can I export clean React or HTML code?", icon: "code" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Accordion Options</h4>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(el.accordionAllowMultiple)}
            onChange={(e) => updateProp("accordionAllowMultiple", e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
          />
          <span className="text-xs font-semibold text-slate-700">Allow Multiple Items Expanded</span>
        </label>
      </div>

      <UniversalItemManager
        title="Accordion Items"
        items={items}
        onUpdate={(newItems) => updateProp("accordionItems", newItems)}
        createDefaultItem={() => ({
          id: "acc_" + Date.now(),
          title: `Accordion Title ${items.length + 1}`,
          icon: "help-circle",
          content: "Accordion item detailed answer text."
        })}
        getItemHeaderLabel={(item, idx) => item.title || `Item ${idx + 1}`}
        renderItemFields={(item, idx, updateItem) => (
          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Item Title</label>
              <input
                type="text"
                value={item.title}
                onChange={(e) => updateItem({ title: e.target.value })}
                className="w-full rounded border border-slate-200 px-2.5 py-1 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Item Content</label>
              <textarea
                value={item.content || ""}
                onChange={(e) => updateItem({ content: e.target.value })}
                rows={2}
                className="w-full rounded border border-slate-200 px-2.5 py-1 text-xs font-medium"
              />
            </div>
          </div>
        )}
      />
    </div>
  );
}
