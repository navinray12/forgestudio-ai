import { documentWriteContext } from "../services/websites/document-request.js";
import { documentETag } from "../services/websites/document-policy.js";
import { authorizeResourceAccess } from "../services/permission.service.js";
import { publishWebsite } from "../services/publishing.service.js";
import type { Request, Response, NextFunction } from "express";
import { getUserWebsites, getWebsiteById, updateWebsiteEditorData } from "../services/website.service.js";
import { AppError } from "../utils/app-error.js";

// Helper strictly filtering the response output mapping (F-118 Output Serialization)
const serializeWebsite = (ws: any) => ({
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    status: ws.status,
    documentVersion: ws.documentVersion,
    createdAt: ws.createdAt,
    updatedAt: ws.updatedAt,
});

export async function getDeveloperWebsitesHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const user = res.locals.user;
        const page = parseInt(req.query.page as string || "1", 10);
        let limit = parseInt(req.query.limit as string || "20", 10);

        if (limit > 100) limit = 100;

        let statusFilter = req.query.status as string | undefined;

        // Fetch using existing service and prune response.
        // F-118 Note: Pagination mapping at the db level isn't exposed in our current internal getUserWebsites gracefully, 
        // so we manually splice the user's data array as an immediate fallback.
        const websitesData = await getUserWebsites(user.id);
        let filtered = websitesData;

        if (statusFilter) {
            filtered = filtered.filter((w: any) => w.status === statusFilter?.toUpperCase());
        }

        const total = filtered.length;
        const startIndex = (page - 1) * limit;
        const paginated = filtered.slice(startIndex, startIndex + limit);

        return res.status(200).json({
            data: paginated.map(serializeWebsite),
            pagination: {
                page,
                limit,
                total
            }
        });
    } catch (e) {
        next(e);
    }
}

export async function getDeveloperWebsiteByIdHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const user = res.locals.user;
        const websiteId = req.params.id as string;

        const website = await getWebsiteById(websiteId, user.id); // Validates ownership implicitly via Service
        if (!website) {
            throw new AppError("Website not found or access denied.", 404, "NOT_FOUND");
        }

        res.setHeader("ETag", documentETag(website.id, website.documentVersion));
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({
            data: {
                ...serializeWebsite(website),
                editorData: website.editorData // Expose structured editorData safely.
            }
        });
    } catch (error: any) {
        if (error instanceof Error && error.message.includes("not found")) {
            return next(new AppError("Website not found or access denied.", 404, "NOT_FOUND"));
        }
        next(error);
    }
}

export async function updateDeveloperWebsiteHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const user = res.locals.user;
        const websiteId = req.params.id as string;

        // F-118: DO NOT completely blast over editorData via API blindly.
        // We only accept valid editorData subset PATCH mappings.
        const { editorData } = req.body;
        if (!editorData) {
            throw new AppError("Missing editorData payload.", 400, "INVALID_REQUEST");
        }

        // Implicit ownership verification and validation exists right inside updateWebsiteEditorData!
        // It validates priority integers structurally against floats/overflows globally.
        const website = await updateWebsiteEditorData(websiteId, user.id, editorData, undefined, documentWriteContext(req, websiteId));

        return res.status(200).json({
            data: serializeWebsite(website)
        });
    } catch (e) {
        next(e);
    }
}

export async function publishDeveloperWebsiteHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = res.locals.user.id;
        const websiteId = String(req.params.id);
        await authorizeResourceAccess(userId, websiteId, "*", "PUBLISH");
        // The publishing service owns validation, release snapshots and deployment state.
        // Merely rewriting snippet status is not a successful publication.
        const result = await publishWebsite(websiteId, userId, { environment: "PRODUCTION", destinationType: "INTERNAL" });
        return res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
}
