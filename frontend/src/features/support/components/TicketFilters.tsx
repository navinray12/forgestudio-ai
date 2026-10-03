import React from "react";
import { Search, Filter, RefreshCw } from "lucide-react";
import type { TicketSearchFilters, SupportCategory } from "../types/support.types";

export interface TicketFiltersProps {
  filters: TicketSearchFilters;
  categories?: SupportCategory[];
  isStaff?: boolean;
  onFilterChange: (filters: Partial<TicketSearchFilters>) => void;
  onRefresh?: () => void;
}

export const TicketFiltersBar: React.FC<TicketFiltersProps> = ({
  filters,
  categories = [],
  isStaff = false,
  onFilterChange,
  onRefresh,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-900/60 border border-slate-800 rounded-xl mb-4">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={filters.query || ""}
          onChange={(e) => onFilterChange({ query: e.target.value })}
          placeholder="Search by ticket #, subject, text..."
          className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={typeof filters.status === "string" ? filters.status : ""}
          onChange={(e) => onFilterChange({ status: e.target.value || undefined })}
          className="bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="NEW">New</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="WAITING_FOR_CUSTOMER">Waiting on Customer</option>
          <option value="CUSTOMER_REPLIED">Customer Replied</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
          <option value="REOPENED">Reopened</option>
        </select>

        <select
          value={typeof filters.priority === "string" ? filters.priority : ""}
          onChange={(e) => onFilterChange({ priority: e.target.value || undefined })}
          className="bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
        >
          <option value="">All Priorities</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="NORMAL">Normal</option>
          <option value="LOW">Low</option>
        </select>

        {categories.length > 0 && (
          <select
            value={filters.categoryId || ""}
            onChange={(e) => onFilterChange({ categoryId: e.target.value || undefined })}
            className="bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
            title="Refresh list"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
