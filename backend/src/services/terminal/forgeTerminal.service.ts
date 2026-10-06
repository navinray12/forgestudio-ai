import { AppError } from "../../utils/app-error.js";
import { forgeSandboxService } from "../runtime/forgeSandbox.service.js";
import { forgeManifestService } from "../project/forgeManifest.service.js";
import { prisma } from "../../config/prisma.js";

const db = prisma as any;

export interface TerminalSessionInfo {
  id: string;
  projectId: string;
  name: string;
  cwd: string;
  status: "ACTIVE" | "CLOSED";
  history: string[];
  outputBuffer: string[];
  lastActivityAt: string;
}

export interface CommandExecutionResult {
  sessionId: string;
  command: string;
  exitCode: number;
  output: string;
  durationMs: number;
  requiresConfirmation?: boolean;
  confirmationReason?: string;
}

// In-memory active terminals registry
const ACTIVE_TERMINALS = new Map<string, TerminalSessionInfo>();

// List of dangerous commands requiring explicit user permission gates
const DESTRUCTIVE_COMMAND_PATTERNS = [
  /rm\s+-rf\s+[\/\\]/i,
  /rm\s+-rf\s+\*/i,
  /mkfs/i,
  /dd\s+if=/i,
  /drop\s+database/i,
  /drop\s+table/i,
  /truncate\s+table/i,
  /chmod\s+-R\s+777/i,
  />\s*\/dev\/sda/i,
];

/**
 * Check if a command is potentially destructive and requires user confirmation
 */
export function checkCommandSafety(command: string): { isDestructive: boolean; reason?: string } {
  for (const pattern of DESTRUCTIVE_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      return {
        isDestructive: true,
        reason: "Dangerous command detected: Potentially destructive filesystem or data operation.",
      };
    }
  }
  return { isDestructive: false };
}

/**
 * Create a new terminal session
 */
export async function createTerminalSession(
  projectId: string,
  nameOrOptions?: string | { name?: string; shell?: string; userId?: string }
): Promise<TerminalSessionInfo> {
  const terminalName =
    typeof nameOrOptions === "string"
      ? nameOrOptions
      : nameOrOptions?.name || `Terminal ${ACTIVE_TERMINALS.size + 1}`;
  const record = await db.forgeTerminalSession.create({
    data: {
      projectId,
      name: terminalName,
      status: "ACTIVE",
      cwd: "/",
      history: [],
    },
  });

  const session: TerminalSessionInfo = {
    id: record.id,
    projectId,
    name: terminalName,
    cwd: "/",
    status: "ACTIVE",
    history: [],
    outputBuffer: [
      `\x1b[1;34mForgeStudio Sandboxed Developer Terminal v2.0\x1b[0m`,
      `Type any project command (e.g. 'npm test', 'npm run build', 'ls')`,
      `Environment: isolated sandbox container (${projectId})`,
      "",
    ],
    lastActivityAt: new Date().toISOString(),
  };

  ACTIVE_TERMINALS.set(record.id, session);
  return session;
}

/**
 * Execute command inside a terminal session
 */
export async function executeTerminalCommand(
  sessionId: string,
  command: string,
  options: {
    userId?: string;
    confirmedByUser?: boolean;
  } = {}
): Promise<CommandExecutionResult> {
  let session = ACTIVE_TERMINALS.get(sessionId);
  if (!session) {
    const record = await db.forgeTerminalSession.findUnique({ where: { id: sessionId } });
    if (!record) {
      throw new AppError("Terminal session not found", 404, "TERMINAL_NOT_FOUND");
    }
    session = {
      id: record.id,
      projectId: record.projectId,
      name: record.name,
      cwd: record.cwd,
      status: record.status as any,
      history: (record.history as any) || [],
      outputBuffer: [],
      lastActivityAt: record.lastActivityAt.toISOString(),
    };
    ACTIVE_TERMINALS.set(sessionId, session);
  }

  const trimmedCmd = command.trim();
  if (!trimmedCmd) {
    return {
      sessionId,
      command: "",
      exitCode: 0,
      output: "",
      durationMs: 0,
    };
  }

  // Safety Gate Check
  const safety = checkCommandSafety(trimmedCmd);
  if (safety.isDestructive && !options.confirmedByUser) {
    session.outputBuffer.push(`\x1b[1;31m[SECURITY GATE BLOCKED]\x1b[0m ${safety.reason}`);
    session.outputBuffer.push(`This command requires explicit user confirmation before executing.`);
    return {
      sessionId,
      command: trimmedCmd,
      exitCode: 126,
      output: session.outputBuffer.slice(-2).join("\n"),
      durationMs: 0,
      requiresConfirmation: true,
      confirmationReason: safety.reason,
    };
  }

  // Record command in history
  session.history.push(trimmedCmd);
  session.outputBuffer.push(`$ ${trimmedCmd}`);

  // Execute in isolated sandbox
  const res = await forgeSandboxService.executeInSandbox({
    projectId: session.projectId,
    command: trimmedCmd,
    cwd: session.cwd,
    userId: options.userId,
  });

  if (res.stdout) {
    session.outputBuffer.push(res.stdout);
  }
  if (res.stderr) {
    session.outputBuffer.push(`\x1b[31m${res.stderr}\x1b[0m`);
  }

  // Keep output buffer bounded
  if (session.outputBuffer.length > 500) {
    session.outputBuffer = session.outputBuffer.slice(-500);
  }

  session.lastActivityAt = new Date().toISOString();

  // Persist history update
  await db.forgeTerminalSession.update({
    where: { id: sessionId },
    data: {
      history: session.history.slice(-50),
      lastActivityAt: new Date(),
    },
  });

  return {
    sessionId,
    command: trimmedCmd,
    exitCode: res.exitCode,
    output: (res.stdout + "\n" + res.stderr).trim(),
    durationMs: res.durationMs,
  };
}

/**
 * Get available manifest task commands for quick execution
 */
export async function getManifestTasks(projectId: string): Promise<Array<{ name: string; command: string }>> {
  try {
    const { manifest } = await forgeManifestService.getProjectManifest(projectId);
    if (!manifest?.commands) return [];

    return Object.entries(manifest.commands)
      .filter(([_, cmd]) => typeof cmd === "string" && cmd.length > 0)
      .map(([name, cmd]) => ({ name, command: String(cmd) }));
  } catch {
    return [
      { name: "dev", command: "npm run dev" },
      { name: "build", command: "npm run build" },
      { name: "test", command: "npm test" },
      { name: "lint", command: "npm run lint" },
    ];
  }
}

/**
 * AI-assisted command and error explanation
 */
export function explainCommandWithAI(command: string, exitCode: number, output: string): {
  analysis: string;
  explanation: string;
  suggestedFix: string;
} {
  if (exitCode === 0) {
    return {
      analysis: "Command Succeeded",
      explanation: `The command '${command}' completed normally with exit code 0.`,
      suggestedFix: "No action required.",
    };
  }

  return {
    analysis: `Command Failed (Exit Code ${exitCode})`,
    explanation: `Execution of '${command}' produced error output:\n${output.slice(0, 300)}`,
    suggestedFix: "Review the missing module or configuration flags indicated above and retry.",
  };
}

export const forgeTerminalService = {
  createTerminalSession,
  executeTerminalCommand,
  executeCommand: executeTerminalCommand,
  getManifestTasks,
  checkCommandSafety,
  explainCommandWithAI,
};
