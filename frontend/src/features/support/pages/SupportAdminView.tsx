import React, { useState, useEffect } from "react";
import { Users, Tag, Clock, BarChart3, ShieldCheck, Plus, RefreshCw, Loader2 } from "lucide-react";
import { ticketService } from "../services/ticketService";
import type { SupportTeam, SupportCategory, SupportSlaPolicy, AnalyticsMetrics } from "../types/support.types";

export const SupportAdminViewPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"analytics" | "teams" | "categories" | "sla">("analytics");
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsMetrics | null>(null);
  const [teams, setTeams] = useState<SupportTeam[]>([]);
  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [slaPolicies, setSlaPolicies] = useState<SupportSlaPolicy[]>([]);

  // Category modal input state
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newTeamName, setNewTeamName] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [anRes, teamRes, catRes, slaRes] = await Promise.all([
        ticketService.getAnalytics(),
        ticketService.getTeams(),
        ticketService.getCategories(),
        ticketService.getSlaPolicies(),
      ]);
      setAnalytics(anRes.analytics.metrics);
      setTeams(teamRes.teams);
      setCategories(catRes.categories);
      setSlaPolicies(slaRes.policies);
    } catch (err) {
      console.error("Failed to load admin support data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await ticketService.createCategory({ name: newCatName.trim(), description: newCatDesc.trim() });
    setNewCatName("");
    setNewCatDesc("");
    fetchData();
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    await ticketService.createCategory({ name: newTeamName.trim() });
    setNewTeamName("");
    fetchData();
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
            <span>Support System Governance & Analytics</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage support staff teams, categories, SLA policies, and review operational performance metrics.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs Header */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
            activeTab === "analytics"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Analytics & Reports</span>
        </button>
        <button
          onClick={() => setActiveTab("teams")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
            activeTab === "teams"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Support Teams</span>
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
            activeTab === "categories"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Ticket Categories</span>
        </button>
        <button
          onClick={() => setActiveTab("sla")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
            activeTab === "sla"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>SLA Policies</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === "analytics" && analytics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-xs text-slate-400 font-semibold">Total Tickets</span>
                  <div className="text-2xl font-bold text-slate-100">{analytics.totalTickets}</div>
                </div>

                <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-xs text-slate-400 font-semibold">Open / In Progress</span>
                  <div className="text-2xl font-bold text-blue-400">
                    {analytics.openTickets + analytics.inProgressTickets + analytics.newTickets}
                  </div>
                </div>

                <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-xs text-slate-400 font-semibold">SLA Compliance</span>
                  <div className="text-2xl font-bold text-emerald-400">{analytics.slaCompliancePercentage}%</div>
                </div>

                <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-xs text-slate-400 font-semibold">Avg Response Time</span>
                  <div className="text-2xl font-bold text-purple-400">{analytics.avgFirstResponseMinutes}m</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-slate-200">Ticket Breakdown by Status</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                      <span>New</span>
                      <span className="font-mono font-bold text-cyan-400">{analytics.newTickets}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                      <span>Open</span>
                      <span className="font-mono font-bold text-blue-400">{analytics.openTickets}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                      <span>In Progress</span>
                      <span className="font-mono font-bold text-amber-400">{analytics.inProgressTickets}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                      <span>Resolved</span>
                      <span className="font-mono font-bold text-emerald-400">{analytics.resolvedTickets}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-slate-200">Performance Metrics</h3>
                  <div className="space-y-3 text-xs text-slate-300">
                    <div>
                      <span className="text-slate-400 block">Average First Response Time</span>
                      <span className="text-base font-bold text-slate-100">{analytics.avgFirstResponseMinutes} minutes</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Average Resolution Time</span>
                      <span className="text-base font-bold text-slate-100">{analytics.avgResolutionMinutes} minutes</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "categories" && (
            <div className="space-y-6">
              <form onSubmit={handleCreateCategory} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex gap-3 items-center">
                <input
                  type="text"
                  placeholder="New Category Name..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="bg-slate-950/70 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 flex-1"
                />
                <input
                  type="text"
                  placeholder="Description..."
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="bg-slate-950/70 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 flex-1"
                />
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Category</span>
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((c) => (
                  <div key={c.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{c.icon || "🏷️"}</span>
                      <h4 className="font-bold text-sm text-slate-100">{c.name}</h4>
                    </div>
                    <p className="text-xs text-slate-400">{c.description || "No description."}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "teams" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.map((t) => (
                  <div key={t.id} className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                    <h4 className="font-bold text-sm text-slate-100">{t.name}</h4>
                    <p className="text-xs text-slate-400">{t.description || "Support Team"}</p>
                    <div className="text-xs text-slate-400">
                      <strong>Members:</strong> {t.members?.length || 0} agents assigned
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "sla" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {slaPolicies.map((p) => (
                <div key={p.id} className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-sm text-slate-100">{p.name}</h4>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {p.priority}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 space-y-1 pt-2">
                    <div>First Response Target: <strong>{p.firstResponseMinutes} minutes</strong></div>
                    <div>Resolution Target: <strong>{p.resolutionMinutes} minutes</strong></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
