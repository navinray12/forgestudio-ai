/**
 * JSON-safe encoding for golden files that keeps distinctions plain JSON would lose (undefined,
 * NaN, -0, Infinity, functions) and records thrown errors instead of failing the capture.
 */
export function encode(value: unknown): unknown {
  if (value === undefined) return "(undefined)";
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "(NaN)";
    if (Object.is(value, -0)) return "(-0)";
    if (!Number.isFinite(value)) return `(${value})`;
    return value;
  }
  if (typeof value === "function") return "(function)";
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  return value;
}

export function attempt(fn: () => unknown): unknown {
  try {
    return { value: encode(fn()) };
  } catch (error) {
    const e = error as Error;
    return { throws: `${e?.constructor?.name}: ${e?.message}` };
  }
}
