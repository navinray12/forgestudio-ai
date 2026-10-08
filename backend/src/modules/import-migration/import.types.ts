/**
 * ForgeStudio Module 59: Project Import & Migration Types
 */

export type ImportSourceType = "GIT_URL" | "GITHUB" | "ZIP" | "LOCAL";

export type ImportPipelineStage =
  | "DISCOVER"
  | "ACQUIRE"
  | "VERIFY"
  | "INDEX"
  | "DETECT"
  | "ANALYZE"
  | "PLAN"
  | "PREVIEW"
  | "IMPORT"
  | "VALIDATE"
  | "REPORT";

export type DetectedFramework =
  | "react"
  | "nextjs"
  | "vite"
  | "node"
  | "express"
  | "nestjs"
  | "static"
  | "vue"
  | "svelte"
  | "angular"
  | "UNKNOWN";

export type DetectedPackageManager = "npm" | "pnpm" | "yarn" | "bun";

export interface DiscoveredRoute {
  path: string;
  sourceFile: string;
  method?: string;
  type: "PAGE" | "API";
}

export interface DiscoveredSecretKey {
  keyName: string;
  fileSource: string;
  risk: "HIGH" | "MEDIUM" | "LOW";
}

export interface UnsupportedPattern {
  category: "FRAMEWORK" | "RUNTIME" | "NATIVE_BINARY" | "SECRET" | "MONOREPO_CONFIG";
  severity: "BLOCKER" | "WARNING" | "INFO";
  title: string;
  description: string;
  affectedFile?: string;
  remedy?: string;
}

export interface MigrationStep {
  step: number;
  title: string;
  category: "DEPENDENCY" | "CONFIG" | "FRAMEWORK" | "INFRASTRUCTURE";
  description: string;
  suggestedPatch?: string;
  isAutomatic: boolean;
}

export interface ImportAnalysisResult {
  framework: DetectedFramework;
  frameworkVersion?: string;
  runtime: string;
  runtimeVersion?: string;
  packageManager: DetectedPackageManager;
  buildTools: string[];
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  isMonorepo: boolean;
  monorepoWorkspaces?: string[];
  envReferences: string[];
  discoveredSecretKeys: DiscoveredSecretKey[];
  routes: DiscoveredRoute[];
  totalFiles: number;
  totalBytes: number;
}

export interface ImportCompatibilityReport {
  overallScore: number;
  compatibilityLevel: "FULLY_COMPATIBLE" | "COMPATIBLE_WITH_PATCHES" | "REQUIRES_MIGRATION" | "INCOMPATIBLE";
  unsupportedPatterns: UnsupportedPattern[];
  recommendations: MigrationStep[];
  filesIndexedCount: number;
  symbolsIndexedCount: number;
  routesDiscovered: DiscoveredRoute[];
  architectureMapSummary: {
    entryPoints: string[];
    mainComponents: string[];
    sharedLibraries: string[];
  };
}
