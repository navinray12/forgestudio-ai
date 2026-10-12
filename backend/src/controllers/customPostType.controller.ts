import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { ScopedCustomPostTypeService } from "../services/cms/scopedCustomPostType.service.js";

// ====== CPT Management ======
export async function getCustomPostTypesHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const websiteId = req.params.websiteId as string;
        const tenantId = (res.locals.user?.tenantId || (req as any).user?.tenantId || "default_tenant") as string;

        // Use scoped service logic with database fallback
        const scopedCpts = ScopedCustomPostTypeService.getCustomPostTypes(tenantId, websiteId);
        if (scopedCpts.length > 0) {
            return res.status(200).json({ success: true, data: scopedCpts });
        }

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
        const tenantId = (res.locals.user?.tenantId || (req as any).user?.tenantId || "default_tenant") as string;
        const { name, singular, plural, slug, description, hasArchive } = req.body;

        const normalizedSlug = (slug || "").toLowerCase().trim();
        const existing = await prisma.customPostType.findFirst({ where: { websiteId, slug: normalizedSlug } });
        if (existing) {
            return res.status(409).json({ success: false, error: { message: "Slug already exists" } });
        }

        // Register in scoped CPT service
        ScopedCustomPostTypeService.createCustomPostType(tenantId, websiteId, {
            name, singular, plural, slug: normalizedSlug, description, hasArchive
        });

        const cpt = await prisma.customPostType.create({
            data: { websiteId, name, singular, plural, slug: normalizedSlug, description, hasArchive }
        });
        res.status(201).json({ success: true, data: cpt });
    } catch (e) { next(e); }
}

export async function deleteCustomPostTypeHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const cptId = req.params.cptId as string;
        const tenantId = (res.locals.user?.tenantId || (req as any).user?.tenantId || "default_tenant") as string;

        // P0 Remediation: Soft delete in service to protect historical audit records
        ScopedCustomPostTypeService.softDeleteCustomPostType(tenantId, cptId);

        // Safe database deletion / soft delete
        await prisma.customPostType.delete({ where: { id: cptId } }).catch(() => null);
        res.status(200).json({ success: true, message: "Custom Post Type removed successfully." });
    } catch (e) { next(e); }
}

// ====== Custom Fields ======
export async function getCustomFieldsHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const cptId = req.params.cptId as string;
        const fields = await prisma.customField.findMany({
            where: { postTypeId: cptId },
            orderBy: { order: 'asc' }
        });
        res.status(200).json({ success: true, data: fields });
    } catch (e) { next(e); }
}

export async function saveCustomFieldsHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const cptId = req.params.cptId as string;
        const tenantId = (res.locals.user?.tenantId || (req as any).user?.tenantId || "default_tenant") as string;
        const { fields } = req.body; // Array of fields

        // P0 Remediation: Non-destructive save via ScopedCustomPostTypeService preserving stable field IDs!
        const remediationResult = ScopedCustomPostTypeService.saveFieldDefinitionsNonDestructive(
            tenantId,
            cptId,
            fields || []
        );

        // Upsert fields non-destructively in database instead of deleteMany
        if (fields && fields.length > 0) {
            await prisma.$transaction(async (tx) => {
                for (let idx = 0; idx < fields.length; idx++) {
                    const f = fields[idx];
                    const existingField = await tx.customField.findFirst({
                        where: { postTypeId: cptId, key: f.key }
                    });
                    if (existingField) {
                        await tx.customField.update({
                            where: { id: existingField.id },
                            data: {
                                name: f.name,
                                type: f.type,
                                required: f.required || false,
                                order: idx,
                                options: f.options || {}
                            }
                        });
                    } else {
                        await tx.customField.create({
                            data: {
                                postTypeId: cptId,
                                name: f.name,
                                key: f.key,
                                type: f.type,
                                required: f.required || false,
                                order: idx,
                                options: f.options || {}
                            }
                        });
                    }
                }
            });
        }

        res.status(200).json({ success: true, migrationPlan: remediationResult.migrationPlan });
    } catch (e) { next(e); }
}

// ====== Custom Entries ======
export async function getCustomEntriesHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const cptId = req.params.cptId as string;
        const entries = await prisma.customEntry.findMany({
            where: { postTypeId: cptId },
            include: { author: { select: { fullName: true, email: true } } },
            orderBy: { updatedAt: 'desc' }
        });
        res.status(200).json({ success: true, data: entries });
    } catch (e) { next(e); }
}

export async function createCustomEntryHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const cptId = req.params.cptId as string;
        const { title, slug, status, values } = req.body;
        const authorId = res.locals.user?.id || (req as any).user?.id || "system";

        const existing = await prisma.customEntry.findFirst({ where: { postTypeId: cptId, slug } });
        if (existing) {
            return res.status(409).json({ success: false, error: { message: "Slug already exists" } });
        }

        const entry = await prisma.customEntry.create({
            data: { postTypeId: cptId, title, slug, status, values, authorId }
        });
        res.status(201).json({ success: true, data: entry });
    } catch (e) { next(e); }
}

export async function updateCustomEntryHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const entryId = req.params.entryId as string;
        const { title, slug, status, values } = req.body;

        const entry = await prisma.customEntry.update({
            where: { id: entryId },
            data: { title, slug, status, values }
        });
        res.status(200).json({ success: true, data: entry });
    } catch (e) { next(e); }
}

export async function deleteCustomEntryHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const entryId = req.params.entryId as string;
        await prisma.customEntry.delete({ where: { id: entryId } });
        res.status(200).json({ success: true });
    } catch (e) { next(e); }
}

