import React, { useState, useEffect } from "react";

interface Member {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface Invitation {
    id: string;
    email: string;
    role: string;
    status: string;
}

interface GranularPerm {
    id: string;
    userId: string;
    resourceId: string;
    capability: string;
    effect: string;
}

interface RoleManagerModalProps {
    websiteId: string;
    websiteName: string;
    onClose: () => void;
    apiUrl: string;
}

const ROLE_DESC: Record<string, { desc: string, caps: string }> = {
    OWNER: { desc: "Full control over website, settings & billing.", caps: "Full Control" },
    PROJECT_OWNER: { desc: "Full control over website, settings & billing.", caps: "Full Control" },
    ADMIN: { desc: "Manage members, settings, and publishing.", caps: "Admin Access" },
    PROJECT_ADMIN: { desc: "Manage members, settings, and publishing.", caps: "Admin Access" },
    DESIGNER: { desc: "Build & modify layout, styling, and design.", caps: "Design Access" },
    DEVELOPER: { desc: "Custom code, integrations, and technical settings.", caps: "Code & APIs" },
    CONTENT_EDITOR: { desc: "Edit text, media, and dynamic content.", caps: "Content Only" },
    SEO_MANAGER: { desc: "Manage SEO metadata, sitemaps, and audits.", caps: "SEO & Audits" },
    REVIEWER: { desc: "View and leave contextual design comments.", caps: "Review Access" },
    VIEWER: { desc: "Read-only access to preview and design.", caps: "Read Only" },
};

const CAPABILITIES = [
    { id: "VIEW", label: "View Project" },
    { id: "COMMENT", label: "Add Comments & Notes" },
    { id: "EDIT_CONTENT", label: "Edit Content text & media" },
    { id: "EDIT_DESIGN", label: "Edit Layout & Design" },
    { id: "CUSTOM_CODE", label: "Custom Code & Scripts" },
    { id: "EDIT_SEO", label: "SEO Settings & Audits" },
    { id: "PUBLISH", label: "Publish & Deploy Website" },
    { id: "MANAGE_PERMISSIONS", label: "Manage Permissions & Team" }
];

const DEFAULT_CAPABILITIES: Record<string, string[]> = {
    OWNER: ["VIEW", "COMMENT", "EDIT_CONTENT", "EDIT_DESIGN", "CUSTOM_CODE", "EDIT_SEO", "PUBLISH", "MANAGE_MEMBERS", "MANAGE_PERMISSIONS"],
    PROJECT_OWNER: ["VIEW", "COMMENT", "EDIT_CONTENT", "EDIT_DESIGN", "CUSTOM_CODE", "EDIT_SEO", "PUBLISH", "MANAGE_MEMBERS", "MANAGE_PERMISSIONS"],
    ADMIN: ["VIEW", "COMMENT", "EDIT_CONTENT", "EDIT_DESIGN", "CUSTOM_CODE", "EDIT_SEO", "PUBLISH", "MANAGE_MEMBERS", "MANAGE_PERMISSIONS"],
    PROJECT_ADMIN: ["VIEW", "COMMENT", "EDIT_CONTENT", "EDIT_DESIGN", "CUSTOM_CODE", "EDIT_SEO", "PUBLISH", "MANAGE_MEMBERS", "MANAGE_PERMISSIONS"],
    DESIGNER: ["VIEW", "COMMENT", "EDIT_CONTENT", "EDIT_DESIGN", "PUBLISH"],
    DEVELOPER: ["VIEW", "COMMENT", "EDIT_CONTENT", "EDIT_DESIGN", "CUSTOM_CODE", "MANAGE_INTEGRATIONS"],
    CONTENT_EDITOR: ["VIEW", "COMMENT", "EDIT_CONTENT"],
    SEO_MANAGER: ["VIEW", "COMMENT", "EDIT_CONTENT", "EDIT_SEO"],
    REVIEWER: ["VIEW", "COMMENT"],
    VIEWER: ["VIEW"],
};

export const RoleManagerModal: React.FC<RoleManagerModalProps> = ({ websiteId, websiteName, onClose, apiUrl }) => {
    const [view, setView] = useState<"MEMBERS" | "PERMISSIONS">("MEMBERS");

    // Core data
    const [members, setMembers] = useState<Member[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [granular, setGranular] = useState<GranularPerm[]>([]);

    // Status UI
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Invite UI
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("DESIGNER");
    const [inviting, setInviting] = useState(false);

    const [confirmRole, setConfirmRole] = useState<{ userId: string, name: string, oldRole: string, newRole: string } | null>(null);
    const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);

    // Permissions UI
    const [selectedMember, setSelectedMember] = useState<string | null>(null);

    const getAuthHeaders = (): Record<string, string> => {
        const token = localStorage.getItem("token");
        return {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view]);

    const fetchData = async () => {
        setLoading(true);
        setError("");
        try {
            const headers = getAuthHeaders();
            const res = await fetch(`${apiUrl}/api/websites/${websiteId}/roles`, {
                headers,
                credentials: "include"
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                const errMsg = data.error?.message || data.message || data.detail || (res.status === 401 ? "Authentication required. Please log in." : `Failed to load access roles (${res.status})`);
                throw new Error(errMsg);
            }

            const membersList = Array.isArray(data.roles)
                ? data.roles
                : Array.isArray(data.roles?.members)
                ? data.roles.members
                : Array.isArray(data.members)
                ? data.members
                : [];
            const invitationsList = Array.isArray(data.invitations)
                ? data.invitations
                : Array.isArray(data.roles?.invitations)
                ? data.roles.invitations
                : [];

            setMembers(membersList);
            setInvitations(invitationsList);

            if (view === "PERMISSIONS") {
                const pRes = await fetch(`${apiUrl}/api/websites/${websiteId}/permissions`, {
                    headers,
                    credentials: "include"
                });
                const pData = await pRes.json().catch(() => ({}));
                if (pRes.ok) {
                    setGranular(pData.permissions || []);
                }

                // Select first valid member by default
                if (!selectedMember && membersList.length > 0) {
                    const nonOwner = membersList.find((m: any) => m.role !== "OWNER");
                    if (nonOwner) setSelectedMember(nonOwner.id);
                }
            }
        } catch (err: any) {
            setError(err.message || "Failed to load roles.");
        } finally {
            setLoading(false);
        }
    };

    const executeRoleChange = async () => {
        if (!confirmRole) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`${apiUrl}/api/websites/${websiteId}/roles/${confirmRole.userId}`, {
                method: "PUT",
                headers: getAuthHeaders(),
                credentials: "include",
                body: JSON.stringify({ role: confirmRole.newRole }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error?.message || data.message || "Failed to change role");
            await fetchData();
            setConfirmRole(null);
        } catch (err: any) {
            setError(err.message || "Could not change role.");
            setLoading(false);
        }
    };

    const executeRemove = async () => {
        if (!removeMemberId) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`${apiUrl}/api/websites/${websiteId}/members/${removeMemberId}`, {
                method: "DELETE",
                headers: getAuthHeaders(),
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error?.message || data.message || "Failed to remove member");
            await fetchData();
            setRemoveMemberId(null);
        } catch (err: any) {
            setError(err.message || "Could not remove member.");
            setLoading(false);
        }
    };

    const triggerInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);
        setError("");
        try {
            const res = await fetch(`${apiUrl}/api/websites/${websiteId}/invite`, {
                method: "POST",
                headers: getAuthHeaders(),
                credentials: "include",
                body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error?.message || data.message || "Failed to invite member");
            setInviteEmail("");
            await fetchData();
        } catch (err: any) {
            setError(err.message || "Could not send invite.");
        } finally {
            setInviting(false);
        }
    };

