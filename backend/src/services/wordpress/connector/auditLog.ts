import { db } from "./db.js";

// Connector audit log entries (errors swallowed, as before).
// Moved verbatim from connector.service.ts (now a compatibility entry point that re-exports the public API).

/**
 * Record structured Audit Log event
 */
export async function recordAuditLog(userId: string, action: string, websiteId: string, details?: any) {
  try {
    if (db?.auditLog?.create) {
      await db.auditLog.create({
        data: {
          userId,
          action,
          targetResource: `website:${websiteId}`,
          details: details || {},
        },
      });
    }
  } catch (e) {}
}
