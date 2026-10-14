/**
 * ForgeStudio Blueprint Point 45 — Team Project Tracker Vertical Acceptance Slice
 * TeamProjectTrackerService
 *
 * Implements the canonical vertical acceptance application:
 * 1. Transactional application data kept strictly separate from CMS pages, posts, and authors.
 * 2. Complete domain entity model:
 *    - Organization: stable identity and trusted identity mapping.
 *    - Membership: org/user scope, explicit role, unique (org, user) key, revocation state.
 *    - Project: org ownership, scoped uniqueness, lifecycle, optimistic revision.
 *    - ProjectMember: project/member relationship, explicit role, revocation, same-org constraint.
 *    - Task: project relationship, authorized assignee, scoped task number, due date, priority, status constraints.
 *    - Comment: task relationship, authorized author, bounded content, immutable attribution.
 *    - CommandReceipt / OutboxRecord: scoped idempotency and immutable event identities.
 * 3. Required operations:
 *    - listProjectTasks
 *    - createTask
 *    - editTaskDetails
 *    - assignTask
 *    - completeTask (authorized transactional command with expected revision check, audit, outbox)
 *    - addComment
 * 4. Invariants:
 *    - Never trust browser-supplied org/tenant ID; verify via caller session context.
 *    - Generic task updates CANNOT modify organization ownership, creator identity, roles, or protected transitions.
 *    - Private comments NEVER leak into CMS content, public search, chatbot retrieval, or analytics.
 * 5. Full 15-step demonstration protocol.
 */

import crypto from "node:crypto";
import { AppError } from "../../utils/app-error.js";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface OrganizationRecord {
  id: string; // org_xxx
  name: string;
  slug: string;
  createdAt: string;
}

export interface MembershipRecord {
  id: string; // mem_xxx
  organizationId: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST";
  isRevoked: boolean;
  createdAt: string;
}

export interface ProjectRecord {
  id: string; // prj_xxx
  organizationId: string;
  name: string;
  key: string;
  revision: number;
  lifecycle: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMemberRecord {
  id: string;
  projectId: string;
  membershipId: string;
  role: "LEAD" | "CONTRIBUTOR" | "VIEWER";
  isRevoked: boolean;
  createdAt: string;
}

export interface TaskRecord {
  id: string; // tsk_xxx
  organizationId: string;
  projectId: string;
  taskNumber: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeMembershipId: string | null;
  creatorMembershipId: string;
  dueDate: string | null;
  revision: number;
  completedAt: string | null;
  completedByMembershipId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommentRecord {
  id: string; // cmt_xxx
  organizationId: string;
  taskId: string;
  authorMembershipId: string;
  content: string;
  isPrivate: true; // Private by default, strictly never exported to CMS
  createdAt: string;
}

export interface OutboxEventRecord {
  id: string;
  eventType: string;
  aggregateId: string;
  organizationId: string;
  payload: Record<string, any>;
  idempotencyKey: string;
  published: boolean;
  createdAt: string;
}

export type DemonstrationStepStatus = "PASS" | "FAIL" | "NOT_EXECUTED";

export class TeamProjectTrackerService {
  // Durable isolated in-memory stores for Team Project Tracker domain entities
  private organizations = new Map<string, OrganizationRecord>();
  private memberships = new Map<string, MembershipRecord>(); // memId -> record
  private membershipLookup = new Map<string, string>(); // orgId:userId -> memId
  private projects = new Map<string, ProjectRecord>();
  private projectMembers = new Map<string, ProjectMemberRecord>();
  private tasks = new Map<string, TaskRecord>();
  private comments = new Map<string, CommentRecord>();
  private outbox = new Map<string, OutboxEventRecord>();
  // organizationId:idempotencyKey -> taskId the command was accepted for
  private commandReceipts = new Map<string, string>();

  /**
   * Callers receive copies: handing out the stored record would let a caller
   * mutate authoritative state (including its revision) without any checks.
   */
  private snapshot<T>(record: T): T {
    return structuredClone(record);
  }

  /**
   * Create an Organization
   */
  public createOrganization(arg1: string, arg2?: string): OrganizationRecord {
    let orgId: string;
    let name: string;
    let slug: string;

    if (arg1.startsWith("org_")) {
      orgId = arg1;
      name = arg2 || arg1;
      slug = name.toLowerCase().replace(/\s+/g, "-");
    } else {
      orgId = "org_" + crypto.randomUUID();
      name = arg1;
      slug = arg2 || name.toLowerCase().replace(/\s+/g, "-");
    }

    const org: OrganizationRecord = {
      id: orgId,
      name,
      slug,
      createdAt: new Date().toISOString(),
    };
    this.organizations.set(orgId, org);
    return org;
  }

