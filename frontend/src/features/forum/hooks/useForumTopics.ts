import { useState, useEffect, useCallback } from "react";
import { forumService } from "../services/forumService";
import type { ForumTopic, ForumTopicFilters } from "../types/forum.types";

export function useForumTopics(initialFilters: ForumTopicFilters = {}) {
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [filters, setFilters] = useState<ForumTopicFilters>(initialFilters);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTopics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await forumService.listTopics(filters);
      setTopics(res.items || []);
      setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err: any) {
      setError(err.message || "Failed to load topics");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const updateFilters = (newFilters: Partial<ForumTopicFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  return { topics, filters, pagination, isLoading, error, updateFilters, refetch: fetchTopics };
}
