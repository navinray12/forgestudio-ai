/**
 * ForgeStudio Module 57: Collaborative Development Types
 */

export interface EditorCursor {
  line: number;
  column: number;
}

export interface SelectionRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface PeerPresence {
  userId: string;
  name: string;
  avatar?: string;
  color: string;
  socketId: string;
  projectId: string;
  activeFile?: string | null;
  cursor?: EditorCursor | null;
  selection?: SelectionRange | null;
  activePanel?: string | null;
  mode?: "READ" | "EDIT" | "REVIEW";
  lastSeen: number;
  status: "ONLINE" | "IDLE" | "OFFLINE";
}

export interface FileSession {
  id: string;
  projectId: string;
  filePath: string;
  currentRevision: number;
  lockedBy?: string | null;
  lockedAt?: Date | null;
  activeEditors: string[];
  updatedAt: Date;
}

export interface FileComment {
  id: string;
  projectId: string;
  filePath: string;
  authorId: string;
  authorName?: string;
  parentCommentId?: string | null;
  content: string;
  startLine?: number | null;
  endLine?: number | null;
  startColumn?: number | null;
  endColumn?: number | null;
  selectedCodeSnippet?: string | null;
  status: "OPEN" | "RESOLVED";
  resolvedBy?: string | null;
  resolvedAt?: Date | null;
  mentions: string[];
  reactions: Record<string, string[]>;
  replies?: FileComment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewRequest {
  id: string;
  projectId: string;
  requesterId: string;
  requesterName?: string;
  title: string;
  description?: string | null;
  sourceBranch: string;
  targetBranch: string;
  status: "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "CLOSED";
  reviewers: string[];
  assignedAt: Date;
  completedAt?: Date | null;
  commentsCount?: number;
  approvalsCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewComment {
  id: string;
  reviewId: string;
  authorId: string;
  authorName?: string;
  filePath?: string | null;
  line?: number | null;
  comment: string;
  suggestion?: string | null;
  isResolved: boolean;
  createdAt: Date;
}

export interface ReviewApproval {
  id: string;
  reviewId: string;
  reviewerId: string;
  decision: "APPROVED" | "CHANGES_REQUESTED" | "DISMISSED";
  feedback?: string | null;
  decidedAt: Date;
}

export interface SharedPreviewSession {
  id: string;
  projectId: string;
  createdById: string;
  token: string;
  currentRoute: string;
  viewport: { width: number; height: number };
  isSyncActive: boolean;
  allowedUsers: string[];
  expiresAt: Date;
  createdAt: Date;
}

export interface ThreeWayConflict {
  filePath: string;
  baseRevision: number;
  currentRevision: number;
  baseContent: string;
  currentContent: string;
  incomingContent: string;
  hasConflicts: boolean;
  conflicts: Array<{
    startLine: number;
    endLine: number;
    currentSnippet: string;
    incomingSnippet: string;
  }>;
}

export interface ActivityEvent {
  id: string;
  projectId: string;
  actorId?: string | null;
  actorName?: string;
  category: "FILE" | "COMMENT" | "REVIEW" | "IMPORT" | "BUILD" | "DEPLOY" | "PLUGIN" | "INFRA";
  action: string;
  targetResource: string;
  details: Record<string, any>;
  createdAt: Date;
}
