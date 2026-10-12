/**
 * ForgeStudio Execution Blueprint v2.1 — Point 06: Core Architecture and Six Authoritative Records
 * Record 3: Source Manifest & Source Ownership Protection
 *
 * Authority: Original custom files, imports, assets, licenses, hashes, and
 * explicit source ownership.
 *
 * Rules:
 * 1. Visual editing must never silently replace protected source-owned code.
 * 2. Generated files and original files must be explicitly distinguishable.
 * 3. Path traversal and unsafe file references are strictly rejected.
 * 4. Hashes are calculated from actual bytes (SHA-256), never trusted from client input.
 * 5. Uploads are never treated as trusted executable source.
 * 6. Manual code edits invalidate affected build evidence and release gates.
 * 7. Failed compilation or migration preserves the last working source snapshot.
 */

import crypto from "node:crypto";
import path from "node:path";
import { AppError } from "../../utils/app-error.js";
import { sanitizeAndNormalizePath } from "../project/forgeFilesystem.service.js";

export type SourceOwnership =
  | "VISUAL_OWNED"             // Generated and managed by visual canvas
  | "SOURCE_OWNED_PROTECTED"   // Written by developer; protected from visual overwrite
  | "GENERATED_COMPILER_OUTPUT"// Temporary build or bundle output
  | "THIRD_PARTY_ASSET";       // Media, vendor font, static library

export type SourceFileRole =
  | "PAGE_COMPONENT"
  | "SHARED_COMPONENT"
  | "STYLE_MODULE"
  | "CONFIG_MANIFEST"
  | "SERVER_FUNCTION"
  | "STATIC_ASSET"
  | "TEST_DEFINITION";

export interface SourceDependency {
  importPath: string;
  isExternal: boolean;
  resolvedFileId?: string;
}

export interface SourceFileRecord {
  fileId: string;
  path: string; // Clean POSIX relative path
  normalizedPath: string;
  name: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string; // SHA-256 of real bytes
  role: SourceFileRole;
  ownership: SourceOwnership;
  isProtected: boolean;
  version: number;
  license?: string;
  dependencies: SourceDependency[];
  protectedRegions?: Array<{
    name: string;
    startMarker: string;
    endMarker: string;
    content: string;
  }>;
  securityScan: {
    scannedAt: string;
    safe: boolean;
    issues: string[];
  };
  lastModifiedBy: string;
  updatedAt: string;
}

export interface SourceManifestSnapshot {
  manifestVersion: string;
  siteId: string;
  tenantId: string;
  revision: number;
  files: SourceFileRecord[];
  overallHash: string;
  totalSizeBytes: number;
  protectedFilesCount: number;
  visualFilesCount: number;
  updatedAt: string;
}

// In-memory registry for source manifests
const SOURCE_MANIFESTS = new Map<string, SourceManifestSnapshot>();

