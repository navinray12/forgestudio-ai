import { describe, it, expect } from "vitest";
import {
  hasForumPermission,
  isForumModeratorRole,
} from "../middlewares/forumAuthorization.middleware.js";

describe("Discussion Forum System — Permissions & RBAC", () => {
  it("should grant regular USER basic forum permissions and deny moderator actions", () => {
    expect(hasForumPermission("USER", "forum:view")).toBe(true);
    expect(hasForumPermission("USER", "forum:create_topic")).toBe(true);
    expect(hasForumPermission("USER", "forum:reply")).toBe(true);
    expect(hasForumPermission("USER", "forum:react")).toBe(true);
    expect(hasForumPermission("USER", "forum:bookmark")).toBe(true);
    expect(hasForumPermission("USER", "forum:follow")).toBe(true);
    expect(hasForumPermission("USER", "forum:report")).toBe(true);
    expect(hasForumPermission("USER", "forum:accept_answer")).toBe(true);

    // Moderation & Admin actions denied to regular users
    expect(hasForumPermission("USER", "forum:moderate_pin")).toBe(false);
    expect(hasForumPermission("USER", "forum:moderate_lock")).toBe(false);
    expect(hasForumPermission("USER", "forum:moderate_hide")).toBe(false);
    expect(hasForumPermission("USER", "forum:manage_categories")).toBe(false);
    expect(hasForumPermission("USER", "forum:view_analytics")).toBe(false);
  });

  it("should grant SUPPORT_AGENT and ADMIN moderator capabilities", () => {
    expect(hasForumPermission("SUPPORT_AGENT", "forum:moderate_pin")).toBe(true);
    expect(hasForumPermission("SUPPORT_AGENT", "forum:moderate_lock")).toBe(true);
    expect(hasForumPermission("SUPPORT_AGENT", "forum:moderate_hide")).toBe(true);

    expect(hasForumPermission("ADMIN", "forum:manage_categories")).toBe(true);
    expect(hasForumPermission("ADMIN", "forum:view_analytics")).toBe(true);
  });

  it("should correctly identify moderator roles", () => {
    expect(isForumModeratorRole("SUPPORT_AGENT")).toBe(true);
    expect(isForumModeratorRole("SUPPORT_MANAGER")).toBe(true);
    expect(isForumModeratorRole("ADMIN")).toBe(true);
    expect(isForumModeratorRole("SUPER_ADMIN")).toBe(true);
    expect(isForumModeratorRole("USER")).toBe(false);
    expect(isForumModeratorRole("TEAM_MEMBER")).toBe(false);
  });
});
