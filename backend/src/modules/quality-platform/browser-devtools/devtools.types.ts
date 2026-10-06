/**
 * Module 45: Browser DevTools & Runtime Inspector Types
 */

export interface ConsoleLogEvent {
  id: string;
  level: "log" | "warn" | "error" | "info" | "debug";
  message: string;
  args?: any[];
  stack?: string;
  sourceFile?: string;
  lineNumber?: number;
  timestamp: string;
}

export interface NetworkTraceEvent {
  id: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody?: any;
  responseBody?: any;
  sizeBytes: number;
  initiator: string;
  timestamp: string;
}

export interface VirtualDomNode {
  id: string;
  tag: string;
  attributes: Record<string, string>;
  classes: string[];
  styles?: Record<string, string>;
  boxModel?: {
    width: number;
    height: number;
    margin: [number, number, number, number];
    padding: [number, number, number, number];
  };
  children?: VirtualDomNode[];
}

export interface CoreWebVitals {
  lcpMs: number; // Largest Contentful Paint
  fidMs: number; // First Input Delay
  cls: number;   // Cumulative Layout Shift
  fcpMs: number; // First Contentful Paint
  ttfbMs: number;// Time to First Byte
  memoryHeapMb: number;
}

export interface RuntimeSnapshotRecord {
  id: string;
  projectId: string;
  url?: string;
  domTree: VirtualDomNode;
  consoleLogs: ConsoleLogEvent[];
  networkLogs: NetworkTraceEvent[];
  vitals: CoreWebVitals;
  storage: {
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    cookies: Record<string, string>;
  };
  createdAt: string;
}

export interface AiRuntimeDiagnosisResult {
  summary: string;
  rootCause: string;
  suggestedPatch: string;
  affectedFile?: string;
  affectedLine?: number;
}
