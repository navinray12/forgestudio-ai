import "dotenv/config";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not defined");

function positiveInteger(name: string, fallback: number, maximum: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximum) {
    throw new Error(`${name} exceeds the supported limit`);
  }
  return value;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: pg.Pool | undefined;
};

export const pgPool = globalForPrisma.pgPool ?? new pg.Pool({
  connectionString,
  max: positiveInteger("DATABASE_POOL_MAX", 5, 100),
  connectionTimeoutMillis: positiveInteger("DATABASE_ACQUIRE_TIMEOUT_MS", 2000, 30000),
  idleTimeoutMillis: positiveInteger("DATABASE_IDLE_TIMEOUT_MS", 30000, 300000),
  statement_timeout: positiveInteger("DATABASE_STATEMENT_TIMEOUT_MS", 5000, 60000),
  idle_in_transaction_session_timeout: 10000,
});
const adapter = new PrismaPg(pgPool);
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pgPool;
}

// Importing the database client must not modify schema, migration history or
// accounts. Migrations and first-admin provisioning use separate operator-owned
// procedures. In particular, a restart must never reset an administrator password.
export default prisma;
