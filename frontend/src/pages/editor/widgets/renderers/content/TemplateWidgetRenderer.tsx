/**
 * TemplateWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, ElementStyles } from "../../../types";
import { PRESET_SECTION_TEMPLATES } from "../../../defaults";

export const TemplateWidgetRenderer = ({
  el,
  components,
  onUnpackTemplate,
  onSelectTemplate,
  mergedStyles,
}: {
  el: EditorElement;
  components: Record<string, { name: string; element: EditorElement }>;
  onUnpackTemplate?: (elementId: string) => void;
  onSelectTemplate?: (elementId: string, templateId?: string, presetName?: string) => void;
  isPreview: boolean;
  mergedStyles: ElementStyles;
}) => {
  const templateId = el.templateId;
  const presetName = el.templatePresetName;
  const customComp = templateId ? components[templateId] : undefined;
  const presetComp = presetName ? PRESET_SECTION_TEMPLATES[presetName] : undefined;

  const hasSelectedTemplate = Boolean(customComp || presetComp);

  return (
    <div
      className="w-full transition-all"
      style={{
        marginTop: mergedStyles.marginTop,
        marginBottom: mergedStyles.marginBottom,
        paddingTop: mergedStyles.paddingTop,
        paddingRight: mergedStyles.paddingRight,
        paddingBottom: mergedStyles.paddingBottom,
        paddingLeft: mergedStyles.paddingLeft,
      }}
    >
      {hasSelectedTemplate ? (
        <div className="relative group border border-purple-200/80 bg-purple-50/20 rounded-2xl p-4">
          <div className="flex items-center justify-between border-b border-purple-200/60 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-100 text-xs text-purple-700 font-bold">
                🧩
              </span>
              <span className="text-xs font-bold text-purple-900">
                Template: {customComp ? customComp.name : presetComp?.name}
              </span>
            </div>
            {onUnpackTemplate && (
              <button
                type="button"
                onClick={() => onUnpackTemplate(el.id)}
                className="text-[10px] font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 px-2 py-1 rounded-md transition shadow-2xs"
                title="Expand this template into editable elements"
              >
                ⚡ Unpack to Canvas
              </button>
            )}
          </div>
          <div className="text-xs text-slate-600">
            {presetComp && <div className="italic text-slate-500 mb-2">{presetComp.description}</div>}
            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs">
              <div className="text-xs font-medium text-slate-800">
                {customComp ? `Master Component: ${customComp.element.type}` : `Preset Section: ${presetComp?.name}`}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50/50 p-6 text-center shadow-2xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 mb-3">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </div>
          <h4 className="text-sm font-bold text-purple-950 mb-1">Reusable Template Widget</h4>
          <p className="text-xs text-purple-700/80 mb-4 max-w-md mx-auto">
            Select a saved reusable component or choose from built-in section templates to insert into your layout.
          </p>

          <div className="flex flex-wrap justify-center gap-2">
            {Object.entries(PRESET_SECTION_TEMPLATES).map(([key, tpl]) => (
              <button
                key={key}
                type="button"
                onClick={() => onSelectTemplate && onSelectTemplate(el.id, undefined, key)}
                className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-purple-800 hover:border-purple-400 hover:bg-purple-50 transition shadow-2xs"
              >
                <span>{tpl.icon}</span>
                <span>{tpl.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