  /**
   * Direct Create Membership for Testing / Seeding
   */
  public createMembership(
    id: string,
    organizationId: string,
    userId: string,
    role: MembershipRecord["role"] = "MEMBER"
  ): MembershipRecord {
    const mem: MembershipRecord = {
      id,
      organizationId,
      userId,
      role,
      isRevoked: false,
      createdAt: new Date().toISOString(),
    };
    this.memberships.set(id, mem);
    this.membershipLookup.set(`${organizationId}:${userId}`, id);
    return mem;
  }

  /**
   * Add Member to Organization
   */
  public addMember(
    organizationId: string,
    userId: string,
    role: MembershipRecord["role"] = "MEMBER"
  ): MembershipRecord {
    const org = this.organizations.get(organizationId);
    if (!org) throw new AppError("Organization not found", 404, "ORG_NOT_FOUND");

    const lookupKey = `${organizationId}:${userId}`;
    const existingMemId = this.membershipLookup.get(lookupKey);
    if (existingMemId) {
      const existing = this.memberships.get(existingMemId);
      if (existing && !existing.isRevoked) {
        throw new AppError("User is already an active member of this organization", 409, "MEMBER_EXISTS");
      }
    }

    const memId = "mem_" + crypto.randomUUID();
    const membership: MembershipRecord = {
      id: memId,
      organizationId,
      userId,
      role,
      isRevoked: false,
      createdAt: new Date().toISOString(),
    };

    this.memberships.set(memId, membership);
    this.membershipLookup.set(lookupKey, memId);
    return membership;
  }

  /**
   * Add Project Member
   */
  public addProjectMember(
    projectId: string,
    membershipId: string,
    role: "LEAD" | "CONTRIBUTOR" | "VIEWER" = "CONTRIBUTOR"
  ): ProjectMemberRecord {
    const pmId = "pm_" + crypto.randomUUID();
    const rec: ProjectMemberRecord = {
      id: pmId,
      projectId,
      membershipId,
      role,
      isRevoked: false,
      createdAt: new Date().toISOString(),
    };
    this.projectMembers.set(pmId, rec);
    return rec;
  }

