/**
 * ForgeStudio Module 35: Code Intelligence & Semantic Index Service
 * Production-grade repository code intelligence engine with incremental indexing,
 * cross-file symbol resolution, definition lookup, and reference tracking.
 */

import path from "node:path";
import { pgPool } from "../../config/prisma.js";
import { forgeFilesystemService } from "../../services/project/forgeFilesystem.service.js";
import { AppError } from "../../utils/app-error.js";
import { extractSymbolsFromSource } from "./astSymbolExtractor.js";
import type {
  CodeSymbolEntity,
  CodeReferenceEntity,
  FileDependencyEntity,
  IndexStatusEntity,
  DefinitionResult,
  ReferencesResult,
  FileDependencyLookupResult,
  CodeSymbolKind,
} from "./codeIntelligence.types.js";

const SUPPORTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

/**
 * Resolve relative import specifier to matching project file path
 */
function resolveImportPath(currentFilePath: string, specifier: string, projectPaths: Set<string>): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    return null; // External package
  }

  const currentDir = path.posix.dirname(currentFilePath);
  const rawTarget = path.posix.normalize(path.posix.join(currentDir, specifier));

  // 1. Direct match
  if (projectPaths.has(rawTarget)) return rawTarget;

  // 2. Try extensions
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".d.ts"];
  for (const ext of extensions) {
    const candidate = `${rawTarget}${ext}`;
    if (projectPaths.has(candidate)) return candidate;
  }

  // 3. Try index files
  for (const ext of extensions) {
    const candidate = `${rawTarget}/index${ext}`;
    if (projectPaths.has(candidate)) return candidate;
  }

  return null;
}

