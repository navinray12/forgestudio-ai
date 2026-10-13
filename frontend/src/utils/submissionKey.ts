export interface SubmissionKeySlot {
  current: { body: string; key: string } | null;
}

function newKey(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return `form-${c.randomUUID()}`;
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  return `form-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * One idempotency key per distinct submission: retrying the same data (for example after a
 * timeout whose outcome is unknown) reuses the key, so the server returns the original receipt
 * instead of recording a duplicate lead. Changed data gets a new key.
 */
export function submissionKeyFor(slot: SubmissionKeySlot, body: string): string {
  if (slot.current?.body !== body) slot.current = { body, key: newKey() };
  return slot.current.key;
}
