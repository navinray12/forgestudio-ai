import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ProposedDocument } from "./DesignProposalPreview";

const Preview = lazy(() => import("./DesignProposalPreview"));
type Scope = { type: "site" | "page" | "selection"; pageId?: string; elementId?: string };
type Execution = { id: string; status: string; stage: string; errorCode?: string; changesetId?: string; retryAvailable: boolean; stages: { key: string; status: string }[] };
type Changeset = { id: string; status: string; expectedDocumentVersion: number; proposedDocument: ProposedDocument; summary: { setupRequired?: string[] } };
const safeMessages: Record<string, string> = {
  AI_DESIGN_NOT_CONFIGURED: "An administrator must configure Stitch, Claude, a supported Claude model and encrypted prompt retention on the server.",
  AI_PROMPT_VAULT_UNAVAILABLE: "Encrypted prompt retention is not configured on the server.",
  AI_EXTERNAL_OUTCOME_UNKNOWN: "A provider may have completed the request. Administrator reconciliation is required before another attempt; no site content was changed.",
  AI_CONVERSION_UNSUPPORTED: "The design contains features that could not be converted safely. No site content was changed.",
  AI_QUOTA_EXCEEDED: "The workspace's daily design quota has been reached.",
  AI_EXECUTION_ACTIVE: "A design is already being generated for this website. Resume it or wait for it to finish.",
  AI_PROMPT_EXPIRED: "The saved brief expired. Submit a new brief.",
  DOCUMENT_VERSION_CONFLICT: "The website changed. Generate a new proposal against the latest saved version.",
  DOCUMENT_EDIT_FORBIDDEN: "You do not currently have design editing permission.",
};
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { ...init, credentials: "include" }); } catch { throw new Error("The request could not be confirmed. Retry using the same action."); }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(safeMessages[body?.code] || (response.status === 401 ? "Sign in again to continue." : "The operation could not complete. Your website has not been replaced."));
  return body as T;
}

