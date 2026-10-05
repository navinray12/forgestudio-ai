/**
 * ForgeStudio Project Generator Types
 * Modules 08 (React) & 09 (Next.js) Architecture Contracts
 */

export type FileOwnership =
  | "GENERATED"
  | "USER"
  | "SHARED"
  | "SYSTEM"
  | "GENERATED_WITH_USER_MODIFICATIONS";

export type PlannedFileAction = "CREATE" | "UPDATE" | "PRESERVE" | "DELETE" | "MERGE";

export interface PlannedFile {
  path: string;
  action: PlannedFileAction;
  ownership: FileOwnership;
  content: string;
  mimeType: string;
  reason: string;
  existingHash?: string;
  newHash: string;
  isProtected?: boolean;
  diff?: string;
}

export interface GenerationScope {
  type: "full" | "page" | "component" | "route";
  targetId?: string;
  targetPath?: string;
}

export interface GenerationPlan {
  id: string;
  projectId: string;
  framework: "react" | "nextjs";
  frameworkVersion: string;
  createdAt: string;
  scope: GenerationScope;
  files: PlannedFile[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  routes: Array<{ path: string; name: string; file: string; dynamic?: boolean }>;
  components: Array<{ name: string; file: string; isClient?: boolean; isPage?: boolean }>;
  environment: {
    clientVars: Record<string, string>;
    serverVars: Record<string, string>;
  };
  warnings: string[];
}

export interface GenerationValidationCheck {
  name: string;
  passed: boolean;
  message?: string;
}

export interface GenerationValidationResult {
  valid: boolean;
  checks: GenerationValidationCheck[];
  errors: string[];
  warnings: string[];
}

export interface GenerationConflict {
  path: string;
  message: string;
  userContent?: string;
  generatedContent?: string;
  diff?: string;
}

export interface GenerationResult {
  success: boolean;
  generationId: string;
  plan: GenerationPlan;
  filesWritten: number;
  filesPreserved: number;
  filesMerged: number;
  conflicts: GenerationConflict[];
  diagnostics: Array<{ severity: "info" | "warning" | "error"; message: string; file?: string }>;
  snapshotId?: string;
  rolledBack?: boolean;
}

export interface ReactGeneratorOptions {
  typescript?: boolean;
  router?: "react-router-dom";
  stateManagement?: "context" | "zustand" | "none";
  styling?: "tailwind" | "css";
  testing?: "vitest" | "jest";
  scope?: GenerationScope;
  authorId?: string;
}

export interface NextJsGeneratorOptions {
  version?: "14" | "15";
  appRouter?: boolean;
  renderingStrategy?: "ssr" | "ssg" | "isr";
  revalidateSeconds?: number;
  serverActions?: boolean;
  imageOptimization?: boolean;
  fontOptimization?: boolean;
  styling?: "tailwind" | "css";
  scope?: GenerationScope;
  authorId?: string;
}
