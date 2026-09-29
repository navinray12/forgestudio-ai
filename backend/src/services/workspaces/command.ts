import { createHash } from "crypto";
import { prisma } from "../../config/prisma.js";
import { isRetryableTransactionConflict } from "../../config/transaction-conflict.js";
import { AppError } from "../../utils/app-error.js";
import type { WorkspaceTransaction } from "./access.js";
import { requireActiveActor } from "./access.js";

type Result = { resourceId: string; [key: string]: unknown };
type Scope = { organizationId: string };

/** Single database commit for result, mutation, mandatory audit and outbox intent.
 * Authorization is reevaluated before journal replay; journal data is not a grant.
 */
export async function workspaceCommand<C extends Scope, R extends Result>(input: {
  actorId: string; operation: string; key: string; payload: unknown;
  authorize: (tx: WorkspaceTransaction) => Promise<C>;
  execute: (tx: WorkspaceTransaction, context: C) => Promise<R>;
  authorizeReplay?: (tx: WorkspaceTransaction, result: R) => Promise<void>;
}): Promise<R> {
  if (typeof input.key !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(input.key)) {
    throw new AppError("A valid Idempotency-Key is required", 400, "IDEMPOTENCY_KEY_REQUIRED");
  }
  const hash = createHash("sha256").update(JSON.stringify(input.payload)).digest("hex");
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await requireActiveActor(tx, input.actorId);
        const context = await input.authorize(tx);
        await tx.$queryRaw`SELECT set_config('app.tenant_id', ${context.organizationId}, true)`;
        const recorded = await tx.$queryRaw<Array<{ requestHash: string; result: R }>>`
          SELECT "requestHash", result FROM workspace_command_journal
          WHERE "organizationId"=${context.organizationId}::uuid AND "actorId"=${input.actorId}::uuid
            AND operation=${input.operation} AND "idempotencyKey"=${input.key}
        `;
        if (recorded[0]) {
          if (recorded[0].requestHash !== hash) throw new AppError("Idempotency key was used for different input", 409, "IDEMPOTENCY_CONFLICT");
          if (input.authorizeReplay) await input.authorizeReplay(tx, recorded[0].result);
          return recorded[0].result;
        }
        const result = await input.execute(tx, context);
        const encoded = JSON.stringify(result);
        await tx.auditLog.create({ data: {
          userId: input.actorId, action: input.operation, targetResource: `workspace-operation:${result.resourceId}`,
          details: { organizationId: context.organizationId, requestHash: hash },
        } });
        await tx.$executeRaw`
          INSERT INTO workspace_outbox ("organizationId","actorId",operation,"resourceId")
          VALUES (${context.organizationId}::uuid,${input.actorId}::uuid,${input.operation},${result.resourceId}::uuid)
        `;
        await tx.$executeRaw`
          INSERT INTO workspace_command_journal ("organizationId","actorId",operation,"idempotencyKey","requestHash",result)
          VALUES (${context.organizationId}::uuid,${input.actorId}::uuid,${input.operation},${input.key},${hash},${encoded}::jsonb)
        `;
        return JSON.parse(encoded) as R;
      }, { isolationLevel: "Serializable", maxWait: 2000, timeout: 5000 });
    } catch (error) {
      const failure = error as { code?: string; meta?: { code?: string } };
      const conflict = isRetryableTransactionConflict(error);
      if (conflict && attempt < 2) continue;
      if (conflict) throw new AppError("A concurrent change could not be completed; retry with the same key", 409, "CONCURRENT_CHANGE");
      if (failure.code === "P2010" && failure.meta?.code === "42P01") {
        throw new AppError("Workspace schema migration is required", 503, "MIGRATION_REQUIRED");
      }
      throw error;
    }
  }
}
