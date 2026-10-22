// In-process publish locks shared by publishing, publish status and rollback (one instance).
// Moved verbatim from connector.service.ts (now a compatibility entry point that re-exports the public API).

export const publishLocks = new Set<string>();
