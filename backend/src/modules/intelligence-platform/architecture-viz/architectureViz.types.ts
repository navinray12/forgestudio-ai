/**
 * ForgeStudio Module 64: Architecture Visualization Types
 */

export type VizLayer = "ALL" | "MODULES" | "SERVICES" | "DATABASE" | "TOPOLOGY";

export interface VizNode {
  id: string;
  label: string;
  layer: "frontend" | "backend" | "database" | "external";
  type: "component" | "page" | "service" | "controller" | "database_table" | "route" | "storage";
  path?: string;
  lineCount?: number;
  fanIn: number;
  fanOut: number;
  riskScore: number;
  position: { x: number; y: number };
}

export interface VizEdge {
  id: string;
  source: string;
  target: string;
  type: "import" | "api_call" | "db_query" | "event";
  label?: string;
  isCircular?: boolean;
}

export interface DatabaseErColumn {
  name: string;
  type: string;
  isPrimary: boolean;
  isForeign: boolean;
  references?: string;
}

export interface DatabaseErEntity {
  tableName: string;
  columns: DatabaseErColumn[];
}

export interface ArchitectureGraphPayload {
  projectId: string;
  layer: VizLayer;
  nodes: VizNode[];
  edges: VizEdge[];
  summary: {
    totalNodes: number;
    totalEdges: number;
    componentCount: number;
    serviceCount: number;
    databaseTablesCount: number;
    circularCount: number;
  };
  mermaid: string;
  databaseEr: DatabaseErEntity[];
}
