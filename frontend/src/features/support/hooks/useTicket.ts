import { useState, useEffect, useCallback } from "react";
import { ticketService } from "../services/ticketService";
import type { SupportTicket } from "../types/support.types";

export function useTicket(ticketId: string | undefined) {
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchTicket = useCallback(async () => {
    if (!ticketId) {
      setTicket(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setTicket(null);
    try {
      const res = await ticketService.getTicket(ticketId);
      setTicket(res.ticket);
    } catch (err: unknown) {
      setTicket(null);
      setError(err instanceof Error ? err.message : "Failed to load ticket details");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const addReply = async (content: string, type: "PUBLIC_REPLY" | "INTERNAL_NOTE" = "PUBLIC_REPLY") => {
    if (!ticketId) return;
    try {
      setSubmitting(true);
      await ticketService.addMessage(ticketId, content, type);
      await fetchTicket();
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async (status: string) => {
    if (!ticketId) return;
    try {
      setSubmitting(true);
      await ticketService.updateStatus(ticketId, status);
      await fetchTicket();
    } finally {
      setSubmitting(false);
    }
  };

  const changePriority = async (priority: string) => {
    if (!ticketId) return;
    try {
      setSubmitting(true);
      await ticketService.updatePriority(ticketId, priority);
      await fetchTicket();
    } finally {
      setSubmitting(false);
    }
  };

  const assignAgent = async (agentId: string | null) => {
    if (!ticketId) return;
    try {
      setSubmitting(true);
      await ticketService.assignAgent(ticketId, agentId);
      await fetchTicket();
    } finally {
      setSubmitting(false);
    }
  };

  return {
    ticket,
    loading,
    error,
    submitting,
    refresh: fetchTicket,
    addReply,
    changeStatus,
    changePriority,
    assignAgent,
  };
}
