/**
 * FormWidgetInspector. Moved verbatim from DynamicWidgetInspectors.tsx, which re-exports it for compatibility.
 */
import type { EditorElement, FormFieldItem, FormFieldType } from "../../types";
import { UniversalItemManager } from "../shared/UniversalItemManager";
import { FormDeliveryPolicyPanel } from "../../components/forms/FormDeliveryPolicyPanel";

// 7. Form Builder Inspector (F-178)
export function FormWidgetInspector({
  el,
  updateProp,
  websiteId,
  apiUrl,
}: {
  el: EditorElement;
  updateProp: (key: string, val: any) => void;
  websiteId?: string;
  apiUrl?: string;
}) {
  const fields = el.formFields || [];
  const steps = el.formSteps || [
    { id: "step_1", title: "Step 1: Contact Info" },
    { id: "step_2", title: "Step 2: Message Details" }
  ];
  const formMode = el.formMode || "simple";

  const handleAddStep = () => {
    const newStepId = "step_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5);
    const newSteps = [...steps, { id: newStepId, title: `Step ${steps.length + 1}: Details` }];
    updateProp("formSteps", newSteps);
  };

  const handleDeleteStep = (stepId: string) => {
    if (steps.length <= 1) return;
    const newSteps = steps.filter((s) => s.id !== stepId);
    updateProp("formSteps", newSteps);
    // Reassign fields that belonged to the deleted step to the first step
    const targetStepId = newSteps[0].id;
    const updatedFields = fields.map((f) => (f.stepId === stepId ? { ...f, stepId: targetStepId } : f));
    updateProp("formFields", updatedFields);
  };

  return (
    <div className="space-y-4">
      {/* Form Mode Selector */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2">
        <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider">Form Mode</label>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-blue-100/60 rounded-lg">
          <button
            type="button"
            onClick={() => updateProp("formMode", "simple")}
            className={`py-1.5 px-2 text-xs font-bold rounded-md transition ${
              formMode === "simple"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-blue-900/70 hover:text-blue-900"
            }`}
          >
            📋 Simple Form
          </button>
          <button
            type="button"
            onClick={() => {
              updateProp("formMode", "step-by-step");
              if (!el.formSteps || el.formSteps.length === 0) {
                updateProp("formSteps", steps);
              }
            }}
            className={`py-1.5 px-2 text-xs font-bold rounded-md transition ${
              formMode === "step-by-step"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-blue-900/70 hover:text-blue-900"
            }`}
          >
            🔢 Multi-Step Form
          </button>
        </div>
      </div>

      {/* Form Title & Subtitle */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Form Title</label>
          <input
            type="text"
            value={el.formTitle || ""}
            onChange={(e) => updateProp("formTitle", e.target.value)}
            placeholder="Get in Touch"
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Columns</label>
          <select
            value={el.formLayoutColumns || 2}
            onChange={(e) => updateProp("formLayoutColumns", parseInt(e.target.value, 10))}
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
          >
            <option value={1}>1 Column</option>
            <option value={2}>2 Columns</option>
          </select>
        </div>
      </div>

      {/* Multi-Step Step Management */}
      {formMode === "step-by-step" && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>👣</span> Step Management ({steps.length} Steps)
            </h4>
            <button
              type="button"
              onClick={handleAddStep}
              className="px-2.5 py-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition active:scale-95 cursor-pointer"
            >
              + ADD STEP
            </button>
          </div>

          <div className="space-y-2">
            {steps.map((step, sIdx) => (
              <div key={step.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-indigo-100 shadow-2xs">
                <span className="text-[10px] font-bold text-indigo-500 shrink-0 w-4">{sIdx + 1}.</span>
                <input
                  type="text"
                  value={step.title}
                  onChange={(e) => {
                    const newSteps = steps.map((s) => (s.id === step.id ? { ...s, title: e.target.value } : s));
                    updateProp("formSteps", newSteps);
                  }}
                  className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800 focus:bg-white outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  title="Delete Step"
                  onClick={() => handleDeleteStep(step.id)}
                  disabled={steps.length <= 1}
                  className="text-red-400 hover:text-red-600 disabled:opacity-30 text-xs px-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fields Builder with explicit + NEW FIELD control */}
      <UniversalItemManager<FormFieldItem>
        title="Form Fields Builder"
        items={fields}
        onUpdate={(newItems) => updateProp("formFields", newItems)}
        createDefaultItem={() => ({
          id: "field_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          type: "text",
          label: "New Field",
          placeholder: "Enter value...",
          required: false,
          width: "full",
          stepId: formMode === "step-by-step" ? (steps[0]?.id || "step_1") : undefined
        })}
        getItemHeaderLabel={(item) => {
          const stepInfo = formMode === "step-by-step" && item.stepId ? ` [Step ${steps.findIndex(s => s.id === item.stepId) + 1 || 1}]` : "";
          return `${item.label} (${item.type})${stepInfo}`;
        }}
        renderItemFields={(item, idx, updateItem) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Field Label</label>
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateItem({ label: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Field Type</label>
                <select
                  value={item.type}
                  onChange={(e) => updateItem({ type: e.target.value as FormFieldType })}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium"
                >
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                  <option value="tel">Phone (Tel)</option>
                  <option value="number">Number</option>
                  <option value="textarea">Textarea</option>
                  <option value="select">Select Dropdown</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="radio">Radio Buttons</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Placeholder</label>
              <input
                type="text"
                value={item.placeholder || ""}
                onChange={(e) => updateItem({ placeholder: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            {/* Step assignment for Multi-Step mode */}
            {formMode === "step-by-step" && (
              <div>
                <label className="block text-[10px] font-semibold text-indigo-600 mb-0.5">Assigned Step</label>
                <select
                  value={item.stepId || steps[0]?.id || "step_1"}
                  onChange={(e) => updateItem({ stepId: e.target.value })}
                  className="w-full rounded-lg border border-indigo-200 bg-indigo-50/50 px-2 py-1 text-xs font-semibold text-indigo-900"
                >
                  {steps.map((step, sIdx) => (
                    <option key={step.id} value={step.id}>
                      Step {sIdx + 1}: {step.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(item.type === "select" || item.type === "radio") && (
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Options (Comma separated)</label>
                <input
                  type="text"
                  value={(item.options || []).join(", ")}
                  onChange={(e) => updateItem({ options: e.target.value.split(",").map((s) => s.trim()) })}
                  placeholder="Option 1, Option 2, Option 3"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.required || false}
                  onChange={(e) => updateItem({ required: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Required Field</span>
              </label>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 text-[10px]">Width:</span>
                <select
                  value={item.width || "full"}
                  onChange={(e) => updateItem({ width: e.target.value as "full" | "half" })}
                  className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px]"
                >
                  <option value="full">Full (100%)</option>
                  <option value="half">Half (50%)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      />

      <FormDeliveryPolicyPanel key={el.id} websiteId={websiteId} formId={el.id} apiUrl={apiUrl} />

      {/* Button & Action Settings */}
      <div className="pt-2 border-t border-slate-200 space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Button Settings</h4>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Submit Text</label>
            <input
              type="text"
              value={el.formSubmitText || "Send Message"}
              onChange={(e) => updateProp("formSubmitText", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Submit Color</label>
            <input
              type="color"
              value={el.formSubmitBtnBg || "#2563eb"}
              onChange={(e) => updateProp("formSubmitBtnBg", e.target.value)}
              className="h-7 w-full cursor-pointer rounded border border-slate-200 bg-transparent p-0.5"
            />
          </div>
        </div>

        {formMode === "step-by-step" && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Next Button Text</label>
              <input
                type="text"
                value={el.formNextText || "Next →"}
                onChange={(e) => updateProp("formNextText", e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Back Button Text</label>
              <input
                type="text"
                value={el.formBackText || "← Back"}
                onChange={(e) => updateProp("formBackText", e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
