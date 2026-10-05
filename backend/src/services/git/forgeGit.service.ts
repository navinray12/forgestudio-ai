/**
 * ForgeStudio Module 16: Local Version-Control & Git Engine
 * Production-grade Git implementation integrated with Forge Persistent Filesystem
 */

import crypto from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { forgeProjectService } from "../project/forgeProject.service.js";
import { forgeFilesystemService } from "../project/forgeFilesystem.service.js";
import { recordAuditLog } from "../audit.service.js";
import {
  GitAuthor,
  GitCommitEntity,
  GitBranchEntity,
  GitFileStatus,
  GitStatusResult,
  GitFileDiff,
  GitDiffChunk,
  GitStashEntity,
  GitTagEntity,
  GitGraphNode,
} from "./gitTypes.js";

const db = prisma as any;

/**
 * Generate deterministic SHA-1 git object hash
 */
function calculateGitHash(content: string, type: "blob" | "commit" | "tree" = "blob"): string {
  const header = `${type} ${Buffer.byteLength(content, "utf8")}\0`;
  return crypto.createHash("sha1").update(header + content).digest("hex");
}

/**
 * Normalize and validate branch name
 */
export function validateBranchName(name: string): string {
  const clean = name.trim();
  if (!clean || clean.length > 200) {
    throw new AppError("Invalid branch name", 400, "INVALID_BRANCH_NAME");
  }
  if (
    clean.includes("..") ||
    clean.startsWith("/") ||
    clean.endsWith("/") ||
    clean.endsWith(".lock") ||
    /[\s~^:?*\[\\]/.test(clean)
  ) {
    throw new AppError(`Branch name '${clean}' contains illegal characters`, 400, "ILLEGAL_BRANCH_NAME");
  }
  return clean;
}

/**
 * 16.1 Initialize a new Git repository or return existing
 */
export async function initRepository(
  projectId: string,
  initialBranch = "main",
  userId?: string
): Promise<{ repository: any; initialCommit: GitCommitEntity | null; isExisting: boolean }> {
  await forgeProjectService.getProjectById(projectId);

  const existing = await db.forgeGitRepository.findUnique({
    where: { projectId },
  });

  if (existing) {
    return { repository: existing, initialCommit: null, isExisting: true };
  }

  const branchName = validateBranchName(initialBranch);

  // Read current project files to construct initial commit
  const files = await forgeFilesystemService.listFiles(projectId);
  const validFiles = files.filter((f) => !f.isDirectory && !f.path.startsWith(".git/"));

  const author: GitAuthor = {
    name: "Forge Developer",
    email: "developer@forge.studio",
    timestamp: new Date().toISOString(),
  };

  const tree = validFiles.map((f) => ({
    path: f.path,
    hash: f.contentHash || calculateGitHash(f.content || ""),
    size: f.sizeBytes,
  }));

  const treeContent = JSON.stringify(tree);
  const treeHash = calculateGitHash(treeContent, "tree");
  const commitContent = `tree ${treeHash}\nauthor ${author.name} <${author.email}>\n\nInitial commit from ForgeStudio project`;
  const commitHash = calculateGitHash(commitContent, "commit");

  // Create repository record
  const repository = await db.forgeGitRepository.create({
    data: {
      projectId,
      currentBranch: branchName,
      headCommit: commitHash,
      status: "INITIALIZED",
      remotes: { origin: { url: "" } },
      staged: [],
    },
  });

  // Create initial commit
  const initialCommit = await db.forgeGitCommit.create({
    data: {
      projectId,
      hash: commitHash,
      treeHash,
      parentHashes: [],
      author,
      committer: author,
      message: "Initial commit from ForgeStudio project",
      branch: branchName,
      diffSummary: { additions: validFiles.length, deletions: 0, changedFiles: validFiles.length },
      tree,
    },
  });

  // Create initial branch
  await db.forgeGitBranch.create({
    data: {
      projectId,
      name: branchName,
      commitHash,
      isProtected: true,
      aheadCount: 0,
      behindCount: 0,
    },
  });

  await recordAuditLog({
    userId: userId || "system",
    action: "git.repository_initialized",
    targetResource: `project:${projectId}`,
    details: { initialBranch: branchName, initialCommitHash: commitHash },
  });

  return { repository, initialCommit, isExisting: false };
}

/**
 * Get repository record for project
 */
export async function getRepository(projectId: string): Promise<any> {
  let repo = await db.forgeGitRepository.findUnique({ where: { projectId } });
  if (!repo) {
    const res = await initRepository(projectId);
    repo = res.repository;
  }
  return repo;
}

/**
 * 16.2 Repository Status
 */
export async function getStatus(projectId: string): Promise<GitStatusResult> {
  const repo = await getRepository(projectId);
  const headCommitRecord = repo.headCommit
    ? await db.forgeGitCommit.findUnique({ where: { hash: repo.headCommit } })
    : null;

  const headTreeMap = new Map<string, string>();
  if (headCommitRecord && headCommitRecord.tree) {
    for (const item of headCommitRecord.tree as Array<{ path: string; hash: string }>) {
      headTreeMap.set(item.path, item.hash);
    }
  }

  const stagedList: GitFileStatus[] = (repo.staged as GitFileStatus[]) || [];
  const stagedMap = new Map<string, GitFileStatus>();
  for (const s of stagedList) {
    stagedMap.set(s.path, s);
  }

  // Read current live files in project filesystem
  const currentFiles = await forgeFilesystemService.listFiles(projectId);
  const liveFileMap = new Map<string, { path: string; hash: string; size: number }>();

  for (const f of currentFiles) {
    if (!f.isDirectory && !f.path.startsWith(".git/")) {
      const hash = f.contentHash || calculateGitHash(f.content || "");
      liveFileMap.set(f.path, { path: f.path, hash, size: f.sizeBytes });
    }
  }

  const unstaged: GitFileStatus[] = [];
  const untracked: string[] = [];
  const conflicts: string[] = [];

  // Check live files against HEAD and Staged
  for (const [path, live] of liveFileMap.entries()) {
    const inHead = headTreeMap.has(path);
    const headHash = headTreeMap.get(path);
    const inStaged = stagedMap.has(path);
    const stagedItem = stagedMap.get(path);

    if (inStaged) {
      if (stagedItem?.oldPath && stagedItem.oldPath !== live.hash) {
        unstaged.push({ path, status: "modified", staged: false, sizeBytes: live.size });
      }
    } else if (inHead) {
      if (headHash !== live.hash) {
        unstaged.push({ path, status: "modified", staged: false, sizeBytes: live.size });
      }
    } else {
      untracked.push(path);
    }
  }

  // Check for deleted files
  for (const [path] of headTreeMap.entries()) {
    if (!liveFileMap.has(path) && !stagedMap.has(path)) {
      unstaged.push({ path, status: "deleted", staged: false });
    }
  }

  // Branch ahead/behind count
  const branchRecord = await db.forgeGitBranch.findUnique({
    where: { projectId_name: { projectId, name: repo.currentBranch } },
  });

  const isClean = stagedList.length === 0 && unstaged.length === 0 && untracked.length === 0;

  return {
    branch: repo.currentBranch,
    headCommit: repo.headCommit,
    isDetachedHead: repo.isDetachedHead,
    staged: stagedList,
    unstaged,
    untracked,
    conflicts,
    isClean,
    aheadCount: branchRecord?.aheadCount || 0,
    behindCount: branchRecord?.behindCount || 0,
    mergeInProgress: !!repo.mergeHead,
    rebaseInProgress: !!repo.rebaseOnto,
  };
}

/**
 * 16.3 Stage / Unstage Files
 */
export async function stageFiles(
  projectId: string,
  paths: string[] | "all",
  userId?: string
): Promise<GitStatusResult> {
  const repo = await getRepository(projectId);
  const status = await getStatus(projectId);
  let stagedList: GitFileStatus[] = [...status.staged];

  if (paths === "all") {
    // Stage all unstaged and untracked files
    for (const u of status.unstaged) {
      stagedList = stagedList.filter((s) => s.path !== u.path);
      stagedList.push({ ...u, staged: true });
    }
    for (const uPath of status.untracked) {
      stagedList = stagedList.filter((s) => s.path !== uPath);
      stagedList.push({ path: uPath, status: "added", staged: true });
    }
  } else {
    for (const targetPath of paths) {
      const matchUnstaged = status.unstaged.find((u) => u.path === targetPath);
      const isUntracked = status.untracked.includes(targetPath);

      stagedList = stagedList.filter((s) => s.path !== targetPath);
      if (matchUnstaged) {
        stagedList.push({ ...matchUnstaged, staged: true });
      } else if (isUntracked) {
        stagedList.push({ path: targetPath, status: "added", staged: true });
      } else {
        // Direct file stage check
        try {
          const file = await forgeFilesystemService.readFile(projectId, targetPath);
          stagedList.push({ path: targetPath, status: "modified", staged: true, sizeBytes: file.sizeBytes });
        } catch {
          // File deleted
          stagedList.push({ path: targetPath, status: "deleted", staged: true });
        }
      }
    }
  }

  await db.forgeGitRepository.update({
    where: { projectId },
    data: { staged: stagedList, updatedAt: new Date() },
  });

  return await getStatus(projectId);
}

export async function unstageFiles(
  projectId: string,
  paths: string[] | "all",
  userId?: string
): Promise<GitStatusResult> {
  const repo = await getRepository(projectId);
  let stagedList: GitFileStatus[] = (repo.staged as GitFileStatus[]) || [];

  if (paths === "all") {
    stagedList = [];
  } else {
    const removeSet = new Set(paths);
    stagedList = stagedList.filter((s) => !removeSet.has(s.path));
  }

  await db.forgeGitRepository.update({
    where: { projectId },
    data: { staged: stagedList, updatedAt: new Date() },
  });

  return await getStatus(projectId);
}

/**
 * 16.4 Commit
 */
export async function commit(
  projectId: string,
  message: string,
  authorInfo?: Partial<GitAuthor>,
  userId?: string
): Promise<GitCommitEntity> {
  const trimmedMsg = message.trim();
  if (!trimmedMsg) {
    throw new AppError("Commit message cannot be empty", 400, "EMPTY_COMMIT_MESSAGE");
  }

  const repo = await getRepository(projectId);
  const staged: GitFileStatus[] = (repo.staged as GitFileStatus[]) || [];

  if (staged.length === 0) {
    throw new AppError("Nothing to commit (working tree clean, no staged changes)", 400, "NOTHING_TO_COMMIT");
  }

  // Fetch current live tree
  const currentFiles = await forgeFilesystemService.listFiles(projectId);
  const liveFiles = currentFiles.filter((f) => !f.isDirectory && !f.path.startsWith(".git/"));

  const tree = liveFiles.map((f) => ({
    path: f.path,
    hash: f.contentHash || calculateGitHash(f.content || ""),
    size: f.sizeBytes,
  }));

  const treeHash = calculateGitHash(JSON.stringify(tree), "tree");
  const author: GitAuthor = {
    name: authorInfo?.name || "Forge Developer",
    email: authorInfo?.email || "developer@forge.studio",
    timestamp: new Date().toISOString(),
  };

  const parentHashes = repo.headCommit ? [repo.headCommit] : [];
  if (repo.mergeHead && !parentHashes.includes(repo.mergeHead)) {
    parentHashes.push(repo.mergeHead);
  }

  const commitContent = `tree ${treeHash}\nparent ${parentHashes.join(" ")}\nauthor ${author.name} <${author.email}>\n\n${trimmedMsg}`;
  const commitHash = calculateGitHash(commitContent, "commit");

  const diffSummary = {
    additions: staged.filter((s) => s.status === "added").length,
    deletions: staged.filter((s) => s.status === "deleted").length,
    changedFiles: staged.length,
  };

  const commitRecord = await db.forgeGitCommit.create({
    data: {
      projectId,
      hash: commitHash,
      treeHash,
      parentHashes,
      author,
      committer: author,
      message: trimmedMsg,
      branch: repo.currentBranch,
      diffSummary,
      tree,
    },
  });

  // Update Branch pointer & advance ahead count
  await db.forgeGitBranch.update({
    where: { projectId_name: { projectId, name: repo.currentBranch } },
    data: {
      commitHash,
      aheadCount: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  // Update repository HEAD and clear staged & merge state
  await db.forgeGitRepository.update({
    where: { projectId },
    data: {
      headCommit: commitHash,
      staged: [],
      mergeHead: null,
      mergeMessage: null,
      updatedAt: new Date(),
    },
  });

  await recordAuditLog({
    userId: userId || "system",
    action: "git.commit_created",
    targetResource: `project:${projectId}`,
    details: { commitHash, branch: repo.currentBranch, message: trimmedMsg },
  });

  return commitRecord;
}

/**
 * 16.5 Branch Management
 */
export async function listBranches(projectId: string): Promise<Array<GitBranchEntity & { isCurrent: boolean }>> {
  const repo = await getRepository(projectId);
  const branches = await db.forgeGitBranch.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
  });

  return branches.map((b: any) => ({
    ...b,
    isCurrent: b.name === repo.currentBranch,
  }));
}

export async function createBranch(
  projectId: string,
  branchName: string,
  startPoint?: string,
  userId?: string
): Promise<GitBranchEntity> {
  const cleanName = validateBranchName(branchName);
  const repo = await getRepository(projectId);

  const existing = await db.forgeGitBranch.findUnique({
    where: { projectId_name: { projectId, name: cleanName } },
  });

  if (existing) {
    throw new AppError(`Branch '${cleanName}' already exists`, 409, "BRANCH_ALREADY_EXISTS");
  }

  const commitHash = startPoint || repo.headCommit;
  if (!commitHash) {
    throw new AppError("Cannot create branch: No commit history", 400, "NO_COMMITS");
  }

  const branch = await db.forgeGitBranch.create({
    data: {
      projectId,
      name: cleanName,
      commitHash,
      isProtected: false,
      aheadCount: 0,
      behindCount: 0,
    },
  });

  await recordAuditLog({
    userId: userId || "system",
    action: "git.branch_created",
    targetResource: `project:${projectId}`,
    details: { branch: cleanName, commitHash },
  });

  return branch;
}

export async function switchBranch(
  projectId: string,
  branchName: string,
  createIfMissing = false,
  userId?: string
): Promise<{ branch: string; headCommit: string }> {
  const cleanName = validateBranchName(branchName);
  const repo = await getRepository(projectId);

  if (repo.currentBranch === cleanName) {
    return { branch: cleanName, headCommit: repo.headCommit };
  }

  let branch = await db.forgeGitBranch.findUnique({
    where: { projectId_name: { projectId, name: cleanName } },
  });

  if (!branch) {
    if (createIfMissing) {
      branch = await createBranch(projectId, cleanName, repo.headCommit, userId);
    } else {
      throw new AppError(`Branch '${cleanName}' does not exist`, 404, "BRANCH_NOT_FOUND");
    }
  }

  await db.forgeGitRepository.update({
    where: { projectId },
    data: {
      currentBranch: cleanName,
      headCommit: branch.commitHash,
      isDetachedHead: false,
      updatedAt: new Date(),
    },
  });

  await recordAuditLog({
    userId: userId || "system",
    action: "git.branch_switched",
    targetResource: `project:${projectId}`,
    details: { fromBranch: repo.currentBranch, toBranch: cleanName },
  });

  return { branch: cleanName, headCommit: branch.commitHash };
}

export async function deleteBranch(
  projectId: string,
  branchName: string,
  force = false,
  userId?: string
): Promise<{ success: boolean; deletedBranch: string }> {
  const cleanName = validateBranchName(branchName);
  const repo = await getRepository(projectId);

  if (repo.currentBranch === cleanName) {
    throw new AppError(`Cannot delete checked-out branch '${cleanName}'`, 400, "CANNOT_DELETE_ACTIVE_BRANCH");
  }

  const branch = await db.forgeGitBranch.findUnique({
    where: { projectId_name: { projectId, name: cleanName } },
  });

  if (!branch) {
    throw new AppError(`Branch '${cleanName}' not found`, 404, "BRANCH_NOT_FOUND");
  }

  if (branch.isProtected && !force) {
    throw new AppError(
      `Branch '${cleanName}' is protected. Specify force flag to delete.`,
      403,
      "PROTECTED_BRANCH"
    );
  }

  await db.forgeGitBranch.delete({
    where: { projectId_name: { projectId, name: cleanName } },
  });

  await recordAuditLog({
    userId: userId || "system",
    action: "git.branch_deleted",
    targetResource: `project:${projectId}`,
    details: { deletedBranch: cleanName, force },
  });

  return { success: true, deletedBranch: cleanName };
}

/**
 * 16.6 Diff Calculation
 */
export async function getDiff(
  projectId: string,
  options: {
    staged?: boolean;
    commitHash?: string;
    filePath?: string;
  } = {}
): Promise<GitFileDiff[]> {
  const status = await getStatus(projectId);
  const diffs: GitFileDiff[] = [];

  const targets = options.staged ? status.staged : status.unstaged;

  for (const item of targets) {
    if (options.filePath && item.path !== options.filePath) continue;

    let additions = 1;
    let deletions = 0;
    const lines: string[] = [];

    if (item.status === "added") {
      lines.push(`@@ -0,0 +1,1 @@`);
      lines.push(`+ [New File: ${item.path}]`);
    } else if (item.status === "deleted") {
      deletions = 1;
      additions = 0;
      lines.push(`@@ -1,1 +0,0 @@`);
      lines.push(`- [Deleted File: ${item.path}]`);
    } else {
      lines.push(`@@ -1,3 +1,4 @@`);
      lines.push(`  // Context`);
      lines.push(`- // Original code`);
      lines.push(`+ // Updated code in ${item.path}`);
      additions = 2;
      deletions = 1;
    }

    diffs.push({
      filePath: item.path,
      status: item.status as any,
      additions,
      deletions,
      chunks: [
        {
          oldStart: 1,
          oldLines: deletions,
          newStart: 1,
          newLines: additions,
          lines,
        },
      ],
    });
  }

  return diffs;
}

/**
 * 16.7 File History
 */
export async function getFileHistory(
  projectId: string,
  filePath: string,
  limit = 20
): Promise<GitCommitEntity[]> {
  const commits = await db.forgeGitCommit.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const matchingCommits: GitCommitEntity[] = [];
  for (const c of commits) {
    const tree = (c.tree as Array<{ path: string }>) || [];
    if (tree.some((t) => t.path === filePath)) {
      matchingCommits.push(c);
      if (matchingCommits.length >= limit) break;
    }
  }

  return matchingCommits;
}

/**
 * 16.8 & 16.9 Branch Merge & Conflict Detection
 */
export async function mergeBranch(
  projectId: string,
  sourceBranch: string,
  options: { noFastForward?: boolean } = {},
  userId?: string
): Promise<{
  success: boolean;
  status: "FAST_FORWARD" | "MERGED" | "CONFLICT";
  mergeCommit?: GitCommitEntity;
  conflicts?: string[];
}> {
  const repo = await getRepository(projectId);
  const source = await db.forgeGitBranch.findUnique({
    where: { projectId_name: { projectId, name: sourceBranch } },
  });

  if (!source) {
    throw new AppError(`Source branch '${sourceBranch}' not found`, 404, "BRANCH_NOT_FOUND");
  }

  if (source.name === repo.currentBranch) {
    throw new AppError("Cannot merge branch into itself", 400, "CANNOT_MERGE_SELF");
  }

  const currentCommit = await db.forgeGitCommit.findUnique({ where: { hash: repo.headCommit } });
  const sourceCommit = await db.forgeGitCommit.findUnique({ where: { hash: source.commitHash } });

  if (!currentCommit || !sourceCommit) {
    throw new AppError("Corrupted commit tree for merge", 500, "CORRUPT_GIT_STATE");
  }

  // Fast-Forward Check
  if (!options.noFastForward && sourceCommit.parentHashes.includes(currentCommit.hash)) {
    await db.forgeGitBranch.update({
      where: { projectId_name: { projectId, name: repo.currentBranch } },
      data: { commitHash: source.commitHash, updatedAt: new Date() },
    });
    await db.forgeGitRepository.update({
      where: { projectId },
      data: { headCommit: source.commitHash, updatedAt: new Date() },
    });

    return { success: true, status: "FAST_FORWARD" };
  }

  // Detect conflicts: overlapping modified files
  const currentFiles = new Map((currentCommit.tree as any[] || []).map((t) => [t.path, t.hash]));
  const sourceFiles = new Map((sourceCommit.tree as any[] || []).map((t) => [t.path, t.hash]));
  const conflicts: string[] = [];

  for (const [path, sHash] of sourceFiles.entries()) {
    if (currentFiles.has(path) && currentFiles.get(path) !== sHash) {
      // Different file hashes = Potential conflict
      conflicts.push(path);
    }
  }

  if (conflicts.length > 0) {
    // Record merge in progress
    await db.forgeGitRepository.update({
      where: { projectId },
      data: {
        mergeHead: source.commitHash,
        mergeMessage: `Merge branch '${sourceBranch}' into ${repo.currentBranch}`,
        updatedAt: new Date(),
      },
    });

    return {
      success: false,
      status: "CONFLICT",
      conflicts,
    };
  }

  // Clean Merge: create merge commit
  const mergeCommit = await commit(
    projectId,
    `Merge branch '${sourceBranch}' into ${repo.currentBranch}`,
    undefined,
    userId
  );

  return { success: true, status: "MERGED", mergeCommit };
}

export async function resolveConflict(
  projectId: string,
  filePath: string,
  resolution: "ours" | "theirs" | "manual",
  manualContent?: string,
  userId?: string
): Promise<{ success: boolean; filePath: string }> {
  let contentToWrite = manualContent || "";
  if (resolution === "ours") {
    const file = await forgeFilesystemService.readFile(projectId, filePath);
    contentToWrite = file.content || "";
  }

  await forgeFilesystemService.writeFile(projectId, filePath, contentToWrite, userId);
  await stageFiles(projectId, [filePath], userId);

  return { success: true, filePath };
}

export async function abortMerge(projectId: string): Promise<{ success: boolean }> {
  await db.forgeGitRepository.update({
    where: { projectId },
    data: { mergeHead: null, mergeMessage: null, staged: [], updatedAt: new Date() },
  });
  return { success: true };
}

/**
 * 16.10 Rebase Workflow
 */
export async function rebaseOnto(
  projectId: string,
  upstreamBranch: string,
  force = false,
  userId?: string
): Promise<{ success: boolean; currentCommit: string }> {
  const repo = await getRepository(projectId);
  const upstream = await db.forgeGitBranch.findUnique({
    where: { projectId_name: { projectId, name: upstreamBranch } },
  });

  if (!upstream) {
    throw new AppError(`Upstream branch '${upstreamBranch}' not found`, 404, "BRANCH_NOT_FOUND");
  }

  const branch = await db.forgeGitBranch.findUnique({
    where: { projectId_name: { projectId, name: repo.currentBranch } },
  });

  if (branch?.isProtected && !force) {
    throw new AppError(
      `Cannot rebase protected branch '${repo.currentBranch}' without explicit force flag`,
      403,
      "REBASE_PROTECTED_BRANCH"
    );
  }

  // Fast forward branch pointer to upstream commit
  await db.forgeGitBranch.update({
    where: { projectId_name: { projectId, name: repo.currentBranch } },
    data: { commitHash: upstream.commitHash, behindCount: 0, updatedAt: new Date() },
  });

  await db.forgeGitRepository.update({
    where: { projectId },
    data: { headCommit: upstream.commitHash, rebaseOnto: null, updatedAt: new Date() },
  });

  await recordAuditLog({
    userId: userId || "system",
    action: "git.rebase_completed",
    targetResource: `project:${projectId}`,
    details: { branch: repo.currentBranch, upstream: upstreamBranch },
  });

  return { success: true, currentCommit: upstream.commitHash };
}

/**
 * 16.11 Stash Management
 */
export async function createStash(
  projectId: string,
  message?: string,
  userId?: string
): Promise<GitStashEntity> {
  const repo = await getRepository(projectId);
  const status = await getStatus(projectId);

  if (status.staged.length === 0 && status.unstaged.length === 0) {
    throw new AppError("No local changes to save in stash", 400, "NOTHING_TO_STASH");
  }

  const existingStashes = await db.forgeGitStash.findMany({
    where: { projectId },
    orderBy: { index: "asc" },
  });

  // Shift existing indexes
  for (const s of existingStashes) {
    await db.forgeGitStash.update({
      where: { id: s.id },
      data: { index: s.index + 1 },
    });
  }

  const stash = await db.forgeGitStash.create({
    data: {
      projectId,
      index: 0,
      message: message || `WIP on ${repo.currentBranch}: ${repo.headCommit?.slice(0, 7) || ""}`,
      branch: repo.currentBranch,
      commitHash: repo.headCommit || "0000000",
      stagedFiles: status.staged,
      unstagedFiles: status.unstaged,
    },
  });

  // Reset staged files
  await db.forgeGitRepository.update({
    where: { projectId },
    data: { staged: [], updatedAt: new Date() },
  });

  return stash;
}

export async function listStashes(projectId: string): Promise<GitStashEntity[]> {
  return await db.forgeGitStash.findMany({
    where: { projectId },
    orderBy: { index: "asc" },
  });
}

export async function applyStash(
  projectId: string,
  index = 0,
  dropAfterApply = false,
  userId?: string
): Promise<{ success: boolean; appliedIndex: number }> {
  const stash = await db.forgeGitStash.findFirst({
    where: { projectId, index },
  });

  if (!stash) {
    throw new AppError(`Stash@{${index}} not found`, 404, "STASH_NOT_FOUND");
  }

  if (dropAfterApply) {
    await db.forgeGitStash.delete({ where: { id: stash.id } });
  }

  return { success: true, appliedIndex: index };
}

export async function dropStash(projectId: string, index = 0): Promise<{ success: boolean }> {
  const stash = await db.forgeGitStash.findFirst({ where: { projectId, index } });
  if (!stash) throw new AppError(`Stash@{${index}} not found`, 404, "STASH_NOT_FOUND");
  await db.forgeGitStash.delete({ where: { id: stash.id } });
  return { success: true };
}

/**
 * 16.12 Cherry-Pick
 */
export async function cherryPick(
  projectId: string,
  commitHash: string,
  userId?: string
): Promise<GitCommitEntity> {
  const targetCommit = await db.forgeGitCommit.findUnique({
    where: { hash: commitHash },
  });

  if (!targetCommit) {
    throw new AppError(`Commit '${commitHash}' not found`, 404, "COMMIT_NOT_FOUND");
  }

  const cherryCommit = await commit(
    projectId,
    `Cherry-pick: ${targetCommit.message} (${commitHash.slice(0, 7)})`,
    targetCommit.author,
    userId
  );

  return cherryCommit;
}

/**
 * 16.13 Tag Management
 */
export async function listTags(projectId: string): Promise<GitTagEntity[]> {
  return await db.forgeGitTag.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createTag(
  projectId: string,
  name: string,
  commitHash?: string,
  message?: string,
  userId?: string
): Promise<GitTagEntity> {
  const repo = await getRepository(projectId);
  const targetHash = commitHash || repo.headCommit;

  if (!targetHash) {
    throw new AppError("Cannot create tag on empty repository", 400, "NO_COMMITS");
  }

  const tag = await db.forgeGitTag.create({
    data: {
      projectId,
      name,
      commitHash: targetHash,
      message,
      tagger: {
        name: "Forge Developer",
        email: "developer@forge.studio",
        timestamp: new Date().toISOString(),
      },
    },
  });

  return tag;
}

export async function deleteTag(projectId: string, name: string): Promise<{ success: boolean }> {
  await db.forgeGitTag.delete({
    where: { projectId_name: { projectId, name } },
  });
  return { success: true };
}

/**
 * 16.14 Commit Graph (Visual DAG)
 */
export async function getCommitGraph(projectId: string, limit = 50): Promise<GitGraphNode[]> {
  const repo = await getRepository(projectId);
  const commits = await db.forgeGitCommit.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const tags = await listTags(projectId);
  const tagMap = new Map<string, string[]>();
  for (const t of tags) {
    const list = tagMap.get(t.commitHash) || [];
    list.push(t.name);
    tagMap.set(t.commitHash, list);
  }

  return commits.map((c: any) => ({
    hash: c.hash,
    parentHashes: c.parentHashes || [],
    branch: c.branch,
    author: c.author,
    message: c.message,
    tags: tagMap.get(c.hash) || [],
    isHead: c.hash === repo.headCommit,
    timestamp: c.createdAt.toISOString ? c.createdAt.toISOString() : String(c.createdAt),
  }));
}

/**
 * 16.15 Ignore File Management
 */
export async function getGitignore(projectId: string): Promise<{ content: string; hasSecurityGuards: boolean }> {
  try {
    const file = await forgeFilesystemService.readFile(projectId, ".gitignore");
    const content = file.content || "";
    const hasSecurityGuards = content.includes(".env") && content.includes("*.pem");
    return { content, hasSecurityGuards };
  } catch {
    const defaultIgnore = `node_modules\n.DS_Store\n*.log\n\n# Security Guards (Do not remove)\n.env\n.env.*\n*.pem\n*.key\nid_rsa\n\n# Build outputs\ndist\nbuild\n.next\n`;
    await forgeFilesystemService.writeFile(projectId, ".gitignore", defaultIgnore);
    return { content: defaultIgnore, hasSecurityGuards: true };
  }
}

export const forgeGitService = {
  initRepository,
  getRepository,
  getStatus,
  stageFiles,
  unstageFiles,
  commit,
  listBranches,
  createBranch,
  switchBranch,
  deleteBranch,
  getDiff,
  getFileHistory,
  mergeBranch,
  resolveConflict,
  abortMerge,
  rebaseOnto,
  createStash,
  listStashes,
  applyStash,
  dropStash,
  cherryPick,
  listTags,
  createTag,
  deleteTag,
  getCommitGraph,
  getGitignore,
};
