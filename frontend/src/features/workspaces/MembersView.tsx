import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Clock3,
  Ellipsis,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { workspaceRequest } from "./workspace-api";
import type { WorkspaceDetails, WorkspaceSummary } from "./workspace-api";
import "./MembersView.css";

type EligibleMember = { userId: string; user: { fullName: string | null } };
type Invitation = { id: string; recipientUserId: string; role: string; status: string; version: number; expiresAt: string };

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function requestKey() { return crypto.randomUUID(); }

export default function MembersView() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceDetails | null>(null);
  const [eligible, setEligible] = useState<EligibleMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [workspaceId, setWorkspaceId] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(selectedId?: string, refresh = false) {
    setError("");
    if (refresh) setRefreshing(true);
    try {
      const list = await workspaceRequest<{ workspaces: WorkspaceSummary[] }>(apiUrl, "");
      const items = list.workspaces || [];
      setWorkspaces(items);
      const id = selectedId || workspaceId || items[0]?.id || "";
      setWorkspaceId(id);
      if (!id) { setWorkspace(null); setEligible([]); setInvitations([]); return; }
      const detail = await workspaceRequest<{ workspace: WorkspaceDetails }>(apiUrl, `/${id}`);
      setWorkspace(detail.workspace);
      const [eligibleResult, invitationResult] = await Promise.all([
        detail.workspace.userRole === "MEMBER"
          ? Promise.resolve({ members: [] as EligibleMember[] })
          : workspaceRequest<{ members: EligibleMember[] }>(apiUrl, `/${id}/eligible-members`),
        detail.workspace.userRole === "MEMBER"
          ? Promise.resolve({ invitations: [] as Invitation[] })
          : workspaceRequest<{ invitations: Invitation[] }>(apiUrl, `/${id}/invitations`),
      ]);
      setEligible(eligibleResult.members || []);
      setInvitations(invitationResult.invitations || []);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load members.");
    } finally { setRefreshing(false); }
  }

  useEffect(() => { void load(); }, []);

  const members = useMemo(() => (workspace?.members || []).filter((member) => {
    const text = `${member.user.fullName || "Member"} ${member.role}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (roleFilter === "ALL" || member.role === roleFilter);
  }), [query, roleFilter, workspace?.members]);
  const available = eligible.filter((candidate) => !workspace?.members.some((member) => member.userId === candidate.userId));
  const invitationName = (id: string) => eligible.find((item) => item.userId === id)?.user.fullName || "Organization member";
  const canManage = workspace?.userRole === "OWNER" || workspace?.userRole === "ADMIN";

  async function command(path: string, method: string, payload: unknown, etag?: string) {
    if (!workspace) return;
    setBusy(true); setError("");
    try {
      await workspaceRequest(apiUrl, `/${workspace.id}${path}`, { method, payload, key: requestKey(), etag });
      await load(workspace.id);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The request failed."); }
    finally { setBusy(false); }
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    if (!inviteTarget) return;
    await command("/invitations", "POST", { userId: inviteTarget, role: inviteRole });
    setInviteOpen(false); setInviteTarget("");
  }

  return <div className="members-page">
    {error && <div className="members-alert" role="alert">{error}<button onClick={() => void load(workspaceId, true)}>Try again</button></div>}
    <div className="members-layout">
      <main>
        <div className="members-hero">
          <p className="members-kicker">WORKSPACE SETTINGS</p>
          <div className="members-hero-row"><div><h1>Members</h1><p>Invite team members to collaborate in your workspace and assign default roles across sites.</p><p>Each member needs a paid seat. To assign a specific role for each site, go to Site settings &gt; Site access.</p><a href="#permissions">Learn how to manage seats and assign roles</a></div><Users size={35} /></div>
        </div>

        <div className="members-toolbar">
          <label className="members-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search members..." /></label>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter members"><option value="ALL">All roles</option><option value="OWNER">Owner</option><option value="ADMIN">Admin</option><option value="MEMBER">Member</option></select>
          {workspaces.length > 1 && <select value={workspaceId} onChange={(event) => void load(event.target.value)} aria-label="Workspace"><option value="">Workspace</option>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
          <button className="members-icon-button" onClick={() => void load(workspaceId, true)} aria-label="Refresh members"><RefreshCw size={15} className={refreshing ? "members-spin" : ""} /></button>
          {canManage && <button className="members-primary" onClick={() => setInviteOpen(true)}><UserPlus size={15} /> Invite member</button>}
        </div>

        {!workspace && !error && <div className="members-empty">Loading workspace members...</div>}
        {workspace && <>
          <div className="members-table-card"><div className="members-table-head"><span>Name</span><span>Role</span><span>2FA</span><span /></div>
            {members.length === 0 ? <div className="members-empty">{query ? "No members match your search." : "No members found."}</div> : members.map((member) => <div className="member-row" key={member.id}><div className="member-identity"><span className="member-avatar">{initials(member.user.fullName || "Member")}</span><div><strong>{member.user.fullName || "Unnamed member"}{member.role === "OWNER" && <em>Owner</em>}</strong><small>Workspace member</small></div></div><span className="member-role">{member.role}</span><span className="member-2fa"><ShieldCheck size={13} /> Managed by account security</span><div className="member-actions">{canManage && member.role !== "OWNER" && <button disabled={busy} onClick={() => void command("/member-role", "PATCH", { userId: member.userId, role: member.role === "ADMIN" ? "MEMBER" : "ADMIN" }, `"${workspace.id}:${workspace.version}"`)} aria-label={`Change role for ${member.user.fullName || "member"}`}><Ellipsis size={16} /></button>}</div></div>)}
          </div>

          <section className="guest-section"><div className="guest-heading"><div><h2>Agency or Freelancer guests</h2><p>Invite guests to collaborate on your Workspace sites for free. To accept an invite, guests need to be on an Agency or Freelancer Workspace plan.</p></div>{canManage && <button className="members-outline" onClick={() => setInviteOpen(true)}>Invite guest</button>}</div><div className="guest-grid"><div className="info-card"><div className="info-card-icon"><Users size={17} /></div><h3>Agency &amp; Freelancer guests</h3><p>Collaborate with external partners without giving them full Workspace access.</p><div className="guest-avatars"><span>R</span><span>A</span><span>J</span><span>+1</span></div><button className="members-primary full" onClick={() => setInviteOpen(true)} disabled={!canManage}>Invite guest</button></div><div className="info-card" id="permissions"><div className="info-card-icon"><ShieldCheck size={17} /></div><h3>Access &amp; permissions</h3><p>Control what members can access across your workspace.</p>{["ADMIN", "MEMBER"].map((role) => <div className="permission-row" key={role}><span className={`permission-dot ${role.toLowerCase()}`}><ShieldCheck size={13} /></span><div><strong>{role === "ADMIN" ? "Admin" : "Member"}</strong><small>{role === "ADMIN" ? "Full workspace access" : "Can access assigned sites"}</small></div><b>{workspace.members.filter((member) => member.role === role).length}</b></div>)}</div></div></section>
          <section className="pending-section"><div><h2><Mail size={16} /> Pending invitations · {invitations.filter((item) => item.status === "PENDING").length}</h2><p>People who have been invited but haven&apos;t joined yet.</p></div>{invitations.filter((item) => item.status === "PENDING").map((invitation) => <div className="pending-row" key={invitation.id}><span className="member-avatar small">{initials(invitationName(invitation.recipientUserId))}</span><div><strong>{invitationName(invitation.recipientUserId)}</strong><small>{invitation.role} · expires {new Date(invitation.expiresAt).toLocaleDateString()}</small></div><button disabled={busy} onClick={() => void command(`/invitations/${invitation.id}/renew`, "POST", {}, `"${invitation.id}:${invitation.version}"`)}>Renew</button><button disabled={busy} onClick={() => void command(`/invitations/${invitation.id}/revoke`, "POST", {}, `"${invitation.id}:${invitation.version}"`)}>Cancel</button></div>)}</section>
        </>}
      </main>
      <aside className="events-panel"><div className="events-title"><h2><Clock3 size={16} /> Upcoming events</h2><a href="#events">View all</a></div><div className="event-card"><span className="event-status">Live · Workspace</span><h3>Collaborate with your team</h3><p>Invite members to build and publish sites together.</p><button onClick={() => setInviteOpen(true)} disabled={!canManage}>Invite member</button></div></aside>
    </div>
    {inviteOpen && <div className="members-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setInviteOpen(false); }}><form className="members-modal" onSubmit={invite}><button type="button" className="members-modal-close" onClick={() => setInviteOpen(false)} aria-label="Close"><X size={17} /></button><UserPlus size={22} className="members-modal-icon" /><h2>Invite a member</h2><p>Choose an existing organization member to invite into this workspace.</p><label>Member<select required value={inviteTarget} onChange={(event) => setInviteTarget(event.target.value)}><option value="">Select member</option>{available.map((item) => <option key={item.userId} value={item.userId}>{item.user.fullName || "Organization member"}</option>)}</select></label><label>Role<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option value="MEMBER">Member</option>{workspace?.userRole === "OWNER" && <option value="ADMIN">Admin</option>}</select></label><div className="members-modal-actions"><button type="button" className="members-outline" onClick={() => setInviteOpen(false)}>Cancel</button><button className="members-primary" disabled={busy || !inviteTarget}>{busy ? "Sending..." : "Send invite"}</button></div></form></div>}
  </div>;
}
