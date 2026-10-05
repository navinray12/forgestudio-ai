/**
 * ForgeStudio Git & GitHub Integration Types
 * Modules 16 and 17 Architectural Contracts
 */

export interface GitAuthor {
  name: string;
  email: string;
  timestamp: string;
}

export interface GitCommitEntity {
  id: string;
  projectId: string;
  hash: string;
  treeHash: string;
  parentHashes: string[];
  author: GitAuthor;
  committer: GitAuthor;
  message: string;
  branch: string;
  diffSummary: {
    additions: number;
    deletions: number;
    changedFiles: number;
  };
  tree?: Array<{ path: string; hash: string; size: number }>;
  createdAt: Date | string;
}

export interface GitBranchEntity {
  id: string;
  projectId: string;
  name: string;
  commitHash: string;
  isProtected: boolean;
  upstream?: string | null;
  aheadCount: number;
  behindCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface GitFileStatus {
  path: string;
  status: "added" | "modified" | "deleted" | "untracked" | "conflicted";
  staged: boolean;
  oldPath?: string;
  sizeBytes?: number;
}

export interface GitStatusResult {
  branch: string;
  headCommit: string | null;
  isDetachedHead: boolean;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: string[];
  conflicts: string[];
  isClean: boolean;
  aheadCount: number;
  behindCount: number;
  mergeInProgress?: boolean;
  rebaseInProgress?: boolean;
}

export interface GitDiffChunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface GitFileDiff {
  filePath: string;
  oldPath?: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  chunks: GitDiffChunk[];
  isBinary?: boolean;
}

export interface GitStashEntity {
  id: string;
  projectId: string;
  index: number;
  message: string;
  branch: string;
  commitHash: string;
  stagedFiles: any[];
  unstagedFiles: any[];
  createdAt: Date | string;
}

export interface GitTagEntity {
  id: string;
  projectId: string;
  name: string;
  commitHash: string;
  message?: string | null;
  tagger?: GitAuthor | null;
  createdAt: Date | string;
}

export interface GitConflictResolution {
  filePath: string;
  resolution: "ours" | "theirs" | "manual";
  manualContent?: string;
}

export interface GitGraphNode {
  hash: string;
  parentHashes: string[];
  branch: string;
  author: GitAuthor;
  message: string;
  tags: string[];
  isHead: boolean;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Module 17: GitHub Integration Types
// ---------------------------------------------------------------------------

export interface GitHubConnectionEntity {
  id: string;
  projectId: string;
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  defaultBranch: string;
  installationId?: string | null;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  syncEnabled: boolean;
  lastSyncAt?: Date | string | null;
  webhookId?: string | null;
  metadata?: Record<string, any>;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface GitHubPullRequestEntity {
  id: string;
  projectId: string;
  githubPrNumber: number;
  title: string;
  body?: string | null;
  sourceBranch: string;
  targetBranch: string;
  status: "OPEN" | "MERGED" | "CLOSED";
  author: {
    login: string;
    avatarUrl?: string;
  };
  url?: string | null;
  diffUrl?: string | null;
  checks: Array<{
    name: string;
    status: "pending" | "success" | "failure" | "cancelled";
    description?: string;
    targetUrl?: string;
  }>;
  reviews: Array<{
    user: string;
    state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED";
    submittedAt: string;
  }>;
  issueLinks: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
}
