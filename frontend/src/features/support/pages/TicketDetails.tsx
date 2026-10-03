import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, RotateCcw, XCircle, Shield, User, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useTicket } from "../hooks/useTicket";
import { TicketStatusBadge } from "../components/TicketStatus";
import { TicketPriorityBadge } from "../components/TicketPriority";
import { SlaBadge } from "../components/SlaBadge";
import { TicketTimeline } from "../components/TicketTimeline";
import { TicketComposer } from "../components/TicketComposer";
import { TicketMetadataSidebar } from "../components/TicketMetadata";
import { ticketService } from "../services/ticketService";

import { CannedResponseModal } from "../components/CannedResponseModal";
import { TicketMergeModal } from "../components/TicketMergeModal";
import { TicketSplitModal } from "../components/TicketSplitModal";
import { CsatRatingModal } from "../components/CsatRatingModal";
import { Zap, GitMerge, GitBranch, Star } from "lucide-react";

export const TicketDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { ticket, loading, error, submitting, refresh, addReply, changeStatus, changePriority, assignAgent } =
    useTicket(id);

  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Modal visibility states
  const [isCannedOpen, setIsCannedOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [isSplitOpen, setIsSplitOpen] = useState(false);
  const [isCsatOpen, setIsCsatOpen] = useState(false);

  const isStaff = [
    "SUPPORT_AGENT",
    "SUPPORT_MANAGER",
    "SUPPORT_ADMIN",
    "ADMIN",
    "SUPER_ADMIN",
    "PLATFORM_ADMIN",
  ].includes(user?.role || "");

  useEffect(() => {
    ticketService.getCategories().then((res) => setCategories(res.categories)).catch(() => {});
    if (isStaff) {
      ticketService
        .getTeams()
        .then((res) => {
          const members: any[] = [];
          res.teams.forEach((t) => {
            if (t.members) {
              t.members.forEach((m) => {
                if (m.user && !members.some((x) => x.id === m.user.id)) {
                  members.push(m.user);
                }
              });
            }
          });
          setAvailableAgents(members);
        })
        .catch(() => {});
    }
  }, [isStaff]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-6 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <h2 className="text-lg font-bold text-slate-100">Ticket Not Found</h2>
        <p className="text-xs text-slate-400">{error || "You don't have permission to view this ticket."}</p>
        <button
          onClick={() => navigate("/support")}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500"
        >
          Return to Support Home
        </button>
      </div>
    );
  }

  const handleSendReply = async (content: string, type: "PUBLIC_REPLY" | "INTERNAL_NOTE") => {
    await addReply(content, type);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <button
        onClick={() => navigate("/support")}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Tickets</span>
      </button>

      {/* Top Header Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                {ticket.ticketNumber}
              </span>
              <TicketStatusBadge status={ticket.status} />
              <TicketPriorityBadge priority={ticket.priority} />
              {isStaff && <SlaBadge status={ticket.sla?.status || "ON_TRACK"} />}
            </div>
            <h1 className="text-xl font-bold text-slate-100">{ticket.subject}</h1>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {!isStaff && (ticket.status === "RESOLVED" || ticket.status === "CLOSED") && !ticket.csatScore && (
              <button
                onClick={() => setIsCsatOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-amber-500/20"
              >
                <Star className="w-4 h-4 fill-slate-950" />
                <span>Rate Support</span>
              </button>
            )}

            {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
              <button
                onClick={() => changeStatus("RESOLVED")}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Mark Resolved</span>
              </button>
            )}

            {(ticket.status === "RESOLVED" || ticket.status === "CLOSED") && (
              <button
                onClick={() => changeStatus("REOPENED")}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/30 text-xs font-semibold transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reopen Ticket</span>
              </button>
            )}

            {isStaff && ticket.status !== "CLOSED" && (
              <button
                onClick={() => changeStatus("CLOSED")}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
              >
                <XCircle className="w-4 h-4 text-slate-400" />
                <span>Close Ticket</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Timeline Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Initial Ticket Problem Description */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-2">
              <span className="font-semibold text-slate-200">Problem Description</span>
              <span>{new Date(ticket.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed pt-2">
              {ticket.description}
            </p>
          </div>

          {/* Timeline Messages & Events */}
          <TicketTimeline
            messages={ticket.messages || []}
            events={ticket.events || []}
            currentUserId={user?.id}
            isStaff={isStaff}
          />

          {/* Reply / Internal Note Composer */}
          <div className="relative space-y-2">
            {isStaff && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsCannedOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Use Canned Response</span>
                </button>
              </div>
            )}
            <TicketComposer
              isStaff={isStaff}
              submitting={submitting}
              onSend={handleSendReply}
            />
          </div>
        </div>

        {/* Sidebar Controls & Metadata Column */}
        <div className="space-y-6">
          {isStaff && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                Staff Controls
              </h3>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Status</label>
                <select
                  value={ticket.status}
                  onChange={(e) => changeStatus(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none"
                >
                  <option value="NEW">New</option>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="WAITING_FOR_CUSTOMER">Waiting on Customer</option>
                  <option value="CUSTOMER_REPLIED">Customer Replied</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                  <option value="REOPENED">Reopened</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Priority</label>
                <select
                  value={ticket.priority}
                  onChange={(e) => changePriority(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Assign Agent</label>
                <select
                  value={ticket.assignedAgentId || ""}
                  onChange={(e) => assignAgent(e.target.value || null)}
                  disabled={submitting}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  <option value={user?.id}>Assign to Me ({user?.fullName || "Me"})</option>
                  {availableAgents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.fullName || ag.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Advanced Operations: Merge & Split */}
              <div className="pt-2 border-t border-slate-800 flex gap-2">
                <button
                  onClick={() => setIsMergeOpen(true)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>Merge Ticket</span>
                </button>
                <button
                  onClick={() => setIsSplitOpen(true)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Split Ticket</span>
                </button>
              </div>
            </div>
          )}

          <TicketMetadataSidebar ticket={ticket} />
        </div>
      </div>

      {/* Enterprise Modals */}
      <CannedResponseModal
        isOpen={isCannedOpen}
        onClose={() => setIsCannedOpen(false)}
        ticket={ticket}
        onSelectResponse={(text) => handleSendReply(text, "PUBLIC_REPLY")}
      />

      <TicketMergeModal
        isOpen={isMergeOpen}
        onClose={() => setIsMergeOpen(false)}
        sourceTicket={ticket}
        onMergeSuccess={refresh}
      />

      <TicketSplitModal
        isOpen={isSplitOpen}
        onClose={() => setIsSplitOpen(false)}
        sourceTicket={ticket}
        categories={categories}
        onSplitSuccess={refresh}
      />

      <CsatRatingModal
        isOpen={isCsatOpen}
        onClose={() => setIsCsatOpen(false)}
        ticket={ticket}
        onSuccess={refresh}
      />
    </div>
  );
};
