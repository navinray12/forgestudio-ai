import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireForumPermission } from "../middlewares/forumAuthorization.middleware.js";
import {
  listCategoriesHandler,
  createCategoryHandler,
  updateCategoryHandler,
  listTopicsHandler,
  createTopicHandler,
  getTopicHandler,
  createPostHandler,
  editPostHandler,
  deletePostHandler,
  toggleAcceptedAnswerHandler,
  toggleReactionHandler,
  toggleBookmarkHandler,
  toggleFollowHandler,
  getUserBookmarksHandler,
  listTagsHandler,
  createReportHandler,
  listReportsHandler,
  moderateTopicHandler,
  getForumAnalyticsHandler,
} from "../controllers/forum.controller.js";

const router = Router();

// Public / Read-Only Categories & Tags (Optional authentication for user-specific context)
router.get("/categories", listCategoriesHandler);
router.get("/tags", listTagsHandler);

// Public / Search Topics
router.get("/topics/search", listTopicsHandler);

// Static Routes MUST precede parameterized routes (/topics/:id)
router.get("/analytics", requireAuth, requireForumPermission("forum:view_analytics"), getForumAnalyticsHandler);
router.get("/reports", requireAuth, requireForumPermission("forum:moderate_hide"), listReportsHandler);
router.get("/bookmarks", requireAuth, requireForumPermission("forum:bookmark"), getUserBookmarksHandler);

// Category Management
router.post("/categories", requireAuth, requireForumPermission("forum:manage_categories"), createCategoryHandler);
router.patch("/categories/:id", requireAuth, requireForumPermission("forum:manage_categories"), updateCategoryHandler);

// Topic Operations
router.get("/topics", listTopicsHandler);
router.post("/topics", requireAuth, requireForumPermission("forum:create_topic"), createTopicHandler);
router.get("/topics/:id", getTopicHandler);

// Post Operations
router.post("/topics/:topicId/posts", requireAuth, requireForumPermission("forum:reply"), createPostHandler);
router.patch("/posts/:id", requireAuth, requireForumPermission("forum:edit_own"), editPostHandler);
router.delete("/posts/:id", requireAuth, requireForumPermission("forum:delete_own"), deletePostHandler);

// Answer Acceptance & Reactions
router.post("/posts/:postId/accept", requireAuth, requireForumPermission("forum:accept_answer"), toggleAcceptedAnswerHandler);
router.post("/posts/:postId/reactions", requireAuth, requireForumPermission("forum:react"), toggleReactionHandler);

// Bookmarks & Follows
router.post("/topics/:topicId/bookmark", requireAuth, requireForumPermission("forum:bookmark"), toggleBookmarkHandler);
router.post("/topics/:topicId/follow", requireAuth, requireForumPermission("forum:follow"), toggleFollowHandler);

// Reports & Moderation
router.post("/reports", requireAuth, requireForumPermission("forum:report"), createReportHandler);
router.post("/topics/:topicId/moderate", requireAuth, requireForumPermission("forum:moderate_pin"), moderateTopicHandler);

export default router;
