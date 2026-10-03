import type { Request, Response, NextFunction } from "express";
import {
  listCategories,
  createCategory,
  updateCategory,
} from "../services/forum/forumCategory.service.js";
import {
  createTopic,
  getTopicByIdOrSlug,
} from "../services/forum/forumTopic.service.js";
import {
  createPost,
  editPost,
  deletePost,
} from "../services/forum/forumPost.service.js";
import { toggleAcceptedAnswer } from "../services/forum/forumAcceptedAnswer.service.js";
import { toggleReaction } from "../services/forum/forumReaction.service.js";
import {
  toggleBookmark,
  toggleFollow,
  getUserBookmarks,
} from "../services/forum/forumBookmarkFollow.service.js";
import { listTags } from "../services/forum/forumTag.service.js";
import { searchTopics } from "../services/forum/forumSearch.service.js";
import {
  createReport,
  listReports,
  moderateTopic,
} from "../services/forum/forumReportModeration.service.js";
import { getForumAnalytics } from "../services/forum/forumAnalytics.service.js";

// Categories
export async function listCategoriesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await listCategories();
    res.json({ success: true, categories });
  } catch (err) {
    next(err);
  }
}

export async function createCategoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await createCategory(req.body);
    res.status(201).json({ success: true, category });
  } catch (err) {
    next(err);
  }
}

export async function updateCategoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await updateCategory(req.params.id as string, req.body);
    res.json({ success: true, category });
  } catch (err) {
    next(err);
  }
}

// Topics
export async function listTopicsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const filters = {
      query: req.query.query as string,
      categoryId: req.query.categoryId as string,
      categorySlug: req.query.categorySlug as string,
      tag: req.query.tag as string,
      status: req.query.status as string,
      solved: req.query.solved !== undefined ? req.query.solved === "true" : undefined,
      unanswered: req.query.unanswered !== undefined ? req.query.unanswered === "true" : undefined,
      featured: req.query.featured !== undefined ? req.query.featured === "true" : undefined,
      workspaceId: req.query.workspaceId as string,
      authorId: req.query.authorId as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      sortBy: req.query.sortBy as any,
    };

    const result = await searchTopics(filters, user?.id, user?.role);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function createTopicHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const topic = await createTopic({
      userId: user.id,
      userRole: user.role,
      body: req.body,
    });
    res.status(201).json({ success: true, topic });
  } catch (err) {
    next(err);
  }
}

export async function getTopicHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const topic = await getTopicByIdOrSlug(req.params.id as string, user?.id, user?.role);
    res.json({ success: true, topic });
  } catch (err) {
    next(err);
  }
}

// Posts & Replies
export async function createPostHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const post = await createPost({
      topicId: req.params.topicId as string,
      userId: user.id,
      userRole: user.role,
      body: req.body,
    });
    res.status(201).json({ success: true, post });
  } catch (err) {
    next(err);
  }
}

export async function editPostHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const post = await editPost(req.params.id as string, user.id, user.role, req.body.content);
    res.json({ success: true, post });
  } catch (err) {
    next(err);
  }
}

export async function deletePostHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    await deletePost(req.params.id as string, user.id, user.role);
    res.json({ success: true, message: "Post removed" });
  } catch (err) {
    next(err);
  }
}

// Accepted Answer
export async function toggleAcceptedAnswerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const result = await toggleAcceptedAnswer({
      postId: req.params.postId as string,
      userId: user.id,
      userRole: user.role,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// Reactions
export async function toggleReactionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const type = req.body.type || "LIKE";
    const result = await toggleReaction(req.params.postId as string, user.id, type);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// Bookmarks & Follows
export async function toggleBookmarkHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const result = await toggleBookmark(req.params.topicId as string, user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function toggleFollowHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const result = await toggleFollow(req.params.topicId as string, user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getUserBookmarksHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const topics = await getUserBookmarks(user.id);
    res.json({ success: true, topics });
  } catch (err) {
    next(err);
  }
}

// Tags
export async function listTagsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const tags = await listTags(req.query.query as string);
    res.json({ success: true, tags });
  } catch (err) {
    next(err);
  }
}

// Reports & Moderation
export async function createReportHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const report = await createReport({
      reporterId: user.id,
      topicId: req.body.topicId,
      postId: req.body.postId,
      reason: req.body.reason,
      details: req.body.details,
    });
    res.status(201).json({ success: true, report });
  } catch (err) {
    next(err);
  }
}

export async function listReportsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const reports = await listReports(user.role, req.query.status as string);
    res.json({ success: true, reports });
  } catch (err) {
    next(err);
  }
}

export async function moderateTopicHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const topic = await moderateTopic({
      topicId: req.params.topicId as string,
      actorId: user.id,
      actorRole: user.role,
      action: req.body.action,
      reason: req.body.reason,
    });
    res.json({ success: true, topic });
  } catch (err) {
    next(err);
  }
}

// Analytics
export async function getForumAnalyticsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const analytics = await getForumAnalytics();
    res.json({ success: true, ...analytics });
  } catch (err) {
    next(err);
  }
}
