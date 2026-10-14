import { useState, useEffect, useCallback, useRef } from "react";
import { forumService } from "../services/forumService";
import type { ForumCategory } from "../types/forum.types";

export function useForumCategories() {
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const mounted = useRef(false);

  const fetchCategories = useCallback(async () => {
    const request = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const res = await forumService.listCategories();
      if (mounted.current && request === requestId.current) {
        setCategories(res.categories || []);
      }
    } catch (err: unknown) {
      if (mounted.current && request === requestId.current) {
        setError(err instanceof Error ? err.message : "Failed to load categories");
      }
    } finally {
      if (mounted.current && request === requestId.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(() => {
      if (mounted.current) void fetchCategories();
    });
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, [fetchCategories]);

  return { categories, isLoading, error, refetch: fetchCategories };
}