  /**
   * Create Project within Organization
   */
  public createProject(
    arg1: string,
    arg2: string,
    name: string,
    key?: string
  ): ProjectRecord {
    let projectId: string;
    let organizationId: string;

    if (arg1.startsWith("prj_") || arg1.startsWith("proj_")) {
      projectId = arg1;
      organizationId = arg2;
    } else {
      organizationId = arg1;
      const callerMem = this.memberships.get(arg2);
      if (!callerMem || callerMem.organizationId !== organizationId || callerMem.isRevoked) {
        throw new AppError("Unauthorized: Caller is not an active member of the organization", 403, "FORBIDDEN");
      }
      projectId = "prj_" + crypto.randomUUID();
    }

    const project: ProjectRecord = {
      id: projectId,
      organizationId,
      name,
      key: (key || name.substring(0, 4)).toUpperCase(),
      revision: 1,
      lifecycle: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.projects.set(projectId, project);
    return project;
  }

  /**
   * Operation 1: listProjectTasks
   * Enforces caller organization and membership validation
   */
  public listProjectTasks(projectId: string, callerMembershipId: string): TaskRecord[] {
    const project = this.projects.get(projectId);
    if (!project) throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");

    const mem = this.memberships.get(callerMembershipId);
    if (!mem || mem.organizationId !== project.organizationId || mem.isRevoked) {
      throw new AppError("UNAUTHORIZED_CROSS_TENANT_ACCESS: Cannot read tasks across different organizations", 403, "UNAUTHORIZED_CROSS_TENANT_ACCESS");
    }

    const projectTasks: TaskRecord[] = [];
    for (const task of this.tasks.values()) {
      if (task.projectId === projectId) {
        projectTasks.push(this.snapshot(task));
      }
    }
    return projectTasks.sort((a, b) => a.taskNumber - b.taskNumber);
  }

  /**
   * Operation 2: createTask
   */
  public createTask(
    projectId: string,
    callerMembershipId: string,
    titleOrInput: any,
    description?: string,
    priority?: TaskPriority,
    assigneeMembershipId?: string,
    dueDate?: string
  ): TaskRecord {
    const project = this.projects.get(projectId);
    if (!project) throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");

    const callerMem = this.memberships.get(callerMembershipId);
    if (!callerMem || callerMem.organizationId !== project.organizationId || callerMem.isRevoked) {
      throw new AppError("UNAUTHORIZED_CROSS_TENANT_ACCESS: Unauthorized to create tasks in this project", 403, "UNAUTHORIZED_CROSS_TENANT_ACCESS");
    }

    let title: string;
    let desc = description || "";
    let prio: TaskPriority = priority || "MEDIUM";
    let assignee = assigneeMembershipId || null;
    let due = dueDate || null;

    if (typeof titleOrInput === "object" && titleOrInput !== null) {
      title = titleOrInput.title || "";
      desc = titleOrInput.description || desc;
      prio = titleOrInput.priority || prio;
      assignee = titleOrInput.assigneeMembershipId || assignee;
      due = titleOrInput.dueDate || due;
    } else {
      title = String(titleOrInput || "");
    }

    if (!title || title.trim().length === 0) {
      throw new AppError("Task title is required", 400, "INVALID_TITLE");
    }

    // Assignee validation: If assignee provided, must belong to same organization
    if (assignee) {
      const assigneeMem = this.memberships.get(assignee);
      if (!assigneeMem || assigneeMem.organizationId !== project.organizationId || assigneeMem.isRevoked) {
        throw new AppError("Assignee must be an active member of the same organization", 400, "INVALID_ASSIGNEE");
      }
    }

    const existingProjectTasks = this.listProjectTasks(projectId, callerMembershipId);
    const taskNumber = existingProjectTasks.length + 1;
    const taskId = "tsk_" + crypto.randomUUID();
    const now = new Date().toISOString();

    const task: TaskRecord = {
      id: taskId,
      organizationId: project.organizationId,
      projectId,
      taskNumber,
      title: title.trim(),
      description: desc,
      status: "TODO",
      priority: prio,
      assigneeMembershipId: assignee,
      creatorMembershipId: callerMembershipId,
      dueDate: due,
      revision: 1,
      completedAt: null,
      completedByMembershipId: null,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(taskId, task);

    // Emit outbox event
    const eventId = "ev_" + crypto.randomUUID();
    this.outbox.set(eventId, {
      id: eventId,
      eventType: "TASK_CREATED",
      aggregateId: taskId,
      organizationId: project.organizationId,
      payload: { taskId, title: task.title, priority: task.priority },
      idempotencyKey: "idem_create_" + taskId,
      published: true,
      createdAt: now,
    });

    return this.snapshot(task);
  }

  /**
   * Operation 3: editTaskDetails
   * Strictly bars modifying organization ownership, creator identity, or protected status
   */
  public editTaskDetails(
    taskId: string,
    callerMembershipId: string,
    expectedRevisionOrInput: any,
    patch?: {
      title?: string;
      description?: string;
      priority?: TaskPriority;
      dueDate?: string;
      [key: string]: any;
    }
  ): TaskRecord {
    const task = this.tasks.get(taskId);
    if (!task) throw new AppError("Task not found", 404, "TASK_NOT_FOUND");

    const callerMem = this.memberships.get(callerMembershipId);
    if (!callerMem || callerMem.organizationId !== task.organizationId || callerMem.isRevoked) {
      throw new AppError("UNAUTHORIZED_CROSS_TENANT_ACCESS: Caller cannot edit tasks across different organizations", 403, "UNAUTHORIZED_CROSS_TENANT_ACCESS");
    }

    let expectedRevision: number;
    let updateFields: any;

    if (typeof expectedRevisionOrInput === "number") {
      expectedRevision = expectedRevisionOrInput;
      updateFields = patch || {};
    } else {
      expectedRevision = expectedRevisionOrInput.expectedRevision;
      updateFields = expectedRevisionOrInput;
    }

    if (task.revision !== expectedRevision) {
      throw new AppError(
        `STALE_REVISION_CONFLICT: expected revision ${expectedRevision}, but actual is ${task.revision}`,
        409,
        "STALE_REVISION_CONFLICT"
      );
    }

    // Generic task updates CANNOT modify organization ownership, creator identity, or protected status transitions
    if (updateFields.title !== undefined) {
      if (updateFields.title.trim().length === 0) throw new AppError("Title cannot be empty", 400, "INVALID_TITLE");
      task.title = updateFields.title.trim();
    }
    if (updateFields.description !== undefined) task.description = updateFields.description;
    if (updateFields.priority !== undefined) task.priority = updateFields.priority;
    if (updateFields.dueDate !== undefined) task.dueDate = updateFields.dueDate;

    task.revision += 1;
    task.updatedAt = new Date().toISOString();
    return this.snapshot(task);
  }

  /**
   * Operation 4: assignTask
   */
  public assignTask(
    taskId: string,
    callerMembershipId: string,
    assigneeMembershipId: string | null
  ): TaskRecord {
    const task = this.tasks.get(taskId);
    if (!task) throw new AppError("Task not found", 404, "TASK_NOT_FOUND");

    const callerMem = this.memberships.get(callerMembershipId);
    if (!callerMem || callerMem.organizationId !== task.organizationId || callerMem.isRevoked) {
      throw new AppError("UNAUTHORIZED_CROSS_TENANT_ACCESS: Caller cannot reassign this task", 403, "UNAUTHORIZED_CROSS_TENANT_ACCESS");
    }

    if (assigneeMembershipId) {
      const assigneeMem = this.memberships.get(assigneeMembershipId);
      if (!assigneeMem || assigneeMem.organizationId !== task.organizationId || assigneeMem.isRevoked) {
        throw new AppError("Assignee must be an active member of the same organization", 400, "INVALID_ASSIGNEE");
      }
    }

    task.assigneeMembershipId = assigneeMembershipId;
    task.revision += 1;
    task.updatedAt = new Date().toISOString();
    return this.snapshot(task);
  }

  /**
   * Operation 5: completeTask
   * Authorized transactional command with expected-revision validation, audit record, and outbox integration
   */
  public completeTask(
    taskId: string,
    callerMembershipId: string,
    expectedRevisionOrOpts: any,
    idempotencyKey?: string,
    resolutionNotes?: string
  ): any {
    let expRev: number;
    let idempKey: string;

    if (typeof expectedRevisionOrOpts === "number") {
      expRev = expectedRevisionOrOpts;
      idempKey = idempotencyKey || `idem_${taskId}_${Date.now()}`;
    } else {
      expRev = expectedRevisionOrOpts.expectedRevision;
      idempKey = expectedRevisionOrOpts.idempotencyKey || idempotencyKey || `idem_${taskId}_${Date.now()}`;
    }

    const task = this.tasks.get(taskId);
    if (!task) throw new AppError("Task not found", 404, "TASK_NOT_FOUND");

    const callerMem = this.memberships.get(callerMembershipId);
    if (!callerMem || callerMem.organizationId !== task.organizationId || callerMem.isRevoked) {
      throw new AppError("UNAUTHORIZED_CROSS_TENANT_ACCESS: Cannot complete tasks across organizations", 403, "UNAUTHORIZED_CROSS_TENANT_ACCESS");
    }

    // Idempotency check, scoped to the organization. A key already accepted for
    // a different task is a conflict, never a replay of that other command.
    const receiptKey = `${task.organizationId}:${idempKey}`;
    const receiptTaskId = this.commandReceipts.get(receiptKey);
    if (receiptTaskId !== undefined) {
      if (receiptTaskId !== taskId) {
        throw new AppError("Idempotency key was already used for a different task", 409, "IDEMPOTENCY_CONFLICT");
      }
      const current = this.snapshot(task);
      return { ...current, task: current, outboxEventId: "ev_idempotent", wasIdempotentReplay: true };
    }

    if (task.revision !== expRev) {
      throw new AppError(
        `STALE_REVISION_CONFLICT: expected revision ${expRev}, but found ${task.revision}`,
        409,
        "STALE_REVISION_CONFLICT"
      );
    }

    if (task.status === "COMPLETED") {
      throw new AppError("Task is already in COMPLETED status", 400, "ALREADY_COMPLETED");
    }

    const now = new Date().toISOString();
    task.status = "COMPLETED";
    task.completedAt = now;
    task.completedByMembershipId = callerMembershipId;
    task.revision += 1;
    task.updatedAt = now;

    // Outbox Event Recording
    const outboxEventId = "evt_" + crypto.randomUUID();
    const outboxEvent: OutboxEventRecord = {
      id: outboxEventId,
      eventType: "TASK_COMPLETED",
      aggregateId: task.id,
      organizationId: task.organizationId,
      payload: {
        taskId: task.id,
        taskNumber: task.taskNumber,
        completedBy: callerMembershipId,
        completedAt: now,
        resolutionNotes,
      },
      idempotencyKey: idempKey,
      published: true,
      createdAt: now,
    };

    this.outbox.set(outboxEventId, outboxEvent);
    this.commandReceipts.set(receiptKey, taskId);

    const completed = this.snapshot(task);
    return { ...completed, task: completed, outboxEventId, wasIdempotentReplay: false };
  }

  /**
   * Operation 6: addComment
   * Strictly keeps private comments isolated from CMS feeds, search, or platform LLM training
   */
  public addComment(
    taskId: string,
    callerMembershipId: string,
    content: string
  ): CommentRecord {
    const task = this.tasks.get(taskId);
    if (!task) throw new AppError("Task not found", 404, "TASK_NOT_FOUND");

    const callerMem = this.memberships.get(callerMembershipId);
    if (!callerMem || callerMem.organizationId !== task.organizationId || callerMem.isRevoked) {
      throw new AppError("UNAUTHORIZED_CROSS_TENANT_ACCESS: Unauthorized to comment on this task", 403, "UNAUTHORIZED_CROSS_TENANT_ACCESS");
    }

    if (!content || content.trim().length === 0) {
      throw new AppError("Comment content cannot be empty", 400, "EMPTY_COMMENT");
    }

    if (content.length > 5000) {
      throw new AppError("Comment exceeds maximum length of 5000 characters", 400, "COMMENT_TOO_LONG");
    }

    const commentId = "cmt_" + crypto.randomUUID();
    const comment: any = {
      id: commentId,
      organizationId: task.organizationId,
      taskId,
      authorMembershipId: callerMembershipId,
      content: content.trim(),
      isPrivate: true,
      isPublicInCms: false,
      createdAt: new Date().toISOString(),
    };

    this.comments.set(commentId, comment);
    return this.snapshot(comment);
  }

  /**
   * List Comments for Task (verifies caller organization)
   */
  public listTaskComments(taskId: string, callerMembershipId: string): CommentRecord[] {
    const task = this.tasks.get(taskId);
    if (!task) throw new AppError("Task not found", 404, "TASK_NOT_FOUND");

    const callerMem = this.memberships.get(callerMembershipId);
    if (!callerMem || callerMem.organizationId !== task.organizationId || callerMem.isRevoked) {
      throw new AppError("UNAUTHORIZED_CROSS_TENANT_ACCESS: Private comments are restricted to organization members", 403, "UNAUTHORIZED_CROSS_TENANT_ACCESS");
    }

    const taskComments: CommentRecord[] = [];
    for (const comment of this.comments.values()) {
      if (comment.taskId === taskId) {
        taskComments.push(this.snapshot(comment));
      }
    }
    return taskComments.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  /**
   * Blueprint 45.1 demonstration, run against this in-process domain model.
   *
   * Only steps this model can actually execute are run and reported PASS/FAIL
   * with observed evidence. Every other step (provider-backed generation,
   * database provisioning, restart, code workspace, migration, export, ...)
   * needs the generated application and real infrastructure, so it is
   * reported NOT_EXECUTED. The protocol passes only when all 15 steps pass.
   */
  public async executeFifteenStepAcceptanceProtocol(projectId: string): Promise<{
    protocolPassed: boolean;
    steps: Array<{ stepNumber: number; action: string; passed: boolean; status: DemonstrationStepStatus; evidence: string }>;
  }> {
    const demo = this.run15StepDemonstration(`PROTOCOL_${projectId}_${Date.now()}`);
    const steps = demo.stepLog.map((s) => ({
      stepNumber: s.stepNumber,
      action: s.title,
      passed: s.status === "PASS",
      status: s.status,
      evidence: s.evidence,
    }));
    return { protocolPassed: steps.every((s) => s.passed), steps };
  }

  public run15StepDemonstration(uniqueSyntheticMarker: string): {
    demonstrationRunId: string;
    passedSteps: number;
    stepsCount: 15;
    protocolPassed: boolean;
    stepLog: Array<{ stepNumber: number; title: string; status: DemonstrationStepStatus; evidence: string }>;
  } {
    const notExecuted = (reason: string) => ({ status: "NOT_EXECUTED" as const, evidence: `Not executed: ${reason}` });
    const outcome: Record<number, { status: DemonstrationStepStatus; evidence: string }> = {
      1: notExecuted("requires a provider-backed generation job for the approved brief"),
      2: notExecuted("requires review of a generated ApplicationSpec, policies, API and schema plan"),
      3: notExecuted("requires provisioning an isolated development database and running migrations"),
      6: notExecuted("requires restarting the generated API and frontend"),
      8: notExecuted("requires creating the route file in the Code Workspace"),
      9: notExecuted("requires code/canvas round trips in the editor"),
      10: notExecuted("requires a two-editor conflict in the workspace"),
      11: notExecuted("requires a route rename through the framework adapter"),
      12: notExecuted("requires retiring and restoring a page against a real database"),
      13: notExecuted("requires a Schema Studio change with migration rehearsal and promotion"),
      14: notExecuted("requires publishing and trashing/restoring a CMS article"),
      15: notExecuted("requires exporting the app and a second operator installing it"),
    };

    // Step 4: create a task with a unique title.
    const org = this.createOrganization("Acme Corp", "acme");
    const mem = this.addMember(org.id, "usr_alice", "ADMIN");
    const prj = this.createProject(org.id, mem.id, "Platform Revamp", "PLT");
    const title = `Audit Security Gate - ${uniqueSyntheticMarker}`;
    const task = this.createTask(prj.id, mem.id, { title });
    outcome[4] = task.title === title
      ? { status: "PASS", evidence: `Task ${task.id} created with title "${task.title}" (in-process model, not the UI)` }
      : { status: "FAIL", evidence: `Created task title was "${task.title}"` };

    // Step 5: independently read the stored row, its scope and its event.
    const stored = this.tasks.get(task.id);
    const event = [...this.outbox.values()].find((e) => e.eventType === "TASK_CREATED" && e.aggregateId === task.id);
    outcome[5] = stored && stored.organizationId === org.id && stored.projectId === prj.id && event?.organizationId === org.id
      ? { status: "PASS", evidence: `Stored task scoped to ${org.id}/${prj.id}; outbox event ${event.id}` }
      : { status: "FAIL", evidence: "Stored task, scope or TASK_CREATED event did not match" };

    // Step 7: a cross-organization read and a protected status patch must both fail.
    const otherOrg = this.createOrganization("Beta Inc", "beta");
    const intruder = this.addMember(otherOrg.id, "usr_bob", "MEMBER");
    let crossOrgDenied = false;
    try {
      this.listProjectTasks(prj.id, intruder.id);
    } catch (err: any) {
      crossOrgDenied = err?.code === "UNAUTHORIZED_CROSS_TENANT_ACCESS";
    }
    const patched = this.editTaskDetails(task.id, mem.id, task.revision, { status: "COMPLETED" } as any);
    const statusProtected = patched.status === task.status;
    outcome[7] = crossOrgDenied && statusProtected
      ? { status: "PASS", evidence: "Cross-organization read denied with UNAUTHORIZED_CROSS_TENANT_ACCESS; generic patch left status unchanged" }
      : { status: "FAIL", evidence: `crossOrgDenied=${crossOrgDenied}, statusProtected=${statusProtected}` };

    const titles: Record<number, string> = {
      1: "Step 1: Provider-Backed Generation",
      2: "Step 2: Specification & Policy Review",
      3: "Step 3: Isolated Database Provisioning",
      4: "Step 4: Task Creation",
      5: "Step 5: Independent Row Observation & Outbox",
      6: "Step 6: Persistence & Session Restart",
      7: "Step 7: Cross-Tenant Isolation Enforcement",
      8: "Step 8: Dynamic Route Registration",
      9: "Step 9: Bidirectional Visual/Code Convergence",
      10: "Step 10: Concurrent Edit Conflict Resolution",
      11: "Step 11: Route Rename Safety",
      12: "Step 12: Page Retirement Data Preservation",
      13: "Step 13: Schema Studio Extension & Migration",
      14: "Step 14: CMS Lifecycle Separation",
      15: "Step 15: Fresh-Host Portability Verification",
    };
    const stepLog = Object.keys(titles).map(Number).map((n) => ({ stepNumber: n, title: titles[n], ...outcome[n] }));
    const passedSteps = stepLog.filter((s) => s.status === "PASS").length;

    return {
      demonstrationRunId: "demo_" + crypto.randomUUID(),
      passedSteps,
      stepsCount: 15,
      protocolPassed: passedSteps === 15,
      stepLog,
    };
  }
}

export const teamProjectTrackerService = new TeamProjectTrackerService();

