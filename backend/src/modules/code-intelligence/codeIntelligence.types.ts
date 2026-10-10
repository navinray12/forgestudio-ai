/**
 * ForgeStudio Module 35: Code Intelligence & Semantic Index Types
 */

export type CodeSymbolKind =
  | "FILE"
  | "MODULE"
  | "FUNCTION"
  | "CLASS"
  | "INTERFACE"
  | "TYPE_ALIAS"
  | "ENUM"
  | "VARIABLE"
  | "CONSTANT"
  | "METHOD"
  | "PROPERTY"
  | "IMPORT"
  | "EXPORT";

export type ReferenceKind =
  | "CALL"
  | "TYPE_REFERENCE"
  | "IMPORT"
  | "PROPERTY_ACCESS"
  | "HERITAGE_EXTENDS"
  | "HERITAGE_IMPLEMENTS";

export interface SymbolLocation {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  startOffset: number;
  endOffset: number;
}

export interface ExtractedSymbol {
  name: string;
  kind: CodeSymbolKind;
  containerName?: string;
  location: SymbolLocation;
  signature?: string;
  documentation?: string;
  isExported: boolean;
  isDefaultExport: boolean;
  metadata?: Record<string, any>;
}

export interface ExtractedReference {
  symbolName: string;
  kind: ReferenceKind;
  line: number;
  col: number;
  snippet?: string;
  metadata?: Record<string, any>;
}

export interface ExtractedImport {
  specifier: string;
  defaultImport?: string;
  namedImports: Array<{ name: string; alias?: string }>;
  namespaceImport?: string;
  line: number;
  isExternal: boolean;
}

export interface ExtractedExport {
  name: string;
  isDefault: boolean;
  isReExport: boolean;
  sourceSpecifier?: string;
  originalName?: string;
  line: number;
}

export interface FileParseResult {
  filePath: string;
  success: boolean;
  symbols: ExtractedSymbol[];
  references: ExtractedReference[];
  imports: ExtractedImport[];
  exports: ExtractedExport[];
  errors: string[];
}

export interface CodeSymbolEntity {
  id: string;
  projectId: string;
  fileId: string;
  filePath: string;
  name: string;
  kind: CodeSymbolKind;
  containerName?: string | null;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  startOffset: number;
  endOffset: number;
  signature?: string | null;
  documentation?: string | null;
  isExported: boolean;
  isDefaultExport: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CodeReferenceEntity {
  id: string;
  projectId: string;
  sourceFileId: string;
  sourceFilePath: string;
  targetSymbolId?: string | null;
  symbolName: string;
  kind: ReferenceKind;
  line: number;
  col: number;
  snippet?: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface FileDependencyEntity {
  id: string;
  projectId: string;
  sourceFileId: string;
  sourceFilePath: string;
  targetFilePath: string;
  targetFileId?: string | null;
  specifier: string;
  isExternal: boolean;
  importedSymbols: Array<{ name: string; alias?: string; isDefault?: boolean }>;
  createdAt: Date;
}

export interface IndexStatusEntity {
  id: string;
  projectId: string;
  status: "IDLE" | "INDEXING" | "READY" | "ERROR";
  totalFiles: number;
  indexedFiles: number;
  totalSymbols: number;
  parserErrors: Array<{ file: string; error: string }>;
  fileHashes: Record<string, string>;
  lastIndexedAt?: Date | null;
  durationMs: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DefinitionResult {
  symbol: CodeSymbolEntity;
  file: {
    id: string;
    path: string;
    name: string;
  };
  location: SymbolLocation;
}

export interface ReferencesResult {
  symbolName: string;
  definition?: CodeSymbolEntity | null;
  references: Array<{
    id: string;
    sourceFilePath: string;
    sourceFileId: string;
    line: number;
    col: number;
    kind: ReferenceKind;
    snippet?: string | null;
  }>;
  totalCount: number;
}

export interface FileDependencyLookupResult {
  filePath: string;
  fileId: string;
  dependencies: Array<{
    specifier: string;
    resolvedPath: string;
    isExternal: boolean;
    importedSymbols: Array<{ name: string; alias?: string; isDefault?: boolean }>;
  }>;
  dependents: Array<{
    sourceFilePath: string;
    sourceFileId: string;
    specifier: string;
  }>;
}
