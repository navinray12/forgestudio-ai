import { purgeExpiredAiPrompts } from "./prompt-cleanup.js";

export function promptCleanupInterval(raw = process.env.AI_PROMPT_CLEANUP_INTERVAL_MS): number {
  const value = Number(raw ?? 60_000);
  if (!Number.isInteger(value) || value < 1000 || value > 3_600_000) throw new Error("AI_PROMPT_CLEANUP_INTERVAL_MS must be 1000–3600000");
  return value;
}

/** Immediate startup sweep, bounded batches, no overlapping ticks, graceful drain.
 * Timers only wake the worker; PostgreSQL retains the pending cleanup work. */
export function startPromptCleanup(options: {
  intervalMs?: number;
  purge?: () => Promise<number>;
  onFailure?: () => void;
  schedule?: (callback: () => void, delay: number) => () => void;
} = {}) {
  const interval = promptCleanupInterval(String(options.intervalMs ?? promptCleanupInterval()));
  const purge = options.purge ?? (() => purgeExpiredAiPrompts());
  const schedule = options.schedule ?? ((callback, delay) => {
    const timer = setTimeout(callback, delay);
    timer.unref();
    return () => clearTimeout(timer);
  });
  let stopped = false;
  let cancelTimer: (() => void) | undefined;
  let active: Promise<void>;
  const run = async () => {
    try { await purge(); }
    catch { options.onFailure?.(); } // Never log ciphertext, SQL, or provider errors.
    finally { if (!stopped) cancelTimer = schedule(() => { active = run(); }, interval); }
  };
  active = run();
  return { stop: async () => { stopped = true; cancelTimer?.(); await active; } };
}
