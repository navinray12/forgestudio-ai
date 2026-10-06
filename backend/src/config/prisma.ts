import "dotenv/config";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { createFallbackModelDelegate, isDynamicFallbackModel, setFallbackPool } from "./prisma-fallback.js";

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
  max: positiveInteger("DATABASE_POOL_MAX", 10, 100),
  connectionTimeoutMillis: positiveInteger("DATABASE_ACQUIRE_TIMEOUT_MS", 10000, 30000),
  idleTimeoutMillis: positiveInteger("DATABASE_IDLE_TIMEOUT_MS", 30000, 300000),
  statement_timeout: positiveInteger("DATABASE_STATEMENT_TIMEOUT_MS", 30000, 60000),
  idle_in_transaction_session_timeout: 30000,
});
setFallbackPool(pgPool);
const adapter = new PrismaPg(pgPool);
const basePrisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

const fallbackDelegatesCache = new Map<string, any>();

export const prisma = new Proxy(basePrisma, {
  get(target, prop, receiver) {
    if (typeof prop === "string" && isDynamicFallbackModel(prop) && !(prop in target)) {
      if (!fallbackDelegatesCache.has(prop)) {
        fallbackDelegatesCache.set(prop, createFallbackModelDelegate(prop));
      }
      return fallbackDelegatesCache.get(prop);
    }
    return Reflect.get(target, prop, receiver);
  },
}) as PrismaClient & Record<string, any>;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma as any;
  globalForPrisma.pgPool = pgPool;
}

// Importing the database client must not modify schema, migration history or
// accounts. Migrations and first-admin provisioning use separate operator-owned
// procedures. In particular, a restart must never reset an administrator password.
export default prisma;

