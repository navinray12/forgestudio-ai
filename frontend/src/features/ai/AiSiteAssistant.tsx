import { useRef, useState } from "react";
import { DesignAssistant } from "./DesignAssistant";

type Changeset = {
  id: string;
  status: string;
  expectedDocumentVersion: number;
  summary: { pageNames?: unknown; sectionCount?: unknown };
};

const SAMPLE_BRIEF = `Create a distinctive, premium website for an accounting training centre called Northstar Academy. We help students and working professionals prepare for CMA, CPA, and ACCA. The audience wants a clear path from choosing a qualification to enrolling.

Create useful Home, Programs, About, Admissions, Contact, and Insights pages. On Home, include a strong outcome-focused hero, three program introductions, how learning works, learner support, frequently asked questions, and an enrollment call to action. Make each program page specific about who it suits and what students will learn. The Insights page is a blog layout proposal only.

Visual direction: editorial, confident, and modern; warm ivory, deep forest/navy, and a restrained coral accent. Use strong typography, generous spacing, varied section rhythm, and concise human copy. Avoid stock phrases and repeated sections. Link buttons to actual pages. Do not invent fees, dates, pass rates, accreditations, faculty names, testimonials, addresses, or a working CMS collection. Where information is missing, invite visitors to contact us.`;

const MAX_BRIEF_LENGTH = 64_000;

async function generationError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code : "";
  if (code === "AI_PROMPT_INVALID" || response.status === 422) return "Brief must be between 12 and 64,000 characters. Shorten it and try again.";
  if (code === "DOCUMENT_VERSION_CONFLICT" || response.status === 412) return "This website changed. Reload and generate a new draft.";
  if (code === "AI_INVALID_OUTPUT" || response.status === 502) return "The AI returned a draft that could not be validated. Please retry or simplify the brief.";
  if (code === "AI_NOT_CONFIGURED") return "The server AI provider is not configured. Ask an administrator to check the server settings.";
  if (code === "AI_PROVIDER_UNAVAILABLE" || response.status === 503) return "The AI provider is unavailable or timed out. Please retry in a moment.";
  if (response.status === 429) return "Too many requests. Please wait before generating another draft.";
  if (response.status === 401) return "Your session expired. Sign in again and retry.";
  if (response.status === 403) return "You do not have permission to generate a draft for this website.";
  return "Generation could not complete. Please retry; if it continues, contact an administrator.";
}

