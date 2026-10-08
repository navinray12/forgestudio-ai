/**
 * ForgeStudio Module 57: Code Review Request Service
 * Manages peer review requests, reviewer assignments, line feedback,
 * approvals, change requests, and review history.
 */

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { collaborationEngineService } from "./collaborationEngine.service.js";
import type { ReviewRequest, ReviewComment, ReviewApproval } from "./collaboration.types.js";

const db = prisma as any;

export class ReviewRequestService {
  /**
   * Request peer review on a branch or changes
   */
  async createReviewRequest(params: {
    projectId: string;
    requesterId: string;
    title: string;
    description?: string;
    sourceBranch?: string;
    targetBranch?: string;
    reviewers?: string[];
  }): Promise<ReviewRequest> {
    const { projectId, requesterId, title, description, sourceBranch = "main", targetBranch = "main", reviewers = [] } = params;

    if (!title || !title.trim()) {
      throw new AppError("Review title is required", 400, "VALIDATION_ERROR");
    }

    const review = await db.forgeReviewRequest.create({
      data: {
        projectId,
        requesterId,
        title: title.trim(),
        description: description?.trim() || null,
        sourceBranch,
        targetBranch,
        status: "PENDING",
        reviewers,
        assignedAt: new Date(),
      },
    });

    await collaborationEngineService.recordActivity({
      projectId,
      actorId: requesterId,
      category: "REVIEW",
      action: "review.requested",
      targetResource: `review:${review.id}`,
      details: { title: review.title, sourceBranch, targetBranch, reviewersCount: reviewers.length },
    });

    return review;
  }

  /**
   * List review requests for a project
   */
  async listReviews(projectId: string, status?: string): Promise<ReviewRequest[]> {
    const where: any = { projectId };
    if (status) where.status = status;

    const reviews = await db.forgeReviewRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Populate comments & approvals count
    for (const r of reviews) {
      r.commentsCount = await db.forgeReviewComment.count({ where: { reviewId: r.id } });
      r.approvalsCount = await db.forgeReviewApproval.count({ where: { reviewId: r.id, decision: "APPROVED" } });
    }

    return reviews;
  }

  /**
   * Add review comment on a specific line or file
   */
  async addReviewComment(params: {
    reviewId: string;
    authorId: string;
    filePath?: string;
    line?: number;
    comment: string;
    suggestion?: string;
  }): Promise<ReviewComment> {
    const { reviewId, authorId, filePath, line, comment, suggestion } = params;

    const review = await db.forgeReviewRequest.findUnique({ where: { id: reviewId } });
    if (!review) throw new AppError("Review request not found", 404, "NOT_FOUND");

    const reviewComment = await db.forgeReviewComment.create({
      data: {
        reviewId,
        authorId,
        filePath: filePath || null,
        line: line || null,
        comment: comment.trim(),
        suggestion: suggestion?.trim() || null,
      },
    });

    await collaborationEngineService.recordActivity({
      projectId: review.projectId,
      actorId: authorId,
      category: "REVIEW",
      action: "review.comment_added",
      targetResource: `review:${reviewId}`,
      details: { filePath, line },
    });

    return reviewComment;
  }

  /**
   * Submit review decision (approve, request changes, dismiss)
   */
  async submitReviewDecision(params: {
    reviewId: string;
    reviewerId: string;
    decision: "APPROVED" | "CHANGES_REQUESTED" | "DISMISSED";
    feedback?: string;
  }): Promise<ReviewApproval> {
    const { reviewId, reviewerId, decision, feedback } = params;

    const review = await db.forgeReviewRequest.findUnique({ where: { id: reviewId } });
    if (!review) throw new AppError("Review request not found", 404, "NOT_FOUND");

    const approval = await db.forgeReviewApproval.upsert({
      where: {
        reviewId_reviewerId: { reviewId, reviewerId },
      },
      create: {
        reviewId,
        reviewerId,
        decision,
        feedback: feedback || null,
        decidedAt: new Date(),
      },
      update: {
        decision,
        feedback: feedback || null,
        decidedAt: new Date(),
      },
    });

    // Update overall review status
    let nextStatus = review.status;
    if (decision === "APPROVED") {
      nextStatus = "APPROVED";
    } else if (decision === "CHANGES_REQUESTED") {
      nextStatus = "CHANGES_REQUESTED";
    }

    await db.forgeReviewRequest.update({
      where: { id: reviewId },
      data: {
        status: nextStatus,
        completedAt: nextStatus === "APPROVED" ? new Date() : null,
        updatedAt: new Date(),
      },
    });

    await collaborationEngineService.recordActivity({
      projectId: review.projectId,
      actorId: reviewerId,
      category: "REVIEW",
      action: `review.${decision.toLowerCase()}`,
      targetResource: `review:${reviewId}`,
      details: { decision, feedback },
    });

    return approval;
  }

  /**
   * Get full review details including comments and decisions
   */
  async getReviewDetails(reviewId: string): Promise<any> {
    const review = await db.forgeReviewRequest.findUnique({ where: { id: reviewId } });
    if (!review) throw new AppError("Review request not found", 404, "NOT_FOUND");

    const comments = await db.forgeReviewComment.findMany({
      where: { reviewId },
      orderBy: { createdAt: "asc" },
    });

    const approvals = await db.forgeReviewApproval.findMany({
      where: { reviewId },
    });

    return {
      ...review,
      comments,
      approvals,
    };
  }
}

export const reviewRequestService = new ReviewRequestService();
