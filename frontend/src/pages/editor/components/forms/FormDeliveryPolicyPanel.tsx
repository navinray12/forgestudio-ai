import { useEffect, useState } from "react";

type DeliveryAction = "database" | "email" | "webhook" | "google_sheets" | "mailchimp" | "zapier";
type PolicyStatus = { configured: boolean; formId: string; activeActions: DeliveryAction[] };
type DeliveryDraft = {
  email: string;
  subject: string;
  webhookUrl: string;
  webhookSecret: string;
  sheetsUrl: string;
  mailchimpKey: string;
  mailchimpList: string;
  zapierUrl: string;
};
const emptyDraft = (): DeliveryDraft => ({
  email: "", subject: "New website lead", webhookUrl: "", webhookSecret: "",
  sheetsUrl: "", mailchimpKey: "", mailchimpList: "", zapierUrl: "",
});
const available: { id: DeliveryAction; label: string }[] = [
  { id: "database", label: "Save to Leads" },
  { id: "email", label: "Email notification" },
  { id: "webhook", label: "Webhook" },
  { id: "google_sheets", label: "Google Sheets" },
  { id: "mailchimp", label: "Mailchimp" },
  { id: "zapier", label: "Zapier" },
];

/**
 * Server-owned policy editor. Keep integration secrets only in this transient
 * component state; never call the document editor's updateProp callback.
 * GET intentionally exposes action names, not existing destinations or secrets.
 */
