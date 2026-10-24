import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { getServerFormDeliveryActions } from "./formDeliveryPolicy.service.js";

type JsonRecord = Record<string, unknown>;
const object = (value: unknown): value is JsonRecord =>
  !!value && typeof value === "object" && !Array.isArray(value);

export interface TrustedFormPolicy {
  actions?: JsonRecord;
  fieldConfigs?: unknown[];
  conditionalLogic?: unknown[];
  spamProtection?: JsonRecord;
  formName?: string;
}

/**
 * Visitor requests cannot choose integration destinations or credentials,
 * required fields or spam policy. Load the owner-saved editor definition.
 * Unknown legacy form formats remain database-only, never outbound.
 */
export async function getTrustedFormPolicy(websiteId: string, formId: string): Promise<TrustedFormPolicy> {
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    select: { editorData: true },
  });
  if (!website) throw new AppError("Website not found", 404, "WEBSITE_NOT_FOUND");

  let document: unknown = website.editorData;
  if (typeof document === "string") {
    try { document = JSON.parse(document); }
    catch { throw new AppError("Website form configuration is invalid", 503, "FORM_CONFIGURATION_UNAVAILABLE"); }
  }

  const seen = new Set<object>();
  const queue: unknown[] = [document];
  let examined = 0;
  while (queue.length && examined++ < 4096) {
    const node = queue.shift();
    if (Array.isArray(node)) {
      queue.push(...node.slice(0, 1024));
      continue;
    }
    if (!object(node) || seen.has(node)) continue;
    seen.add(node);
    const config = object(node.formConfig) ? node.formConfig : null;
    const isMatch = (
      node.id === formId && (node.type === "form" || node.type === "form-widget" || node.type === "formWidget")
    ) || (config?.id === formId);
    if (isMatch) {
      const actions = config && object(config.actions) ? config.actions :
        object(node.formActions) ? node.formActions :
        object(node.actions) ? node.actions : undefined;
      const fields = config && Array.isArray(config.fields) ? config.fields :
        Array.isArray(node.formFields) ? node.formFields : undefined;
      const logic = config && Array.isArray(config.conditionalLogic) ? config.conditionalLogic : undefined;
      const spam = config && object(config.spamProtection) ? config.spamProtection : undefined;
      // Production outbound destinations/credentials must exist only in the
      // dedicated encrypted control-plane table. Editor JSON can be published,
      // copied or returned to browsers and is never a credential authority.
      const deliveryActions = process.env.NODE_ENV === "production"
        ? await getServerFormDeliveryActions(websiteId, formId)
        : actions;
      return {
        actions: deliveryActions,
        fieldConfigs: fields,
        conditionalLogic: logic,
        spamProtection: spam,
        formName: typeof (config?.formName ?? node.formTitle) === "string"
          ? String(config?.formName ?? node.formTitle) : undefined,
      };
    }
    for (const [key, child] of Object.entries(node)) {
      if (["data", "fields", "actions", "metadata", "settings", "content", "style"].includes(key)) continue;
      if (Array.isArray(child) || object(child)) queue.push(child);
    }
  }
  // An explicitly configured server-only policy remains valid for older form
  // renderers that do not serialize their widgets in the modern editor format.
  if (process.env.NODE_ENV === "production") {
    const actions = await getServerFormDeliveryActions(websiteId, formId);
    return actions ? { actions } : {};
  }
  return {};
}
