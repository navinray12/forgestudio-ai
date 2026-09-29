import { useState } from "react";

type Changeset = {
  id: string;
  status: string;
  expectedDocumentVersion: number;
  summary: { pageNames?: unknown; sectionCount?: unknown };
};

export function AiSiteAssistant({ apiUrl, websiteId, onClose, onApplied }: {
  apiUrl: string; websiteId: string; onClose: () => void; onApplied: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [changeset, setChangeset] = useState<Changeset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const headers = (version: number) => ({ "Content-Type": "application/json", "X-Forge-Intent": "document-command",
    "If-Match": `"${websiteId}:document:${version}"`, "Idempotency-Key": crypto.randomUUID() });

  async function version() {
    const response = await fetch(`${apiUrl}/api/websites/${websiteId}`, { credentials: "include" });
    if (!response.ok) throw new Error("Unable to load the current website");
    const body = await response.json();
    return Number(body.website.documentVersion);
  }
  async function generate() {
    setBusy(true); setError("");
    try {
      const currentVersion = await version();
      const response = await fetch(`${apiUrl}/api/ai/websites/${websiteId}/generate`, { method: "POST", credentials: "include",
        headers: headers(currentVersion), body: JSON.stringify({ prompt }) });
      if (!response.ok) throw new Error(response.status === 412
        ? "This website changed. Reload and generate a new draft."
        : "Generation could not complete. Check the server AI configuration or try again.");
      const body = await response.json();
      setChangeset(body.changeset);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Generation failed"); }
    finally { setBusy(false); }
  }
  async function apply() {
    if (!changeset) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${apiUrl}/api/ai/changesets/${changeset.id}/apply`, { method: "POST", credentials: "include",
        headers: headers(changeset.expectedDocumentVersion) });
      if (!response.ok) throw new Error(response.status === 412
        ? "This website changed since the draft was created. Discard it and generate a new draft."
        : "Draft could not be applied. Please try again.");
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
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
      <h2 className="text-lg font-bold">AI website draft</h2>
      <p className="mt-1 text-sm text-slate-500">Generation creates a reviewable draft; it never overwrites your site without approval.</p>
      {!changeset && <>
        <textarea value={prompt} onChange={event => setPrompt(event.target.value)} className="mt-4 min-h-32 w-full rounded-lg border p-3" placeholder="Describe the website you want to create" />
        <button disabled={busy || prompt.trim().length < 12} onClick={generate} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Generating draft..." : "Generate draft"}</button>
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