export function AiSiteAssistant({ apiUrl, websiteId, onClose, onApplied }: {
  apiUrl: string; websiteId: string; onClose: () => void; onApplied: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [designMode, setDesignMode] = useState(false);
  const [changeset, setChangeset] = useState<Changeset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const applyAttempt = useRef<{ changesetId: string; key: string } | null>(null);
  const headers = (version: number, key: string = crypto.randomUUID()) => ({ "Content-Type": "application/json", "X-Forge-Intent": "document-command",
    "If-Match": `"${websiteId}:document:${version}"`, "Idempotency-Key": key });

  async function version() {
    const response = await fetch(`${apiUrl}/api/websites/${websiteId}`, { credentials: "include" });
    if (!response.ok) throw new Error("Unable to load the current website");
    const body = await response.json();
    return Number(body.website.documentVersion);
  }
  async function generate() {
    if (prompt.trim().length < 12 || prompt.length > MAX_BRIEF_LENGTH) {
      setError("Brief must be between 12 and 64,000 characters.");
      return;
    }
    setBusy(true); setError("");
    try {
      const currentVersion = await version();
      const response = await fetch(`${apiUrl}/api/ai/websites/${websiteId}/generate`, { method: "POST", credentials: "include",
        headers: headers(currentVersion), body: JSON.stringify({ prompt }) });
      if (!response.ok) throw new Error(await generationError(response));
      const body = await response.json();
      setChangeset(body.changeset);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Generation failed"); }
    finally { setBusy(false); }
  }
  async function apply() {
    if (!changeset) return;
    setBusy(true); setError("");
    try {
      // Preserve the key after a timeout/lost response. A retry must retrieve the
      // original acknowledgement, not attempt a second mutation.
      if (applyAttempt.current?.changesetId !== changeset.id) applyAttempt.current = { changesetId: changeset.id, key: crypto.randomUUID() };
      const response = await fetch(`${apiUrl}/api/ai/changesets/${changeset.id}/apply`, { method: "POST", credentials: "include",
        headers: headers(changeset.expectedDocumentVersion, applyAttempt.current.key) });
      if (!response.ok) throw new Error(response.status === 412
        ? "This website changed since the draft was created. Discard it and generate a new draft."
        : response.status === 403 ? "Your editing permissions changed. Ask a workspace administrator for access."
        : response.status === 409 ? "This draft is no longer available to apply. Reload its status before continuing."
        : "The apply result could not be confirmed. Retry Apply to safely check the same request.");
      onApplied(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Draft could not be applied"); }
    finally { setBusy(false); }
  }
  async function cancel() {
    if (!changeset) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${apiUrl}/api/ai/changesets/${changeset.id}/cancel`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("Draft could not be discarded");
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Draft could not be discarded"); }
    finally { setBusy(false); }
  }
  const pageNames = changeset && Array.isArray(changeset.summary?.pageNames)
    ? changeset.summary.pageNames.filter((value): value is string => typeof value === "string") : [];
  if (designMode) return <DesignAssistant apiUrl={apiUrl} websiteId={websiteId} onClose={() => { onApplied(); onClose(); }} />;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
      <h2 className="text-lg font-bold">AI website draft</h2>
      <button disabled={busy} onClick={() => setDesignMode(true)} className="my-3 rounded bg-indigo-700 px-4 py-2 text-white">Open Stitch + Claude designer</button>
      <p className="mt-1 text-sm text-slate-500">Generation creates a reviewable draft; it never overwrites your site without approval.</p>
      {!changeset && <>
        <div className="mt-4 flex items-center justify-between gap-3"><label htmlFor="ai-site-brief" className="text-sm font-semibold text-slate-700">Website brief</label><button type="button" disabled={busy} onClick={() => setPrompt(SAMPLE_BRIEF)} className="text-sm font-semibold text-blue-700 hover:underline">Use sample brief</button></div>
        <textarea id="ai-site-brief" value={prompt} onChange={event => setPrompt(event.target.value)} className="mt-2 min-h-48 w-full rounded-lg border p-3 text-sm text-slate-900" placeholder="Describe your audience, pages, offerings, visual direction, and calls to action" />
        <p className={`mt-1 text-xs ${prompt.length > MAX_BRIEF_LENGTH ? "text-red-600" : "text-slate-500"}`}>{prompt.length.toLocaleString()} / {MAX_BRIEF_LENGTH.toLocaleString()} characters. Edit the sample to match your business. CMS collections, forms, and images need separate setup.</p>
        <button disabled={busy || prompt.trim().length < 12 || prompt.length > MAX_BRIEF_LENGTH} onClick={generate} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Generating draft..." : "Generate draft"}</button>
      </>}
      {changeset && <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
        <p className="font-semibold">Draft ready for review</p>
        <p className="mt-1 text-slate-600">{pageNames.length} editable pages, {String(changeset.summary.sectionCount ?? 0)} sections. This does not create a CMS collection.</p>
        {pageNames.length > 0 && <ul className="mt-2 list-inside list-disc text-slate-700">{pageNames.map((name, index) => <li key={`${index}-${name}`}>{name}</li>)}</ul>}
        <p className="mt-2 text-slate-600">Applying replaces the current editable document only if it has not changed since generation.</p>
        <div className="mt-4 flex gap-2"><button disabled={busy} onClick={apply} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Apply draft</button><button disabled={busy} onClick={cancel} className="rounded-lg border px-4 py-2 font-semibold">Discard</button></div>
      </div>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button disabled={busy} onClick={onClose} className="mt-4 text-sm text-slate-600">Close</button>
    </div>
  </div>;
}
