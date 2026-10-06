/**
 * Module 43: Automated Testing Platform Types
 */

export type TestType =
  | "UNIT"
  | "COMPONENT"
  | "INTEGRATION"
  | "E2E"
  | "VISUAL"
  | "ACCESSIBILITY"
  | "PERFORMANCE";

export interface TestCaseResult {
  name: string;
  suiteName: string;
  status: "PASSED" | "FAILED" | "SKIPPED";
  durationMs: number;
  error?: {
    message: string;
    stack?: string;
    expected?: any;
    actual?: any;
    file?: string;
    line?: number;
  };
}

export interface CoverageReport {
  statements: { total: number; covered: number; pct: number };
  branches: { total: number; covered: number; pct: number };
  functions: { total: number; covered: number; pct: number };
  lines: { total: number; covered: number; pct: number };
}

export interface TestSuiteRecord {
  id: string;
  projectId: string;
  name: string;
  testType: TestType;
  filePath: string;
  totalTests: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestRunRecord {
  id: string;
  projectId: string;
  suiteId?: string;
  trigger: "MANUAL" | "CI" | "SAVE" | "AI";
  status: "RUNNING" | "PASSED" | "FAILED" | "ERROR";
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  coverage: CoverageReport;
  results: TestCaseResult[];
  aiDiagnostic?: {
    summary: string;
    rootCause: string;
    suggestedFix: string;
    affectedFiles: string[];
  };
  createdAt: string;
}

export interface RunTestsOptions {
  suiteId?: string;
  filePath?: string;
  testFilter?: string;
  testType?: TestType;
  trigger?: "MANUAL" | "CI" | "SAVE" | "AI";
  collectCoverage?: boolean;
}
