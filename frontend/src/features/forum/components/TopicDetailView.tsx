import React, { useState } from "react";
import type { ForumTopic, ForumPost } from "../types/forum.types";
import {
  ArrowLeft,
  CheckCircle2,
  Bookmark,
  Bell,
  Heart,
  ThumbsUp,
  MessageSquare,
  Shield,
  Flag,
  Pin,
  Lock,
  Eye,
} from "lucide-react";
import { AcceptedAnswerCard } from "./AcceptedAnswerCard";
import { ReplyComposer } from "./ReplyComposer";
import { ReportModal } from "./ReportModal";
import { forumService } from "../services/forumService";

interface TopicDetailViewProps {
  topic: ForumTopic;
  onBack: () => void;
  onAddReply: (content: string, parentPostId?: string) => Promise<any>;
  onToggleBookmark: () => Promise<void>;
  onToggleFollow: () => Promise<void>;
  onToggleAcceptedAnswer: (postId: string) => Promise<void>;
  onToggleReaction: (postId: string, type: string) => Promise<void>;
  onModerateAction?: (action: string) => Promise<void>;
  isModerator?: boolean;
}

export const TopicDetailView: React.FC<TopicDetailViewProps> = ({
  topic,
  onBack,
  onAddReply,
  onToggleBookmark,
  onToggleFollow,
  onToggleAcceptedAnswer,
  onToggleReaction,
  onModerateAction,
  isModerator = true,
}) => {
  const [reportTarget, setReportTarget] = useState<{ type: "topic" | "post"; id: string } | null>(null);

  const authorName = topic.author?.fullName || topic.author?.email?.split("@")[0] || "Author";
  const categoryName = topic.category?.name || "General";
  const categoryColor = topic.category?.color || "#6366f1";

  const acceptedPost = topic.posts?.find((p) => p.isAcceptedAnswer);

  const handleReportSubmit = async (reason: string, details?: string) => {
    if (!reportTarget) return;
    if (reportTarget.type === "topic") {
      await forumService.createReport({ topicId: reportTarget.id, reason, details });
    } else {
      await forumService.createReport({ postId: reportTarget.id, reason, details });
    }
  };

  return (
    <div className="max-w-4xl mx-auto my-6 px-4">
      {/* Back Button & Top Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Discussions</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleBookmark}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              topic.isBookmarked
                ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>{topic.isBookmarked ? "Bookmarked" : "Bookmark"}</span>
          </button>

          <button
            onClick={onToggleFollow}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              topic.isFollowed
                ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>{topic.isFollowed ? "Following" : "Follow Updates"}</span>
          </button>

          <button
            onClick={() => setReportTarget({ type: "topic", id: topic.id })}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
            title="Report Topic"
          >
            <Flag className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Topic Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl mb-6">
        <div className="flex items-center flex-wrap gap-2 text-xs mb-3">
          <span className="px-3 py-1 rounded-full font-bold text-white text-xs" style={{ backgroundColor: categoryColor }}>
            {categoryName}
          </span>

          {topic.isSolved && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Solved</span>
            </span>
          )}

          {topic.isPinned && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-xs font-semibold">
              <Pin className="w-3.5 h-3.5" />
              <span>Pinned</span>
            </span>
          )}

          <span className="text-slate-500 font-mono">{topic.topicNumber}</span>
        </div>

        <h1 className="text-2xl font-extrabold text-white leading-tight mb-4">{topic.title}</h1>

        <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 text-xs text-slate-400">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold">
              {authorName[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-slate-200 font-semibold">{authorName}</p>
              <p className="text-slate-400 text-[11px]">{new Date(topic.createdAt).toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span className="font-bold text-white">{topic.replyCount}</span>
              <span>replies</span>
            </div>
            <div className="flex items-center space-x-1">
              <Eye className="w-4 h-4 text-slate-400" />
              <span>{topic.viewCount} views</span>
            </div>
          </div>
        </div>
      </div>

      {/* Moderator Action Bar */}
      {isModerator && onModerateAction && (
        <div className="my-4 p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center space-x-2 font-bold">
            <Shield className="w-4 h-4 text-amber-400" />
            <span>Moderator Actions</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onModerateAction(topic.isPinned ? "UNPIN" : "PIN")}
              className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-semibold transition-all"
            >
              {topic.isPinned ? "Unpin Topic" : "Pin Topic"}
            </button>
            <button
              onClick={() => onModerateAction(topic.isLocked ? "UNLOCK" : "LOCK")}
              className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-semibold transition-all"
            >
              {topic.isLocked ? "Unlock Topic" : "Lock Topic"}
            </button>
            <button
              onClick={() => onModerateAction(topic.status === "HIDDEN" ? "UNHIDE" : "HIDE")}
              className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 font-semibold transition-all"
            >
              {topic.status === "HIDDEN" ? "Unhide Topic" : "Hide Topic"}
            </button>
          </div>
        </div>
      )}

      {/* Original Topic Body Post */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-md mb-6">
        <div className="text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
          {topic.content}
        </div>
      </div>

      {/* Verified Solution Highlight if present */}
      {acceptedPost && <AcceptedAnswerCard post={acceptedPost} />}

      {/* Reply Section */}
      <div className="mt-8">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
          <span>Replies & Discussion</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
            {topic.posts?.length ?? 0}
          </span>
        </h3>

        {/* Reply List */}
        <div className="space-y-4">
          {topic.posts && topic.posts.length > 0 ? (
            topic.posts.map((post) => {
              const postAuthor = post.author?.fullName || post.author?.email?.split("@")[0] || "User";
              const likeCount = post.reactions?.filter((r) => r.type === "LIKE").length || 0;
              const heartCount = post.reactions?.filter((r) => r.type === "HEART").length || 0;

              return (
                <div
                  key={post.id}
                  className={`bg-slate-900/70 border rounded-2xl p-5 transition-all ${
                    post.isAcceptedAnswer
                      ? "border-emerald-500/60 bg-emerald-950/20"
                      : "border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-indigo-400">
                        {postAuthor[0]?.toUpperCase()}
                      </div>
                      <span className="font-bold text-slate-200">{postAuthor}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-400">{new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onToggleAcceptedAnswer(post.id)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center space-x-1 transition-all ${
                          post.isAcceptedAnswer
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:text-emerald-400"
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{post.isAcceptedAnswer ? "Accepted Solution" : "Mark as Solution"}</span>
                      </button>

                      <button
                        onClick={() => setReportTarget({ type: "post", id: post.id })}
                        className="text-slate-400 hover:text-amber-400 p-1"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{post.content}</p>

                  {/* Reaction Bar */}
                  <div className="flex items-center space-x-3 mt-4 pt-3 border-t border-slate-800/80 text-xs">
                    <button
                      onClick={() => onToggleReaction(post.id, "LIKE")}
                      className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-indigo-400 transition-colors"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span className="font-semibold">{likeCount}</span>
                    </button>
                    <button
                      onClick={() => onToggleReaction(post.id, "HEART")}
                      className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-pink-400 transition-colors"
                    >
                      <Heart className="w-3.5 h-3.5" />
                      <span className="font-semibold">{heartCount}</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-400 italic text-center py-6">No replies yet. Be the first to share your thoughts!</p>
          )}
        </div>

        {/* Inline Reply Composer */}
        {!topic.isLocked ? (
          <ReplyComposer onSubmit={async (content) => { await onAddReply(content); }} />
        ) : (
          <div className="my-6 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400 font-medium">
            This topic is locked and closed for new replies.
          </div>
        )}
      </div>

      {/* Report Modal */}
      <ReportModal
        isOpen={!!reportTarget}
        onClose={() => setReportTarget(null)}
        onSubmit={handleReportSubmit}
        targetType={reportTarget?.type || "topic"}
      />
    </div>
  );
};
