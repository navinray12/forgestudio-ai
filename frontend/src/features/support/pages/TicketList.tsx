import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, LifeBuoy, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useTickets } from "../hooks/useTickets";
import { TicketTable } from "../components/TicketTable";
import { TicketFiltersBar } from "../components/TicketFilters";
import { ticketService } from "../services/ticketService";
import type { SupportCategory } from "../types/support.types";

import { TicketBulkBar } from "../components/TicketBulkBar";

export const TicketListPage: React.FC = () => {
  const { user } = useAuth();
  const isStaff = [
    "SUPPORT_AGENT",
    "SUPPORT_MANAGER",
    "SUPPORT_ADMIN",
    "ADMIN",
    "SUPER_ADMIN",
    "PLATFORM_ADMIN",
  ].includes(user?.role || "");

  const { tickets, filters, pagination, loading, error, refresh, updateFilters } = useTickets();
  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);

  useEffect(() => {
    ticketService
      .getCategories()
      .then((res) => setCategories(res.categories))
      .catch(() => {});
  }, []);

  const handleToggleSelect = (ticketId: string) => {
    setSelectedTicketIds((prev) =>
      prev.includes(ticketId) ? prev.filter((id) => id !== ticketId) : [...prev, ticketId]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedTicketIds.length === tickets.length) {
      setSelectedTicketIds([]);
    } else {
      setSelectedTicketIds(tickets.map((t) => t.id));
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 relative">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <LifeBuoy className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">
              {isStaff ? "Support Staff Command Center" : "Support Tickets"}
            </h1>
            <p className="text-xs text-slate-400">
              {isStaff
                ? "Manage customer support queues, assignments, SLA policies, and issues."
                : "View your submitted support requests or open a new ticket for assistance."}
            </p>
          </div>
        </div>

        <Link
          to="/support/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Support Ticket</span>
        </Link>
      </div>

      <TicketFiltersBar
        filters={filters}
        categories={categories}
        isStaff={isStaff}
        onFilterChange={updateFilters}
        onRefresh={refresh}
      />

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
          {error}
        </div>
      ) : (
        <>
          <TicketTable
            tickets={tickets}
            isStaff={isStaff}
            selectedTicketIds={selectedTicketIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
          />

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 text-xs text-slate-400">
              <div>
                Showing page <strong className="text-slate-200">{pagination.page}</strong> of{" "}
                <strong className="text-slate-200">{pagination.totalPages}</strong> ({pagination.total}{" "}
                tickets)
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => updateFilters({ page: pagination.page - 1 })}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => updateFilters({ page: pagination.page + 1 })}
                  className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {isStaff && (
            <TicketBulkBar
              selectedTicketIds={selectedTicketIds}
              onClearSelection={() => setSelectedTicketIds([])}
              onBulkSuccess={refresh}
            />
          )}
        </>
      )}
    </div>
  );
};
