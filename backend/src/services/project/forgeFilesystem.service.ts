import crypto from "node:crypto";
import path from "node:path";
import { prisma, pgPool } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { recordAuditLog } from "../audit.service.js";

const db = prisma as any;

export const MAX_TEXT_FILE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_BINARY_FILE_BYTES = 25 * 1024 * 1024; // 25MB

export const DEFAULT_IGNORED_PATTERNS = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".cache",
  ".DS_Store",
  "Thumbs.db",
];

export interface ProjectFileEntity {
  id: string;
  projectId: string;
  path: string;
  name: string;
  extension: string;
  mimeType: string;
  isDirectory: boolean;
  sizeBytes: number;
  content?: string | null;
  encoding: "utf-8" | "base64";
  contentHash: string;
  version: number;
  isGenerated: boolean;
  isProtected: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileTreeNode {
  id: string;
  path: string;
  name: string;
  extension: string;
  isDirectory: boolean;
  sizeBytes: number;
  version: number;
  isGenerated: boolean;
  isProtected: boolean;
  children?: FileTreeNode[];
}

export interface WriteFileOptions {
  content: string;
  encoding?: "utf-8" | "base64";
  expectedVersion?: number;
  isGenerated?: boolean;
  isProtected?: boolean;
  authorId?: string;
  reason?: string;
}

/**
 * Normalize and strictly validate path against directory traversal, absolute paths, and invalid characters.
 * Returns clean POSIX relative path, e.g. "src/components/Header.tsx".
 */
export function sanitizeAndNormalizePath(inputPath: string): string {
  if (!inputPath || typeof inputPath !== "string") {
    throw new AppError("File path is required", 400, "INVALID_PATH");
  }

  // Reject Windows drive letters, null bytes, backslashes normalization
  if (inputPath.includes("\0") || /^[a-zA-Z]:/.test(inputPath)) {
    throw new AppError("Invalid path characters detected", 400, "PATH_TRAVERSAL_DETECTED");
  }

  const forwardSlashes = inputPath.replace(/\\/g, "/");
  const normalized = path.posix.normalize(forwardSlashes).replace(/^\/+/, "");

  // Prevent path traversal
  if (normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new AppError("Path traversal is strictly prohibited", 403, "PATH_TRAVERSAL_DETECTED");
  }

  // Clean trailing slash for files, keep single string
  const cleaned = normalized.replace(/\/+$/, "");
  if (!cleaned) {
    throw new AppError("Path cannot be empty or root", 400, "INVALID_PATH");
  }

  return cleaned;
}

/**
 * Calculate SHA-256 hash of file content
 */
export function calculateContentHash(content: string, encoding: "utf-8" | "base64" = "utf-8"): string {
  return crypto.createHash("sha256").update(content, encoding).digest("hex");
}

/**
 * Determine MIME type based on file extension
 */
export function detectMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".ts": "application/typescript",
    ".tsx": "text/typescript-jsx",
    ".js": "application/javascript",
    ".jsx": "text/javascript-jsx",
    ".json": "application/json",
    ".css": "text/css",
    ".scss": "text/x-scss",
    ".html": "text/html",
    ".md": "text/markdown",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".env": "text/plain",
    ".txt": "text/plain",
  };
  return mimeMap[ext] || "text/plain";
}

/**
 * Check if a path matches any ignore pattern
 */
export function isPathIgnored(filePath: string, customPatterns: string[] = []): boolean {
  const patterns = [...DEFAULT_IGNORED_PATTERNS, ...customPatterns];
  const parts = filePath.split("/");
  return patterns.some((p) => parts.includes(p) || filePath.startsWith(p));
}

/**
 * Create or atomically update a file with revision tracking and optimistic concurrency
 */
