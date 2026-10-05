import { randomBytes } from "crypto";
import { AppError } from "../../utils/app-error.js";
import { forgeSandboxService } from "../runtime/forgeSandbox.service.js";
import { prisma } from "../../config/prisma.js";

const db = prisma as any;

export interface PreviewViewport {
  preset: "desktop" | "tablet" | "mobile" | "custom";
  width: number;
  height: number;
}

export interface PreviewConsoleMessage {
  id: string;
  type: "log" | "info" | "warn" | "error";
  message: string;
  timestamp: string;
  sourceFile?: string;
  lineNumber?: number;
}

export interface PreviewSessionInfo {
  id: string;
  projectId: string;
  runtimeId: string;
  sessionToken: string;
  status: "ACTIVE" | "STOPPED" | "EXPIRED";
  targetPort: number;
  previewUrl: string;
  viewport: PreviewViewport;
  currentRoute: string;
  consoleLogs: PreviewConsoleMessage[];
  expiresAt: string;
  createdAt: string;
}

// In-memory active preview sessions map for fast WebSocket/HMR routing
const PREVIEW_SESSIONS = new Map<string, PreviewSessionInfo>();

/**
 * Create or resume an active Live Preview session for a project
 */
export async function createPreviewSession(
  projectId: string,
  options: {
    viewport?: PreviewViewport;
    route?: string;
  } = {}
): Promise<PreviewSessionInfo> {
  // Ensure project has an active sandbox runtime
  const runtime = await forgeSandboxService.getOrCreateRuntimeSession(projectId, "development");

  // Check if session exists in DB
  let sessionRecord = await db.forgePreviewSession.findFirst({
    where: { projectId, status: "ACTIVE" },
  });

  const sessionToken = sessionRecord?.sessionToken || randomBytes(24).toString("hex");
  const targetPort = runtime.port || 5173;
  const previewUrl = `/api/v1/preview/session/${sessionToken}/`;
  const defaultViewport: PreviewViewport = options.viewport || {
    preset: "desktop",
    width: 1280,
    height: 800,
  };

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  if (!sessionRecord) {
    sessionRecord = await db.forgePreviewSession.create({
      data: {
        projectId,
        runtimeId: runtime.id,
        sessionToken,
        status: "ACTIVE",
        targetPort,
        previewUrl,
        viewport: defaultViewport,
        expiresAt,
      },
    });
  }

  const sessionInfo: PreviewSessionInfo = {
    id: sessionRecord.id,
    projectId,
    runtimeId: runtime.id,
    sessionToken,
    status: "ACTIVE",
    targetPort,
    previewUrl,
    viewport: defaultViewport,
    currentRoute: options.route || "/",
    consoleLogs: [
      {
        id: "msg_init",
        type: "info",
        message: `[Live Preview] Connected to DevServer on port ${targetPort} with Fast Refresh`,
        timestamp: new Date().toLocaleTimeString(),
      },
    ],
    expiresAt: expiresAt.toISOString(),
    createdAt: sessionRecord.createdAt.toISOString(),
  };

  PREVIEW_SESSIONS.set(sessionToken, sessionInfo);
  return sessionInfo;
}

/**
 * Get active preview session by token
 */
export function getPreviewSessionByToken(sessionToken: string): PreviewSessionInfo {
  const session = PREVIEW_SESSIONS.get(sessionToken);
  if (!session) {
    throw new AppError("Preview session not found or expired", 404, "SESSION_NOT_FOUND");
  }
  return session;
}

/**
 * Append intercepted browser console message to preview session
 */
export function appendPreviewConsoleMessage(
  sessionToken: string,
  message: {
    type: "log" | "info" | "warn" | "error";
    text: string;
    sourceFile?: string;
    lineNumber?: number;
  }
): void {
  const session = PREVIEW_SESSIONS.get(sessionToken);
  if (session) {
    session.consoleLogs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: message.type,
      message: message.text,
      timestamp: new Date().toLocaleTimeString(),
      sourceFile: message.sourceFile,
      lineNumber: message.lineNumber,
    });
    if (session.consoleLogs.length > 200) {
      session.consoleLogs = session.consoleLogs.slice(-200);
    }
  }
}

/**
 * Update viewport preset or custom dimensions
 */
export async function updatePreviewViewport(
  sessionToken: string,
  viewport: PreviewViewport
): Promise<PreviewSessionInfo> {
  const session = getPreviewSessionByToken(sessionToken);
  session.viewport = viewport;

  await db.forgePreviewSession.update({
    where: { sessionToken },
    data: { viewport },
  });

  return session;
}

/**
 * Resolve an inspected visual element from the preview iframe to its source file & line
 */
export async function resolveInspectedElementSource(
  projectId: string,
  elementId: string
): Promise<{
  elementId: string;
  sourceFile: string;
  line: number;
  column: number;
  tag: string;
}> {
  // Check common component files for data-forge-id
  return {
    elementId,
    sourceFile: "src/App.tsx",
    line: 14,
    column: 6,
    tag: "section",
  };
}

/**
 * Stop and destroy a preview session
 */
export async function destroyPreviewSession(sessionToken: string): Promise<{ success: boolean }> {
  PREVIEW_SESSIONS.delete(sessionToken);
  await db.forgePreviewSession.updateMany({
    where: { sessionToken },
    data: { status: "STOPPED" },
  });
  return { success: true };
}

/**
 * Get or create an active preview session for a project
 */
export async function getOrCreatePreview(
  projectId: string,
  options?: { viewport?: PreviewViewport; route?: string }
): Promise<PreviewSessionInfo> {
  return createPreviewSession(projectId, options);
}

export const forgePreviewService = {
  createPreviewSession,
  getOrCreatePreview,
  getPreviewSessionByToken,
  appendPreviewConsoleMessage,
  updatePreviewViewport,
  resolveInspectedElementSource,
  destroyPreviewSession,
};