    const togglePermission = async (capId: string, currentEffect: string | null) => {
        if (!selectedMember) return;

        const memberObj = members.find(m => m.id === selectedMember);
        if (!memberObj) return;

        const isDefaultAllowed = DEFAULT_CAPABILITIES[memberObj.role]?.includes(capId);

        let newEffect = "INHERIT";
        if (currentEffect === null) {
            newEffect = isDefaultAllowed ? "DENY" : "ALLOW";
        } else if (currentEffect === "ALLOW") {
            newEffect = "DENY";
        } else if (currentEffect === "DENY") {
            newEffect = "INHERIT";
        }

        try {
            const res = await fetch(`${apiUrl}/api/websites/${websiteId}/permissions`, {
                method: "POST",
                headers: getAuthHeaders(),
                credentials: "include",
                body: JSON.stringify({
                    targetUserId: selectedMember,
                    resourceId: "*",
                    capability: capId,
                    effect: newEffect
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error?.message || data.message || "Failed to update permission");
            }
            await fetchData();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const getPermEffect = (userId: string, capId: string) => {
        const p = granular.find(g => g.userId === userId && g.capability === capId && g.resourceId === "*");
        return p ? p.effect : null;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-4xl rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 p-0 shadow-2xl flex flex-col h-[85vh] max-h-[800px] overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-lg">👥</span>
                            <h2 className="text-xl font-bold text-white tracking-tight">Manage Team Access & Roles</h2>
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-1">{websiteName}</p>
                    </div>

                    <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
                        <button
                            onClick={() => setView("MEMBERS")}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${view === "MEMBERS" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
                        >
                            Members ({members.length})
                        </button>
                        <button
                            onClick={() => setView("PERMISSIONS")}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${view === "PERMISSIONS" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
                        >
                            Granular Permissions
                        </button>
                    </div>

                    <button onClick={onClose} className="text-slate-400 hover:text-white font-bold text-2xl flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-800 transition-colors">&times;</button>
                </div>

                {error && (
                    <div className="m-6 mb-0 rounded-xl border border-red-500/30 bg-red-950/40 p-3.5 text-xs font-semibold text-red-300 flex items-center justify-between">
                        <span>⚠️ {error}</span>
                        <button onClick={() => setError("")} className="text-red-400 hover:text-red-200 font-bold ml-4">✕</button>
                    </div>
                )}

                <div className="flex-1 overflow-hidden flex flex-col bg-slate-950/50">
                    {view === "MEMBERS" && (
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Invite Form */}
                            <form onSubmit={triggerInvite} className="flex gap-3 items-end max-w-2xl bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-sm">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Invite Collaborator</label>
                                    <input
                                        type="email"
                                        required
                                        placeholder="colleague@example.com"
                                        value={inviteEmail}
                                        onChange={e => setInviteEmail(e.target.value)}
                                        className="w-full h-10 bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 outline-none transition-colors"
                                    />
                                </div>
                                <div className="w-48">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Assigned Role</label>
                                    <select
                                        value={inviteRole}
                                        onChange={e => setInviteRole(e.target.value)}
                                        className="w-full h-10 bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-white focus:border-indigo-500 outline-none cursor-pointer font-semibold"
                                    >
                                        <option value="ADMIN">Admin</option>
                                        <option value="DESIGNER">Designer</option>
                                        <option value="DEVELOPER">Developer</option>
                                        <option value="CONTENT_EDITOR">Content Editor</option>
                                        <option value="SEO_MANAGER">SEO Manager</option>
                                        <option value="REVIEWER">Reviewer</option>
                                        <option value="VIEWER">Viewer</option>
                                    </select>
                                </div>
                                <button
                                    disabled={inviting}
                                    type="submit"
                                    className="h-10 px-5 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-500 transition disabled:opacity-50 cursor-pointer shadow-sm"
                                >
                                    {inviting ? "Sending..." : "Send Invite"}
                                </button>
                            </form>

                            {/* Members Table */}
                            {loading && members.length === 0 ? (
                                <div className="flex items-center justify-center text-xs text-slate-400 py-16">
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mr-3" />
                                    <span>Loading members...</span>
                                </div>
                            ) : (
                                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-950/80 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            <tr>
                                                <th className="px-5 py-3">Member</th>
                                                <th className="px-5 py-3">Role</th>
                                                <th className="px-5 py-3">Status</th>
                                                <th className="px-5 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60 text-xs">
                                            {(Array.isArray(members) ? members : []).map(m => (
                                                <tr key={m.id} className="hover:bg-slate-850/60 transition-colors">
                                                    <td className="px-5 py-4">
                                                        <div className="font-bold text-white text-sm">{m.name}</div>
                                                        <div className="text-xs text-slate-400 font-mono mt-0.5">{m.email}</div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <select
                                                            value={m.role}
                                                            disabled={m.role === "OWNER"}
                                                            onChange={e => setConfirmRole({ userId: m.id, name: m.name, oldRole: m.role, newRole: e.target.value })}
                                                            className="w-full max-w-[140px] text-xs font-semibold text-white bg-slate-950 border border-slate-700 rounded p-1.5 focus:border-indigo-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                                                        >
                                                            <option value="OWNER" disabled>Owner</option>
                                                            <option value="ADMIN">Admin</option>
                                                            <option value="DESIGNER">Designer</option>
                                                            <option value="DEVELOPER">Developer</option>
                                                            <option value="CONTENT_EDITOR">Content Editor</option>
                                                            <option value="SEO_MANAGER">SEO Manager</option>
                                                            <option value="REVIEWER">Reviewer</option>
                                                            <option value="VIEWER">Viewer</option>
                                                        </select>
                                                        <div className="text-[10px] text-slate-500 mt-1">{ROLE_DESC[m.role]?.desc}</div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                            Active
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        {m.role !== "OWNER" && (
                                                            <button
                                                                onClick={() => setRemoveMemberId(m.id)}
                                                                className="text-xs font-semibold text-red-400 hover:text-red-300 px-3 py-1 rounded-lg border border-red-500/30 bg-red-950/30 hover:bg-red-950/60 transition"
                                                            >
                                                                Remove
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {invitations.map(inv => (
                                                <tr key={inv.id} className="bg-slate-950/40">
                                                    <td className="px-5 py-4">
                                                        <div className="font-bold text-slate-300 font-mono text-xs">{inv.email}</div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className="bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded text-[10px] uppercase">{inv.role}</span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className="text-[10px] text-amber-400 font-bold bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                            Pending
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Awaiting Accept</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {view === "PERMISSIONS" && (
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <p className="text-xs text-slate-400">
                                Override granular capabilities for specific team members. Default capabilities are inherited from the user's role.
                            </p>
                            {members.filter(m => m.role !== "OWNER").length === 0 ? (
                                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-12 text-center text-xs text-slate-400">
                                    No non-owner collaborators found on this project. Invite a team member to configure granular capabilities.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <label className="text-xs font-bold text-slate-400">Select Collaborator:</label>
                                        <select
                                            value={selectedMember || ""}
                                            onChange={e => setSelectedMember(e.target.value)}
                                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                                        >
                                            {members.filter(m => m.role !== "OWNER").map(m => (
                                                <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {CAPABILITIES.map(cap => {
                                            const effect = selectedMember ? getPermEffect(selectedMember, cap.id) : null;
                                            return (
                                                <div key={cap.id} className="p-3 rounded-xl border border-slate-800 bg-slate-900/80 flex items-center justify-between">
                                                    <div>
                                                        <div className="font-bold text-xs text-white">{cap.label}</div>
                                                        <div className="text-[10px] text-slate-500 font-mono">{cap.id}</div>
                                                    </div>
                                                    <button
                                                        onClick={() => togglePermission(cap.id, effect)}
                                                        className={`px-3 py-1 rounded text-xs font-bold transition ${
                                                            effect === "ALLOW"
                                                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                                                : effect === "DENY"
                                                                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                                                                : "bg-slate-800 text-slate-400 border border-slate-700"
                                                        }`}
                                                    >
                                                        {effect || "INHERIT"}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Confirm Role Change Dialog */}
                {confirmRole && (
                    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
                        <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
                            <h4 className="text-base font-bold text-white">Change Role?</h4>
                            <p className="text-xs text-slate-400">
                                Change <strong>{confirmRole.name}</strong> from <strong>{confirmRole.oldRole}</strong> to <strong>{confirmRole.newRole}</strong>?
                            </p>
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setConfirmRole(null)} className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-bold text-slate-400 hover:text-white">Cancel</button>
                                <button onClick={executeRoleChange} className="px-4 py-1.5 rounded-lg bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500">Confirm</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirm Remove Member Dialog */}
                {removeMemberId && (
                    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
                        <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
                            <h4 className="text-base font-bold text-white">Remove Collaborator?</h4>
                            <p className="text-xs text-slate-400">
                                This user will immediately lose access to this project.
                            </p>
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setRemoveMemberId(null)} className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-bold text-slate-400 hover:text-white">Cancel</button>
                                <button onClick={executeRemove} className="px-4 py-1.5 rounded-lg bg-red-600 text-xs font-bold text-white hover:bg-red-500">Remove</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