export async function writeFile(
  projectId: string,
  filePath: string,
  contentOrOptions: string | WriteFileOptions,
  legacyOptions?: Partial<WriteFileOptions> | string
): Promise<ProjectFileEntity> {
  const options: WriteFileOptions =
    typeof contentOrOptions === "string"
      ? {
          content: contentOrOptions,
          ...(typeof legacyOptions === "object"
            ? legacyOptions
            : typeof legacyOptions === "string"
            ? { authorId: legacyOptions }
            : {}),
        }
      : contentOrOptions;

  const cleanPath = sanitizeAndNormalizePath(filePath);
  const name = path.posix.basename(cleanPath);
  const extension = path.posix.extname(cleanPath);
  const encoding = options.encoding || "utf-8";
  const content = options.content ?? "";
  const sizeBytes = Buffer.byteLength(content, encoding);

  // Validate file size limit
  const isBinary = encoding === "base64";
  const maxSize = isBinary ? MAX_BINARY_FILE_BYTES : MAX_TEXT_FILE_BYTES;
  if (sizeBytes > maxSize) {
    throw new AppError(
      `File exceeds maximum permitted size of ${maxSize / (1024 * 1024)}MB`,
      413,
      "FILE_TOO_LARGE"
    );
  }

  const mimeType = detectMimeType(cleanPath);
  const contentHash = calculateContentHash(content, encoding);

  // Find existing file record for this project
  const existing = await db.forgeProjectFile.findFirst({
    where: { projectId, path: cleanPath },
  });

  if (existing) {
    // Check if file is deleted
    if (existing.deletedAt) {
      // Re-create / un-delete file
      const updated = await db.forgeProjectFile.update({
        where: { id: existing.id },
        data: {
          content,
          encoding,
          sizeBytes,
          contentHash,
          mimeType,
          version: existing.version + 1,
          isGenerated: options.isGenerated ?? false,
          isProtected: options.isProtected ?? false,
          deletedAt: null,
        },
      });

      // Save revision
      await db.forgeProjectRevision.create({
        data: {
          fileId: existing.id,
          projectId,
          version: updated.version,
          content,
          contentHash,
          changeType: "RESTORE",
          authorId: options.authorId || null,
          reason: options.reason || "Re-created previously deleted file",
        },
      });

      return updated;
    }

    // Optimistic concurrency check: if caller passed expectedVersion, enforce it!
    if (options.expectedVersion !== undefined && existing.version !== options.expectedVersion) {
      throw new AppError(
        `Concurrency conflict: file '${cleanPath}' has been modified (expected v${options.expectedVersion}, current v${existing.version})`,
        409,
        "CONCURRENCY_CONFLICT"
      );
    }

    // Check protected regions: if file is protected and update is from visual generator, reject
    if (existing.isProtected && options.isGenerated) {
      throw new AppError(
        `File '${cleanPath}' is protected from automated overwrite. Manual edit required.`,
        403,
        "FILE_PROTECTED"
      );
    }

    // If content hash hasn't changed, return without unnecessary revision increment
    if (existing.contentHash === contentHash && existing.content === content) {
      return existing;
    }

    const nextVersion = existing.version + 1;
    const updated = await db.forgeProjectFile.update({
      where: { id: existing.id },
      data: {
        content,
        encoding,
        sizeBytes,
        contentHash,
        mimeType,
        version: nextVersion,
        isGenerated: options.isGenerated !== undefined ? options.isGenerated : existing.isGenerated,
        isProtected: options.isProtected !== undefined ? options.isProtected : existing.isProtected,
      },
    });

    // Create immutable audit revision
    await db.forgeProjectRevision.create({
      data: {
        fileId: existing.id,
        projectId,
        version: nextVersion,
        content,
        contentHash,
        changeType: "UPDATE",
        authorId: options.authorId || null,
        reason: options.reason || "File updated",
      },
    });

    return updated;
  }

  // Create new file
  const created = await db.forgeProjectFile.create({
    data: {
      projectId,
      path: cleanPath,
      name,
      extension,
      mimeType,
      isDirectory: false,
      sizeBytes,
      content,
      encoding,
      contentHash,
      version: 1,
      isGenerated: options.isGenerated || false,
      isProtected: options.isProtected || false,
    },
  });

  // Create initial revision
  await db.forgeProjectRevision.create({
    data: {
      fileId: created.id,
      projectId,
      version: 1,
      content,
      contentHash,
      changeType: "CREATE",
      authorId: options.authorId || null,
      reason: options.reason || "Initial file creation",
    },
  });

  return created;
}

