/**
 * IconLibraryWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement } from "../../types";
import { UniversalIconControls } from "../shared/UniversalIconControls";

// Icon Library Inspector
export function IconLibraryWidgetInspector({
  el,
  updateProp,
  updateStyle,
  onOpenIconPicker,
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
  updateStyle?: (key: string, val: any) => void;
  onOpenIconPicker?: () => void;
}) {
  return (
    <div className="space-y-4 pt-2 border-t border-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
        <span>🎨</span> Icon Library Configuration
      </h3>

      <UniversalIconControls
        el={el}
        updateProp={updateProp}
        updateStyle={updateStyle}
        onOpenIconPicker={onOpenIconPicker}
        showContainerControls={true}
      />
    </div>
  );
}
