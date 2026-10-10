import type http from "node:http";
import { spawn, ChildProcess } from "node:child_process";
import { WebSocketServer, WebSocket } from "ws";
import { AppError } from "../../utils/app-error.js";
import { forgeSandboxService } from "../runtime/forgeSandbox.service.js";
import { forgeManifestService } from "../project/forgeManifest.service.js";
import { prisma } from "../../config/prisma.js";

const db = prisma as any;

// Dedicated WebSocketServer for /ws/terminal PTY upgrades
export const terminalWss = new WebSocketServer({
  noServer: true,
  maxPayload: 65536,
  perMessageDeflate: false,
});

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

// Active interactive PTY processes: sessionId -> process info
interface ActivePtySession {
  sessionId: string;
  projectId: string;
  proc: ChildProcess;
  subscribers: Set<WebSocket>;
  buffer: string[];
}
const ACTIVE_PTY_SESSIONS = new Map<string, ActivePtySession>();

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

/**
 * Handle incoming WebSocket connection for real interactive terminal PTY session
 */
export function handleTerminalWebSocketConnection(ws: WebSocket, req: http.IncomingMessage): void {
  try {
    const parsedUrl = new URL(req.url ?? "", "http://localhost");
    const sessionId = parsedUrl.searchParams.get("sessionId");
    const projectId = parsedUrl.searchParams.get("projectId");

    if (!sessionId && !projectId) {
      ws.send(JSON.stringify({ type: "error", message: "sessionId or projectId parameter is required" }));
      ws.close(1008, "Missing session ID");
      return;
    }

    const sid = sessionId || `pty_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const pid = projectId || ACTIVE_TERMINALS.get(sid)?.projectId || "default";

    // Get or start PTY session
    let pty = ACTIVE_PTY_SESSIONS.get(sid);
    if (!pty) {
      const workspaceDir = forgeSandboxService.getSandboxWorkspaceDir(pid);
      void forgeSandboxService.materializeProjectWorkspace(pid);

      const isWin = process.platform === "win32";
      const shell = isWin ? (process.env.COMSPEC || "cmd.exe") : (process.env.SHELL || "/bin/sh");
      const shellArgs = isWin ? [] : ["-i"];

      const proc = spawn(shell, shellArgs, {
        cwd: workspaceDir,
        env: {
          ...process.env,
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
          FORGE_PROJECT_ID: pid,
          FORGE_TERMINAL_SESSION: sid,
        },
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });

      pty = {
        sessionId: sid,
        projectId: pid,
        proc,
        subscribers: new Set<WebSocket>(),
        buffer: [],
      };

      const broadcastData = (data: string) => {
        pty!.buffer.push(data);
        if (pty!.buffer.length > 500) pty!.buffer.shift();
        for (const sub of pty!.subscribers) {
          if (sub.readyState === WebSocket.OPEN) {
            sub.send(JSON.stringify({ type: "output", data }));
          }
        }
      };

      proc.stdout?.on("data", (chunk: Buffer) => {
        broadcastData(chunk.toString());
      });

      proc.stderr?.on("data", (chunk: Buffer) => {
        broadcastData(chunk.toString());
      });

      proc.on("close", (code) => {
        broadcastData(`\r\n[Process exited with code ${code ?? 0}]\r\n`);
        ACTIVE_PTY_SESSIONS.delete(sid);
        void db.forgeTerminalSession.updateMany({
          where: { id: sid },
          data: { status: "CLOSED", lastActivityAt: new Date() },
        }).catch(() => {});
      });

      ACTIVE_PTY_SESSIONS.set(sid, pty);
    }

    pty.subscribers.add(ws);

    // Send initial buffer replay
    if (pty.buffer.length > 0) {
      ws.send(JSON.stringify({ type: "replay", data: pty.buffer.join("") }));
    }

    ws.on("message", (raw: string | Buffer) => {
      try {
        const text = raw.toString();
        let payload: any;
        try {
          payload = JSON.parse(text);
        } catch {
          payload = { type: "stdin", data: text };
        }

        if (payload.type === "stdin" && typeof payload.data === "string") {
          pty?.proc.stdin?.write(payload.data);
        } else if (payload.type === "signal" && payload.signal === "SIGINT") {
          pty?.proc.kill("SIGINT");
        } else if (payload.type === "signal" && payload.signal === "EOF") {
          pty?.proc.stdin?.end();
        }
      } catch (err: any) {
        ws.send(JSON.stringify({ type: "error", message: err.message }));
      }
    });

    ws.on("close", () => {
      pty?.subscribers.delete(ws);
      if (pty && pty.subscribers.size === 0) {
        // Keep active for 60 seconds to allow reconnection
        setTimeout(() => {
          if (pty && pty.subscribers.size === 0) {
            try { pty.proc.kill("SIGTERM"); } catch {}
            ACTIVE_PTY_SESSIONS.delete(sid);
          }
        }, 60000);
      }
    });
  } catch (err: any) {
    ws.close(1011, err.message);
  }
}

export const forgeTerminalService = {
  createTerminalSession,
  executeTerminalCommand,
  executeCommand: executeTerminalCommand,
  getManifestTasks,
  checkCommandSafety,
  explainCommandWithAI,
  handleTerminalWebSocketConnection,
  terminalWss,
};