/**
 * Read a file by path in project
 */
export async function readFile(
  projectId: string,
  filePath: string
): Promise<ProjectFileEntity> {
  const cleanPath = sanitizeAndNormalizePath(filePath);
  const file = await db.forgeProjectFile.findFirst({
    where: { projectId, path: cleanPath, deletedAt: null },
  });

  if (!file) {
    throw new AppError(`File '${cleanPath}' not found in project`, 404, "FILE_NOT_FOUND");
  }

  return file;
}

/**
 * Read a file by ID
 */
export async function readFileById(
  projectId: string,
  fileId: string
): Promise<ProjectFileEntity> {
  const file = await db.forgeProjectFile.findFirst({
    where: { id: fileId, projectId, deletedAt: null },
  });

  if (!file) {
    throw new AppError(`File not found`, 404, "FILE_NOT_FOUND");
  }

  return file;
}

/**
 * Delete a file (soft-delete with retention & revision record)
 */
export async function deleteFile(
  projectId: string,
  filePath: string,
  authorId?: string
): Promise<{ success: boolean; path: string }> {
  const cleanPath = sanitizeAndNormalizePath(filePath);
  const file = await db.forgeProjectFile.findFirst({
    where: { projectId, path: cleanPath, deletedAt: null },
  });

  if (!file) {
    throw new AppError(`File '${cleanPath}' not found`, 404, "FILE_NOT_FOUND");
  }

  await db.forgeProjectFile.update({
    where: { id: file.id },
    data: { deletedAt: new Date(), version: file.version + 1 },
  });

  await db.forgeProjectRevision.create({
    data: {
      fileId: file.id,
      projectId,
      version: file.version + 1,
      content: file.content || "",
      contentHash: file.contentHash,
      changeType: "DELETE",
      authorId: authorId || null,
      reason: "File deleted",
    },
  });

  return { success: true, path: cleanPath };
}

/**
 * Move or rename a file
 */
export async function moveOrRenameFile(
  projectId: string,
  sourcePath: string,
  destPath: string,
  authorId?: string
): Promise<ProjectFileEntity> {
  const cleanSrc = sanitizeAndNormalizePath(sourcePath);
  const cleanDest = sanitizeAndNormalizePath(destPath);

  if (cleanSrc === cleanDest) {
    return readFile(projectId, cleanSrc);
  }

  const file = await db.forgeProjectFile.findFirst({
    where: { projectId, path: cleanSrc, deletedAt: null },
  });

  if (!file) {
    throw new AppError(`Source file '${cleanSrc}' not found`, 404, "FILE_NOT_FOUND");
  }

  // Check destination does not conflict
  const conflict = await db.forgeProjectFile.findFirst({
    where: { projectId, path: cleanDest, deletedAt: null },
  });
  if (conflict) {
    throw new AppError(`Destination path '${cleanDest}' already exists`, 409, "DESTINATION_EXISTS");
  }

  const newName = path.posix.basename(cleanDest);
  const newExt = path.posix.extname(cleanDest);
  const newMime = detectMimeType(cleanDest);

  const updated = await db.forgeProjectFile.update({
    where: { id: file.id },
    data: {
      path: cleanDest,
      name: newName,
      extension: newExt,
      mimeType: newMime,
      version: file.version + 1,
    },
  });

  await db.forgeProjectRevision.create({
    data: {
      fileId: file.id,
      projectId,
      version: file.version + 1,
      content: file.content || "",
      contentHash: file.contentHash,
      changeType: "MOVE",
      authorId: authorId || null,
      reason: `Moved from '${cleanSrc}' to '${cleanDest}'`,
    },
  });

  return updated;
}

/**
 * Get full file tree for project (hierarchical directory representation)
 */
