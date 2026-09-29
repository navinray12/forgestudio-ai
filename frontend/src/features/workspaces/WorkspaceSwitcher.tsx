import { WorkspaceInvitationInbox } from "./WorkspaceInvitationInbox";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { workspaceRequest } from "./workspace-api";
import type { WorkspaceSummary } from "./workspace-api";
export type WorkspaceItem = WorkspaceSummary;
interface Props { apiUrl: string; currentWorkspaceId: string | null; onSelectWorkspace: (id: string | null) => void }

export function WorkspaceSwitcher({ apiUrl, currentWorkspaceId, onSelectWorkspace }: Props) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const requestKey = useRef<{ name: string; key: string } | null>(null);
  const lifetime = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    return () => controller.abort();
  }, [apiUrl]);
  useEffect(() => {
    const controller = new AbortController(); setError("");
    workspaceRequest<{workspaces: WorkspaceSummary[]; hasMore: boolean}>(apiUrl, "", { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { setWorkspaces(data.workspaces); setHasMore(data.hasMore); } })
      .catch((failure: unknown) => { if (!controller.signal.aborted) { setWorkspaces([]); setError(failure instanceof Error ? failure.message : "Unable to load workspaces"); } });
    return () => controller.abort();
  }, [apiUrl, revision]);

  async function create(event: FormEvent) {
    event.preventDefault(); const trimmed = name.trim(); if (!trimmed || busy) return;
    if (requestKey.current?.name !== trimmed) requestKey.current = { name: trimmed, key: crypto.randomUUID() };
    setBusy(true); setError("");
    const signal = lifetime.current?.signal;
    try {
      const data = await workspaceRequest<{workspace: WorkspaceSummary}>(apiUrl, "", {
        method: "POST", payload: { name: trimmed }, key: requestKey.current.key, signal,
      });
      if (signal?.aborted) return;
      requestKey.current = null; setName(""); setCreating(false); setRevision((value) => value + 1); onSelectWorkspace(data.workspace.id);
    } catch (failure) { if (!signal?.aborted) setError(failure instanceof Error ? failure.message : "Workspace creation failed"); }
    finally { if (!signal?.aborted) setBusy(false); }
  }
  return <section aria-label="Workspace selection" className="space-y-2 max-w-full">
    <div className="flex flex-wrap gap-2 items-center">
      <button type="button" aria-pressed={!currentWorkspaceId} onClick={() => onSelectWorkspace(null)} className="rounded-lg border px-3 py-2 text-xs">My websites</button>
      {workspaces.map((workspace) => <button key={workspace.id} type="button" aria-pressed={currentWorkspaceId === workspace.id}
        title={workspace.organizationName} onClick={() => onSelectWorkspace(workspace.id)}
        className={`rounded-lg border px-3 py-2 text-xs ${currentWorkspaceId === workspace.id ? "bg-blue-600 text-white" : "bg-white"}`}>{workspace.name}{workspace.lifecycleStatus==="ARCHIVED"?" (archived)":""}</button>)}
      <button type="button" onClick={() => setCreating((value) => !value)} className="rounded-lg border px-3 py-2 text-xs">{creating ? "Cancel" : "+ New workspace"}</button>
    </div>
    {creating && <form onSubmit={create} className="flex flex-wrap items-center gap-2">
      <label className="text-xs">Workspace name <input value={name} maxLength={100} required onChange={(event) => setName(event.target.value)} className="rounded border px-2 py-1" /></label>
      <button type="submit" disabled={busy} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">{busy ? "Creating…" : "Create"}</button>
      <span className="text-xs text-slate-500">Creates a workspace in your personal organization.</span>
    </form>}
    <WorkspaceInvitationInbox apiUrl={apiUrl} onJoined={id=>{setRevision(value=>value+1);onSelectWorkspace(id);}} />
    {hasMore && <p className="text-xs">Showing the first 100 workspaces.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error} <button type="button" onClick={() => setRevision((value) => value + 1)} className="underline">Reload</button></p>}
  </section>;
}
export default WorkspaceSwitcher;
