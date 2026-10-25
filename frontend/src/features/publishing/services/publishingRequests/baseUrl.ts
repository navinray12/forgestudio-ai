/**
 * API base URL used by every publishing request: the explicit apiUrl override, else VITE_API_URL, else
 * same-origin (relative URLs).
 * Moved verbatim from publishingService.ts.
 */
export const getBaseUrl = (override?: string) => override || (import.meta.env.VITE_API_URL || "");
