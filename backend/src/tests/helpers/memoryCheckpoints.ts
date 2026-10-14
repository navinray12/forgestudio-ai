/**
 * In-memory stand-in for workspaceCheckpoints.service used by suites that run on createMemoryDb().
 * It keeps the module's contract (atomic metadata update, gap-free per-project sequence, change-set
 * lookup, kind mapping); the real PostgreSQL behaviour is covered by
 * workspace-durable-sync.integration.test.ts.
 */
import { randomUUID, createHash } from "node:crypto";

export function memoryCheckpointsModule(getStore: () => { table: (model: string) => any[] }, real: { kindForSyncStatus: (s: any) => any }) {
  const rows = () => getStore().table("forgeWorkspaceCheckpoint");
  const toCheckpoint = (r: any) => ({ ...r });

  return {
    kindForSyncStatus: real.kindForSyncStatus,

    async updateProjectMetadataAtomic(projectId: string, mutate: (m: Record<string, any>) => void) {
      const project = getStore().table("forgeProject").find((p: any) => p.id === projectId);
      if (!project) return;
      const metadata = { ...(project.metadata && typeof project.metadata === "object" ? project.metadata : {}) };
      mutate(metadata);
      project.metadata = metadata;
      project.updatedAt = new Date();
    },

    async recordCheckpoint(input: any) {
      const site = input.websiteId ? getStore().table("website").find((w: any) => w.id === input.websiteId) : null;
      const files = getStore()
        .table("forgeProjectFile")
        .filter((f: any) => f.projectId === input.projectId && !f.deletedAt)
        .sort((a: any, b: any) => a.path.localeCompare(b.path));
      const sequence = rows().filter((r: any) => r.projectId === input.projectId).length + 1;
      const row = {
        id: randomUUID(),
        projectId: input.projectId,
        sequence,
        origin: input.origin,
        kind: input.kind,
        filePath: input.filePath ?? null,
        message: input.message ?? null,
        documentVersion: site?.documentVersion ?? null,
        documentHash: site ? createHash("sha256").update(JSON.stringify(site.editorData ?? null)).digest("hex") : null,
        sourceManifest: files.map((f: any) => ({ path: f.path, version: f.version, contentHash: f.contentHash })),
        changeSetId: input.changeSetId ?? null,
        response: input.response === undefined ? null : JSON.parse(JSON.stringify(input.response)),
        createdById: input.actorId ?? null,
        createdAt: new Date().toISOString(),
      };
      rows().push(row);
      return toCheckpoint(row);
    },

    async findCommittedChangeSet(projectId: string, changeSetId: string) {
      const row = rows().find((r: any) => r.projectId === projectId && r.changeSetId === changeSetId);
      return row ? { checkpoint: toCheckpoint(row), response: row.response } : null;
    },

    async getCheckpointState(projectId: string) {
      const mine = rows().filter((r: any) => r.projectId === projectId).sort((a: any, b: any) => b.sequence - a.sequence);
      return {
        latest: mine[0] ? toCheckpoint(mine[0]) : null,
        lastSynchronized: mine.find((r: any) => r.kind === "SYNCHRONIZED") ?? null,
      };
    },

    async listCheckpointsAfter(projectId: string, after: number, limit = 100) {
      return rows()
        .filter((r: any) => r.projectId === projectId && r.sequence > after)
        .sort((a: any, b: any) => a.sequence - b.sequence)
        .slice(0, limit)
        .map(toCheckpoint);
    },
  };
}