export function FormDeliveryPolicyPanel({
  websiteId, formId, apiUrl = "",
}: { websiteId?: string; formId: string; apiUrl?: string }) {
  const [status, setStatus] = useState<PolicyStatus | null>(null);
  const [draft, setDraft] = useState<DeliveryDraft>(emptyDraft);
  const [actions, setActions] = useState<DeliveryAction[]>(["database"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const endpoint = (apiUrl || "").replace(/\/$/, "") +
    "/api/forms/" + encodeURIComponent(websiteId || "") +
    "/forms/" + encodeURIComponent(formId) + "/delivery";

  useEffect(() => {
    setStatus(null);
    setDraft(emptyDraft());
    setActions(["database"]);
    setError("");
    setMessage("");
    if (!websiteId || !formId) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetch(endpoint, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load delivery settings. Check your access and retry.");
        const body: { success?: boolean; data?: PolicyStatus } = await response.json();
        if (!body.success || !body.data || !Array.isArray(body.data.activeActions)) {
          throw new Error("Delivery settings response is invalid.");
        }
        return body.data;
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setStatus(data);
          setActions(data.configured ? data.activeActions.filter((action) =>
            available.some((option) => option.id === action)) : ["database"]);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Unable to load delivery settings. Check your access and retry.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, websiteId, formId]);

  const updateDraft = (field: keyof DeliveryDraft, value: string) =>
    setDraft((old) => ({ ...old, [field]: value }));

  const toggle = (action: DeliveryAction) => {
    setMessage("");
    setActions((previous) => previous.includes(action)
      ? previous.filter((item) => item !== action)
      : [...previous, action]);
  };

  const save = async () => {
    if (!websiteId || saving || loading) return;
    setSaving(true);
    setError("");
    setMessage("");
    const policy: Record<string, unknown> = { activeActions: actions };
    if (actions.includes("email")) policy.emailConfig = { toEmail: draft.email.trim(), subject: draft.subject.trim(), includeMetadata: true };
    if (actions.includes("webhook")) policy.webhookConfig = { endpointUrl: draft.webhookUrl.trim(), ...(draft.webhookSecret ? { secretKey: draft.webhookSecret } : {}) };
    if (actions.includes("google_sheets")) policy.googleSheetsConfig = { webhookUrl: draft.sheetsUrl.trim() };
    if (actions.includes("mailchimp")) policy.mailchimpConfig = { apiKey: draft.mailchimpKey, listId: draft.mailchimpList.trim() };
    if (actions.includes("zapier")) policy.zapierConfig = { webhookUrl: draft.zapierUrl.trim() };
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: policy }),
      });
      if (!response.ok) throw new Error("Could not save delivery policy. Verify the settings and owner permissions.");
      const body: { success?: boolean; data?: PolicyStatus } = await response.json();
      if (!body.success || !body.data?.configured) throw new Error("Server did not confirm the policy.");
      setStatus(body.data);
      setDraft(emptyDraft()); // No credentials remain in form fields after successful save.
      setMessage("Delivery settings saved securely. Existing secrets cannot be viewed; re-enter all selected destinations to replace this policy.");
    } catch {
      setError("Could not save delivery policy. Verify the settings and owner permissions.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!websiteId || saving || loading || !status?.configured) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(endpoint, { method: "DELETE", credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Could not disable delivery.");
      const body: { success?: boolean; data?: PolicyStatus } = await response.json();
      if (!body.success || body.data?.configured !== false) throw new Error("Server did not confirm removal.");
      setStatus({ configured: false, formId, activeActions: [] });
      setDraft(emptyDraft());
      setActions(["database"]);
      setMessage("External delivery policy removed.");
    } catch {
      setError("Could not disable delivery; the previous policy may still be active.");
    } finally {
      setSaving(false);
    }
  };

  const disabled = loading || saving || !websiteId || !!error && !status;
  const field = (label: string, value: string, key: keyof DeliveryDraft, type = "text") => (
    <label key={key} className="block text-xs font-medium text-slate-700">
      {label}
      <input aria-label={label} type={type} autoComplete="off" value={value}
        onChange={(event) => updateDraft(key, event.target.value)}
        disabled={loading || saving}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs" />
    </label>
  );

  return (
    <section aria-label="Secure form delivery settings" className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-3">
      <h4 className="text-xs font-bold uppercase text-indigo-900">Secure form delivery</h4>
      <p className="text-[11px] text-slate-600">
        Integrations are saved in encrypted owner-only settings, never in the published page.
        Re-enter every selected destination and credential when replacing a policy.
      </p>
      {!websiteId && <p role="alert" className="text-xs text-red-700">Save this website before configuring delivery.</p>}
      {loading ? <p role="status" className="text-xs">Loading delivery settings…</p> : (
        <>
          <p role="status" className="text-xs text-slate-700">
            {status?.configured ? "Configured actions: " + status.activeActions.join(", ") : "No server-side delivery policy configured."}
          </p>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          {message && <p role="status" className="text-xs text-emerald-700">{message}</p>}
          {!error || !!status ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {available.map(({ id, label }) => (
                  <label key={id} className="flex gap-1.5 items-center text-xs text-slate-700">
                    <input type="checkbox" checked={actions.includes(id)} disabled={saving || !websiteId}
                      onChange={() => toggle(id)} />{label}
                  </label>
                ))}
              </div>
              {actions.includes("email") && <>
                {field("Notification email", draft.email, "email", "email")}
                {field("Email subject", draft.subject, "subject")}
              </>}
              {actions.includes("webhook") && <>
                {field("Webhook HTTPS URL", draft.webhookUrl, "webhookUrl", "url")}
                {field("Webhook secret (optional)", draft.webhookSecret, "webhookSecret", "password")}
              </>}
              {actions.includes("google_sheets") && field("Google Sheets HTTPS URL", draft.sheetsUrl, "sheetsUrl", "url")}
              {actions.includes("mailchimp") && <>
                {field("Mailchimp API key", draft.mailchimpKey, "mailchimpKey", "password")}
                {field("Mailchimp audience ID", draft.mailchimpList, "mailchimpList")}
              </>}
              {actions.includes("zapier") && field("Zapier HTTPS URL", draft.zapierUrl, "zapierUrl", "url")}
              <div className="flex gap-2">
                <button type="button" disabled={disabled} onClick={save}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                  {saving ? "Saving…" : "Save secure delivery"}
                </button>
                <button type="button" disabled={disabled || !status?.configured} onClick={remove}
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">
                  Disable delivery
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-600">Reload the selected form to retry. No changes were saved.</p>
          )}
        </>
      )}
    </section>
  );
}
