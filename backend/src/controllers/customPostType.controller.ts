import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { verifyProjectAccess, type ProjectAccess } from "../modules/data-platform/common/project-access.js";
import {
    trashEntry,
    restoreEntry,
    createPurgeRequest,
    approvePurgeRequest,
    executePurgeRequest,
    listPurgeRequests,
} from "../services/cms/contentLifecycle.service.js";

// The UI works with { key, required, options } on fields and { values } on entries; the
// database stores them as custom_fields.slug / custom_fields.config and custom_entries.data.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELD_KEY_PATTERN = /^[a-z0-9_]+$/;

function currentUserId(req: Request, res: Response): string {
    const id = res.locals.user?.id || (req as any).user?.id;
    if (!id) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    return id;
}

function requireUuid(value: unknown, label: string): string {
    if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
        throw new AppError(`${label} not found`, 404, "NOT_FOUND");
    }
    return value;
}

async function authorizeWebsite(req: Request, res: Response, websiteId: unknown): Promise<ProjectAccess> {
    return verifyProjectAccess(requireUuid(websiteId, "Website"), currentUserId(req, res));
}

async function authorizePostType(req: Request, res: Response, cptId: unknown) {
    const postType = await prisma.customPostType.findUnique({
        where: { id: requireUuid(cptId, "Custom post type") },
        select: { id: true, websiteId: true },
    });
    if (!postType) throw new AppError("Custom post type not found", 404, "NOT_FOUND");
    const access = await verifyProjectAccess(postType.websiteId, currentUserId(req, res));
    return { postType, access };
}

async function authorizeEntry(req: Request, res: Response, entryId: unknown) {
    const entry = await prisma.customEntry.findUnique({
        where: { id: requireUuid(entryId, "Entry") },
        select: { id: true, postTypeId: true, deletedAt: true, postType: { select: { websiteId: true } } },
    });
    if (!entry) throw new AppError("Entry not found", 404, "NOT_FOUND");
    await verifyProjectAccess(entry.postType.websiteId, currentUserId(req, res));
    return { ...entry, websiteId: entry.postType.websiteId };
}

function toApiField(field: { id: string; postTypeId: string; name: string; slug: string; type: string; order: number; config: unknown; createdAt: Date; updatedAt: Date }) {
    const config = (field.config && typeof field.config === "object" ? field.config : {}) as Record<string, any>;
    return {
        id: field.id,
        postTypeId: field.postTypeId,
        name: field.name,
        key: field.slug,
        type: field.type,
        order: field.order,
        required: Boolean(config.required),
        options: config.options ?? {},
        createdAt: field.createdAt,
        updatedAt: field.updatedAt,
    };
}

function toApiEntry<T extends { data: unknown }>(entry: T) {
    const { data, ...rest } = entry;
    return { ...rest, values: data ?? {} };
}

// ====== CPT Management ======
export async function getCustomPostTypesHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const websiteId = req.params.websiteId as string;
        await authorizeWebsite(req, res, websiteId);

        const cpts = await prisma.customPostType.findMany({
            where: { websiteId },
            include: { _count: { select: { entries: true, fields: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json({ success: true, data: cpts });
    } catch (e) { next(e); }
}

export async function createCustomPostTypeHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const websiteId = req.params.websiteId as string;
        await authorizeWebsite(req, res, websiteId);
        const { name, singular, plural, slug, description, hasArchive } = req.body ?? {};

        const normalizedSlug = String(slug || "").toLowerCase().trim();
        if (typeof name !== "string" || !name.trim() || !normalizedSlug) {
            throw new AppError("name and slug are required", 400, "INVALID_INPUT");
        }
        // URLs cannot contain path separators, query fragments or whitespace.
        // Keep server and CMS builder slug rules aligned.
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
            throw new AppError("Slug must contain lowercase letters, numbers or single hyphens between words", 400, "INVALID_SLUG");
        }

        const existing = await prisma.customPostType.findFirst({ where: { websiteId, slug: normalizedSlug } });
        if (existing) {
            return res.status(409).json({ success: false, error: { message: "Slug already exists" } });
        }

        const cpt = await prisma.customPostType.create({
            data: {
                websiteId,
                name: String(name),
                singular: singular ? String(singular) : null,
                plural: plural ? String(plural) : null,
                slug: normalizedSlug,
                description: description ? String(description) : null,
                hasArchive: Boolean(hasArchive),
            }
        });
        res.status(201).json({ success: true, data: cpt });
    } catch (e) { next(e); }
}

export async function deleteCustomPostTypeHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { postType, access } = await authorizePostType(req, res, req.params.cptId);
        if (!access.canAdminister) {
            throw new AppError("Only project owners and admins can delete custom post types", 403, "FORBIDDEN");
        }

        // Deleting a post type cascades to its entries, so it is refused while content exists.
        const entryCount = await prisma.customEntry.count({ where: { postTypeId: postType.id } });
        if (entryCount > 0) {
            throw new AppError(
                `This post type still has ${entryCount} entr${entryCount === 1 ? "y" : "ies"}. Delete or move them before deleting the post type.`,
                409,
                "POST_TYPE_HAS_ENTRIES"
            );
        }

        await prisma.customPostType.delete({ where: { id: postType.id } });
        res.status(200).json({ success: true, message: "Custom Post Type removed successfully." });
    } catch (e) { next(e); }
}

