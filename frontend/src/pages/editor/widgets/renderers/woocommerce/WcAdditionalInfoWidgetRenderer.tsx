/**
 * WcAdditionalInfoWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, DeviceMode } from "../../../types";
import { getMergedStyles } from "../../../utils";

export const WcAdditionalInfoWidgetRenderer: React.FC<{ el: EditorElement; getMergedStyles?: any; activeDevice?: DeviceMode; mergedStyles?: any }> = ({ el, getMergedStyles, activeDevice, mergedStyles }) => {
  const styles = mergedStyles || (getMergedStyles ? getMergedStyles(el, activeDevice) : {});
  const attrs = el.additionalInfoAttributes && el.additionalInfoAttributes.length > 0
    ? el.additionalInfoAttributes
    : [
        { key: "Weight", value: "250 grams" },
        { key: "Dimensions", value: "18 x 15 x 8 cm" },
        { key: "Material", value: "Anodized Aerospace Aluminum" },
        { key: "Connectivity", value: "Bluetooth 5.3 + 3.5mm AUX" },
        { key: "Warranty", value: "2 Years Manufacturer Warranty" },
      ];

  return (
    <div style={styles as React.CSSProperties} className="rounded-xl border border-slate-200 overflow-hidden bg-white text-xs shadow-2xs">
      <table className="w-full text-left border-collapse">
        <tbody>
          {attrs.map((attr, idx) => (
            <tr key={idx} className={`border-b border-slate-100 ${idx % 2 === 0 ? "bg-slate-50/70" : "bg-white"}`}>
              <th className="p-3 font-bold text-slate-800 w-1/3">{attr.key}</th>
              <td className="p-3 text-slate-600">{attr.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
