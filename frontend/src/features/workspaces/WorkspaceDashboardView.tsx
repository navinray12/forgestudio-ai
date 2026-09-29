import { WorkspaceAdministration } from "./WorkspaceAdministration";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { workspaceRequest } from "./workspace-api";
import type { WorkspaceDetails } from "./workspace-api";
interface Props { apiUrl: string; workspaceId: string; onOpenWebsite: (id: string) => void }
type Eligible = { userId: string; user: { fullName: string | null } };

export function WorkspaceDashboardView({ apiUrl, workspaceId, onOpenWebsite }: Props) {
  const [data, setData] = useState<WorkspaceDetails | null>(null);
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [name, setName] = useState(""); const [target, setTarget] = useState(""); const [role, setRole] = useState("MEMBER");
  const [revision, setRevision] = useState(0);
  const lifetime = useRef<AbortController | null>(null);
  const keys = useRef(new Map<string,string>());
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller; keys.current.clear();
    setData(null); setEligible([]); setError(""); setBusy(false); setName(""); setTarget(""); setRole("MEMBER");
    return () => controller.abort();
  }, [workspaceId, apiUrl]);
  useEffect(() => {
    const controller = new AbortController(); setError("");
    workspaceRequest<{workspace: WorkspaceDetails}>(apiUrl, `/${workspaceId}`, { signal: controller.signal })
      .then(async ({workspace}) => {
        if (controller.signal.aborted) return; setData(workspace);
        if (workspace.userRole !== "MEMBER") {
          const result = await workspaceRequest<{members: Eligible[]}>(apiUrl, `/${workspaceId}/eligible-members`, { signal: controller.signal });
          if (!controller.signal.aborted) setEligible(result.members);
        }
      }).catch((failure) => { if (!controller.signal.aborted) { setData(null); setEligible([]); setError(failure instanceof Error ? failure.message : "Unable to load workspace"); } });
    return () => controller.abort();
  }, [apiUrl, workspaceId, revision]);

  async function command(path: string, method: string, payload?: unknown, etag?: string) {
    const identity = JSON.stringify({ workspaceId, path, method, payload, etag });
    if (!keys.current.has(identity)) keys.current.set(identity, crypto.randomUUID());
    const signal = lifetime.current?.signal;
    setBusy(true); setError("");
    try {
      await workspaceRequest(apiUrl, `/${workspaceId}${path}`, { method, payload, key: keys.current.get(identity), signal, etag });
      if (!signal?.aborted) { keys.current.delete(identity); setRevision((value) => value + 1); setName(""); setTarget(""); }
    } catch (failure) { if (!signal?.aborted) setError(failure instanceof Error ? failure.message : "Workspace command failed"); }
    finally { if (!signal?.aborted) setBusy(false); }
  }
  function createWebsite(event: FormEvent) { event.preventDefault(); if (!busy && name.trim()) void command("/websites", "POST", {name:name.trim()}); }
  function addMember(event: FormEvent) { event.preventDefault(); if (!busy && target) void command("/members", "POST", {userId:target,role}); }

  return <section className="rounded-xl border bg-white p-5 space-y-5" aria-label="Selected workspace">
    {error && <p role="alert" className="text-red-700 text-sm">{error} <button type="button" className="underline" onClick={() => setRevision((value) => value + 1)}>Reload</button></p>}
    {!data && !error && <p role="status">Loading workspace…</p>}
    {data?.id===workspaceId && <>
      <header><h3 className="font-bold text-lg">{data.name}</h3><p className="text-sm text-slate-500">{data.organizationName} · {data.userRole} · {data.lifecycleStatus}</p></header>
      {data.userRole !== "MEMBER" && data.lifecycleStatus === "ACTIVE" && <form onSubmit={createWebsite} className="flex flex-wrap gap-2 items-end">
        <label className="text-sm">New website name<input className="block rounded border p-2" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <button disabled={busy} className="rounded bg-blue-600 p-2 text-white text-sm">Create in this workspace</button>
      </form>}
      <div><h4 className="font-semibold mb-2">Websites</h4>
        {data.websites.length === 0 ? <p className="text-sm text-slate-500">No websites in this workspace yet.</p> : <ul className="space-y-2">{data.websites.map((website) => <li key={website.id} className="flex items-center justify-between rounded border p-3"><span>{website.name} <small className="text-slate-500">{website.status}</small></span><button type="button" onClick={() => onOpenWebsite(website.id)} className="underline text-sm">Open website</button></li>)}</ul>}
        {data.hasMoreWebsites && <p className="text-xs">Showing the first 100 websites.</p>}
      </div>
      <div><h4 className="font-semibold mb-2">Members</h4><ul className="space-y-2">{data.members.map((member) => <li key={member.id} className="flex justify-between gap-3 text-sm"><span>{member.user.fullName || "Member"} · {member.role}</span>
        {data.userRole !== "MEMBER" && member.role !== "OWNER" && (data.userRole === "OWNER" || member.role === "MEMBER") && <button disabled={busy} type="button" className="text-red-700 underline" onClick={() => { if (window.confirm("Remove this member's workspace access?")) void command(`/members/${member.userId}`, "DELETE"); }}>Remove access</button>}
      </li>)}</ul></div>
      {data.userRole !== "MEMBER" && data.lifecycleStatus === "ACTIVE" && <form onSubmit={addMember} className="flex flex-wrap gap-2 items-end">
        <label className="text-sm">Existing organization member<select required value={target} onChange={(event) => setTarget(event.target.value)} className="block rounded border p-2"><option value="">Select a member</option>{eligible.filter((candidate) => !data.members.some((member) => member.userId === candidate.userId)).map((candidate) => <option key={candidate.userId} value={candidate.userId}>{candidate.user.fullName || candidate.userId}</option>)}</select></label>
        <label className="text-sm">Role<select value={role} onChange={(event) => setRole(event.target.value)} className="block rounded border p-2"><option value="MEMBER">Member (view)</option>{data.userRole === "OWNER" && <option value="ADMIN">Administrator</option>}</select></label>
        <button disabled={busy || !target} className="rounded border p-2 text-sm">Add member</button>
        <p className="w-full text-xs text-slate-500">Only active members of the same organization are eligible. Organization invitation and ownership-transfer workflows are separate.</p>
      </form>}
      {data.userRole !== "MEMBER" && <WorkspaceAdministration data={data} apiUrl={apiUrl} busy={busy} eligible={eligible} run={command} />}
    </>}
  </section>;
}
