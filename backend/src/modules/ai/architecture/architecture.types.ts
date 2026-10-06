/**
 * ForgeStudio Module 40: AI Architecture Agent Types
 */

export type ArchitectureFindingCategory =
  | "CIRCULAR_DEPENDENCY"
  | "LAYER_VIOLATION"
  | "DUPLICATION"
  | "ARCHITECTURE_DRIFT"
  | "COUPLING_RISK";

export type ArchitectureFindingSeverity = "INFO" | "WARNING" | "HIGH" | "CRITICAL";

export interface ArchitectureFindingEntity {
  id: string;
  projectId: string;
  snapshotId: string;
  category: ArchitectureFindingCategory;
  severity: ArchitectureFindingSeverity;
  title: string;
  description: string;
  affectedFiles: string[];
  remediation?: string | null;
  status: "OPEN" | "RESOLVED" | "IGNORED";
  createdAt: string;
}

export interface ArchitectureSnapshotEntity {
  id: string;
  projectId: string;
  score: number; // 0 - 100
  moduleCount: number;
  serviceCount: number;
  circularDependencies: Array<{ cycle: string[] }>;
  layerViolations: Array<{ file: string; rule: string }>;
  duplicatedModules: Array<{ fileA: string; fileB: string; similarity: number }>;
  architectureDrift: Array<{ component: string; driftDescription: string }>;
  couplingMetrics: {
    averageFanIn: number;
    averageFanOut: number;
    highRiskModules: string[];
  };
  diagramData: {
    nodes: Array<{ id: string; label: string; type: string }>;
    edges: Array<{ from: string; to: string; label?: string }>;
    mermaid: string;
  };
  recommendations: string[];
  findings?: ArchitectureFindingEntity[];
  createdAt: string;
}
