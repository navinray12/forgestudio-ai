/**
 * ForgeStudio Test Suite — Blueprint Point 42: Environment Bindings, Secrets and Isolation
 */

import { describe, it, expect } from "vitest";
import { environmentBindingService } from "../services/environment/environmentBinding.service.js";
import { targetResolutionService } from "../services/environment/targetResolution.service.js";

describe("Point 42 — Environment Bindings, Secrets and Isolation", () => {
  const projectId = "proj_env_42";

  describe("42.1 EnvironmentBinding Contract & Secret Reference Integrity", () => {
    it("registers an environment binding with hashed fingerprints and vault secret references", () => {
      const binding = environmentBindingService.registerBinding(projectId, "app_42", "DEVELOPMENT", {
        secretRef: "vault:keys:proj_42:dev_db",
      });

      expect(binding.bindingId).toContain("proj_env_42_dev");
      expect(binding.version).toBe(1);
      expect(binding.environmentClass).toBe("DEVELOPMENT");
      expect(binding.protectionLevel).toBe("SANDBOX");
      expect(binding.targetFingerprint).toBeTruthy();
      expect(binding.secretRef).toBe("vault:keys:proj_42:dev_db");
    });

    it("rejects raw connection strings or embedded passwords in secretRef", () => {
      expect(() =>
        environmentBindingService.registerBinding(projectId, "app_42", "DEVELOPMENT", {
          secretRef: "postgres://user:supersecretpassword@localhost:5432/db",
        })
      ).toThrowError("Raw credentials or connection strings must never be passed as secretRef");
    });

    it("requires step-up verification for production binding registration or mutation", () => {
      expect(() =>
        environmentBindingService.registerBinding(projectId, "app_42", "PRODUCTION", {
          secretRef: "vault:keys:proj_42:prod_db",
          stepUpVerified: false,
        })
      ).toThrowError("Production environment binding mutations require step-up verification");

      const prodBinding = environmentBindingService.registerBinding(projectId, "app_42", "PRODUCTION", {
        secretRef: "vault:keys:proj_42:prod_db",
        stepUpVerified: true,
      });

      expect(prodBinding.protectionLevel).toBe("RESTRICTED_PRODUCTION");
    });

    it("fails closed on missing or invalid environmentClass lookup", () => {
      expect(() => environmentBindingService.getBinding(projectId, "")).toThrowError("Explicit environmentClass selection is mandatory");
      expect(() => environmentBindingService.getBinding(projectId, "INVALID_ENV")).toThrowError("Invalid environment");
    });
  });

  describe("42.2 Target Resolution, Pooling, and Isolation", () => {
    it("resolves target pools incorporating bindingId, version, and role", () => {
      const pool = targetResolutionService.resolveTargetPool(projectId, "DEVELOPMENT", "runtime");

      expect(pool.poolKey).toContain("v1");
      expect(pool.status).toBe("ACTIVE");
      expect(pool.role).toContain("runtime");
    });

    it("gracefully drains obsolete pools during credential rotation", () => {
      // Rotate binding by incrementing version with step-up verification
      const rotatedBinding = environmentBindingService.registerBinding(projectId, "app_42", "DEVELOPMENT", {
        secretRef: "vault:keys:proj_42:dev_db_v2",
      });

      expect(rotatedBinding.version).toBe(2);

      const rotationResult = targetResolutionService.rotateCredentialsAndDrain(rotatedBinding);
      expect(rotationResult.drainedPoolKeys.length).toBeGreaterThanOrEqual(1);
      expect(rotationResult.newActivePoolKeys.length).toBeGreaterThanOrEqual(1);
    });

    it("quarantines and discards tainted connection when session reset fails", () => {
      const initialQuarantine = targetResolutionService.getQuarantinedCount();

      const normalRelease = targetResolutionService.handleConnectionRelease(false);
      expect(normalRelease.action).toBe("RETURN_TO_POOL");

      const taintedRelease = targetResolutionService.handleConnectionRelease(true);
      expect(taintedRelease.action).toBe("DISCARD_AND_QUARANTINE");
      expect(targetResolutionService.getQuarantinedCount()).toBe(initialQuarantine + 1);
    });

    it("verifies scratch database as disposable, and strictly forbids production as scratch target", () => {
      // Production scratch attempt fails closed
      expect(() =>
        targetResolutionService.verifyShadowDatabase({
          targetId: "target_prod_01",
          environment: "PRODUCTION",
          isDisposable: true,
          endpoint: "db.prod.internal",
        })
      ).toThrowError("CRITICAL INVARIANT VIOLATION: Production database can NEVER be used as a shadow or scratch database!");

      // Valid scratch database succeeds
      const shadow = targetResolutionService.verifyShadowDatabase({
        targetId: "target_scratch_01",
        environment: "DEVELOPMENT",
        isDisposable: true,
        endpoint: "db.scratch.internal",
      });

      expect(shadow.isDisposable).toBe(true);
      expect(shadow.verifiedIsolated).toBe(true);
    });

    it("performs comprehensive multi-check verification before staging -> production promotion", () => {
      const readiness = targetResolutionService.verifyPromotionReadiness(projectId, "PRODUCTION");
      expect(readiness.ready).toBe(true);
      expect(readiness.checks.every((c) => c.status === "PASS")).toBe(true);
    });
  });
});
