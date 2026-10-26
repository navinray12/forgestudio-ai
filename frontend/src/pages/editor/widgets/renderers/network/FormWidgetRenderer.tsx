import { integrationFormTokens } from "../../../../../features/integrations/PublishedIntegrations";
/**
 * FormWidgetRenderer. Moved verbatim from widgets/renderers.tsx, which re-exports it for compatibility.
 */
import { useState, useRef } from "react";
import { type SubmissionKeySlot, submissionKeyFor } from "../../../../../utils/submissionKey";
import type { EditorElement, ElementStyles, FormFieldItem } from "../../../types";

export const FormWidgetRenderer = ({
  el,
  isPreview,
  mergedStyles,
  websiteId,
}: {
  el: EditorElement;
  isPreview: boolean;
  mergedStyles: ElementStyles;
  websiteId?: string;
}) => {
  const apiUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || "http://localhost:5000";
  const fields = el.formFields || [];
  const formMode = el.formMode || "simple";
  const defaultSteps = [
    { id: "step_1", title: "Step 1: Basic Info" },
    { id: "step_2", title: "Step 2: Message Details" }
  ];
  const steps = (el.formSteps && el.formSteps.length > 0) ? el.formSteps : defaultSteps;

  const columns = el.formLayoutColumns || 2;
  const gap = el.formFieldGap !== undefined ? el.formFieldGap : 16;
  const showLabels = el.formShowLabels !== false;
  const title = el.formTitle || "Get in Touch";
  const subtitle = el.formSubtitle || "Fill out the form below and our team will get back to you within 24 hours.";
  const submitText = el.formSubmitText || "Send Message";
  const nextText = el.formNextText || "Next Step →";
  const backText = el.formBackText || "← Back";
  const successMsg = el.formSubmitSuccessMsg || "Thank you! Your message has been sent successfully.";
  const btnBg = el.formSubmitBtnBg || "#2563eb";
  const btnColor = el.formSubmitBtnColor || "#ffffff";
  const backBtnBg = el.formBackBtnBg || "#f1f5f9";
  const backBtnColor = el.formBackBtnColor || "#334155";
  const btnFullWidth = el.formSubmitBtnFullWidth !== false;
  const cardBg = el.formCardBg || "#ffffff";
  const cardBorder = el.formCardBorder || "#f1f5f9";

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [honeypotVal, setHoneypotVal] = useState("");
  const submissionKey = useRef<SubmissionKeySlot["current"]>(null);

  // Active step fields
  const activeStep = steps[currentStepIndex] || steps[0];
  const isMultiStep = formMode === "step-by-step" && steps.length > 1;

  // Client-Side Conditional Logic (X-788)
  const isFieldVisible = (field: FormFieldItem, currentData: Record<string, any>): boolean => {
    if (!field.conditionalLogic || !field.conditionalLogic.targetFieldId) {
      return true;
    }
    const { action, targetFieldId, operator, value } = field.conditionalLogic;
    const targetVal = currentData[targetFieldId];
    const strTargetVal = targetVal !== undefined && targetVal !== null ? String(targetVal) : "";
    const ruleValue = value !== undefined && value !== null ? String(value) : "";

    let conditionMet: boolean;
    switch (operator) {
      case "equals":
        conditionMet = strTargetVal === ruleValue;
        break;
      case "not_equals":
        conditionMet = strTargetVal !== ruleValue;
        break;
      case "contains":
        conditionMet = strTargetVal.toLowerCase().includes(ruleValue.toLowerCase());
        break;
      case "not_empty":
        conditionMet = strTargetVal.trim().length > 0;
        break;
      default:
        conditionMet = strTargetVal === ruleValue;
        break;
    }

    if (action === "show") {
      return conditionMet;
    } else if (action === "hide") {
      return !conditionMet;
    }
    return true;
  };

  const currentStepFields = isMultiStep
    ? fields.filter((f) => (f.stepId ? f.stepId === activeStep.id : currentStepIndex === 0))
    : fields;

  const visibleFields = currentStepFields.filter((f) => isFieldVisible(f, formData));

  const validateStepFields = (fieldsToValidate: FormFieldItem[]) => {
    setValidationError(null);
    for (const field of fieldsToValidate) {
      const val = formData[field.id];
      if (field.required && (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0))) {
        return `Please fill in the required field: "${field.label}"`;
      }
      if (val && field.type === "email") {
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(String(val))) {
          return `Please enter a valid email address for "${field.label}"`;
        }
      }
      if (val && field.type === "number") {
        if (isNaN(Number(val))) {
          return `Please enter a valid number for "${field.label}"`;
        }
      }
      if (val && field.type === "tel") {
        const phoneRegex = /[0-9]/;
        if (!phoneRegex.test(String(val))) {
          return `Please enter a valid phone number for "${field.label}"`;
        }
      }
    }
    return null;
  };

  const handleNextStep = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const error = validateStepFields(visibleFields);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrevStep = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setValidationError(null);
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const fieldsToValidate = isMultiStep ? visibleFields : fields;
    const error = validateStepFields(fieldsToValidate);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    setSubmitError(null);

    if (isPreview && websiteId) {
      // Real submission in preview/published mode
      try {
        setIsSubmitting(true);
        const payload = {
          integrationTokens: integrationFormTokens(e.currentTarget),
          websiteId,
          formId: el.id,
          formName: el.formTitle || el.content || "Website Form",
          fields: formData,
          data: formData,
          honeypotValue: honeypotVal,
        };
        const body = JSON.stringify(payload);
        const res = await fetch(`${apiUrl}/api/forms/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": submissionKeyFor(submissionKey, body) },
          body,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || data?.message || "Submission failed");
        submissionKey.current = null;
        setSubmitted(true);
        setFormData({});
        // Handle redirect
        const redirectUrl = el.formRedirectUrl || data?.redirectUrl;
        if (redirectUrl && redirectUrl !== "#") {
          setTimeout(() => { window.location.href = redirectUrl; }, 1500);
        }
      } catch (err: any) {
        setSubmitError(err?.message || "Submission failed. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // In editor mode — just show success state locally
      setSubmitted(true);
    }
  };

  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 p-10 text-center bg-slate-50/50">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mb-3">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <p className="text-base font-bold text-slate-700">Empty Form Widget</p>
        <p className="text-xs text-slate-400 mt-1">Use the properties panel on the right to add form fields.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        className="rounded-3xl border p-8 sm:p-12 text-center shadow-xl backdrop-blur-md transition-all duration-500 animate-in fade-in zoom-in-95"
        style={{
          backgroundColor: cardBg,
          borderColor: cardBorder,
        }}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4 shadow-inner">
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Submission Received!</h3>
        <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">{successMsg}</p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setCurrentStepIndex(0);
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-5 py-2.5 text-xs font-bold text-slate-800 transition hover:bg-slate-200 active:scale-95 cursor-pointer shadow-xs"
        >
          <span>Send Another Response</span>
          <svg className="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
        </button>
      </div>
    );
  }

  const isFinalStep = !isMultiStep || currentStepIndex === steps.length - 1;

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-3xl p-6 sm:p-10 shadow-xl border transition-all duration-300"
      style={{
        backgroundColor: cardBg,
        borderColor: cardBorder,
        boxSizing: "border-box",
      }}
    >
      {/* Honeypot Trap (F-277) */}
      <input
        type="text"
        name="_fs_hp_check"
        value={honeypotVal}
        onChange={(e) => setHoneypotVal(e.target.value)}
        style={{ display: "none", opacity: 0, position: "absolute", top: -9999, left: -9999 }}
        tabIndex={-1}
        autoComplete="off"
      />
      {/* Form Header Title & Subtitle */}
      {(title || subtitle) && (
        <div className="mb-6">
          {title && (
            <h3
              className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight"
              style={{ fontFamily: mergedStyles.fontFamily }}
            >
              {title}
            </h3>
          )}
          {subtitle && (
            <p
              className="mt-2 text-xs sm:text-sm text-slate-500 font-normal leading-relaxed max-w-xl"
              style={{ fontFamily: mergedStyles.fontFamily }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Multi-Step Indicator Header */}
      {isMultiStep && (
        <div className="mb-8 rounded-2xl bg-slate-50 p-4 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
              Step {currentStepIndex + 1} of {steps.length}: {activeStep.title}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {Math.round(((currentStepIndex + 1) / steps.length) * 100)}% Complete
            </span>
          </div>

          {/* Progress Bar & Pills */}
          <div className="relative flex items-center justify-between gap-2">
            <div className="absolute left-0 top-1/2 -z-0 h-1 w-full -translate-y-1/2 bg-slate-200 rounded-full" />
            <div
              className="absolute left-0 top-1/2 -z-0 h-1 -translate-y-1/2 bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
            />
            {steps.map((step, sIdx) => {
              const isPast = sIdx < currentStepIndex;
              const isCurrent = sIdx === currentStepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setCurrentStepIndex(sIdx)}
                  className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                    isCurrent
                      ? "bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-md scale-110"
                      : isPast
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                  }`}
                >
                  {isPast ? "✓" : sIdx + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Validation Error Alert Banner */}
      {validationError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-600 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
          <svg className="h-4 w-4 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{validationError}</span>
        </div>
      )}

      {/* Visible Form Fields */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2"
        style={{
          gap: `${gap}px`,
        }}
      >
        {visibleFields.map((field) => {
          const isHalf = columns === 2 && field.width === "half";
          const colClass = isHalf ? "sm:col-span-1 col-span-1" : "sm:col-span-2 col-span-1";

          return (
            <div key={field.id} className={`${colClass} flex flex-col`}>
              {showLabels && (
                <label className="block text-xs font-bold text-slate-700 mb-1.5 tracking-wide">
                  {field.label}
                  {field.required && <span className="text-red-500 font-extrabold ml-1">*</span>}
                </label>
              )}

              {/* Field Inputs */}
              {field.type === "date" ? (
                <input
                  type="date"
                  required={field.required}
                  value={formData[field.id] || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, [field.id]: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition duration-200 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 hover:border-slate-300"
                />
              ) : field.type === "file" ? (
                <div className="flex flex-col gap-1.5">
                  <input
                    type="file"
                    required={field.required}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setFormData((prev) => ({ ...prev, [field.id]: file ? file.name : "" }));
                    }}
                    className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3 text-xs sm:text-sm font-medium text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                  />
                  {formData[field.id] && (
                    <span className="text-[11px] text-slate-500 truncate">Selected: {formData[field.id]}</span>
                  )}
                </div>
              ) : field.type === "textarea" ? (
                <textarea
                  rows={4}
                  required={field.required}
                  placeholder={field.placeholder || ""}
                  value={formData[field.id] || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, [field.id]: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition duration-200 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 hover:border-slate-300"
                />
              ) : field.type === "select" ? (
                <div className="relative">
                  <select
                    required={field.required}
                    value={formData[field.id] || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, [field.id]: e.target.value }))}
                    className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 pr-10 text-xs sm:text-sm font-medium text-slate-800 outline-none transition duration-200 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 hover:border-slate-300 cursor-pointer"
                  >
                    <option value="">{field.placeholder || "Select an option..."}</option>
                    {(field.options || []).map((opt, i) => (
                      <option key={i} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              ) : field.type === "checkbox" ? (
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/40 p-3.5 text-xs font-medium text-slate-700 cursor-pointer transition hover:bg-slate-50">
                  <input
                    type="checkbox"
                    required={field.required}
                    checked={!!formData[field.id]}
                    onChange={(e) => setFormData((prev) => ({ ...prev, [field.id]: e.target.checked }))}
                    className="h-4 w-4 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>{field.placeholder || field.label}</span>
                </label>
              ) : field.type === "radio" ? (
                <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/40 p-3.5">
                  {(field.options || ["Option 1", "Option 2"]).map((opt, i) => (
                    <label key={i} className="flex items-center gap-3 text-xs font-medium text-slate-700 cursor-pointer transition hover:text-slate-900">
                      <input
                        type="radio"
                        name={`radio_${field.id}`}
                        required={field.required}
                        value={opt}
                        checked={formData[field.id] === opt}
                        onChange={(e) => setFormData((prev) => ({ ...prev, [field.id]: e.target.value }))}
                        className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              ) : field.type === "tel" ? (
                <div className="flex gap-2">
                  <select
                    value={formData[`${field.id}_country`] || "+91"}
                    onChange={(e) => {
                      const selectedDial = e.target.value;
                      const selectedCountry = [
                        { code: "IN", dial: "+91", placeholder: "98765 43210" },
                        { code: "US", dial: "+1", placeholder: "(555) 000-0000" },
                        { code: "GB", dial: "+44", placeholder: "7911 123456" },
                        { code: "CA", dial: "+1", placeholder: "(555) 000-0000" },
                        { code: "AU", dial: "+61", placeholder: "412 345 678" },
                        { code: "DE", dial: "+49", placeholder: "151 12345678" },
                        { code: "FR", dial: "+33", placeholder: "6 12 34 56 78" },
                        { code: "JP", dial: "+81", placeholder: "90 1234 5678" },
                        { code: "AE", dial: "+971", placeholder: "50 123 4567" },
                      ].find((c) => c.dial === selectedDial);
                      setFormData((prev: any) => ({
                        ...prev,
                        [`${field.id}_country`]: selectedDial,
                        [`${field.id}_placeholder`]: selectedCountry?.placeholder,
                      }));
                    }}
                    className="rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-3 text-xs font-medium text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white"
                  >
                    <option value="+91">🇮🇳 India (+91)</option>
                    <option value="+1">🇺🇸 US / CA (+1)</option>
                    <option value="+44">🇬🇧 UK (+44)</option>
                    <option value="+61">🇦🇺 Australia (+61)</option>
                    <option value="+49">🇩🇪 Germany (+49)</option>
                    <option value="+33">🇫🇷 France (+33)</option>
                    <option value="+81">🇯🇵 Japan (+81)</option>
                    <option value="+971">🇦🇪 UAE (+971)</option>
                  </select>
                  <input
                    type="tel"
                    id={`field_${field.id}`}
                    required={field.required}
                    placeholder={formData[`${field.id}_placeholder`] || field.placeholder || "Enter phone number"}
                    value={formData[field.id] || ""}
                    onChange={(e) => setFormData((prev: any) => ({ ...prev, [field.id]: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 hover:border-slate-300"
                  />
                </div>
              ) : (
                <div className="relative flex items-center">
                  <input
                    type={field.type}
                    required={field.required}
                    placeholder={field.placeholder || ""}
                    value={formData[field.id] || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, [field.id]: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition duration-200 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 hover:border-slate-300"
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Buttons Row (Back, Next, Submit) */}
        <div className="col-span-1 sm:col-span-2 pt-6 flex items-center gap-3">
          {/* Back Button for Multi-Step */}
          {isMultiStep && currentStepIndex > 0 && (
            <button
              type="button"
              onClick={handlePrevStep}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-xs sm:text-sm font-bold shadow-xs transition duration-200 hover:bg-slate-200 cursor-pointer"
              style={{
                backgroundColor: backBtnBg,
                color: backBtnColor,
              }}
            >
              <span>{backText}</span>
            </button>
          )}

          {/* Next Button for Multi-Step */}
          {isMultiStep && !isFinalStep && (
            <button
              type="button"
              onClick={handleNextStep}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-xs sm:text-sm font-extrabold shadow-lg transition duration-200 hover:shadow-xl hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
              style={{
                backgroundColor: btnBg,
                color: btnColor,
              }}
            >
              <span>{nextText}</span>
            </button>
          )}

          {/* Submit Button */}
          {isFinalStep && (
            <button
              type="submit"
              disabled={isSubmitting}
              className={`group inline-flex items-center justify-center gap-2.5 rounded-2xl px-8 py-3.5 text-xs sm:text-sm font-extrabold shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.01] active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                btnFullWidth ? "w-full" : "w-auto"
              }`}
              style={{
                backgroundColor: btnBg,
                color: btnColor,
              }}
            >
              {isSubmitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <span>{submitText}</span>
                  <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          )}
        </div>

        {/* API Submission Error */}
        {submitError && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-600 flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{submitError}</span>
          </div>
        )}
      </div>
    </form>
  );
};
