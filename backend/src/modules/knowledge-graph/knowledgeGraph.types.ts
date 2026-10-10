/**
 * ForgeStudio Module 36: Repository Knowledge Graph Types
 */

export type KnowledgeGraphNodeType =
  | "PROJECT"
  | "FILE"
  | "MODULE"
  | "SYMBOL"
  | "FUNCTION"
  | "CLASS"
  | "INTERFACE"
  | "TYPE"
  | "API_ROUTE"
  | "DATABASE_ENTITY"
  | "EXTERNAL_DEPENDENCY";

export type KnowledgeGraphEdgeType =
  | "IMPORTS"
  | "EXPORTS"
  | "DEFINES"
  | "REFERENCES"
  | "CALLS"
  | "EXTENDS"
  | "IMPLEMENTS"
  | "ROUTES_TO"
  | "QUERIES"
  | "DEPENDS_ON";

export interface KnowledgeGraphNodeEntity {
  id: string;
  projectId: string;
  nodeKey: string;
  name: string;
  nodeType: KnowledgeGraphNodeType;
  filePath?: string | null;
  symbolId?: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeGraphEdgeEntity {
  id: string;
  projectId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: KnowledgeGraphEdgeType;
  metadata: Record<string, any>;
  createdAt: Date;
}

export type GraphQueryType =
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

export interface KnowledgeGraphQuery {
  queryType: GraphQueryType;
  target?: string; // filePath, symbolName, or route path
  sourceNodeKey?: string;
  targetNodeKey?: string;
  depth?: number;
  nodeTypes?: KnowledgeGraphNodeType[];
  edgeTypes?: KnowledgeGraphEdgeType[];
}

export interface GraphQueryResult {
  queryType: GraphQueryType;
  nodes: KnowledgeGraphNodeEntity[];
  edges: KnowledgeGraphEdgeEntity[];
  summary: {
    totalNodes: number;
    totalEdges: number;
    target?: string;
    pathFound?: boolean;
    chainLength?: number;
    affectedFilesCount?: number;
    affectedSymbolsCount?: number;
  };
  details?: Record<string, any>;
}

export interface BuildGraphResult {
  projectId: string;
  nodesCount: number;
  edgesCount: number;
  durationMs: number;
  builtAt: Date;
}
