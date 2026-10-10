/**
 * Minimal in-memory stand-in for the Prisma client used by the Website-to-Code
 * tests, so persistence and API behaviour can be verified without touching a
 * real database. Supports the query shapes the project services actually use.
 */
import { randomUUID, createHash } from "node:crypto";
import zlib from "node:zlib";

type Row = Record<string, any>;

// Like a real database client, queries hand back copies rather than live rows
const copy = <T,>(row: T): T => (row && typeof row === "object" ? ({ ...row } as T) : row);

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  for (const [key, expected] of Object.entries(where)) {
    if (expected === undefined) continue;
    if (key === "OR") {
      if (!(expected as Row[]).some((w) => matches(row, w))) return false;
      continue;
    }
    if (key === "AND") {
      if (!(expected as Row[]).every((w) => matches(row, w))) return false;
      continue;
    }
    const actual = row[key];
    if (expected === null) {
      if (actual !== null && actual !== undefined) return false;
    } else if (expected instanceof Date) {
      if (!(actual instanceof Date) || actual.getTime() !== expected.getTime()) return false;
    } else if (typeof expected === "object") {
      if ("in" in expected) {
        if (!(expected.in as any[]).includes(actual)) return false;
      } else if ("not" in expected) {
        if (expected.not === null ? actual === null || actual === undefined : actual === expected.not) return false;
      } else if (!(key in row)) {
        // Compound unique key, e.g. { workspaceId_userId: { workspaceId, userId } }
        if (!matches(row, expected)) return false;
      } else if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        return false;
      }
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

function sortRows(rows: Row[], orderBy: any): Row[] {
  const order = Array.isArray(orderBy) ? orderBy[0] : orderBy;
  if (!order) return rows;
  const [field, dir] = Object.entries(order)[0] as [string, string];
  return [...rows].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return dir === "desc" ? -cmp : cmp;
  });
}

export function createMemoryDb() {
  const tables = new Map<string, Row[]>();
  /** Test hook: throw from the next matching write, to exercise failure handling */
  const failures: Array<{ model: string; op: string; when: (args: any) => boolean; error: Error }> = [];

  const table = (model: string) => {
    if (!tables.has(model)) tables.set(model, []);
    return tables.get(model)!;
  };

  const maybeFail = (model: string, op: string, args: any) => {
    const idx = failures.findIndex((f) => f.model === model && f.op === op && f.when(args));
    if (idx >= 0) {
      const [failure] = failures.splice(idx, 1);
      throw failure.error;
    }
  };

  const delegate = (model: string) => ({
    async findUnique(args: any) {
      return copy(table(model).find((r) => matches(r, args?.where)) ?? null);
    },
    async findFirst(args: any = {}) {
      return copy(sortRows(table(model).filter((r) => matches(r, args.where)), args.orderBy)[0] ?? null);
    },
    async findMany(args: any = {}) {
      const rows = sortRows(table(model).filter((r) => matches(r, args.where)), args.orderBy);
      const skipped = args.skip ? rows.slice(args.skip) : rows;
      return (args.take ? skipped.slice(0, args.take) : skipped).map(copy);
    },
    async count(args: any = {}) {
      return table(model).filter((r) => matches(r, args.where)).length;
    },
    async create(args: any) {
      maybeFail(model, "create", args);
      const now = new Date();
      const row = { id: randomUUID(), createdAt: now, updatedAt: now, deletedAt: null, ...args.data };
      table(model).push(row);
      return copy(row);
    },
    async update(args: any) {
      maybeFail(model, "update", args);
      const row = table(model).find((r) => matches(r, args.where));
      if (!row) throw new Error(`Record to update not found in ${model}`);
      Object.assign(row, args.data, { updatedAt: new Date() });
      return copy(row);
    },
    async updateMany(args: any) {
      const rows = table(model).filter((r) => matches(r, args.where));
      rows.forEach((r) => Object.assign(r, args.data));
      return { count: rows.length };
    },
    async delete(args: any) {
      const rows = table(model);
      const idx = rows.findIndex((r) => matches(r, args.where));
      if (idx < 0) throw new Error(`Record to delete not found in ${model}`);
      return rows.splice(idx, 1)[0];
    },
  });

  const delegates = new Map<string, ReturnType<typeof delegate>>();
  const db: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then") return undefined;
        if (prop === "$transaction") return async (fn: any) => (typeof fn === "function" ? fn(db) : Promise.all(fn));
        if (prop === "$disconnect" || prop === "$connect") return async () => undefined;
        if (!delegates.has(prop)) delegates.set(prop, delegate(prop));
        return delegates.get(prop);
      },
    }
  );

  return {
    db,
    table,
    reset: () => {
      tables.clear();
      failures.length = 0;
    },
    failNext: (model: string, op: string, when: (args: any) => boolean, message: string) => {
      failures.push({ model, op, when, error: new Error(message) });
    },
  };
}

/** Seed an active user plus a valid session; returns the bearer token for that session */
export function seedUserSession(
  mem: ReturnType<typeof createMemoryDb>,
  user: { id: string; role?: string; email?: string }
): string {
  const token = `test-session-${user.id}-${randomUUID()}`;
  const now = new Date();
  const userRow = { id: user.id, role: user.role || "USER", email: user.email || `${user.id}@example.test`, status: "ACTIVE", authEpoch: 1 };
  mem.table("user").push(userRow);
  mem.table("session").push({
    id: randomUUID(),
    tokenHash: createHash("sha256").update(token).digest("hex"),
    userId: user.id,
    user: userRow,
    revokedAt: null,
    expiresAt: new Date(now.getTime() + 3_600_000),
    authEpoch: 1,
    audience: "TENANT",
    authTime: new Date(now.getTime() - 1000),
    authMethod: "local",
    lastUsedAt: now,
  });
  return token;
}

export interface ZipEntry {
  name: string;
  data: Buffer;
}

/**
 * Strict ZIP reader: walks the central directory, inflates every entry and
 * verifies its CRC-32 and size, so a structurally invalid archive fails loudly.
 */
export function readZip(buffer: Buffer): ZipEntry[] {
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 0xffff); i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a ZIP archive: end-of-central-directory record not found");

  const total = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < total; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Corrupt ZIP central directory");
    const method = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLen);

    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Corrupt local header for ${name}`);
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? Buffer.from(raw) : method === 8 ? zlib.inflateRawSync(raw) : null;
    if (!data) throw new Error(`Unsupported compression method ${method} for ${name}`);
    if (data.length !== uncompressedSize) throw new Error(`Size mismatch for ${name}`);
    if ((zlib as any).crc32(data) !== crc) throw new Error(`CRC mismatch for ${name}`);

    if (!name.endsWith("/")) entries.push({ name, data });
    offset += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}
