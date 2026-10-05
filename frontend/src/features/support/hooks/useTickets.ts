import { useState, useEffect, useCallback } from "react";
import { ticketService } from "../services/ticketService";
import type { SupportTicket, TicketSearchFilters } from "../types/support.types";

export function useTickets(initialFilters: TicketSearchFilters = {}) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [filters, setFilters] = useState<TicketSearchFilters>(initialFilters);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await ticketService.listTickets(filters);
      setTickets(res.items);
      setPagination(res.pagination);
    } catch (err: any) {
      setError(err.message || "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const updateFilters = (newFilters: Partial<TicketSearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: newFilters.page ?? 1 }));
  };

  return {
    tickets,
    filters,
    pagination,
    loading,
    error,
    refresh: fetchTickets,
    updateFilters,
  };
}
