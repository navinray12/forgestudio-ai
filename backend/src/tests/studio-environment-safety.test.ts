/**
 * Database Studio environment safety (blueprint §41.2, FS21-AT-ENV-02 / ENV-14).
 *
 * - Requests without an explicit environment, or with an unknown one, are rejected before any
 *   database access (no silent PRODUCTION default).
 * - Destructive PRODUCTION operations require a project owner/admin.
 * - PRODUCTION SQL runs in a PostgreSQL-enforced read-only transaction. That part runs against
 *   the real database in DATABASE_URL and is skipped when it is not reachable.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import pg from "pg";

const state = vi.hoisted(() => ({
  website: null as any,
  pool: null as any,
  dropTable: vi.fn(async () => undefined),
  mutateTableRow: vi.fn(async () => ({})),
  getDatabaseTables: vi.fn(async () => []),
}));

vi.mock("../config/prisma.js", () => ({
  prisma: { website: { findFirst: async () => state.website } },
  pgPool: { query: async () => ({ rows: [] }) },
}));

vi.mock("../modules/data-platform/common/pool-manager.js", () => ({
  TenantPoolManager: { getTenantPool: async () => state.pool },
}));

vi.mock("../modules/data-platform/studio/studio-schema.service.js", () => ({
  getDatabaseTables: state.getDatabaseTables,
  getTableDetails: vi.fn(),
  getSchemaDiagram: vi.fn(),
  createTable: vi.fn(),
  dropTable: state.dropTable,
  getTableRows: vi.fn(),
  mutateTableRow: state.mutateTableRow,
}));

const { resolveExplicitEnvironment, assertCanModify, verifyProjectAccess } = await import(
  "../modules/data-platform/common/project-access.js"
);
const { dropTableHandler, getTablesHandler, mutateTableRowHandler } = await import(
  "../modules/data-platform/studio/studio.controller.js"
);
const { executeUserQuery } = await import("../modules/data-platform/studio/studio-sql.service.js");

const OWNER = "11111111-1111-4111-8111-111111111111";
const EDITOR = "22222222-2222-4222-8222-222222222222";
const PROJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function websiteFor(callerRoles: { collaborator?: string; team?: string } = {}) {
  return {
    id: PROJECT,
    userId: OWNER,
    collaborators: callerRoles.collaborator ? [{ permission: callerRoles.collaborator }] : [],
    team: { members: callerRoles.team ? [{ role: callerRoles.team }] : [] },
    workspace: null,
    organization: null,
  };
}

async function invoke(handler: any, opts: { userId: string; query?: any; body?: any; params?: any }) {
  const req: any = {
    params: { projectId: PROJECT, ...(opts.params || {}) },
    query: opts.query || {},
    body: opts.body || {},
  };
  let status = 0;
  let payload: any;
  let error: any;
  const res: any = {
    locals: { user: { id: opts.userId } },
    status(code: number) {
      status = code;
      return res;
    },
    json(body: any) {
      payload = body;
      return res;
    },
  };
  await handler(req, res, (err: any) => {
    error = err;
  });
  return { status, payload, error };
}

describe("explicit environment resolution", () => {
  it("rejects a missing environment instead of defaulting to PRODUCTION", () => {
    expect(() => resolveExplicitEnvironment({ query: {}, body: {} } as any)).toThrowError(
      expect.objectContaining({ code: "ENVIRONMENT_REQUIRED", statusCode: 400 })
    );
  });

  it("rejects unknown environments instead of mapping them to PRODUCTION", () => {
    for (const value of ["staging", "dev", "prod", " "]) {
      expect(() => resolveExplicitEnvironment({ query: { environment: value }, body: {} } as any)).toThrow();
    }
  });

  it("accepts explicit environments from query or body, case-insensitively", () => {
    expect(resolveExplicitEnvironment({ query: { environment: "development" }, body: {} } as any)).toBe("DEVELOPMENT");
    expect(resolveExplicitEnvironment({ query: {}, body: { environment: "PRODUCTION" } } as any)).toBe("PRODUCTION");
  });
});

describe("project access roles", () => {
  it("treats the owner and OWNER/ADMIN members as administrators", async () => {
    state.website = websiteFor();
    expect((await verifyProjectAccess(PROJECT, OWNER)).canAdminister).toBe(true);
    state.website = websiteFor({ team: "ADMIN" });
    expect((await verifyProjectAccess(PROJECT, EDITOR)).canAdminister).toBe(true);
  });

  it("does not treat editors/designers as administrators", async () => {
    state.website = websiteFor({ collaborator: "EDITOR", team: "DESIGNER" });
    expect((await verifyProjectAccess(PROJECT, EDITOR)).canAdminister).toBe(false);
  });

  it("only gates PRODUCTION", () => {
    const editor = { website: { id: PROJECT, userId: OWNER }, canAdminister: false };
    expect(() => assertCanModify("DEVELOPMENT", editor, "drop tables")).not.toThrow();
    expect(() => assertCanModify("PRODUCTION", editor, "drop tables")).toThrowError(
      expect.objectContaining({ code: "PRODUCTION_WRITE_FORBIDDEN", statusCode: 403 })
    );
  });
});

describe("Studio handlers", () => {
  beforeEach(() => {
    state.dropTable.mockClear();
    state.mutateTableRow.mockClear();
    state.getDatabaseTables.mockClear();
  });

  it("drop table without an environment is rejected before touching any database", async () => {
    state.website = websiteFor();
    const { error } = await invoke(dropTableHandler, { userId: OWNER, params: { tableName: "orders" } });
    expect(error?.code).toBe("ENVIRONMENT_REQUIRED");
    expect(state.dropTable).not.toHaveBeenCalled();
  });

  it("an editor cannot drop or modify PRODUCTION data", async () => {
    state.website = websiteFor({ collaborator: "EDITOR" });
    const drop = await invoke(dropTableHandler, {
      userId: EDITOR,
      params: { tableName: "orders" },
      query: { environment: "PRODUCTION" },
    });
    expect(drop.error?.code).toBe("PRODUCTION_WRITE_FORBIDDEN");
    const mutate = await invoke(mutateTableRowHandler, {
      userId: EDITOR,
      params: { tableName: "orders" },
      query: { environment: "PRODUCTION" },
      body: { action: "DELETE", primaryKeyColumn: "id", primaryKeyValue: 1 },
    });
    expect(mutate.error?.code).toBe("PRODUCTION_WRITE_FORBIDDEN");
    expect(state.dropTable).not.toHaveBeenCalled();
    expect(state.mutateTableRow).not.toHaveBeenCalled();
  });

  it("an editor can still work in DEVELOPMENT, and the requested environment is passed through", async () => {
    state.website = websiteFor({ collaborator: "EDITOR" });
    const drop = await invoke(dropTableHandler, {
      userId: EDITOR,
      params: { tableName: "orders" },
      query: { environment: "development" },
    });
    expect(drop.status).toBe(200);
    expect(state.dropTable).toHaveBeenCalledWith(PROJECT, "orders", "DEVELOPMENT");
    const list = await invoke(getTablesHandler, { userId: EDITOR, query: { environment: "PREVIEW" } });
    expect(list.status).toBe(200);
    expect(state.getDatabaseTables).toHaveBeenCalledWith(PROJECT, "PREVIEW");
  });
});

const databaseUrl = process.env.DATABASE_URL;
let databaseReachable = false;
if (databaseUrl) {
  const probe = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });
  try {
    await probe.connect();
    databaseReachable = true;
  } catch {
    databaseReachable = false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

describe.skipIf(!databaseReachable)("PRODUCTION SQL read-only enforcement (real PostgreSQL)", () => {
  const probeTable = `forge_ro_probe_${process.pid}_${Date.now()}`;

  beforeAll(() => {
    state.pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  });

  afterAll(async () => {
    // Only reached if enforcement failed and a probe table was created.
    await state.pool.query(`DROP TABLE IF EXISTS ${probeTable}`).catch(() => undefined);
    await state.pool.end();
  });

  async function tableExists(): Promise<boolean> {
    const { rows } = await state.pool.query("SELECT to_regclass($1) AS t", [probeTable]);
    return rows[0].t !== null;
  }

  it("allows reads", async () => {
    const result = await executeUserQuery(PROJECT, "SELECT 1 AS ok", "PRODUCTION", { readOnly: true });
    expect(result.rows).toEqual([{ ok: 1 }]);
  });

  it("rejects DDL with PostgreSQL's read-only error", async () => {
    await expect(
      executeUserQuery(PROJECT, `CREATE TABLE ${probeTable} (id int)`, "PRODUCTION", { readOnly: true })
    ).rejects.toMatchObject({ code: "25006" });
    expect(await tableExists()).toBe(false);
  });

  it("cannot escape the read-only transaction with a COMMIT-prefixed batch", async () => {
    await expect(
      executeUserQuery(PROJECT, `COMMIT; CREATE TABLE ${probeTable} (id int)`, "PRODUCTION", { readOnly: true })
    ).rejects.toBeTruthy();
    expect(await tableExists()).toBe(false);
  });

  it("cannot switch the transaction back to read-write", async () => {
    await expect(
      executeUserQuery(PROJECT, "SET TRANSACTION READ WRITE", "PRODUCTION", { readOnly: true })
    ).rejects.toBeTruthy();
    await expect(
      executeUserQuery(
        PROJECT,
        "SELECT set_config('transaction_read_only', 'off', true)",
        "PRODUCTION",
        { readOnly: true }
      )
    ).rejects.toBeTruthy();
  });

  it("still allows writes outside PRODUCTION read-only mode", async () => {
    await expect(
      executeUserQuery(PROJECT, "CREATE TEMP TABLE forge_rw_probe (id int)", "DEVELOPMENT")
    ).resolves.toMatchObject({ rows: [] });
  });
});
