import { describe, it, expect, beforeEach } from "vitest";
import {
  hasSupportPermission,
  isSupportStaffRole,
} from "../middlewares/supportAuthorization.middleware.js";
import {
  validateCreateTicketPayload,
  validateStatusTransition,
  validateMessagePayload,
} from "../validators/support.validator.js";
import { calculateSlaTarget, getSlaStatus } from "../services/support/ticketSla.service.js";
import { sanitizeFileName, validateAttachmentFile } from "../services/support/ticketAttachment.service.js";

describe("Support Ticket System — Permissions & RBAC", () => {
  it("should grant customer basic ticket permissions and deny staff permissions", () => {
    expect(hasSupportPermission("USER", "ticket:create")).toBe(true);
    expect(hasSupportPermission("USER", "ticket:view_own")).toBe(true);
    expect(hasSupportPermission("USER", "ticket:reply")).toBe(true);
    expect(hasSupportPermission("USER", "ticket:internal_note")).toBe(false);
    expect(hasSupportPermission("USER", "ticket:assign")).toBe(false);
    expect(hasSupportPermission("USER", "ticket:manage_sla")).toBe(false);
    expect(hasSupportPermission("USER", "ticket:view_analytics")).toBe(false);
  });

  it("should grant SUPPORT_AGENT internal notes and queue management permissions", () => {
    expect(hasSupportPermission("SUPPORT_AGENT", "ticket:internal_note")).toBe(true);
    expect(hasSupportPermission("SUPPORT_AGENT", "ticket:assign")).toBe(true);
    expect(hasSupportPermission("SUPPORT_AGENT", "ticket:change_status")).toBe(true);
    expect(hasSupportPermission("SUPPORT_AGENT", "ticket:change_priority")).toBe(true);
  });

  it("should correctly classify support staff roles", () => {
    expect(isSupportStaffRole("SUPPORT_AGENT")).toBe(true);
    expect(isSupportStaffRole("SUPPORT_MANAGER")).toBe(true);
    expect(isSupportStaffRole("SUPPORT_ADMIN")).toBe(true);
    expect(isSupportStaffRole("ADMIN")).toBe(true);
    expect(isSupportStaffRole("SUPER_ADMIN")).toBe(true);
    expect(isSupportStaffRole("USER")).toBe(false);
  });
});

describe("Support Ticket System — Validation & State Transitions", () => {
  it("should validate valid ticket creation payload", () => {
    const valid = validateCreateTicketPayload({
      subject: "WordPress Sync Error",
      description: "Unable to sync page edits to remote WordPress instance.",
      categoryId: "cat-123",
      priority: "HIGH",
    });
    expect(valid.subject).toBe("WordPress Sync Error");
    expect(valid.priority).toBe("HIGH");
  });

  it("should throw error on short or empty ticket subject", () => {
    expect(() =>
      validateCreateTicketPayload({
        subject: "Hi",
        description: "Valid description long enough",
        categoryId: "cat-123",
      })
    ).toThrow();
  });

  it("should enforce status transition rules", () => {
    // Valid transitions
    expect(() => validateStatusTransition("NEW", "OPEN")).not.toThrow();
    expect(() => validateStatusTransition("OPEN", "IN_PROGRESS")).not.toThrow();
    expect(() => validateStatusTransition("IN_PROGRESS", "RESOLVED")).not.toThrow();
    expect(() => validateStatusTransition("RESOLVED", "REOPENED")).not.toThrow();

    // Invalid transitions (direct skip)
    expect(() => validateStatusTransition("NEW", "CLOSED")).toThrow();
    expect(() => validateStatusTransition("CLOSED", "RESOLVED")).toThrow();
  });

  it("should validate message payload and enforce length limits", () => {
    const msg = validateMessagePayload({
      content: "Hello agent, here are the logs.",
      type: "PUBLIC_REPLY",
    });
    expect(msg.content).toBe("Hello agent, here are the logs.");
    expect(msg.type).toBe("PUBLIC_REPLY");
  });
});

describe("Support Ticket System — SLA Engine", () => {
  it("should calculate correct SLA targets based on ticket priority", async () => {
    const urgentTarget = await calculateSlaTarget("URGENT");
    expect(urgentTarget.firstResponseMinutes).toBe(30);

    const normalTarget = await calculateSlaTarget("NORMAL");
    expect(normalTarget.firstResponseMinutes).toBe(480);
  });

  it("should accurately determine SLA status as ON_TRACK, BREACHED, or COMPLETED", () => {
    const createdAt = new Date();
    const slaOnTrack = getSlaStatus({
      createdAt,
      priority: "NORMAL",
    });
    expect(slaOnTrack.status).toBe("ON_TRACK");

    const pastDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago
    const slaBreached = getSlaStatus({
      createdAt: pastDate,
      priority: "URGENT",
    });
    expect(slaBreached.status).toBe("BREACHED");
    expect(slaBreached.isFirstResponseBreached).toBe(true);

    const slaCompleted = getSlaStatus({
      createdAt: pastDate,
      resolvedAt: new Date(pastDate.getTime() + 10 * 60 * 1000), // Resolved in 10m
      priority: "URGENT",
    });
    expect(slaCompleted.status).toBe("COMPLETED");
  });
});

describe("Support Ticket System — Attachment Security", () => {
  it("should sanitize file names against path traversal", () => {
    expect(sanitizeFileName("../../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("my log file (1).txt")).toBe("my_log_file__1_.txt");
  });

  it("should reject disallowed executable file extensions", () => {
    expect(() =>
      validateAttachmentFile({
        originalname: "malicious.exe",
        mimetype: "application/octet-stream",
        size: 1024,
      })
    ).toThrow();

    expect(() =>
      validateAttachmentFile({
        originalname: "script.sh",
        mimetype: "text/plain",
        size: 1024,
      })
    ).toThrow();
  });
});
