import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SYSTEM_PERMISSIONS,
  BUILTIN_ROLES,
  createCustomRole,
  validateDelegationAuthority,
  evaluateEffectivePermissions,
} from "../services/ownerExperience/dynamicPermissionEngine.service.js";
import {
  authorizeAction,
  issueJobLeaseToken,
  revalidateJobExecutionAuthority,
  completeJobLease,
  type AuthorizationContext,
} from "../services/ownerExperience/authoritativeAuthorization.service.js";

describe("Point 11 — Dynamic Permissions & Authoritative Authorization", () => {
  it("should maintain independent separation of high-risk permissions", () => {
    // 1. Content editing vs content publishing separation
    const editPerm = SYSTEM_PERMISSIONS["perm:content:edit"];
    const pubPerm = SYSTEM_PERMISSIONS["perm:content:publish"];
    assert.ok(editPerm, "Edit content permission must exist");
    assert.ok(pubPerm, "Publish content permission must exist");
    assert.notEqual(editPerm.id, pubPerm.id, "Edit and publish must be distinct permission IDs");
    assert.equal(pubPerm.riskClassification, "HIGH", "Publishing must be high risk");

    // 2. High-risk permissions require step-up MFA or independent approval
    assert.equal(
      SYSTEM_PERMISSIONS["perm:code:approve"].requiredApproval,
      "STEP_UP_MFA",
      "Code approval must require step-up MFA"
    );
    assert.equal(
      SYSTEM_PERMISSIONS["perm:secrets:manage"].requiredApproval,
      "STEP_UP_MFA",
      "Secrets management must require step-up MFA"
    );
    assert.equal(
      SYSTEM_PERMISSIONS["perm:purge:execute"].requiredApproval,
      "INDEPENDENT_APPROVER",
      "Permanent purge must require independent approver"
    );
    assert.equal(
      SYSTEM_PERMISSIONS["perm:account:transfer"].requiredApproval,
      "INDEPENDENT_APPROVER",
      "Account transfer must require independent approver"
    );
  });

  it("should ensure Content Editor cannot publish directly", () => {
    const editorRole = BUILTIN_ROLES["CONTENT_EDITOR"];
    assert.ok(editorRole, "Content editor role must exist");
    assert.ok(
      editorRole.permissions.includes("perm:content:edit"),
      "Content editor must hold edit permission"
    );
    assert.ok(
      !editorRole.permissions.includes("perm:content:publish"),
      "Content editor must NOT hold direct publish permission"
    );
    assert.ok(
      !editorRole.permissions.includes("perm:purge:execute"),
      "Content editor must NOT hold purge permission"
    );
  });

  it("should prevent unauthorized delegation when assigner lacks permissions", () => {
    const designerRole = BUILTIN_ROLES["DESIGNER"];
    const adminRole = BUILTIN_ROLES["ADMIN"];

    // Designer trying to assign Admin role (which has permissions designer doesn't have)
    const delegation = validateDelegationAuthority(designerRole.permissions, adminRole);
    assert.equal(delegation.allowed, false, "Designer must not be allowed to delegate Admin role");
    assert.ok(
      delegation.violations.includes("perm:secrets:manage") ||
        delegation.violations.includes("perm:content:publish"),
      "Violations must record missing permissions"
    );

    // Creating custom role with unpossessed permission must throw UNAUTHORIZED_DELEGATION
    assert.throws(
      () => {
        createCustomRole({
          creatorId: "designer-1",
          creatorPermissions: designerRole.permissions,
          name: "Escalated Designer",
          description: "Attempting to grant secrets management",
          permissions: ["perm:design:edit", "perm:secrets:manage"],
        });
      },
      (err: any) => err.code === "UNAUTHORIZED_DELEGATION",
      "Must throw UNAUTHORIZED_DELEGATION"
    );
  });

  it("should allow legitimate custom role creation within creator authority", () => {
    const adminRole = BUILTIN_ROLES["ADMIN"];
    const customRole = createCustomRole({
      creatorId: "admin-1",
      creatorPermissions: adminRole.permissions,
      name: "Junior Content Specialist",
      description: "Custom role for content drafting and seo",
      permissions: ["perm:content:edit", "perm:seo:manage", "perm:overview:view"],
    });

    assert.ok(customRole.id.startsWith("role:custom:"), "Role ID must have custom prefix");
    assert.equal(customRole.permissions.length, 3);
    assert.equal(customRole.version, 1);
  });

  it("should enforce explicit DENY overrides strictly over base role grants", () => {
    const result = evaluateEffectivePermissions({
      role: "OWNER",
      overrides: [
        {
          permissionId: "perm:pii:export",
          effect: "DENY",
          resourceScope: "*",
        },
      ],
    });

    assert.ok(
      !result.allowedPermissions.has("perm:pii:export"),
      "Explicit DENY must revoke permission from OWNER"
    );
    assert.ok(result.deniedPermissions.has("perm:pii:export"));
    assert.ok(
      result.allowedPermissions.has("perm:content:publish"),
      "Other permissions must remain intact"
    );
  });

  it("should enforce step-up MFA and dual-custody approval in authoritative engine", async () => {
    const adminContext: AuthorizationContext = {
      userId: "admin-user",
      userRole: "ADMIN",
      userStatus: "ACTIVE",
      workspaceId: "ws-1",
      mfaVerified: false, // MFA NOT verified
    };

    // Attempting secrets management without MFA must fail
    await assert.rejects(
      async () => {
        await authorizeAction({
          context: adminContext,
          requiredPermissionId: "perm:secrets:manage",
        });
      },
      (err: any) => err.code === "STEP_UP_MFA_REQUIRED",
      "Must require step-up MFA"
    );

    // With MFA verified, should pass
    const mfaAdminContext = { ...adminContext, mfaVerified: true };
    const authResult = await authorizeAction({
      context: mfaAdminContext,
      requiredPermissionId: "perm:secrets:manage",
    });
    assert.equal(authResult.authorized, true);

    // Attempting permanent purge without independent approver must fail
    const ownerContext: AuthorizationContext = {
      userId: "owner-user",
      userRole: "OWNER",
      userStatus: "ACTIVE",
      workspaceId: "ws-1",
      mfaVerified: true,
      independentApproverId: undefined, // Missing independent approver
    };

    await assert.rejects(
      async () => {
        await authorizeAction({
          context: ownerContext,
          requiredPermissionId: "perm:purge:execute",
        });
      },
      (err: any) => err.code === "INDEPENDENT_APPROVAL_REQUIRED",
      "Must require independent approver"
    );

    // With independent approver, purge must authorize
    const dualCustodyContext = { ...ownerContext, independentApproverId: "approver-user" };
    const purgeAuth = await authorizeAction({
      context: dualCustodyContext,
      requiredPermissionId: "perm:purge:execute",
    });
    assert.equal(purgeAuth.authorized, true);
  });

  it("should revalidate long-running job authority and revoke stale authority at commit time", async () => {
    const jobId = "job:export-leads-101";
    const userRole = "ADMIN";

    // 1. Issue job lease token
    const token = issueJobLeaseToken({
      jobId,
      userId: "operator-1",
      workspaceId: "ws-1",
      userRole,
      roleVersion: 1,
      requiredPermissions: ["perm:pii:export"],
    });
    assert.ok(token, "Job token must be issued");

    // 2. User has active authority while job executes
    const activeContext: AuthorizationContext = {
      userId: "operator-1",
      userRole: "ADMIN",
      userStatus: "ACTIVE",
      workspaceId: "ws-1",
    };
    const validCheck = await revalidateJobExecutionAuthority({ jobId, currentContext: activeContext });
    assert.equal(validCheck.valid, true);

    // 3. User gets downgraded to REVIEWER or suspended before job commits!
    const downgradedContext: AuthorizationContext = {
      userId: "operator-1",
      userRole: "REVIEWER", // Downgraded! No longer has perm:pii:export
      userStatus: "ACTIVE",
      workspaceId: "ws-1",
    };

    await assert.rejects(
      async () => {
        await revalidateJobExecutionAuthority({ jobId, currentContext: downgradedContext });
      },
      (err: any) => err.code === "STALE_JOB_AUTHORITY_REVOKED",
      "Must revoke stale job authority upon role downgrade"
    );

    completeJobLease(jobId);
  });
});
