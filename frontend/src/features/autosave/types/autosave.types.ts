export type TruthfulEditorState =
  | "UNSAVED"
  | "SAVING"
  | "DRAFT_ACKNOWLEDGED"
  | "CONFLICT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PARTIALLY_PROPAGATED"
  | "LIVE_VERIFIED"
  | "FAILED";

/** Legacy UI status mapping for backwards compatibility with existing UI components */
export type AutosaveStatus = "saved" | "unsaved" | "saving" | "error" | TruthfulEditorState;

export interface AutosaveState {
  status: AutosaveStatus;
  truthfulState?: TruthfulEditorState;
  lastSavedAt: number | null;
  errorMessage: string | null;
  isDirty: boolean;
  documentVersion?: number;
  conflictDetails?: {
    conflictId: string;
    clientVersion: number;
    serverVersion: number;
    autoRegenerationLocked: boolean;
  };
}
