import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { GlobalWidget, CreateGlobalWidgetPayload, UpdateGlobalWidgetPayload } from "../types/globalWidget.types";
import {
  getGlobalWidgets,
  saveGlobalWidget,
  updateGlobalWidgetService,
  deleteGlobalWidgetService,
} from "../services/globalWidgetService";

interface UseGlobalWidgetsParams {
  apiUrl: string;
}

export function useGlobalWidgets({ apiUrl }: UseGlobalWidgetsParams) {
  const [globalWidgets, setGlobalWidgets] = useState<GlobalWidget[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [previewWidget, setPreviewWidget] = useState<GlobalWidget | null>(null);
  const requestId = useRef(0);
  const mounted = useRef(false);

  const fetchWidgets = useCallback(async () => {
    const request = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getGlobalWidgets(apiUrl);
      if (mounted.current && request === requestId.current) {
        setGlobalWidgets(data);
      }
    } catch (err: unknown) {
      if (mounted.current && request === requestId.current) {
        setError(err instanceof Error ? err.message : "Unable to load Global Widgets.");
      }
    } finally {
      if (mounted.current && request === requestId.current) setIsLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(() => {
      if (mounted.current) void fetchWidgets();
    });
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, [fetchWidgets]);

  const filteredWidgets = useMemo(() => {
    if (!searchQuery.trim()) {
      return globalWidgets;
    }
    const q = searchQuery.toLowerCase().trim();
    return globalWidgets.filter((w) => {
      const nameMatch = w.name.toLowerCase().includes(q);
      const descMatch = w.description ? w.description.toLowerCase().includes(q) : false;
      return nameMatch || descMatch;
    });
  }, [globalWidgets, searchQuery]);

  const createWidget = useCallback(
    async (payload: CreateGlobalWidgetPayload) => {
      setIsSaving(true);
      setError(null);
      try {
        const created = await saveGlobalWidget(apiUrl, payload);
        setGlobalWidgets((prev) => [created, ...prev.filter((w) => w.id !== created.id)]);
        return created;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unable to save Global Widget.");
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [apiUrl]
  );

  const updateWidget = useCallback(
    async (id: string, payload: UpdateGlobalWidgetPayload) => {
      setIsSaving(true);
      setError(null);
      try {
        const updated = await updateGlobalWidgetService(apiUrl, id, payload);
        setGlobalWidgets((prev) => prev.map((w) => (w.id === id ? updated : w)));
        setPreviewWidget((prev) => prev?.id === id ? updated : prev);
        return updated;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unable to update Global Widget.");
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [apiUrl]
  );

  const removeWidget = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await deleteGlobalWidgetService(apiUrl, id);
        setGlobalWidgets((prev) => prev.filter((w) => w.id !== id));
        setPreviewWidget((prev) => prev?.id === id ? null : prev);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unable to delete Global Widget.");
        throw err;
      }
    },
    [apiUrl]
  );

  return {
    globalWidgets,
    filteredWidgets,
    isLoading,
    isSaving,
    error,
    searchQuery,
    setSearchQuery,
    previewWidget,
    setPreviewWidget,
    createWidget,
    updateWidget,
    removeWidget,
    refetchGlobalWidgets: fetchWidgets,
  };
}
