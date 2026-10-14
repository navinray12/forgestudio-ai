import { useState, useEffect, useCallback, useMemo } from "react";
import type { FormContainerConfig, CreateFormPayload } from "../types/atomicForm.types";
import { AtomicFormService } from "../services/atomicFormService";

export function useAtomicForm() {
  const [forms, setForms] = useState<FormContainerConfig[]>([]);
  const [activeForm, setActiveForm] = useState<FormContainerConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchForms = useCallback(() => {
    setIsLoading(true);
    setError(null);
    try {
      const list = AtomicFormService.getForms();
      setForms(list);
      setActiveForm((previous) => list.find((item) => item.id === previous?.id) ?? list[0] ?? null);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : "") || "Failed to load Atomic Forms.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Cancel stale initial loads on StrictMode remount or cleanup.
    const timer = window.setTimeout(fetchForms, 0);
    return () => window.clearTimeout(timer);
  }, [fetchForms]);

  const filteredForms = useMemo(() => {
    if (!searchQuery.trim()) return forms;
    const q = searchQuery.toLowerCase().trim();
    return forms.filter(
      (f) => f.name.toLowerCase().includes(q) || (f.category && f.category.toLowerCase().includes(q))
    );
  }, [forms, searchQuery]);

  const createForm = async (payload: CreateFormPayload) => {
    try {
      const created = AtomicFormService.createForm(payload);
      setForms((prev) => [...prev, created]);
      setActiveForm(created);
      return created;
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : "") || "Failed to create Form.");
      throw err;
    }
  };

  const updateActiveForm = async (payload: Partial<FormContainerConfig>) => {
    if (!activeForm) return;
    try {
      const updated = AtomicFormService.updateForm(activeForm.id, payload);
      setForms((prev) => prev.map((f) => (f.id === activeForm.id ? updated : f)));
      setActiveForm(updated);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : "") || "Failed to update Form.");
    }
  };

  const deleteForm = async (id: string) => {
    try {
      AtomicFormService.deleteForm(id);
      const remaining = forms.filter((f) => f.id !== id);
      setForms(remaining);
      if (activeForm?.id === id) {
        setActiveForm(remaining[0] || null);
      }
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : "") || "Failed to delete Form.");
    }
  };

  return {
    forms,
    filteredForms,
    activeForm,
    setActiveForm,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    createForm,
    updateActiveForm,
    deleteForm,
    refreshForms: fetchForms,
  };
}
