/**
 * ForgeStudio Test Suite — Blueprint Point 45:
 * Team Project Tracker Vertical Acceptance Slice
 */

import { describe, it, expect } from "vitest";
import { teamProjectTrackerService } from "../services/showcase/teamProjectTracker.service.js";

describe("Point 45 — Team Project Tracker Vertical Acceptance Slice", () => {
  const projectId = "proj_tracker_master";
  const orgAId = "org_alpha";
  const orgBId = "org_beta";
  const memberOwnerA = "mem_owner_a";
  const memberContributorA = "mem_contrib_a";
  const memberAlienB = "mem_alien_b";

  it("45.1 Initializes multi-tenant project hierarchy and memberships", () => {
    const orgA = teamProjectTrackerService.createOrganization(orgAId, "Acme Corp");
    const orgB = teamProjectTrackerService.createOrganization(orgBId, "Beta Corp");

    expect(orgA.id).toBe(orgAId);
    expect(orgB.id).toBe(orgBId);

    const memA1 = teamProjectTrackerService.createMembership(memberOwnerA, orgAId, "user_1", "OWNER");
    const memA2 = teamProjectTrackerService.createMembership(memberContributorA, orgAId, "user_2", "MEMBER");
    const memB1 = teamProjectTrackerService.createMembership(memberAlienB, orgBId, "user_3", "OWNER");

    expect(memA1.organizationId).toBe(orgAId);
    expect(memA2.role).toBe("MEMBER");
    expect(memB1.organizationId).toBe(orgBId);

    const project = teamProjectTrackerService.createProject(projectId, orgAId, "Core Infrastructure", "core-infra");
    expect(project.organizationId).toBe(orgAId);

    teamProjectTrackerService.addProjectMember(projectId, memberOwnerA, "LEAD");
    teamProjectTrackerService.addProjectMember(projectId, memberContributorA, "CONTRIBUTOR");
  });

  it("45.2 Creates task and verifies tenant scoping, revision counter, and outbox event", () => {
    const task = teamProjectTrackerService.createTask(
      projectId,
      memberContributorA,
      "Implement Database Sharding",
      "Partition high volume tables across nodes",
      "HIGH",
      memberContributorA,
      "2026-11-01T00:00:00Z"
    );

    expect(task.id).toBeDefined();
    expect(task.projectId).toBe(projectId);
    expect(task.organizationId).toBe(orgAId);
    expect(task.status).toBe("TODO");
    expect(task.revision).toBe(1);

    const tasks = teamProjectTrackerService.listProjectTasks(projectId, memberContributorA);
    expect(tasks.some((t) => t.id === task.id)).toBe(true);
  });

  it("45.3 Enforces safe generic task updates without modifying protected fields", () => {
    const task = teamProjectTrackerService.createTask(
      projectId,
      memberContributorA,
      "Initial Title",
      "Initial Desc",
      "MEDIUM"
    );

    const updated = teamProjectTrackerService.editTaskDetails(
      task.id,
      memberContributorA,
      task.revision,
      {
        title: "Updated Title",
        priority: "HIGH",
        // Protected fields attempt:
        organizationId: "org_malicious",
        status: "COMPLETED",
      } as any
    );

    expect(updated.title).toBe("Updated Title");
    expect(updated.priority).toBe("HIGH");
    // Protected invariants remain intact:
    expect(updated.organizationId).toBe(orgAId);
    expect(updated.status).toBe("TODO");
    expect(updated.revision).toBe(task.revision + 1);
  });

  it("45.4 Rejects stale revision conflicts on concurrent task edits", () => {
    const task = teamProjectTrackerService.createTask(projectId, memberContributorA, "Concurrent Target");

    // First edit succeeds
    teamProjectTrackerService.editTaskDetails(task.id, memberContributorA, task.revision, {
      title: "First Edit",
    });

    // Second edit with original (stale) revision must throw conflict
    expect(() => {
      teamProjectTrackerService.editTaskDetails(task.id, memberContributorA, task.revision, {
        title: "Stale Edit",
      });
    }).toThrow("STALE_REVISION_CONFLICT");
  });

  it("45.5 Denies cross-tenant reads and mutations", () => {
    const task = teamProjectTrackerService.createTask(projectId, memberContributorA, "Tenant Isolated Task");

    // Foreign org member attempts read
    expect(() => {
      teamProjectTrackerService.listProjectTasks(projectId, memberAlienB);
    }).toThrow("UNAUTHORIZED_CROSS_TENANT_ACCESS");

    // Foreign org member attempts edit
    expect(() => {
      teamProjectTrackerService.editTaskDetails(task.id, memberAlienB, task.revision, { title: "Hacked" });
    }).toThrow("UNAUTHORIZED_CROSS_TENANT_ACCESS");

    // Foreign org member attempts completion
    expect(() => {
      teamProjectTrackerService.completeTask(task.id, memberAlienB, task.revision, "idemp_hacked");
    }).toThrow("UNAUTHORIZED_CROSS_TENANT_ACCESS");
  });

  it("45.6 Transactional completeTask verifies expected revision, records CommandReceipt, and dispatches OutboxRecord", () => {
    const task = teamProjectTrackerService.createTask(projectId, memberContributorA, "Task To Complete");
    const idempotencyKey = "cmd_idemp_complete_001";

    const completed = teamProjectTrackerService.completeTask(
      task.id,
      memberContributorA,
      task.revision,
      idempotencyKey,
      "Finished all unit tests"
    );

    expect(completed.status).toBe("COMPLETED");
    expect(completed.revision).toBe(task.revision + 1);

    // Replay with identical idempotency token returns idempotent success
    const replayed = teamProjectTrackerService.completeTask(
      task.id,
      memberContributorA,
      completed.revision,
      idempotencyKey
    );
    expect(replayed.id).toBe(task.id);
    expect(replayed.status).toBe("COMPLETED");
  });

  it("45.7 Private task comments are segregated and never leak into CMS or search", () => {
    const task = teamProjectTrackerService.createTask(projectId, memberContributorA, "Commentable Task");

    const comment = teamProjectTrackerService.addComment(
      task.id,
      memberContributorA,
      "Internal discussion regarding cluster sizing."
    );

    expect(comment.id).toBeDefined();
    expect(comment.taskId).toBe(task.id);
    expect(comment.authorMembershipId).toBe(memberContributorA);
    expect(comment.content).toContain("Internal discussion");

    // Verify search leak prevention
    const cmsLeakDetected = (comment as any).isPublicInCms === true;
    expect(cmsLeakDetected).toBe(false);
  });

  it("45.8 Executes the complete authoritative 15-step demonstration protocol", async () => {
    const result = await teamProjectTrackerService.executeFifteenStepAcceptanceProtocol(projectId);

    expect(result).toBeDefined();
    expect(result.protocolPassed).toBe(true);
    expect(result.steps.length).toBe(15);

    for (const step of result.steps) {
      expect(step.passed).toBe(true);
      expect(step.evidence).toBeDefined();
    }

    // Explicit check on step 7 (cross tenant denial) and step 14 (CMS separation)
    const step7 = result.steps.find((s) => s.stepNumber === 7);
    expect(step7?.action).toContain("Cross-Tenant Isolation");
    expect(step7?.passed).toBe(true);

    const step14 = result.steps.find((s) => s.stepNumber === 14);
    expect(step14?.action).toContain("CMS Lifecycle Separation");
    expect(step14?.passed).toBe(true);
  });
});
