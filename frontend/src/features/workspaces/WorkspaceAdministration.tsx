import { useEffect, useState } from "react";
import type { WorkspaceDetails } from "./workspace-api";
import { workspaceRequest } from "./workspace-api";
type Command = (path: string, method: string, payload?: unknown, etag?: string) => Promise<void>;
type Invitation = {
    id: string;
    recipientUserId: string;
    role: string;
    status: string;
    version: number;
    expiresAt: string;
};
interface Props {
    data: WorkspaceDetails;
    apiUrl: string;
    busy: boolean;
    run: Command;
    eligible: Array<{
        userId: string;
        user: {
            fullName: string | null;
        };
    }>;
}
export function WorkspaceAdministration({ data, apiUrl, busy, run, eligible }: Props) {
    const [name, setName] = useState(data.name);
    const [locale, setLocale] = useState(data.settings?.locale || "en");
    const [zone, setZone] = useState(data.settings?.timeZone || "UTC");
    const [target, setTarget] = useState("");
    const [role, setRole] = useState("MEMBER");
    const [reason, setReason] = useState("");
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [error, setError] = useState("");
    const [refresh, setRefresh] = useState(0);
    const active = data.lifecycleStatus === "ACTIVE";
    const etag = `"${data.id}:${data.version}"`;
    useEffect(() => { setName(data.name); setLocale(data.settings?.locale || "en"); setZone(data.settings?.timeZone || "UTC"); }, [data.id, data.version, data.name, data.settings?.locale, data.settings?.timeZone]);
    useEffect(() => {
        const controller = new AbortController();
        setInvitations([]);
        setError("");
        workspaceRequest<{
            invitations: Invitation[];
        }>(apiUrl, `/${data.id}/invitations`, { signal: controller.signal })
            .then(result => { if (!controller.signal.aborted)
            setInvitations(result.invitations); })
            .catch(failure => { if (!controller.signal.aborted)
            setError(failure instanceof Error ? failure.message : "Unable to read invitations"); });
        return () => controller.abort();
    }, [apiUrl, data.id, data.version, refresh]);
    async function invite() { await run("/invitations", "POST", { userId: target, role }); setRefresh(value => value + 1); }
    async function updateInvite(invitation: Invitation, action: "renew" | "revoke") {
        await run(`/invitations/${invitation.id}/${action}`, "POST", {}, `"${invitation.id}:${invitation.version}"`);
        setRefresh(value => value + 1);
    }
    return <div className="space-y-5 border-t pt-4" aria-label="Workspace administration">
  <h4 className="font-semibold">Workspace settings</h4>
  <form className="flex flex-wrap gap-3 items-end" onSubmit={event => { event.preventDefault(); void run("/settings", "PATCH", { name, settings: { locale, timeZone: zone } }, etag); }}>
   <label>Name<input required maxLength={100} disabled={!active || busy} className="block border rounded p-2" value={name} onChange={event => setName(event.target.value)}/></label>
   <label>Locale<input required maxLength={50} disabled={!active || busy} className="block border rounded p-2" value={locale} onChange={event => setLocale(event.target.value)}/></label>
   <label>Time zone<input required maxLength={100} disabled={!active || busy} className="block border rounded p-2" value={zone} onChange={event => setZone(event.target.value)}/></label>
   <button className="border rounded p-2" disabled={!active || busy}>Save settings</button>
  </form>
  <div><h4 className="font-semibold">Invitations</h4><p className="text-sm text-slate-500">Recipient-bound in-app invitations for existing organization members with verified email. Invitations expire after seven days; no email is sent.</p>
   <form className="flex flex-wrap gap-2 mt-2" onSubmit={event => { event.preventDefault(); void invite(); }}>
    <label>Recipient<select aria-label="Recipient" required disabled={!active || busy} className="block border p-2 rounded" value={target} onChange={event => setTarget(event.target.value)}><option value="">Select organization member</option>{eligible.filter(candidate => !data.members.some(member => member.userId === candidate.userId)).map(candidate => <option key={candidate.userId} value={candidate.userId}>{candidate.user.fullName || "Organization member"}</option>)}</select></label>
    <label>Invitation role<select aria-label="Invitation role" disabled={!active || busy} className="block border p-2 rounded" value={role} onChange={event => setRole(event.target.value)}><option value="MEMBER">Member</option>{data.userRole === "OWNER" && <option value="ADMIN">Administrator</option>}</select></label>
    <button disabled={!active || busy || !target} className="border p-2 rounded">Invite in app</button>
   </form>
   {error && <p role="alert">{error}</p>}
   <ul className="space-y-2 mt-2">{invitations.map(invitation => <li key={invitation.id} className="text-sm flex flex-wrap gap-2">
    <span>{eligible.find(item => item.userId === invitation.recipientUserId)?.user.fullName || "Organization member"} · {invitation.role} · {invitation.status === "PENDING" && Date.parse(invitation.expiresAt) <= Date.now() ? "EXPIRED" : invitation.status}</span>
    {invitation.status === "PENDING" && <><button disabled={busy || !active} className="underline" onClick={() => void updateInvite(invitation, "renew")}>Renew for seven days</button><button disabled={busy} className="underline" onClick={() => void updateInvite(invitation, "revoke")}>Revoke</button></>}
   </li>)}</ul>
  </div>
  {data.userRole === "OWNER" && <div className="space-y-3"><h4 className="font-semibold">Ownership and lifecycle</h4>
   <p className="text-sm">Ownership transfer keeps you as a workspace administrator. Organization ownership and billing do not transfer.</p>
   <ul className="space-y-2">{data.members.filter(member => member.role !== "OWNER").map(member => <li key={member.id} className="flex flex-wrap gap-2 text-sm"><span>{member.user.fullName || "Member"}</span>
    <button disabled={busy || !active} className="underline" onClick={() => void run("/member-role", "PATCH", { userId: member.userId, role: member.role === "ADMIN" ? "MEMBER" : "ADMIN" }, etag)}>{member.role === "ADMIN" ? "Change to member" : "Make administrator"}</button>
    <button disabled={busy || !active} className="underline" onClick={() => { if (window.confirm("Transfer workspace ownership to this member? You will remain an administrator."))
                void run("/ownership", "POST", { userId: member.userId }, etag); }}>Transfer ownership</button>
   </li>)}</ul>
   <p className="text-sm">Archiving preserves data and published websites, blocks new managed writes, and requires pending publication work to be drained. Restoration does not restore revoked memberships.</p>
   <form onSubmit={event => { event.preventDefault(); if (window.confirm(active ? "Archive this workspace as read-only?" : "Restore this workspace?"))
            void run(active ? "/archive" : "/restore", "POST", { reason }, etag); }} className="flex gap-2 flex-wrap">
    <label>Reason<input required maxLength={500} className="block border p-2 rounded" value={reason} onChange={event => setReason(event.target.value)}/></label><button disabled={busy} className="border rounded p-2">{active ? "Archive workspace" : "Restore workspace"}</button>
   </form>
  </div>}
 </div>;
}
