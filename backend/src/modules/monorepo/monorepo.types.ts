/**
 * ForgeStudio Module 60: Monorepo & Multi-service Support Types
 */

export type WorkspaceManagerType = "npm" | "pnpm" | "yarn" | "turborepo" | "nx" | "custom";

export type PackageType = "APP" | "PACKAGE" | "SERVICE" | "TOOL" | "DOCS";

export interface WorkspacePackage {
  id: string;
  name: string;
  path: string;
  type: PackageType;
  version: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  isPrivate: boolean;
}

export interface PackageDependencyEdge {
  fromPackage: string;
  toPackage: string;
  dependencyType: "INTERNAL" | "PEER" | "DEV";
  versionRange?: string;
}

export interface MonorepoGraph {
  packages: WorkspacePackage[];
  edges: PackageDependencyEdge[];
  buildOrder: string[]; // Topologically sorted package names
  hasCircularDependencies: boolean;
  circularPaths: string[][];
}

export interface ServiceRuntimeConfig {
  id: string;
  packageId: string;
  serviceName: string;
  assignedPort: number;
  startCommand: string;
  envOverrides: Record<string, string>;
  healthEndpoint: string;
  status: "RUNNING" | "STOPPED" | "FAILED";
  lastStartedAt?: Date | null;
}

export interface CoordinatedDeploymentStage {
  stageIndex: number;
  name: string;
  packages: string[];
  status: "PENDING" | "BUILDING" | "DEPLOYING" | "COMPLETED" | "FAILED";
}

export interface CoordinatedDeploymentPlan {
  id: string;
  projectId: string;
  name: string;
  stages: CoordinatedDeploymentStage[];
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  targetServices: string[];
  logs: string[];
}
