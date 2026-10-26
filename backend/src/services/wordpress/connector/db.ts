import { prisma } from "../../../config/prisma.js";

// Database handle used by the connector (the shared prisma client, untyped).
// Moved verbatim from connector.service.ts (now a compatibility entry point that re-exports the public API).

export const db = prisma as any;