export class SourceManifestService {
  /**
   * Calculate SHA-256 hash from raw content bytes.
   */
  static hashBytes(content: string | Buffer): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  /**
   * Scan code content for security risks (e.g., eval, unsafe execution).
   */
  static scanCodeContent(code: string): { safe: boolean; issues: string[] } {
    const issues: string[] = [];

    if (/eval\s*\(/.test(code)) {
      issues.push("Prohibited use of eval() detected in source");
    }
    if (/child_process|execSync|spawnSync/.test(code)) {
      issues.push("Prohibited process execution import detected");
    }
    if (/__proto__|prototype\s*\[/.test(code)) {
      issues.push("Potential prototype pollution pattern detected");
    }

    return {
      safe: issues.length === 0,
      issues,
    };
  }

  /**
   * Register or update a source file with strict ownership enforcement.
   */
  static async registerSourceFile(
    siteId: string,
    tenantId: string,
    params: {
      path: string;
      content: string;
      ownership: SourceOwnership;
      role: SourceFileRole;
      isProtected?: boolean;
      license?: string;
      actorId: string;
    }
  ): Promise<SourceFileRecord> {
    const normalizedPath = sanitizeAndNormalizePath(params.path);
    const contentBytes = Buffer.from(params.content, "utf-8");
    const contentHash = this.hashBytes(contentBytes);
    const sizeBytes = contentBytes.length;

    const manifest = this.getOrCreateManifest(siteId, tenantId);
    const existingIndex = manifest.files.findIndex((f) => f.normalizedPath === normalizedPath);
    const existing = existingIndex >= 0 ? manifest.files[existingIndex] : null;

    // Protection Check: If existing file is SOURCE_OWNED_PROTECTED, reject visual overwrite
    if (existing && existing.ownership === "SOURCE_OWNED_PROTECTED" && params.ownership === "VISUAL_OWNED") {
      throw new AppError(
        `Source Preservation Violation: File "${normalizedPath}" is marked SOURCE_OWNED_PROTECTED. Visual edits cannot overwrite protected custom code.`,
        403,
        "PROTECTED_SOURCE_OVERWRITE_FORBIDDEN"
      );
    }

    const securityScan = this.scanCodeContent(params.content);
    if (!securityScan.safe) {
      throw new AppError(
        `Security Scan Failure for "${normalizedPath}": ${securityScan.issues.join("; ")}`,
        422,
        "SECURITY_SCAN_FAILED"
      );
    }

    const ext = path.extname(normalizedPath).toLowerCase();
    const isProtected = params.isProtected ?? params.ownership === "SOURCE_OWNED_PROTECTED";

    const record: SourceFileRecord = {
      fileId: existing ? existing.fileId : `file_${crypto.randomUUID()}`,
      path: normalizedPath,
      normalizedPath,
      name: path.basename(normalizedPath),
      extension: ext,
      mimeType: ext === ".tsx" ? "text/typescript-jsx" : ext === ".ts" ? "application/typescript" : "text/plain",
      sizeBytes,
      contentHash,
      role: params.role,
      ownership: params.ownership,
      isProtected,
      version: existing ? existing.version + 1 : 1,
      license: params.license || existing?.license,
      dependencies: this.extractDependencies(params.content),
      securityScan: {
        scannedAt: new Date().toISOString(),
        safe: securityScan.safe,
        issues: securityScan.issues,
      },
      lastModifiedBy: params.actorId,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      manifest.files[existingIndex] = record;
    } else {
      manifest.files.push(record);
    }

    manifest.revision += 1;
    manifest.updatedAt = new Date().toISOString();
    manifest.overallHash = this.computeManifestOverallHash(manifest.files);
    manifest.totalSizeBytes = manifest.files.reduce((sum, f) => sum + f.sizeBytes, 0);
    manifest.protectedFilesCount = manifest.files.filter((f) => f.isProtected).length;
    manifest.visualFilesCount = manifest.files.filter((f) => f.ownership === "VISUAL_OWNED").length;

    SOURCE_MANIFESTS.set(siteId, manifest);
    return record;
  }

  /**
   * Extract import statements from source file.
   */
  static extractDependencies(content: string): SourceDependency[] {
    const deps: SourceDependency[] = [];
    const importRegex = /import\s+.*?from\s+['"](.*?)['"]/g;
    let match: RegExpExecArray | null;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      const isExternal = !importPath.startsWith(".") && !importPath.startsWith("/");
      deps.push({
        importPath,
        isExternal,
      });
    }

    return deps;
  }

  /**
   * Compute overall deterministic SHA-256 hash for entire manifest fileset.
   */
  static computeManifestOverallHash(files: SourceFileRecord[]): string {
    const sorted = [...files].sort((a, b) => a.normalizedPath.localeCompare(b.normalizedPath));
    const raw = sorted.map((f) => `${f.normalizedPath}:${f.contentHash}:${f.ownership}`).join("|");
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  /**
   * Get or initialize source manifest snapshot for website.
   */
  static getOrCreateManifest(siteId: string, tenantId: string): SourceManifestSnapshot {
    let manifest = SOURCE_MANIFESTS.get(siteId);
    if (!manifest) {
      manifest = {
        manifestVersion: "1.0.0",
        siteId,
        tenantId,
        revision: 1,
        files: [],
        overallHash: crypto.createHash("sha256").update("empty").digest("hex"),
        totalSizeBytes: 0,
        protectedFilesCount: 0,
        visualFilesCount: 0,
        updatedAt: new Date().toISOString(),
      };
      SOURCE_MANIFESTS.set(siteId, manifest);
    }
    return manifest;
  }

  /**
   * Get active source manifest snapshot.
   */
  static getManifest(siteId: string): SourceManifestSnapshot | null {
    return SOURCE_MANIFESTS.get(siteId) || null;
  }

  /**
   * Clear in-memory manifests (for tests).
   */
  static clearMemory(): void {
    SOURCE_MANIFESTS.clear();
  }
}
