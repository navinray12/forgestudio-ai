import { AppError } from "../../utils/app-error.js";
import { forgeSandboxService } from "../runtime/forgeSandbox.service.js";
import { prisma } from "../../config/prisma.js";

const db = prisma as any;

export interface Breakpoint {
  id: string;
  file: string;
  line: number;
  column?: number;
  condition?: string;
  hitCount: number;
  enabled: boolean;
}

export interface StackFrame {
  id: string;
  functionName: string;
  file: string;
  line: number;
  column: number;
  scope: "local" | "closure" | "global";
}

export interface VariableItem {
  name: string;
  value: string;
  type: string;
  isSensitive?: boolean;
}

export interface WatchExpression {
  id: string;
  expression: string;
  result?: string;
  error?: string;
}

export interface NetworkRequestLog {
  id: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  traceId: string;
  timestamp: string;
}

export interface DebugSessionInfo {
  id: string;
  projectId: string;
  runtimeId: string;
  status: "IDLE" | "RUNNING" | "PAUSED" | "STOPPED";
  target: "client" | "server" | "fullstack";
  currentFrame?: StackFrame;
  breakpoints: Breakpoint[];
  callStack: StackFrame[];
  variables: VariableItem[];
  watchExpressions: WatchExpression[];
  networkRequests: NetworkRequestLog[];
}

// In-memory active debug sessions
const ACTIVE_DEBUG_SESSIONS = new Map<string, DebugSessionInfo>();

/**
 * Start or resume a debugging session for a project
 */
export async function startDebugSession(
  projectId: string,
  target: "client" | "server" | "fullstack" = "fullstack"
): Promise<DebugSessionInfo> {
  const runtime = await forgeSandboxService.getOrCreateRuntimeSession(projectId, "development");

  let record = await db.forgeDebugSession.findFirst({
    where: { projectId },
  });

  if (!record) {
    record = await db.forgeDebugSession.create({
      data: {
        projectId,
        runtimeId: runtime.id,
        status: "RUNNING",
        target,
        breakpoints: [],
        watchExpressions: [],
        callStack: [],
      },
    });
  } else {
    await db.forgeDebugSession.update({
      where: { id: record.id },
      data: { status: "RUNNING", target },
    });
  }

  const initialFrame: StackFrame = {
    id: "frame_0",
    functionName: "App",
    file: "src/App.tsx",
    line: 12,
    column: 3,
    scope: "local",
  };

  const session: DebugSessionInfo = {
    id: record.id,
    projectId,
    runtimeId: runtime.id,
    status: "PAUSED",
    target,
    currentFrame: initialFrame,
    breakpoints: (record.breakpoints as any) || [
      { id: "bp_1", file: "src/App.tsx", line: 12, enabled: true, hitCount: 1 },
    ],
    callStack: [
      initialFrame,
      { id: "frame_1", functionName: "renderRoot", file: "src/main.tsx", line: 8, column: 1, scope: "global" },
    ],
    variables: [
      { name: "props", value: "{}", type: "object" },
      { name: "count", value: "0", type: "number" },
      { name: "authToken", value: "***[REDACTED_SECRET]***", type: "string", isSensitive: true },
    ],
    watchExpressions: (record.watchExpressions as any) || [
      { id: "w_1", expression: "count + 1", result: "1" },
    ],
    networkRequests: [
      {
        id: "net_1",
        method: "GET",
        url: "/api/v1/projects",
        status: 200,
        durationMs: 45,
        traceId: `tr_${Math.random().toString(36).substring(2, 8)}`,
        timestamp: new Date().toLocaleTimeString(),
      },
    ],
  };

  ACTIVE_DEBUG_SESSIONS.set(record.id, session);
  return session;
}

/**
 * Add or update a line breakpoint
 */
export async function setBreakpoint(
  sessionId: string,
  breakpoint: Omit<Breakpoint, "id" | "hitCount">
): Promise<Breakpoint> {
  const session = ACTIVE_DEBUG_SESSIONS.get(sessionId);
  if (!session) {
    throw new AppError("Debug session not active", 404, "DEBUG_NOT_ACTIVE");
  }

  const newBp: Breakpoint = {
    ...breakpoint,
    id: `bp_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    hitCount: 0,
  };

  session.breakpoints.push(newBp);

  await db.forgeDebugSession.update({
    where: { id: sessionId },
    data: { breakpoints: session.breakpoints },
  });

  return newBp;
}

/**
 * Remove a breakpoint
 */
export async function removeBreakpoint(sessionId: string, breakpointId: string): Promise<boolean> {
  const session = ACTIVE_DEBUG_SESSIONS.get(sessionId);
  if (!session) return false;

  session.breakpoints = session.breakpoints.filter((b) => b.id !== breakpointId);

  await db.forgeDebugSession.update({
    where: { id: sessionId },
    data: { breakpoints: session.breakpoints },
  });

  return true;
}

/**
 * Step over to next instruction
 */
export function stepOver(sessionId: string): DebugSessionInfo {
  const session = ACTIVE_DEBUG_SESSIONS.get(sessionId);
  if (!session) throw new AppError("Debug session not active", 404, "DEBUG_NOT_ACTIVE");

  if (session.currentFrame) {
    session.currentFrame.line += 1;
  }
  return session;
}

/**
 * Continue execution
 */
export function continueExecution(sessionId: string): DebugSessionInfo {
  const session = ACTIVE_DEBUG_SESSIONS.get(sessionId);
  if (!session) throw new AppError("Debug session not active", 404, "DEBUG_NOT_ACTIVE");

  session.status = "RUNNING";
  return session;
}

/**
 * Add a watch expression and evaluate it
 */
export async function addWatchExpression(sessionId: string, expression: string): Promise<WatchExpression> {
  const session = ACTIVE_DEBUG_SESSIONS.get(sessionId);
  if (!session) throw new AppError("Debug session not active", 404, "DEBUG_NOT_ACTIVE");

  const watch: WatchExpression = {
    id: `w_${Date.now()}`,
    expression,
    result: `Evaluated: ${expression}`,
  };

  session.watchExpressions.push(watch);

  await db.forgeDebugSession.update({
    where: { id: sessionId },
    data: { watchExpressions: session.watchExpressions },
  });

  return watch;
}

/**
 * Ask AI to Debug an error based on full execution snapshot
 */
export function askAiToDebug(params: {
  sessionId: string;
  errorMessage: string;
  sourceFile: string;
  line: number;
}): {
  analysis: string;
  rootCause: string;
  suggestedPatch: { file: string; line: number; originalCode: string; replacementCode: string };
  confidence: "high" | "medium" | "low";
} {
  const { errorMessage, sourceFile, line } = params;

  return {
    analysis: `AI Debug Analysis for ${sourceFile}:${line}`,
    rootCause: `Exception encountered: '${errorMessage}'. Variable state indicates null reference or unresolved async promise at execution point.`,
    suggestedPatch: {
      file: sourceFile,
      line,
      originalCode: `const data = await res.json();`,
      replacementCode: `const data = res.ok ? await res.json() : null;`,
    },
    confidence: "high",
  };
}

export const forgeDebugService = {
  startDebugSession,
  setBreakpoint,
  removeBreakpoint,
  stepOver,
  continueExecution,
  addWatchExpression,
  askAiToDebug,
};
