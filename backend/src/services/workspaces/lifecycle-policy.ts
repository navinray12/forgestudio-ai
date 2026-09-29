import { AppError } from "../../utils/app-error.js";
export function expectedWorkspaceVersion(value: unknown): number {
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 2147483646) {
        throw new AppError("The current workspace version is required", 428, "PRECONDITION_REQUIRED");
    }
    return Number(value);
}
export function assertWorkspaceVersion(actual: number, expected: number): void {
    if (actual !== expected)
        throw new AppError("Workspace changed; reload before applying your changes", 412, "VERSION_CONFLICT");
}
export function assertWorkspaceWritable(workspace: {
    lifecycleStatus?: string;
}): void {
    if ((workspace.lifecycleStatus ?? "ACTIVE") !== "ACTIVE") {
        throw new AppError("This workspace is archived and read-only", 409, "WORKSPACE_READ_ONLY");
    }
}
export function workspaceSettings(value: unknown): {
    locale?: string;
    timeZone?: string;
} {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new AppError("Invalid workspace settings", 400, "VALIDATION_ERROR");
    const source = value as Record<string, unknown>;
    const result: {
        locale?: string;
        timeZone?: string;
    } = {};
    if (Object.keys(source).some(key => !["locale", "timeZone"].includes(key)))
        throw new AppError("Unsupported workspace setting", 400, "VALIDATION_ERROR");
    if (source.locale !== undefined) {
        if (typeof source.locale !== "string" || source.locale.length > 50)
            throw new AppError("Invalid locale", 400, "VALIDATION_ERROR");
        try {
            result.locale = Intl.getCanonicalLocales(source.locale)[0];
        }
        catch {
            throw new AppError("Invalid locale", 400, "VALIDATION_ERROR");
        }
        if (!result.locale)
            throw new AppError("Invalid locale", 400, "VALIDATION_ERROR");
    }
    if (source.timeZone !== undefined) {
        if (typeof source.timeZone !== "string" || source.timeZone.length > 100)
            throw new AppError("Invalid time zone", 400, "VALIDATION_ERROR");
        try {
            result.timeZone = new Intl.DateTimeFormat("en", { timeZone: source.timeZone }).resolvedOptions().timeZone;
        }
        catch {
            throw new AppError("Invalid time zone", 400, "VALIDATION_ERROR");
        }
    }
    return result;
}
export function boundedReason(value: unknown): string {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 500)
        throw new AppError("A reason of 1 to 500 characters is required", 400, "REASON_REQUIRED");
    return value.trim();
}
export function publicWorkspaceSettings(value: unknown): {
    locale: string;
    timeZone: string;
} {
    const settings = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    return { locale: typeof settings.locale === "string" ? settings.locale : "en", timeZone: typeof settings.timeZone === "string" ? settings.timeZone : "UTC" };
}