export class CodeIntelligenceService {
  /**
   * Run full or incremental index for a project
   */
  async indexProject(
    projectId: string,
    options: { forceReindex?: boolean; filePaths?: string[] } = {}
  ): Promise<IndexStatusEntity> {
    const startTime = Date.now();

    // Set status to INDEXING
    await pgPool.query(
      `INSERT INTO forge_index_status ("projectId", status, "updatedAt")
       VALUES ($1, 'INDEXING', NOW())
       ON CONFLICT ("projectId") DO UPDATE SET status = 'INDEXING', "updatedAt" = NOW()`,
      [projectId]
    );

    // Retrieve active files from forge_project_files
    const files = await forgeFilesystemService.listFiles(projectId);
    const codeFiles = files.filter((f) => {
      const ext = path.posix.extname(f.path).toLowerCase();
      return SUPPORTED_EXTENSIONS.has(ext);
    });

    const projectPathSet = new Set(files.map((f) => f.path));

    // Get current index status
    const statusRow = await pgPool.query(
      `SELECT * FROM forge_index_status WHERE "projectId" = $1`,
      [projectId]
    );
    const existingHashes: Record<string, string> = statusRow.rows[0]?.fileHashes || {};

    const updatedHashes = { ...existingHashes };
    const parserErrors: Array<{ file: string; error: string }> = [];

    // Determine files to parse
    const filesToParse = codeFiles.filter((f) => {
      if (options.forceReindex) return true;
      if (options.filePaths && options.filePaths.includes(f.path)) return true;
      return existingHashes[f.path] !== f.contentHash;
    });

    // Parse each file
    for (const f of filesToParse) {
      try {
        const fileRecord = await forgeFilesystemService.readFile(projectId, f.path);
        const source = fileRecord.content || "";

        // Delete old symbols/references/dependencies for this file
        await pgPool.query(`DELETE FROM forge_code_symbols WHERE "fileId" = $1`, [f.id]);
        await pgPool.query(`DELETE FROM forge_code_references WHERE "sourceFileId" = $1`, [f.id]);
        await pgPool.query(`DELETE FROM forge_file_dependencies WHERE "sourceFileId" = $1`, [f.id]);

        const parseResult = extractSymbolsFromSource(f.path, source);
        if (parseResult.errors.length > 0) {
          for (const err of parseResult.errors) {
            parserErrors.push({ file: f.path, error: err });
          }
        }

        // Insert symbols
        for (const sym of parseResult.symbols) {
          await pgPool.query(
            `INSERT INTO forge_code_symbols (
              "projectId", "fileId", "filePath", name, kind, "containerName",
              "startLine", "startCol", "endLine", "endCol", "startOffset", "endOffset",
              signature, documentation, "isExported", "isDefaultExport", metadata
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
            )`,
            [
              projectId,
              f.id,
              f.path,
              sym.name,
              sym.kind,
              sym.containerName || null,
              sym.location.startLine,
              sym.location.startCol,
              sym.location.endLine,
              sym.location.endCol,
              sym.location.startOffset,
              sym.location.endOffset,
              sym.signature || null,
              sym.documentation || null,
              sym.isExported,
              sym.isDefaultExport,
              JSON.stringify(sym.metadata || {}),
            ]
          );
        }

        // Insert references
        for (const ref of parseResult.references) {
          await pgPool.query(
            `INSERT INTO forge_code_references (
              "projectId", "sourceFileId", "sourceFilePath", "symbolName",
              kind, line, col, snippet, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              projectId,
              f.id,
              f.path,
              ref.symbolName,
              ref.kind,
              ref.line,
              ref.col,
              ref.snippet || null,
              JSON.stringify(ref.metadata || {}),
            ]
          );
        }

        // Insert file dependencies
        for (const imp of parseResult.imports) {
          const resolvedPath = resolveImportPath(f.path, imp.specifier, projectPathSet);
          let targetFileId: string | null = null;
          if (resolvedPath) {
            const targetFile = files.find((file) => file.path === resolvedPath);
            targetFileId = targetFile?.id || null;
          }

          await pgPool.query(
            `INSERT INTO forge_file_dependencies (
              "projectId", "sourceFileId", "sourceFilePath", "targetFilePath",
              "targetFileId", specifier, "isExternal", "importedSymbols"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              projectId,
              f.id,
              f.path,
              resolvedPath || imp.specifier,
              targetFileId,
              imp.specifier,
              imp.isExternal,
              JSON.stringify(imp.namedImports),
            ]
          );
        }

        updatedHashes[f.path] = f.contentHash;
      } catch (err: any) {
        parserErrors.push({ file: f.path, error: err?.message || String(err) });
      }
    }

    // Link targetSymbolId on forge_code_references
    await pgPool.query(
      `UPDATE forge_code_references r
       SET "targetSymbolId" = s.id
       FROM forge_code_symbols s
       WHERE r."projectId" = $1
         AND s."projectId" = $1
         AND r."symbolName" = s.name
         AND r."targetSymbolId" IS NULL`,
      [projectId]
    );

    // Clean up deleted file hashes
    const currentPaths = new Set(codeFiles.map((f) => f.path));
    for (const p of Object.keys(updatedHashes)) {
      if (!currentPaths.has(p)) {
        delete updatedHashes[p];
      }
    }

    // Calculate totals
    const countRes = await pgPool.query(
      `SELECT COUNT(*)::int AS count FROM forge_code_symbols WHERE "projectId" = $1`,
      [projectId]
    );
    const totalSymbols = countRes.rows[0]?.count || 0;
    const durationMs = Date.now() - startTime;

    // Update index status record
    const updatedStatus = await pgPool.query(
      `INSERT INTO forge_index_status (
        "projectId", status, "totalFiles", "indexedFiles", "totalSymbols",
        "parserErrors", "fileHashes", "lastIndexedAt", "durationMs", "updatedAt"
      ) VALUES (
        $1, 'READY', $2, $3, $4, $5, $6, NOW(), $7, NOW()
      ) ON CONFLICT ("projectId") DO UPDATE SET
        status = 'READY',
        "totalFiles" = $2,
        "indexedFiles" = $3,
        "totalSymbols" = $4,
        "parserErrors" = $5,
        "fileHashes" = $6,
        "lastIndexedAt" = NOW(),
        "durationMs" = $7,
        "updatedAt" = NOW()
      RETURNING *`,
      [
        projectId,
        codeFiles.length,
        filesToParse.length,
        totalSymbols,
        JSON.stringify(parserErrors),
        JSON.stringify(updatedHashes),
        durationMs,
      ]
    );

    return updatedStatus.rows[0];
  }

