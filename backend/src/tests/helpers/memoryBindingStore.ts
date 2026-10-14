import { AppError } from "../../utils/app-error.js";
import type {
  EnvironmentBinding,
  EnvironmentBindingStore,
  EnvironmentClass,
} from "../../services/environment/environmentBinding.service.js";

/**
 * Test double for the binding store, for unit suites that exercise validation and pool resolution
 * without a database. It follows the same contract as PostgresEnvironmentBindingStore; persistence
 * itself is verified by environment-bindings.integration.test.ts.
 */
export class MemoryEnvironmentBindingStore implements EnvironmentBindingStore {
  private rows = new Map<string, EnvironmentBinding>();

  async find(projectId: string, envClass: EnvironmentClass) {
    return this.rows.get(`${projectId}:${envClass}`) ?? null;
  }

  async list(projectId: string) {
    return [...this.rows.values()].filter((b) => b.projectId === projectId);
  }

  async upsert(
    projectId: string,
    envClass: EnvironmentClass,
    expectedVersion: number | undefined,
    _actorId: string | undefined,
    build: (existing: EnvironmentBinding | null) => EnvironmentBinding
  ) {
    const key = `${projectId}:${envClass}`;
    const existing = this.rows.get(key) ?? null;
    if (expectedVersion !== undefined && expectedVersion !== (existing?.version ?? 0)) {
      throw new AppError("The binding changed since it was read", 409, "BINDING_VERSION_CONFLICT");
    }
    const next = build(existing);
    this.rows.set(key, next);
    return next;
  }

  async retire(projectId: string, envClass: EnvironmentClass) {
    const key = `${projectId}:${envClass}`;
    const existing = this.rows.get(key);
    if (!existing || existing.status !== "ACTIVE") return null;
    const retired = { ...existing, status: "RETIRED" as const, version: existing.version + 1 };
    this.rows.set(key, retired);
    return retired;
  }
}
