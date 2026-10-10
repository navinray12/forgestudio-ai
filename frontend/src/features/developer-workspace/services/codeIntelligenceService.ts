/**
 * ForgeStudio Modules 35 & 36: Code Intelligence & Knowledge Graph Service (Frontend API Client)
 * Provides typed access to semantic symbol search, definition lookup, find references,
 * file dependency tracing, and repository knowledge graph queries.
 */

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/v1/projects`;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const contentType = res.headers.get("content-type") || "";
  let data: any = null;

  if (contentType.includes("json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  if (!res.ok || (data && data.success === false)) {
    const errorMsg =
      data?.error?.message ||
      data?.detail ||
      data?.message ||
      `Request failed with status ${res.status} (${res.statusText})`;
    throw new Error(errorMsg);
  }

  return data;
}

export interface CodeSymbol {
  id: string;
  projectId: string;
  fileId: string;
  filePath: string;
  name: string;
  kind: string;
  containerName?: string | null;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  signature?: string | null;
  documentation?: string | null;
  isExported: boolean;
  isDefaultExport: boolean;
}

export interface DefinitionResult {
  symbol: CodeSymbol;
  file: {
    id: string;
    path: string;
    name: string;
  };
  location: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  };
}

export interface ReferencesResult {
  symbolName: string;
  definition?: CodeSymbol | null;
  references: Array<{
    id: string;
    sourceFilePath: string;
    sourceFileId: string;
    line: number;
    col: number;
    kind: string;
    snippet?: string | null;
  }>;
  totalCount: number;
}

export interface FileDependenciesResult {
  filePath: string;
  fileId: string;
  dependencies: Array<{
    specifier: string;
    resolvedPath: string;
    isExternal: boolean;
    importedSymbols: Array<{ name: string; alias?: string }>;
  }>;
  dependents: Array<{
    sourceFilePath: string;
    sourceFileId: string;
    specifier: string;
  }>;
}

export interface KnowledgeGraphQueryOptions {
  queryType:
    | "WHAT_IMPORTS_FILE"
    | "WHAT_FILE_IMPORTS"
    | "WHERE_SYMBOL_DEFINED"
    | "WHO_REFERENCES_SYMBOL"
    | "WHO_CALLS_FUNCTION"
    | "FILE_DEPENDENCIES"
    | "ROUTE_REACHABILITY"
    | "IMPACT_ANALYSIS"
    | "DEPENDENCY_CHAIN"
    | "SUBGRAPH";
  target?: string;
  sourceNodeKey?: string;
  targetNodeKey?: string;
  depth?: number;
}

export const codeIntelligenceService = {
  // Feature 35: Code Intelligence
  async searchSymbols(
    projectId: string,
    query: string = "",
    kind?: string,
    limit: number = 50
  ): Promise<{ symbols: CodeSymbol[]; count: number }> {
    const params = new URLSearchParams({ query, limit: String(limit) });
    if (kind) params.set("kind", kind);
    return request(`/${projectId}/intelligence/symbols?${params.toString()}`);
  },

  async lookupDefinition(
    projectId: string,
    params: { filePath?: string; line?: number; symbolName?: string }
  ): Promise<{ definition: DefinitionResult }> {
    const searchParams = new URLSearchParams();
    if (params.filePath) searchParams.set("filePath", params.filePath);
    if (params.line) searchParams.set("line", String(params.line));
    if (params.symbolName) searchParams.set("symbolName", params.symbolName);
    return request(`/${projectId}/intelligence/definition?${searchParams.toString()}`);
  },

  async findReferences(
    projectId: string,
    params: { symbolName?: string; symbolId?: string; filePath?: string; line?: number }
  ): Promise<ReferencesResult> {
    const searchParams = new URLSearchParams();
    if (params.symbolName) searchParams.set("symbolName", params.symbolName);
    if (params.symbolId) searchParams.set("symbolId", params.symbolId);
    if (params.filePath) searchParams.set("filePath", params.filePath);
    if (params.line) searchParams.set("line", String(params.line));
    return request(`/${projectId}/intelligence/references?${searchParams.toString()}`);
  },

  async getFileDependencies(projectId: string, fileIdOrPath: string): Promise<FileDependenciesResult> {
    return request(`/${projectId}/intelligence/files/${encodeURIComponent(fileIdOrPath)}`);
  },

  async indexProject(
    projectId: string,
    forceReindex: boolean = false
  ): Promise<{ status: any }> {
    return request(`/${projectId}/intelligence/index`, {
      method: "POST",
      body: JSON.stringify({ forceReindex }),
    });
  },

  async getIndexStatus(projectId: string): Promise<{ status: any }> {
    return request(`/${projectId}/intelligence/status`);
  },

  // Feature 36: Repository Knowledge Graph
  async queryGraph(projectId: string, query: KnowledgeGraphQueryOptions): Promise<any> {
    const params = new URLSearchParams();
    params.set("queryType", query.queryType);
    if (query.target) params.set("target", query.target);
    if (query.sourceNodeKey) params.set("sourceNodeKey", query.sourceNodeKey);
    if (query.targetNodeKey) params.set("targetNodeKey", query.targetNodeKey);
    if (query.depth) params.set("depth", String(query.depth));
    return request(`/${projectId}/knowledge-graph/query?${params.toString()}`);
  },

  async buildGraph(projectId: string): Promise<any> {
    return request(`/${projectId}/knowledge-graph/build`, {
      method: "POST",
    });
  },

  async getGraph(projectId: string, target?: string, depth: number = 2): Promise<any> {
    const params = new URLSearchParams();
    if (target) params.set("target", target);
    params.set("depth", String(depth));
    return request(`/${projectId}/knowledge-graph?${params.toString()}`);
  },
};
