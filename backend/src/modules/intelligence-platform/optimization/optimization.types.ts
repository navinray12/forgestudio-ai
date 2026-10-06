/**
 * ForgeStudio Module 62: Optimization Engine Types
 */

export type OptimizationCategory =
  | "BUNDLE"
  | "DEAD_CODE"
  | "CODE_SPLITTING"
  | "MEDIA"
  | "WEB_VITALS";

export interface OptimizationRecommendation {
  id: string;
  ruleId: string;
  category: OptimizationCategory;
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  estimatedSavingBytes?: number;
  actionableDiff?: string;
  targetFile?: string;
}

export interface OptimizationMetrics {
  jsBytes: number;
  cssBytes: number;
  assetBytes: number;
  heavyDependencies: Array<{
    name: string;
    sizeKb: number;
    alternative: string;
    impact: string;
  }>;
  webVitalsPrediction: {
    lcpMs: number;
    fidMs: number;
    cls: number;
    score: number;
  };
  unusedExports: Array<{
    file: string;
    exportedName: string;
  }>;
  codeSplittingCandidates: Array<{
    file: string;
    componentName: string;
    suggestedImport: string;
  }>;
}

export interface OptimizationAuditRecord {
  id: string;
  projectId: string;
  score: number;
  totalBytes: number;
  estimatedGzipBytes: number;
  deadCodeCount: number;
  heavyDepCount: number;
  recommendationsCount: number;
  metrics: OptimizationMetrics;
  recommendations: OptimizationRecommendation[];
  createdAt: string;
}