// ====== Custom Fields ======
export async function getCustomFieldsHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { postType } = await authorizePostType(req, res, req.params.cptId);
        const fields = await prisma.customField.findMany({
            where: { postTypeId: postType.id },
            orderBy: { order: 'asc' }
        });
        res.status(200).json({ success: true, data: fields.map(toApiField) });
    } catch (e) { next(e); }
}

interface IncomingField {
    id?: string;
    name: string;
    key: string;
    type: string;
    required: boolean;
    options: Record<string, any>;
}

function parseIncomingFields(raw: unknown): IncomingField[] {
    if (!Array.isArray(raw)) throw new AppError("fields must be an array", 400, "INVALID_INPUT");
    const seen = new Set<string>();
    const seenIds = new Set<string>();
    return raw.map((f: any, i: number) => {
        const name = typeof f?.name === "string" ? f.name.trim() : "";
        const key = typeof f?.key === "string" ? f.key.trim() : "";
        if (!name || !key) throw new AppError(`Field ${i + 1} needs a name and a key`, 400, "INVALID_FIELD");
        if (!FIELD_KEY_PATTERN.test(key)) {
            throw new AppError(`Field key "${key}" may only contain lowercase letters, digits and underscores`, 400, "INVALID_FIELD");
        }
        if (seen.has(key)) throw new AppError(`Field key "${key}" is used more than once`, 400, "DUPLICATE_FIELD_KEY");
        seen.add(key);
        if (f.id !== undefined) {
            if (typeof f.id !== "string" || !UUID_PATTERN.test(f.id)) {
                throw new AppError("Invalid field identity", 400, "INVALID_FIELD_ID");
            }
            if (seenIds.has(f.id)) {
                throw new AppError("Repeated field identity", 400, "DUPLICATE_FIELD_ID");
            }
            seenIds.add(f.id);
        }
        return {
            id: typeof f.id === "string" ? f.id : undefined,
            name,
            key,
            type: typeof f.type === "string" && f.type ? f.type : "text",
            required: Boolean(f.required),
            options: f.options && typeof f.options === "object" ? f.options : {},
        };
    });
}

/**
 * Saves field definitions without deleting existing ones (blueprint §10/§21): fields are
 * matched by stable id, then by key, so a renamed key keeps its identity. Fields omitted
 * from the request are retained and reported, because omission does not authorize deletion.
 */
export async function saveCustomFieldsHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { postType } = await authorizePostType(req, res, req.params.cptId);
        const incoming = parseIncomingFields(req.body?.fields);

        const result = await prisma.$transaction(async (tx) => {
            const existing = await tx.customField.findMany({ where: { postTypeId: postType.id } });
            const byId = new Map(existing.map((f) => [f.id, f]));
            const bySlug = new Map(existing.map((f) => [f.slug, f]));
            const matchedIds = new Set<string>();
            const plan = { added: [] as string[], modified: [] as string[], retained: [] as string[] };

            const matches = incoming.map((f) => {
                if (f.id && !byId.has(f.id)) {
                    throw new AppError("Field identity does not belong to this post type", 409, "FIELD_ID_MISMATCH");
                }
                const match = (f.id && byId.get(f.id)) || bySlug.get(f.key);
                if (match) matchedIds.add(match.id);
                return { f, match };
            });

            if (matchedIds.size !== matches.filter((entry) => entry.match).length) {
                throw new AppError("A saved field was referenced more than once", 400, "DUPLICATE_FIELD_ID");
            }
            const retained = existing.filter((f) => !matchedIds.has(f.id));
            const retainedSlugs = new Set(retained.map((f) => f.slug));
            for (const { f } of matches) {
                if (retainedSlugs.has(f.key)) {
                    throw new AppError(`Field key "${f.key}" is already used by another field`, 409, "DUPLICATE_FIELD_KEY");
                }
            }

            for (let order = 0; order < matches.length; order++) {
                const { f, match } = matches[order];
                const data = {
                    name: f.name,
                    slug: f.key,
                    type: f.type,
                    order,
                    config: { ...((match?.config as Record<string, any>) ?? {}), required: f.required, options: f.options },
                };
                if (match) {
                    await tx.customField.update({ where: { id: match.id }, data });
                    plan.modified.push(f.key);
                } else {
                    await tx.customField.create({ data: { postTypeId: postType.id, ...data } });
                    plan.added.push(f.key);
                }
            }
            plan.retained = retained.map((f) => f.slug);

            const fields = await tx.customField.findMany({ where: { postTypeId: postType.id }, orderBy: { order: "asc" } });
            return { plan, fields };
        });

        res.status(200).json({ success: true, data: result.fields.map(toApiField), migrationPlan: result.plan });
    } catch (e) { next(e); }
}

