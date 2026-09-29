import type { Prisma } from "../../generated/prisma/index.js";
import { AppError } from "../../utils/app-error.js";
import { effectiveCapability } from "../permissions/effective-capability.js";
import { workspaceCommand } from "../workspaces/command.js";
import { getScopedWebsiteInTransaction } from "./scoped-access.js";
import { authorizeDocumentEdit, canonicalDocumentJson, documentObject, expectedDocumentVersion } from "./document-policy.js";

export interface DocumentWriteContext { key: string; expectedVersion: number; }
export interface DocumentPatch {
  name?: string; slug?: string; editorData?: unknown; performanceSettings?: unknown; status?: string;
}
export interface DocumentAcknowledgement {
  id: string; name: string; slug: string; status: string; documentVersion: number;
  updatedAt: string;
}
function normalizePatch(input: DocumentPatch): DocumentPatch {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new AppError("A document patch is required", 422, "DOCUMENT_INVALID");
  const allowed = new Set(["name", "slug", "editorData", "performanceSettings", "status"]);
  if (Object.keys(input).some(key => !allowed.has(key))) throw new AppError("Unknown writable field", 422, "DOCUMENT_INVALID");
  const patch: DocumentPatch = {};
  if (input.name !== undefined) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 255) throw new AppError("A bounded website name is required", 422, "DOCUMENT_INVALID");
    patch.name = input.name.trim();
  }
  if (input.slug !== undefined) {
    if (typeof input.slug !== "string" || !/^[a-z0-9](?:[a-z0-9-]{0,253}[a-z0-9])?$/.test(input.slug)) throw new AppError("Invalid website slug", 422, "DOCUMENT_INVALID");
    patch.slug = input.slug;
  }
  if (input.status !== undefined) patch.status = input.status;
  if (input.editorData !== undefined) patch.editorData = documentObject(input.editorData);
  if (input.performanceSettings !== undefined) {
    const settings = documentObject(input.performanceSettings);
    const flags = new Set(["lazyLoadImages", "optimizeImages", "minifyCss", "minifyJs", "enableCaching", "preloadFonts", "enableGzip", "deferScripts", "lazyLoadVideos", "enableImageOptimization", "enableLazyLoading", "enableMinification", "enableCdn", "reducedDom", "optimizedMedia", "reducedCss", "reducedJs", "lazyLoading", "fasterFonts", "assetDefer", "elementCaching", "performanceMode", "imageOptimization"]);
    if (Object.entries(settings).some(([key,value]) => !flags.has(key) || typeof value !== "boolean")) throw new AppError("Unsupported performance setting", 422, "DOCUMENT_INVALID");
    patch.performanceSettings = settings;
  }
  if (!Object.keys(patch).length) throw new AppError("No document changes were supplied", 422, "DOCUMENT_INVALID");
  canonicalDocumentJson(patch);
  return patch;
}
/** No network I/O in this transaction. Replayed acknowledgements are minimal;
 * they neither disclose historical documents nor grant continuing authority. */
export async function saveWebsiteDocument(websiteId: string, actorId: string, input: DocumentPatch, write: DocumentWriteContext) {
  const version = expectedDocumentVersion(write?.expectedVersion);
  const patch = normalizePatch(input);
  const payload = canonicalDocumentJson({ websiteId, expectedVersion: version, patch });
  const result = await workspaceCommand({
    actorId, operation: "WEBSITE_DOCUMENT_SAVED", key: write?.key, payload,
    authorize: async tx => {
      const website = await getScopedWebsiteInTransaction(tx, websiteId, actorId);
      if (!website.organizationId || !website.workspaceId) throw new AppError("Website ownership migration is required before editing", 503, "TENANT_MIGRATION_REQUIRED");
      if (website.workspaceStatus !== "ACTIVE") throw new AppError("This workspace is read-only", 409, "WORKSPACE_READ_ONLY");
      const overrides = await tx.granularPermission.findMany({ where: { websiteId, userId: actorId }, take: 1001 });
      if (overrides.length > 1000) throw new AppError("Permission policy exceeds the supported budget", 503, "POLICY_BUDGET_EXCEEDED");
      const can = (capability: string, resourceId = "*") => effectiveCapability({ role: website.userPermission, archived: false, resourceId, capability, overrides });
      if (!can("EDIT_DESIGN") && !can("EDIT_CONTENT") && !can("MANAGE_SETTINGS")) throw new AppError("Document editing is not permitted", 403, "DOCUMENT_EDIT_FORBIDDEN");
      return { organizationId: website.organizationId, website, can };
    },
    execute: async (tx, { website, can }) => {
      if (website.documentVersion !== version) throw new AppError("The website changed after you loaded it. Reload or compare your unsaved changes before saving.", 412, "DOCUMENT_VERSION_CONFLICT");
      if (patch.status !== undefined && patch.status !== website.status) throw new AppError("Use the authorized publishing operation to change publication state", 403, "PUBLISH_COMMAND_REQUIRED");
      const data: Prisma.WebsiteUpdateInput = {};
      if (patch.name !== undefined && patch.name !== website.name) {
        if (!can("EDIT_DESIGN") && !can("MANAGE_SETTINGS")) throw new AppError("Website rename is not permitted", 403, "DOCUMENT_EDIT_FORBIDDEN");
        data.name = patch.name;
      }
      if (patch.slug !== undefined && patch.slug !== website.slug) {
        if (!can("MANAGE_SETTINGS")) throw new AppError("Website URL changes require management permission", 403, "DOCUMENT_EDIT_FORBIDDEN");
        if (await tx.website.findFirst({where:{slug:patch.slug,id:{not:websiteId}},select:{id:true}})) throw new AppError("This website URL is already in use", 409, "WEBSITE_SLUG_CONFLICT");
        data.slug = patch.slug;
      }
      if (patch.performanceSettings !== undefined) {
        if (!can("MANAGE_SETTINGS")) throw new AppError("Performance settings require management permission", 403, "DOCUMENT_EDIT_FORBIDDEN");
        data.performanceSettings = patch.performanceSettings as Prisma.InputJsonValue;
      }
      if (patch.editorData !== undefined) {
        const current = documentObject(typeof website.editorData === "string" ? JSON.parse(website.editorData) : website.editorData);
        const accesses = await tx.componentAccess.findMany({ where: { websiteId, userId: actorId, permission: "EDIT" }, take: 1001 });
        if (accesses.length > 1000) throw new AppError("Component policy exceeds the supported budget", 503, "POLICY_BUDGET_EXCEEDED");
        const editableProtectedIds = new Set(accesses.filter(access => can("EDIT", access.componentId)).map(access => access.componentId));
        data.editorData = authorizeDocumentEdit(current, patch.editorData as ReturnType<typeof documentObject>, {
          canDesign: can("EDIT_DESIGN"), canContent: can("EDIT_CONTENT"), canManage: can("MANAGE_PERMISSIONS"), canSeo: can("EDIT_SEO"), editableProtectedIds,
        }) as Prisma.InputJsonValue;
      }
      const saved = await tx.website.update({ where: { id: websiteId, documentVersion: version }, data,
        select: { id: true, name: true, slug: true, status: true, documentVersion: true, updatedAt: true } });
      const acknowledgement: DocumentAcknowledgement = { ...saved, updatedAt: saved.updatedAt.toISOString() };
      return { resourceId: websiteId, website: acknowledgement };
    },
  });
  return result.website;
}
