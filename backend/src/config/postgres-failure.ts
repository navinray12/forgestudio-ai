/** Normalize only known driver shapes. Do not inspect free-text errors for retry decisions. */
export function postgresFailure(error: unknown): {
    code?: string;
    message?: string;
} {
    if (!error || typeof error !== "object")
        return {};
    const failure = error as {
        code?: unknown;
        meta?: {
            code?: unknown;
            driverAdapterError?: unknown;
        };
        cause?: {
            originalCode?: unknown;
            originalMessage?: unknown;
        };
    };
    if (typeof failure.code === "string" && /^[0-9A-Z]{5}$/.test(failure.code) && !/^P[0-9]{4}$/.test(failure.code))
        return { code: failure.code };
    if (typeof failure.meta?.code === "string" && /^[0-9A-Z]{5}$/.test(failure.meta.code))
        return { code: failure.meta.code };
    const nested = failure.meta?.driverAdapterError;
    const adapter = (nested && typeof nested === "object" ? nested : failure) as {
        name?: unknown;
        cause?: {
            originalCode?: unknown;
            originalMessage?: unknown;
        };
    };
    if (adapter.name !== "DriverAdapterError")
        return {};
    const code = adapter.cause?.originalCode;
    return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)
        ? { code, message: typeof adapter.cause?.originalMessage === "string" ? adapter.cause.originalMessage : undefined } : {};
}