export async function getProjectFileTree(
  projectId: string,
  includeIgnored = false
): Promise<FileTreeNode[]> {
  const files: ProjectFileEntity[] = await db.forgeProjectFile.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { path: "asc" },
  });

  const rootNodes: FileTreeNode[] = [];
  const dirMap = new Map<string, FileTreeNode>();

  for (const f of files) {
    if (!includeIgnored && isPathIgnored(f.path)) continue;

    const parts = f.path.split("/");
    let currentPath = "";

    // Build intermediate folder nodes if they don't exist
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!dirMap.has(currentPath)) {
        const dirNode: FileTreeNode = {
          id: `dir_${currentPath}`,
          path: currentPath,
          name: part,
          extension: "",
          isDirectory: true,
          sizeBytes: 0,
          version: 1,
          isGenerated: false,
          isProtected: false,
          children: [],
        };
        dirMap.set(currentPath, dirNode);

        if (parentPath && dirMap.has(parentPath)) {
          dirMap.get(parentPath)!.children!.push(dirNode);
        } else {
          rootNodes.push(dirNode);
        }
      }
    }

    // Add file node
    const fileNode: FileTreeNode = {
      id: f.id,
      path: f.path,
      name: f.name,
      extension: f.extension,
      isDirectory: f.isDirectory,
      sizeBytes: f.sizeBytes,
      version: f.version,
      isGenerated: f.isGenerated,
      isProtected: f.isProtected,
    };

    const parentPath = parts.slice(0, -1).join("/");
    if (parentPath && dirMap.has(parentPath)) {
      dirMap.get(parentPath)!.children!.push(fileNode);
    } else {
      rootNodes.push(fileNode);
    }
  }

  // Sort directories first, then alphabetical
  function sortNodes(nodes: FileTreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) {
      if (n.children && n.children.length > 0) sortNodes(n.children);
    }
  }

  sortNodes(rootNodes);
  return rootNodes;
}

/**
 * List revisions for a file
 */
export async function getFileRevisions(
  projectId: string,
  fileId: string
): Promise<any[]> {
  return await db.forgeProjectRevision.findMany({
    where: { projectId, fileId },
    orderBy: { version: "desc" },
    include: {
      author: { select: { id: true, fullName: true, email: true } },
    },
  });
}

/**
 * Create a point-in-time snapshot of the entire project filesystem
 */
export async function createProjectSnapshot(
  projectId: string,
  name: string,
  description?: string,
  authorId?: string
): Promise<any> {
  const files: ProjectFileEntity[] = await db.forgeProjectFile.findMany({
    where: { projectId, deletedAt: null },
  });

  const totalBytes = files.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);
  const treeManifest = files.map((f) => ({
    id: f.id,
    path: f.path,
    version: f.version,
    contentHash: f.contentHash,
    sizeBytes: f.sizeBytes,
    isGenerated: f.isGenerated,
  }));

  const snapshot = await db.forgeProjectSnapshot.create({
    data: {
      projectId,
      name: name.trim(),
      description: description?.trim() || null,
      fileCount: files.length,
      totalBytes,
      treeManifest,
      createdById: authorId || null,
    },
  });

  await recordAuditLog({
    userId: authorId || "system",
    action: "project.snapshot_created",
    targetResource: `project:${projectId}`,
    details: { snapshotId: snapshot.id, name, fileCount: files.length },
  });

  return snapshot;
}

/**
 * List all snapshots for a project
 */
export async function listProjectSnapshots(projectId: string): Promise<any[]> {
  return await db.forgeProjectSnapshot.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * List all active files for a project
 */
export async function listFiles(projectId: string): Promise<ProjectFileEntity[]> {
  return await db.forgeProjectFile.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { path: "asc" },
  });
}

export const forgeFilesystemService = {
  writeFile,
  readFile,
  readFileById,
  listFiles,
  deleteFile,
  moveOrRenameFile,
  getProjectFileTree,
  getFileRevisions,
  createProjectSnapshot,
  listProjectSnapshots,
  sanitizeAndNormalizePath,
  calculateContentHash,
  detectMimeType,
};