export function DesignAssistant({ apiUrl, websiteId, onClose, prepare, apply, pageId, elementId }: {
  apiUrl: string; websiteId: string; onClose: () => void; prepare?: () => Promise<number>;
  apply?: (changeset: Changeset, key: string) => Promise<void>; pageId?: string; elementId?: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [operation, setOperation] = useState("GENERATE_SITE");
  const [scope, setScope] = useState<Scope["type"]>("site");
  const [execution, setExecution] = useState<Execution | null>(null);
  const [proposal, setProposal] = useState<Changeset | null>(null);
  const [currentDocument, setCurrentDocument] = useState<ProposedDocument | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const actionKeys = useRef(new Map<string, string>());
  const keyFor = (action: string) => { if (!actionKeys.current.has(action)) actionKeys.current.set(action, crypto.randomUUID()); return actionKeys.current.get(action)!; };
  const storageKey = `forge-design:${websiteId}`;
  const [executionId, setExecutionId] = useState(() => { try { return sessionStorage.getItem(storageKey); } catch { return null; } });
  const headers = (key: string, version?: number) => ({ "Content-Type": "application/json", "X-Forge-Intent": "document-command", "Idempotency-Key": key, ...(version ? { "If-Match": `"${websiteId}:document:${version}"` } : {}) });
  useEffect(() => {
    let active = true;
    void request<{ design: { available: boolean } }>(`${apiUrl}/api/v1/ai/capabilities`).then(value => { if (active) setAvailable(value.design.available); }).catch(() => { if (active) setAvailable(false); });
    return () => { active = false; };
  }, [apiUrl]);
  useEffect(() => {
    if (!executionId) return;
    let active = true;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await request<{ execution: Execution }>(`${apiUrl}/api/v1/ai/executions/${executionId}`);
        if (!active) return;
        setExecution(result.execution);
        failures = 0;
        if (result.execution.changesetId) {
          const resultProposal = await request<{ changeset: Changeset }>(`${apiUrl}/api/v1/ai/changesets/${result.execution.changesetId}`);
          if (active) setProposal(resultProposal.changeset);
        } else if (["QUEUED", "RUNNING"].includes(result.execution.status)) timer = setTimeout(() => void poll(), 1500);
        else if (result.execution.errorCode) setError(safeMessages[result.execution.errorCode] || "Design generation failed safely. Review the settings or retry.");
      } catch (cause) { if (active) { setError(cause instanceof Error ? cause.message : "Unable to retrieve progress."); if (++failures < 3) timer = setTimeout(() => void poll(), 5000); } }
    }
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [apiUrl, executionId]);
  useEffect(() => {
    if (!proposal || proposal.status !== "PENDING_REVIEW") return;
    let active = true;
    async function compare() {
      try {
        const result = await request<{ website: { documentVersion: number; editorData: unknown } }>(`${apiUrl}/api/websites/${websiteId}`);
        if (!active) return;
        setStale(result.website.documentVersion !== proposal!.expectedDocumentVersion);
        const doc = typeof result.website.editorData === "string" ? JSON.parse(result.website.editorData) : result.website.editorData;
        if (doc && Array.isArray(doc.pages)) setCurrentDocument(doc as ProposedDocument);
      } catch { /* Apply always rechecks authorization and version on the server. */ }
    }
    void compare(); const timer = setInterval(() => void compare(), 5000);
    return () => { active = false; clearInterval(timer); };
  }, [apiUrl, websiteId, proposal]);
  async function version() {
    if (prepare) return prepare();
    return (await request<{ website: { documentVersion: number } }>(`${apiUrl}/api/websites/${websiteId}`)).website.documentVersion;
  }
  function remember(id: string) { try { sessionStorage.setItem(storageKey, id); } catch { /* Polling still works in this mounted panel. */ } setExecutionId(id); }
  async function perform(work: () => Promise<void>) { setBusy(true); setError(""); try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Operation failed."); } finally { setBusy(false); } }
  async function generate() {
    await perform(async () => {
      const expectedVersion = await version();
      const chosen: Scope = { type: scope, ...(scope !== "site" ? { pageId } : {}), ...(scope === "selection" ? { elementId } : {}) };
      const body = { workflow: "stitch-claude", prompt, operation, scope: chosen };
      const response = await request<{ executionId: string }>(`${apiUrl}/api/v1/ai/websites/${websiteId}/executions`, { method: "POST", headers: headers(keyFor(JSON.stringify({ body, expectedVersion })), expectedVersion), body: JSON.stringify(body) });
      setProposal(null); setCurrentDocument(null); setShowCurrent(false); setStale(false); setExecution(null); remember(response.executionId);
    });
  }
  async function accept() {
    if (!proposal) return;
    await perform(async () => {
      const key = keyFor(`apply:${proposal.id}`);
      if (apply) await apply(proposal, key);
      else await request(`${apiUrl}/api/v1/ai/changesets/${proposal.id}/apply`, { method: "POST", headers: headers(key, proposal.expectedDocumentVersion) });
      try { sessionStorage.removeItem(storageKey); } catch { /* No content is stored here. */ }
      onClose();
    });
  }
  async function discard() {
    await perform(async () => {
      if (proposal) await request(`${apiUrl}/api/v1/ai/changesets/${proposal.id}/cancel`, { method: "POST", headers: headers(keyFor(`discard:${proposal.id}`)) });
      else if (executionId) await request(`${apiUrl}/api/v1/ai/executions/${executionId}/cancel`, { method: "POST", headers: headers(keyFor(`cancel:${executionId}`)) });
      try { sessionStorage.removeItem(storageKey); } catch { /* No content is stored here. */ }
      setExecutionId(null); setExecution(null); setProposal(null);
    });
  }
  const running = !!executionId && (!execution || ["QUEUED", "RUNNING"].includes(execution.status));
  return <div className="fixed inset-0 z-[100] overflow-auto bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label="Stitch and Claude website designer">
    <div className="mx-auto max-w-6xl rounded-xl bg-white p-6 text-slate-900 shadow-xl">
      <div className="flex justify-between gap-4"><h2 className="text-xl font-bold">Design with Stitch + Claude</h2><button disabled={busy} onClick={onClose}>Back to editing</button></div>
      <p className="my-2 text-sm">Generate a design or edit the saved website. Nothing replaces your document until you apply. Publishing is separate.</p>
      <p className="my-2 text-sm text-slate-600">Supported: editable pages, containers, headings, text, links and responsive styles. CMS, forms and imported images still require separate setup.</p>
      {available === false && <p role="status" className="my-3 text-amber-800">{safeMessages.AI_DESIGN_NOT_CONFIGURED}</p>}
      <label className="block">Website brief<textarea aria-label="Design brief" className="my-2 block min-h-32 w-full rounded border p-3" maxLength={64000} value={prompt} onChange={event => setPrompt(event.target.value)} /></label>
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="AI operation" value={operation} onChange={event => setOperation(event.target.value)}><option value="GENERATE_SITE">Generate a new website</option><option value="EDIT_DOCUMENT">Edit existing text/styles</option></select>
        {operation === "EDIT_DOCUMENT" && <select aria-label="AI edit scope" value={scope} onChange={event => setScope(event.target.value as Scope["type"])}><option value="site">Whole site</option>{pageId && <option value="page">Current page</option>}{elementId && <option value="selection">Selected element/section</option>}</select>}
        <button disabled={busy || running || available !== true || prompt.trim().length < 12} onClick={() => void generate()} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">Generate proposal</button>
        <button disabled={busy} onClick={() => setPrompt("Design a premium accounting training academy website with Home, Programs, About and Contact pages. Use editorial typography, warm ivory, deep green and restrained coral, generous whitespace and varied layouts. Include CMA, CPA and ACCA program introductions and clear navigation between real pages. Use expressive CSS shapes and gradients rather than external images. Do not invent testimonials, prices or statistics. Make the layout work from 320px mobile to desktop.")}>Use sample brief</button>
      </div>
      {execution && <div className="my-4" role="status"><p>{execution.status} · {execution.stage}</p><p className="text-sm">{execution.stages.filter(stage => stage.status === "COMPLETED").length} stages complete. You can return to manual editing while generation runs.</p></div>}
      {running && <button disabled={busy} onClick={() => void discard()} className="my-3 rounded border px-3 py-2">Cancel generation</button>}
      {proposal?.status === "PENDING_REVIEW" && <div className="mt-5">
        <h3 className="mb-2 font-semibold">Native editable proposal — not yet saved</h3>
        {!!proposal.summary.setupRequired?.length && <div className="my-3 rounded border border-amber-400 p-3"><p className="font-semibold">Still requires separate setup</p><ul>{proposal.summary.setupRequired.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
        {stale && <p role="alert" className="my-3 text-amber-800">The saved website changed. Generate a new proposal; this proposal cannot overwrite newer work.</p>}
        {currentDocument && <button className="my-2 rounded border px-3 py-1" onClick={() => setShowCurrent(value => !value)}>{showCurrent ? "Show proposed design" : "Compare current website"}</button>}
        <Suspense fallback={<p>Loading native preview…</p>}><Preview key={showCurrent ? "before" : proposal.id} document={showCurrent && currentDocument ? currentDocument : proposal.proposedDocument} apiUrl={apiUrl} websiteId={websiteId} /></Suspense>
        <div className="mt-4 flex gap-3"><button disabled={busy || stale} onClick={() => void accept()} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">Apply changes</button><button disabled={busy} onClick={() => void discard()}>Discard proposal</button></div>
      </div>}
      {proposal && proposal.status !== "PENDING_REVIEW" && <p role="status" className="my-3">This proposal is {proposal.status.toLowerCase()}. Return to the editor or generate a new proposal.</p>}
      {execution?.retryAvailable && <button disabled={busy || available !== true} onClick={() => void perform(async () => { const current = await version(); const result = await request<{ executionId: string }>(`${apiUrl}/api/v1/ai/executions/${execution.id}/retry`, { method: "POST", headers: headers(keyFor(`retry:${execution.id}:${current}`), current) }); setExecution(null); remember(result.executionId); })} className="mt-3 rounded border px-3 py-2">Retry failed stages</button>}
      {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
    </div>
  </div>;
}
