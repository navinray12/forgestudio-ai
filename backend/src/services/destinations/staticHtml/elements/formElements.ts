import type { StaticElementContext } from "../elementContext.js";
import { escapeHtml } from "../htmlSafety.js";

// Form element.
// Each function is one case of renderElementToHtml (staticHtml/renderElement.ts), moved verbatim from
// staticCompiler.ts.

// case "form"
export function renderFormElement({ el, websiteId, styleAttr, classAttr, idAttr }: StaticElementContext): string {
  const formFields = Array.isArray(el.fields) ? el.fields : (Array.isArray(el.formFields) ? el.formFields : []);
  const fieldsHtml = formFields
    .map((f: any) => {
      const fieldId = escapeHtml(f.name || f.id || "field");
      const label = f.label ? `<label for="${fieldId}">${escapeHtml(f.label)}</label>` : "";
      let input = "";
      if (f.type === "textarea") {
        input = `<textarea id="${fieldId}" name="${fieldId}" ${f.required ? "required" : ""}></textarea>`;
      } else if (f.type === "select") {
        const options = Array.isArray(f.options) ? f.options : [];
        const optsHtml = options
          .map((opt: any) => {
            const val = typeof opt === "string" ? opt : opt.value ?? opt.label;
            const lab = typeof opt === "string" ? opt : opt.label ?? opt.value;
            return `<option value="${escapeHtml(String(val))}">${escapeHtml(String(lab))}</option>`;
          })
          .join("\n");
        input = `<select id="${fieldId}" name="${fieldId}" ${f.required ? "required" : ""}>\n${optsHtml}\n</select>`;
      } else {
        input = `<input type="${escapeHtml(f.type || "text")}" id="${fieldId}" name="${fieldId}" ${f.required ? "required" : ""} />`;
      }
      return `<div class="form-group">\n${label}\n${input}\n</div>`;
    })
    .join("\n");
  const submitText = el.submitButtonText || "Submit";
  const actualWebsiteId = websiteId || el.websiteId || "";
  const formId = el.id || el.formId || "form";
  const redirectUrl = el.redirectUrl || el.formRedirectUrl || "";
  const redirectAttr = redirectUrl ? ` data-redirect="${escapeHtml(redirectUrl)}"` : "";
  const hiddenInputs = `  <input type="hidden" name="websiteId" value="${escapeHtml(actualWebsiteId)}" />\n  <input type="hidden" name="formId" value="${escapeHtml(formId)}" />\n  <input type="text" name="_fs_hp_check" value="" style="display:none !important; opacity:0; position:absolute; top:-9999px; left:-9999px;" tabindex="-1" autocomplete="off" />`;

  return `<form${idAttr}${classAttr}${styleAttr}${redirectAttr} action="/api/forms/submit" method="POST">\n${hiddenInputs}\n${fieldsHtml}\n<div class="fs-form-status" style="display:none; margin: 10px 0; padding: 10px; border-radius: 4px;"></div>\n<button type="submit" class="btn btn-primary">${escapeHtml(submitText)}</button>\n</form>`;
}
