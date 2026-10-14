const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/v1`;

export interface CustomCodeSnippet {
    id: string;
    websiteId: string;
    title: string;
    language: "HTML" | "CSS" | "JS";
    code: string;
    placement: "HEAD" | "BODY_TOP" | "BODY_BOTTOM";
    scope: "GLOBAL" | "PAGE";
    pageId: string | null;
    isActive: boolean;
    conditions?: { pages?: string[]; devices?: string[] } | null;
    priority?: number;
    status?: "DRAFT" | "PUBLISHED" | "SCHEDULED";
    scheduledFor?: string | null;
    createdAt: string;
    updatedAt: string;
}

export async function getCustomCodeSnippets(websiteId: string): Promise<CustomCodeSnippet[]> {
    try {
        const response = await fetch(`${API_URL}/custom-code/website/${websiteId}`, {
            method: "GET",
            credentials: "include",
        });

        if (!response.ok) return [];
        const data = await response.json();
        return data?.success && Array.isArray(data.snippets) ? data.snippets : [];
    } catch (error) {
        console.error("Failed to fetch custom code snippets:", error);
        return [];
    }
}

export interface CustomCodeMutationResult {
    success: boolean;
    message?: string;
}

function getRequestErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "An unexpected request error occurred.";
}

async function readMutationResult(response: Response): Promise<CustomCodeMutationResult> {
    let payload: unknown;
    try {
        payload = await response.json();
    } catch {
        return { success: false, message: `Custom code request failed (HTTP ${response.status}): invalid server response.` };
    }
    const result = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const success = response.ok && result.success === true;
    const message = typeof result.message === "string" ? result.message : undefined;
    return { success, ...(message ? { message } : !success ? { message: `Custom code request failed (HTTP ${response.status}).` } : {}) };
}

export async function createCustomCodeSnippet(websiteId: string, snippetData: Partial<CustomCodeSnippet>): Promise<CustomCodeMutationResult> {
    try {
        const response = await fetch(`${API_URL}/custom-code/website/${websiteId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(snippetData),
        });

        return await readMutationResult(response);
    } catch (error: unknown) {
        console.error("Failed to create custom code snippet:", error);
        return { success: false, message: getRequestErrorMessage(error) };
    }
}

export async function updateCustomCodeSnippet(snippetId: string, snippetData: Partial<CustomCodeSnippet>): Promise<CustomCodeMutationResult> {
    try {
        const response = await fetch(`${API_URL}/custom-code/${snippetId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(snippetData),
        });

        return await readMutationResult(response);
    } catch (error: unknown) {
        console.error("Failed to update custom code snippet:", error);
        return { success: false, message: getRequestErrorMessage(error) };
    }
}

export async function deleteCustomCodeSnippet(snippetId: string): Promise<boolean> {
    try {
        const response = await fetch(`${API_URL}/custom-code/${snippetId}`, {
            method: "DELETE",
            credentials: "include",
        });

        return response.ok;
    } catch (error) {
        console.error("Failed to delete custom code snippet:", error);
        return false;
    }
}