  /**
   * Search indexed symbols in a project
   */
  async searchSymbols(
    projectId: string,
    query: string = "",
    filter: { kind?: CodeSymbolKind; fileId?: string; filePath?: string; limit?: number } = {}
  ): Promise<CodeSymbolEntity[]> {
    let sql = `SELECT * FROM forge_code_symbols WHERE "projectId" = $1`;
    const params: any[] = [projectId];
    let idx = 2;

    if (query.trim()) {
      sql += ` AND name ILIKE $${idx}`;
      params.push(`%${query.trim()}%`);
      idx++;
    }

    if (filter.kind) {
      sql += ` AND kind = $${idx}`;
      params.push(filter.kind);
      idx++;
    }

    if (filter.fileId) {
      sql += ` AND "fileId" = $${idx}`;
      params.push(filter.fileId);
      idx++;
    }

    if (filter.filePath) {
      sql += ` AND "filePath" = $${idx}`;
      params.push(filter.filePath);
      idx++;
    }

    sql += ` ORDER BY "isExported" DESC, name ASC LIMIT $${idx}`;
    params.push(filter.limit || 50);

    const res = await pgPool.query(sql, params);
    return res.rows;
  }

  /**
   * Find the definition of a symbol
   */
  async lookupDefinition(
    projectId: string,
    params: {
      filePath?: string;
      line?: number;
      character?: number;
      symbolName?: string;
    }
  ): Promise<DefinitionResult | null> {
    let targetName = params.symbolName?.trim();

    // If position is provided, find reference at that location
    if (params.filePath && params.line) {
      const refRes = await pgPool.query(
        `SELECT * FROM forge_code_references
         WHERE "projectId" = $1 AND "sourceFilePath" = $2 AND line = $3
         ORDER BY col ASC LIMIT 1`,
        [projectId, params.filePath, params.line]
      );
      if (refRes.rows.length > 0) {
        targetName = refRes.rows[0].symbolName;
      }
    }

    if (!targetName) {
      throw new AppError("Symbol name or valid source position required", 400, "INVALID_LOOKUP_PARAMS");
    }

    // Look up primary symbol definition in project
    const symRes = await pgPool.query(
      `SELECT s.*, f.id as file_id, f.path as file_path, f.name as file_name
       FROM forge_code_symbols s
       JOIN forge_project_files f ON s."fileId" = f.id
       WHERE s."projectId" = $1 AND s.name = $2
       ORDER BY s."isExported" DESC, s."createdAt" ASC LIMIT 1`,
      [projectId, targetName]
    );

    if (symRes.rows.length === 0) {
      return null;
    }

    const row = symRes.rows[0];
    return {
      symbol: {
        id: row.id,
        projectId: row.projectId,
        fileId: row.fileId,
        filePath: row.filePath,
        name: row.name,
        kind: row.kind,
        containerName: row.containerName,
        startLine: row.startLine,
        startCol: row.startCol,
        endLine: row.endLine,
        endCol: row.endCol,
        startOffset: row.startOffset,
        endOffset: row.endOffset,
        signature: row.signature,
        documentation: row.documentation,
        isExported: row.isExported,
        isDefaultExport: row.isDefaultExport,
        metadata: row.metadata || {},
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      file: {
        id: row.file_id,
        path: row.file_path,
        name: row.file_name,
      },
      location: {
        startLine: row.startLine,
        startCol: row.startCol,
        endLine: row.endLine,
        endCol: row.endCol,
        startOffset: row.startOffset,
        endOffset: row.endOffset,
      },
    };
  }

  /**
   * Find all references to a symbol across the project
   */
  async findReferences(
    projectId: string,
    params: {
      symbolName?: string;
      symbolId?: string;
      filePath?: string;
      line?: number;
    }
  ): Promise<ReferencesResult> {
    let symbolName = params.symbolName;
    let definition: CodeSymbolEntity | null = null;

    if (params.symbolId) {
      const defRes = await pgPool.query(
        `SELECT * FROM forge_code_symbols WHERE "projectId" = $1 AND id = $2`,
        [projectId, params.symbolId]
      );
      if (defRes.rows.length > 0) {
        definition = defRes.rows[0];
        symbolName = definition?.name;
      }
    } else if (params.filePath && params.line) {
      const defAtLoc = await this.lookupDefinition(projectId, {
        filePath: params.filePath,
        line: params.line,
      });
      if (defAtLoc) {
        definition = defAtLoc.symbol;
        symbolName = defAtLoc.symbol.name;
      }
    }

    if (!symbolName) {
      throw new AppError("Symbol identifier or name required", 400, "INVALID_REFERENCES_PARAM");
    }

    const refRows = await pgPool.query(
      `SELECT id, "sourceFilePath", "sourceFileId", line, col, kind, snippet
       FROM forge_code_references
       WHERE "projectId" = $1 AND "symbolName" = $2
       ORDER BY "sourceFilePath" ASC, line ASC`,
      [projectId, symbolName]
    );

    return {
      symbolName,
      definition,
      references: refRows.rows,
      totalCount: refRows.rows.length,
    };
  }

  /**
   * Lookup file dependencies and dependents
   */
  async getFileDependencies(projectId: string, fileIdOrPath: string): Promise<FileDependencyLookupResult> {
    let fileRow = await pgPool.query(
      `SELECT * FROM forge_project_files WHERE "projectId" = $1 AND (id::text = $2 OR path = $2) AND "deletedAt" IS NULL`,
      [projectId, fileIdOrPath]
    );

    if (fileRow.rows.length === 0) {
      throw new AppError("File not found in project", 404, "FILE_NOT_FOUND");
    }

    const file = fileRow.rows[0];

    // Outgoing dependencies
    const depsRes = await pgPool.query(
      `SELECT specifier, "targetFilePath", "isExternal", "importedSymbols"
       FROM forge_file_dependencies
       WHERE "projectId" = $1 AND "sourceFileId" = $2`,
      [projectId, file.id]
    );

    // Incoming dependents
    const dependentsRes = await pgPool.query(
      `SELECT "sourceFilePath", "sourceFileId", specifier
       FROM forge_file_dependencies
       WHERE "projectId" = $1 AND ("targetFileId" = $2 OR "targetFilePath" = $3)`,
      [projectId, file.id, file.path]
    );

    return {
      filePath: file.path,
      fileId: file.id,
      dependencies: depsRes.rows.map((r) => ({
        specifier: r.specifier,
        resolvedPath: r.targetFilePath,
        isExternal: r.isExternal,
        importedSymbols: r.importedSymbols || [],
      })),
      dependents: dependentsRes.rows,
    };
  }

  /**
   * Get current project indexing status
   */
  async getIndexStatus(projectId: string): Promise<IndexStatusEntity> {
    const res = await pgPool.query(
      `SELECT * FROM forge_index_status WHERE "projectId" = $1`,
      [projectId]
    );

    if (res.rows.length === 0) {
      return {
        id: "",
        projectId,
        status: "IDLE",
        totalFiles: 0,
        indexedFiles: 0,
        totalSymbols: 0,
        parserErrors: [],
        fileHashes: {},
        lastIndexedAt: null,
        durationMs: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return res.rows[0];
  }

  /**
   * Clean up symbols when a file is deleted
   */
  async cleanupDeletedFile(projectId: string, filePath: string): Promise<void> {
    await pgPool.query(
      `DELETE FROM forge_code_symbols WHERE "projectId" = $1 AND "filePath" = $2`,
      [projectId, filePath]
    );
    await pgPool.query(
      `DELETE FROM forge_code_references WHERE "projectId" = $1 AND "sourceFilePath" = $2`,
      [projectId, filePath]
    );
    await pgPool.query(
      `DELETE FROM forge_file_dependencies WHERE "projectId" = $1 AND "sourceFilePath" = $2`,
      [projectId, filePath]
    );
  }
}

export const codeIntelligenceService = new CodeIntelligenceService();
