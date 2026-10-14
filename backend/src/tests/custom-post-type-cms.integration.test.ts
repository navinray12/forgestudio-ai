/**
 * Custom Post Type CMS on real PostgreSQL (blueprint §10, §21 P0).
 *
 * Exercises the served /api/cpt handlers against the disposable local forge_hardening database:
 * project-scoped authorization, non-destructive field saves with stable identity, the UI/database
 * field and entry mapping, and protection against cascading deletion of content.
 *
 * Run with: FORGE_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://…@localhost:5432/forge_hardening npx vitest run src/tests/custom-post-type-cms.integration.test.ts
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

const database = new URL(process.env.DATABASE_URL || "invalid:");
const optedIn =
  process.env.FORGE_DISPOSABLE_TEST_DB === "1" &&
  ["localhost", "127.0.0.1"].includes(database.hostname) &&
  database.pathname === "/forge_hardening";

describe.skipIf(!optedIn)("Custom Post Type CMS (disposable PostgreSQL)", async () => {
  const { prisma, pgPool } = await import("../config/prisma.js");
  const cpt = await import("../controllers/customPostType.controller.js");

  const marker = randomUUID().slice(0, 8);
  const users: Record<"owner" | "editor" | "outsider" | "coadmin", { id: string }> = {} as any;
  let websiteId = "";

  async function call(handler: any, userId: string, opts: { params?: any; body?: any; query?: any; authTime?: Date } = {}) {
    let status = 0;
    let payload: any;
    let error: any;
    const res: any = {
      locals: { user: { id: userId }, session: { authTime: opts.authTime ?? new Date() } },
      status(code: number) { status = code; return res; },
      json(body: any) { payload = body; return res; },
    };
    await handler({ params: opts.params || {}, body: opts.body || {}, query: opts.query || {} }, res, (err: any) => { error = err; });
    return { status: error ? error.statusCode ?? 500 : status, payload, error };
  }

  beforeAll(async () => {
    for (const role of ["owner", "editor", "outsider", "coadmin"] as const) {
      users[role] = await prisma.user.create({
        data: { fullName: `CPT ${role}`, email: `cpt-${role}-${marker}@example.test`, status: "ACTIVE" },
      });
    }
    const website = await prisma.website.create({
      data: { userId: users.owner.id, name: `CPT fixture ${marker}`, slug: `cpt-fixture-${marker}` },
    });
    websiteId = website.id;
    await prisma.websiteCollaborator.create({
      data: { websiteId, userId: users.editor.id, permission: "EDITOR" },
    });
    await prisma.websiteCollaborator.create({
      data: { websiteId, userId: users.coadmin.id, permission: "ADMIN" },
    });
  });

  afterAll(async () => {
    if (websiteId) await prisma.website.delete({ where: { id: websiteId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email: { endsWith: `-${marker}@example.test` } } });
    await prisma.$disconnect();
    await pgPool.end();
  });

  let postTypeId = "";
  let titleFieldId = "";

  it("creates a post type and stores the labels the UI collects", async () => {
    const created = await call(cpt.createCustomPostTypeHandler, users.owner.id, {
      params: { websiteId },
      body: { name: "Projects", singular: "Project", plural: "Projects", slug: "Projects", hasArchive: true },
    });
    expect(created.status).toBe(201);
    postTypeId = created.payload.data.id;
    const row = await prisma.customPostType.findUnique({ where: { id: postTypeId } });
    expect(row).toMatchObject({ slug: "projects", singular: "Project", plural: "Projects", hasArchive: true });
  });

  it("refuses another tenant's user on every post type, field and entry path", async () => {
    const outsider = users.outsider.id;
    expect((await call(cpt.getCustomPostTypesHandler, outsider, { params: { websiteId } })).status).toBe(404);
    expect((await call(cpt.createCustomPostTypeHandler, outsider, { params: { websiteId }, body: { name: "X", slug: "x" } })).status).toBe(404);
    expect((await call(cpt.getCustomFieldsHandler, outsider, { params: { cptId: postTypeId } })).status).toBe(404);
    expect((await call(cpt.saveCustomFieldsHandler, outsider, { params: { cptId: postTypeId }, body: { fields: [] } })).status).toBe(404);
    expect((await call(cpt.getCustomEntriesHandler, outsider, { params: { cptId: postTypeId } })).status).toBe(404);
    expect((await call(cpt.deleteCustomPostTypeHandler, outsider, { params: { cptId: postTypeId } })).status).toBe(404);
    expect(await prisma.customPostType.count({ where: { websiteId } })).toBe(1);
  });

  it("returns 404, not a database error, for malformed ids", async () => {
    const res = await call(cpt.getCustomFieldsHandler, users.owner.id, { params: { cptId: "not-a-uuid" } });
    expect(res.status).toBe(404);
  });

  it("saves fields through the UI shape and maps them onto slug/config", async () => {
    const saved = await call(cpt.saveCustomFieldsHandler, users.editor.id, {
      params: { cptId: postTypeId },
      body: {
        fields: [
          { name: "Title", key: "title", type: "text", required: true },
          { name: "Body", key: "body", type: "rich-text", required: false, options: { rows: 6 } },
        ],
      },
    });
    expect(saved.status).toBe(200);
    expect(saved.payload.migrationPlan.added).toEqual(["title", "body"]);
    expect(saved.payload.data.map((f: any) => [f.key, f.required])).toEqual([["title", true], ["body", false]]);
    titleFieldId = saved.payload.data[0].id;

    const rows = await prisma.customField.findMany({ where: { postTypeId }, orderBy: { order: "asc" } });
    expect(rows.map((r) => r.slug)).toEqual(["title", "body"]);
    expect(rows[1].config).toMatchObject({ required: false, options: { rows: 6 } });
  });

  it("keeps a field's identity when its key is renamed, and never deletes omitted fields", async () => {
    const renamed = await call(cpt.saveCustomFieldsHandler, users.owner.id, {
      params: { cptId: postTypeId },
      body: { fields: [{ id: titleFieldId, name: "Headline", key: "headline", type: "text", required: true }] },
    });
    expect(renamed.status).toBe(200);
    expect(renamed.payload.migrationPlan).toMatchObject({ added: [], modified: ["headline"], retained: ["body"] });

    const rows = await prisma.customField.findMany({ where: { postTypeId } });
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === titleFieldId)?.slug).toBe("headline");
  });

  it("rejects duplicate and invalid field keys without writing", async () => {
    const dup = await call(cpt.saveCustomFieldsHandler, users.owner.id, {
      params: { cptId: postTypeId },
      body: { fields: [{ name: "A", key: "same", type: "text" }, { name: "B", key: "same", type: "text" }] },
    });
    expect(dup.status).toBe(400);
    const clash = await call(cpt.saveCustomFieldsHandler, users.owner.id, {
      params: { cptId: postTypeId },
      body: { fields: [{ name: "Another body", key: "body", type: "text" }, { id: titleFieldId, name: "Headline", key: "headline", type: "text" }] },
    });
    expect(clash.status).toBe(200); // "body" matches the retained field by key, so it is an update
    const invalid = await call(cpt.saveCustomFieldsHandler, users.owner.id, {
      params: { cptId: postTypeId },
      body: { fields: [{ name: "Bad", key: "Bad Key!", type: "text" }] },
    });
    expect(invalid.status).toBe(400);
    expect(await prisma.customField.count({ where: { postTypeId } })).toBe(2);
  });

  let entryId = "";

  it("stores entry values in the data column and returns them as values", async () => {
    const created = await call(cpt.createCustomEntryHandler, users.editor.id, {
      params: { cptId: postTypeId },
      body: { title: "First project", slug: "first-project", status: "DRAFT", values: { headline: "Hello", body: "World" } },
    });
    expect(created.status).toBe(201);
    entryId = created.payload.data.id;
    expect(created.payload.data.values).toEqual({ headline: "Hello", body: "World" });
    const row = await prisma.customEntry.findUnique({ where: { id: entryId } });
    expect(row?.data).toEqual({ headline: "Hello", body: "World" });
    expect(row?.authorId).toBe(users.editor.id);

    const outsiderUpdate = await call(cpt.updateCustomEntryHandler, users.outsider.id, {
      params: { entryId },
      body: { title: "Hijacked" },
    });
    expect(outsiderUpdate.status).toBe(404);
    expect((await prisma.customEntry.findUnique({ where: { id: entryId } }))?.title).toBe("First project");

    const updated = await call(cpt.updateCustomEntryHandler, users.editor.id, {
      params: { entryId },
      body: { values: { headline: "Updated" } },
    });
    expect(updated.payload.data).toMatchObject({ title: "First project", values: { headline: "Updated" } });
  });

  it("moves entries to trash with a reason, hides them, and keeps the row", async () => {
    expect((await call(cpt.deleteCustomEntryHandler, users.editor.id, { params: { entryId } })).status).toBe(400);
    expect((await call(cpt.deleteCustomEntryHandler, users.outsider.id, { params: { entryId }, body: { reason: "x" } })).status).toBe(404);
    const trashed = await call(cpt.deleteCustomEntryHandler, users.editor.id, { params: { entryId }, body: { reason: "Out of date" } });
    expect(trashed.status).toBe(200);
    const row = await prisma.customEntry.findUnique({ where: { id: entryId } });
    expect(row).toMatchObject({ deleteReason: "Out of date", deletedById: users.editor.id });
    expect(row?.deletedAt).toBeInstanceOf(Date);
    expect((await call(cpt.getCustomEntriesHandler, users.editor.id, { params: { cptId: postTypeId } })).payload.data).toHaveLength(0);
    expect((await call(cpt.getTrashedEntriesHandler, users.editor.id, { params: { cptId: postTypeId } })).payload.data).toHaveLength(1);
    expect((await call(cpt.updateCustomEntryHandler, users.editor.id, { params: { entryId }, body: { title: "x" } })).status).toBe(409);
  });

  it("does not let a post type deletion cascade away trashed content", async () => {
    expect((await call(cpt.deleteCustomPostTypeHandler, users.editor.id, { params: { cptId: postTypeId } })).status).toBe(403);
    expect((await call(cpt.deleteCustomPostTypeHandler, users.owner.id, { params: { cptId: postTypeId } })).status).toBe(409);
    expect(await prisma.customEntry.count({ where: { postTypeId } })).toBe(1);
  });

  it("restores a trashed entry as a draft, refusing a slug now in use", async () => {
    const other = await call(cpt.createCustomEntryHandler, users.editor.id, {
      params: { cptId: postTypeId }, body: { title: "Same slug", slug: "first-project", status: "PUBLISHED", values: {} },
    });
    expect(other.status).toBe(201);
    expect((await call(cpt.restoreCustomEntryHandler, users.editor.id, { params: { entryId } })).status).toBe(409);
    await call(cpt.updateCustomEntryHandler, users.editor.id, { params: { entryId: other.payload.data.id }, body: { slug: "renamed" } });

    expect((await call(cpt.restoreCustomEntryHandler, users.outsider.id, { params: { entryId } })).status).toBe(404);
    const restored = await call(cpt.restoreCustomEntryHandler, users.editor.id, { params: { entryId } });
    expect(restored.status).toBe(200);
    expect(restored.payload.data).toMatchObject({ status: "DRAFT", deletedAt: null });
    await call(cpt.deleteCustomEntryHandler, users.editor.id, { params: { entryId }, body: { reason: "Superseded" } });
  });

  it("requires an independent approver and an unchanged manifest before purging", async () => {
    const create = (who: string, body: any, authTime?: Date) =>
      call(cpt.createPurgeRequestHandler, who, { params: { websiteId }, body, authTime });

    expect((await create(users.editor.id, { entryIds: [entryId], reason: "Cleanup" })).status).toBe(403);
    expect((await create(users.owner.id, { entryIds: [entryId] })).status).toBe(400);
    const notTrashed = (await call(cpt.getCustomEntriesHandler, users.owner.id, { params: { cptId: postTypeId } })).payload.data[0].id;
    expect((await create(users.owner.id, { entryIds: [notTrashed], reason: "Cleanup" })).status).toBe(409);
    expect((await create(users.owner.id, { entryIds: [entryId], reason: "Cleanup", singleOwnerException: true })).status).toBe(409);

    const request = await create(users.owner.id, { entryIds: [entryId], reason: "Cleanup" });
    expect(request.status).toBe(201);
    const requestId = request.payload.data.id;
    expect(request.payload.data.status).toBe("PENDING_APPROVAL");

    expect((await call(cpt.executePurgeRequestHandler, users.owner.id, { params: { requestId } })).status).toBe(409);
    expect((await call(cpt.approvePurgeRequestHandler, users.owner.id, { params: { requestId } })).status).toBe(403);
    expect((await call(cpt.approvePurgeRequestHandler, users.outsider.id, { params: { requestId } })).status).toBe(404);
    const approved = await call(cpt.approvePurgeRequestHandler, users.coadmin.id, { params: { requestId } });
    expect(approved.payload.data).toMatchObject({ status: "APPROVED", approvedById: users.coadmin.id });

    // The entry changes after approval: nothing may be purged on the stale approval.
    await call(cpt.restoreCustomEntryHandler, users.editor.id, { params: { entryId } });
    await call(cpt.deleteCustomEntryHandler, users.editor.id, { params: { entryId }, body: { reason: "Again" } });
    expect((await call(cpt.executePurgeRequestHandler, users.owner.id, { params: { requestId } })).status).toBe(409);
    expect(await prisma.customEntry.count({ where: { id: entryId } })).toBe(1);
    expect((await prisma.contentPurgeRequest.findUnique({ where: { id: requestId } }))?.status).toBe("APPROVED");

    // A fresh request, approved but past its expiry, is refused.
    const second = (await create(users.owner.id, { entryIds: [entryId], reason: "Cleanup" })).payload.data.id;
    await call(cpt.approvePurgeRequestHandler, users.coadmin.id, { params: { requestId: second } });
    await prisma.contentPurgeRequest.update({ where: { id: second }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await call(cpt.executePurgeRequestHandler, users.owner.id, { params: { requestId: second } })).status).toBe(409);
    expect((await prisma.contentPurgeRequest.findUnique({ where: { id: second } }))?.status).toBe("EXPIRED");

    const third = (await create(users.owner.id, { entryIds: [entryId], reason: "Cleanup" })).payload.data.id;
    await call(cpt.approvePurgeRequestHandler, users.coadmin.id, { params: { requestId: third } });
    expect((await call(cpt.executePurgeRequestHandler, users.outsider.id, { params: { requestId: third } })).status).toBe(404);
    const executed = await call(cpt.executePurgeRequestHandler, users.owner.id, { params: { requestId: third } });
    expect(executed.payload).toMatchObject({ purged: 1 });
    expect(await prisma.customEntry.count({ where: { id: entryId } })).toBe(0);
    expect((await call(cpt.executePurgeRequestHandler, users.owner.id, { params: { requestId: third } })).status).toBe(409);
  });

  it("allows the single-owner exception only with no other admin and a recent sign-in", async () => {
    await prisma.websiteCollaborator.deleteMany({ where: { websiteId, userId: users.coadmin.id } });
    const remaining = (await call(cpt.getCustomEntriesHandler, users.owner.id, { params: { cptId: postTypeId } })).payload.data[0].id;
    await call(cpt.deleteCustomEntryHandler, users.owner.id, { params: { entryId: remaining }, body: { reason: "Done" } });

    const stale = await call(cpt.createPurgeRequestHandler, users.owner.id, {
      params: { websiteId }, body: { entryIds: [remaining], reason: "Done", singleOwnerException: true },
      authTime: new Date(Date.now() - 60 * 60 * 1000),
    });
    expect(stale.status).toBe(401);
    const fresh = await call(cpt.createPurgeRequestHandler, users.owner.id, {
      params: { websiteId }, body: { entryIds: [remaining], reason: "Done", singleOwnerException: true },
    });
    expect(fresh.payload.data).toMatchObject({ status: "APPROVED", singleOwnerException: true, approvedById: users.owner.id });
    expect((await call(cpt.executePurgeRequestHandler, users.owner.id, { params: { requestId: fresh.payload.data.id } })).payload.purged).toBe(1);

    const deleted = await call(cpt.deleteCustomPostTypeHandler, users.owner.id, { params: { cptId: postTypeId } });
    expect(deleted.status).toBe(200);
  });
});
