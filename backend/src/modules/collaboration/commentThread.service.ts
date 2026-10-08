/**
 * ForgeStudio Module 57: Comment Thread & Discussion Service
 * Supports file comments, line comments, code-range comments, threaded replies,
 * @mentions extraction, resolution, and permission-aware editing.
 */

import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { collaborationEngineService } from "./collaborationEngine.service.js";
import type { FileComment } from "./collaboration.types.js";

const db = prisma as any;

export class CommentThreadService {
  /**
   * Extract @mentions from text
   */
  private extractMentions(content: string): string[] {
    const matches = content.match(/@([a-zA-Z0-9._-]+)/g);
    if (!matches) return [];
    return Array.from(new Set(matches.map((m) => m.slice(1))));
  }

  /**
   * Create a new file or line comment
   */
  async createComment(params: {
    projectId: string;
    filePath: string;
    authorId: string;
    content: string;
    parentCommentId?: string | null;
    startLine?: number;
    endLine?: number;
    startColumn?: number;
    endColumn?: number;
    selectedCodeSnippet?: string;
  }): Promise<FileComment> {
    const { projectId, filePath, authorId, content, parentCommentId, startLine, endLine, startColumn, endColumn, selectedCodeSnippet } = params;

    if (!content || !content.trim()) {
      throw new AppError("Comment content cannot be empty", 400, "VALIDATION_ERROR");
    }

    const mentions = this.extractMentions(content);

    const comment = await db.forgeFileComment.create({
      data: {
        projectId,
        filePath,
        authorId,
        parentCommentId: parentCommentId || null,
        content: content.trim(),
        startLine: startLine || null,
        endLine: endLine || null,
        startColumn: startColumn || null,
        endColumn: endColumn || null,
        selectedCodeSnippet: selectedCodeSnippet || null,
        status: "OPEN",
        mentions,
        reactions: {},
      },
    });

    await collaborationEngineService.recordActivity({
      projectId,
      actorId: authorId,
      category: "COMMENT",
      action: parentCommentId ? "comment.replied" : "comment.created",
      targetResource: `${filePath}:${startLine || 0}`,
      details: { commentId: comment.id, mentions },
    });

    return comment;
  }

  /**
   * List comments for a file or entire project with threaded structure
   */
  async getComments(projectId: string, filePath?: string): Promise<FileComment[]> {
    const where: any = { projectId };
    if (filePath) where.filePath = filePath;

    const allComments = await db.forgeFileComment.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });

    // Nest replies into parent comments
    const rootComments: FileComment[] = [];
    const commentMap = new Map<string, FileComment>();

    for (const c of allComments) {
      const commentObj: FileComment = { ...c, replies: [] };
      commentMap.set(c.id, commentObj);
    }

    for (const c of allComments) {
      const commentObj = commentMap.get(c.id)!;
      if (c.parentCommentId && commentMap.has(c.parentCommentId)) {
        commentMap.get(c.parentCommentId)!.replies!.push(commentObj);
      } else {
        rootComments.push(commentObj);
      }
    }

    return rootComments;
  }

  /**
   * Resolve or reopen a comment thread
   */
  async updateStatus(
    commentId: string,
    status: "OPEN" | "RESOLVED",
    userId: string
  ): Promise<FileComment> {
    const comment = await db.forgeFileComment.findUnique({ where: { id: commentId } });
    if (!comment) {
      throw new AppError("Comment not found", 404, "NOT_FOUND");
    }

    const updated = await db.forgeFileComment.update({
      where: { id: commentId },
      data: {
        status,
        resolvedBy: status === "RESOLVED" ? userId : null,
        resolvedAt: status === "RESOLVED" ? new Date() : null,
        updatedAt: new Date(),
      },
    });

    await collaborationEngineService.recordActivity({
      projectId: comment.projectId,
      actorId: userId,
      category: "COMMENT",
      action: status === "RESOLVED" ? "comment.resolved" : "comment.reopened",
      targetResource: comment.filePath,
      details: { commentId },
    });

    return updated;
  }

  /**
   * Edit comment content
   */
  async editComment(commentId: string, content: string, userId: string): Promise<FileComment> {
    const comment = await db.forgeFileComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new AppError("Comment not found", 404, "NOT_FOUND");
    if (comment.authorId !== userId) throw new AppError("Cannot edit another user's comment", 403, "FORBIDDEN");

    const mentions = this.extractMentions(content);
    return db.forgeFileComment.update({
      where: { id: commentId },
      data: {
        content: content.trim(),
        mentions,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete comment
   */
  async deleteComment(commentId: string, userId: string): Promise<{ success: boolean }> {
    const comment = await db.forgeFileComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new AppError("Comment not found", 404, "NOT_FOUND");
    if (comment.authorId !== userId) throw new AppError("Cannot delete another user's comment", 403, "FORBIDDEN");

    await db.forgeFileComment.delete({ where: { id: commentId } });
    return { success: true };
  }
}

export const commentThreadService = new CommentThreadService();
