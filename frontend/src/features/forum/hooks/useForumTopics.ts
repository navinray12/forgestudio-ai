import { useState, useEffect, useCallback, useRef } from "react";
import { forumService } from "../services/forumService";
import type { ForumTopic, ForumTopicFilters } from "../types/forum.types";

export function useForumTopics(initialFilters: ForumTopicFilters = {}) {
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [filters, setFilters] = useState<ForumTopicFilters>(initialFilters);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const mounted = useRef(false);

  const fetchTopics = useCallback(async () => {
    const request = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const res = await forumService.listTopics(filters);
      if (mounted.current && request === requestId.current) {
        setTopics(res.items || []);
        setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
      }
    } catch (err: unknown) {
      if (mounted.current && request === requestId.current) {
        setError(err instanceof Error ? err.message : "Failed to load topics");
      }
    } finally {
      if (mounted.current && request === requestId.current) {
        setIsLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(() => {
      if (mounted.current) void fetchTopics();
    });
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, [fetchTopics]);

  const updateFilters = (newFilters: Partial<ForumTopicFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  return { topics, filters, pagination, isLoading, error, updateFilters, refetch: fetchTopics };
}