// ====== Custom Entries ======
export async function getCustomEntriesHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { postType } = await authorizePostType(req, res, req.params.cptId);
        const entries = await prisma.customEntry.findMany({
            where: { postTypeId: postType.id, deletedAt: null },
            include: { author: { select: { fullName: true, email: true } } },
            orderBy: { updatedAt: 'desc' }
        });
        res.status(200).json({ success: true, data: entries.map(toApiEntry) });
    } catch (e) { next(e); }
}

export async function createCustomEntryHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { postType } = await authorizePostType(req, res, req.params.cptId);
        const { title, slug, status, values } = req.body ?? {};
        if (!title || typeof title !== "string") {
            throw new AppError("title is required", 400, "INVALID_INPUT");
        }

        if (slug) {
            const existing = await prisma.customEntry.findFirst({ where: { postTypeId: postType.id, slug, deletedAt: null } });
            if (existing) {
                return res.status(409).json({ success: false, error: { message: "Slug already exists" } });
            }
        }

        const entry = await prisma.customEntry.create({
            data: {
                postTypeId: postType.id,
                title,
                slug: slug || null,
                status: status || "PUBLISHED",
                data: values && typeof values === "object" ? values : {},
                authorId: currentUserId(req, res),
            }
        });
        res.status(201).json({ success: true, data: toApiEntry(entry) });
    } catch (e) { next(e); }
}

export async function updateCustomEntryHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const entry = await authorizeEntry(req, res, req.params.entryId);
        if (entry.deletedAt) throw new AppError("Entry is in trash; restore it before editing", 409, "ENTRY_IN_TRASH");
        const { title, slug, status, values } = req.body ?? {};

        if (slug) {
            const clash = await prisma.customEntry.findFirst({
                where: { postTypeId: entry.postTypeId, slug, deletedAt: null, NOT: { id: entry.id } },
            });
            if (clash) {
                return res.status(409).json({ success: false, error: { message: "Slug already exists" } });
            }
        }

        const updated = await prisma.customEntry.update({
            where: { id: entry.id },
            data: {
                ...(title !== undefined ? { title } : {}),
                ...(slug !== undefined ? { slug: slug || null } : {}),
                ...(status !== undefined ? { status } : {}),
                ...(values !== undefined ? { data: values } : {}),
            }
        });
        res.status(200).json({ success: true, data: toApiEntry(updated) });
    } catch (e) { next(e); }
}

/** DELETE /entries/:entryId — moves the entry to trash (recoverable); a reason is required. */
export async function deleteCustomEntryHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const entry = await authorizeEntry(req, res, req.params.entryId);
        if (entry.deletedAt) throw new AppError("Entry is already in trash", 409, "ALREADY_IN_TRASH");
        const trashed = await trashEntry(entry, currentUserId(req, res), req.body ?? {});
        res.status(200).json({ success: true, data: toApiEntry(trashed) });
    } catch (e) { next(e); }
}

/** POST /entries/:entryId/restore — restores a trashed entry as a draft. */
export async function restoreCustomEntryHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const entry = await authorizeEntry(req, res, req.params.entryId);
        const restored = await restoreEntry(entry, currentUserId(req, res));
        res.status(200).json({ success: true, data: toApiEntry(restored) });
    } catch (e) { next(e); }
}

/** GET /types/:cptId/trash — trashed entries of a post type. */
export async function getTrashedEntriesHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { postType } = await authorizePostType(req, res, req.params.cptId);
        const entries = await prisma.customEntry.findMany({
            where: { postTypeId: postType.id, deletedAt: { not: null } },
            orderBy: { deletedAt: "desc" },
        });
        res.status(200).json({ success: true, data: entries.map(toApiEntry) });
    } catch (e) { next(e); }
}

/** POST /websites/:websiteId/purge-requests — owner/admin requests permanent deletion of trashed entries. */
export async function createPurgeRequestHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const websiteId = requireUuid(req.params.websiteId, "Website");
        const authTime = res.locals.session?.authTime ? new Date(res.locals.session.authTime) : null;
        const request = await createPurgeRequest(websiteId, currentUserId(req, res), authTime, req.body ?? {});
        res.status(201).json({ success: true, data: request });
    } catch (e) { next(e); }
}

/** GET /websites/:websiteId/purge-requests */
export async function listPurgeRequestsHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const websiteId = requireUuid(req.params.websiteId, "Website");
        await authorizeWebsite(req, res, websiteId);
        res.status(200).json({ success: true, data: await listPurgeRequests(websiteId) });
    } catch (e) { next(e); }
}

/** POST /purge-requests/:requestId/approve — an independent owner/admin approves. */
export async function approvePurgeRequestHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const approved = await approvePurgeRequest(requireUuid(req.params.requestId, "Purge request"), currentUserId(req, res));
        res.status(200).json({ success: true, data: approved });
    } catch (e) { next(e); }
}

/** POST /purge-requests/:requestId/execute — permanently deletes the approved, unchanged manifest. */
export async function executePurgeRequestHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await executePurgeRequest(requireUuid(req.params.requestId, "Purge request"), currentUserId(req, res));
        res.status(200).json({ success: true, ...result });
    } catch (e) { next(e); }
}
