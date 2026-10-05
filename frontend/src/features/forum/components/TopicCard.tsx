import React from "react";
import type { ForumTopic } from "../types/forum.types";
import { MessageSquare, Eye, Pin, Lock, CheckCircle2, Bookmark, Globe, Building2 } from "lucide-react";

interface TopicCardProps {
  topic: ForumTopic;
  onSelect: (topic: ForumTopic) => void;
}

export const TopicCard: React.FC<TopicCardProps> = ({ topic, onSelect }) => {
  const authorName = topic.author?.fullName || topic.author?.email?.split("@")[0] || "Anonymous";
  const categoryName = topic.category?.name || "General";
  const categoryColor = topic.category?.color || "#6366f1";

  return (
    <div
      onClick={() => onSelect(topic)}
      className="group relative bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800/90 hover:border-slate-700/90 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Topic Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 text-xs mb-1.5">
            {/* Category Tag */}
            <span
              className="px-2.5 py-0.5 rounded-md font-semibold text-white text-[11px]"
              style={{ backgroundColor: categoryColor }}
            >
              {categoryName}
            </span>

            {/* Visibility Badge */}
            {topic.visibility === "WORKSPACE" && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-medium">
                <Building2 className="w-3 h-3" />
                <span>Workspace</span>
              </span>
            )}

            {/* Status Badges */}
            {topic.isPinned && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] font-medium">
                <Pin className="w-3 h-3" />
                <span>Pinned</span>
              </span>
            )}

            {topic.isSolved && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
                <CheckCircle2 className="w-3 h-3" />
                <span>Solved</span>
              </span>
            )}

            {topic.isLocked && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-700 text-slate-300 text-[11px] font-medium">
                <Lock className="w-3 h-3" />
                <span>Locked</span>
              </span>
            )}

            <span className="text-slate-500 font-mono text-[11px]">{topic.topicNumber}</span>
          </div>

          <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-400 transition-colors line-clamp-1">
            {topic.title}
          </h3>

          <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
            {topic.content}
          </p>

          {/* Tags */}
          {topic.tags && topic.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              {topic.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700/60 text-[10px] font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Topic Metrics */}
        <div className="flex flex-col items-end justify-between self-stretch shrink-0 text-xs text-slate-400 font-medium">
          <div className="flex items-center space-x-3 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
            <div className="flex items-center space-x-1 text-indigo-400">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="font-bold">{topic.replyCount}</span>
            </div>
            <div className="flex items-center space-x-1 text-slate-400">
              <Eye className="w-3.5 h-3.5" />
              <span>{topic.viewCount}</span>
            </div>
          </div>

          <div className="mt-2 text-[11px] text-slate-400 text-right">
            <span>By </span>
            <span className="text-slate-300 font-medium">{authorName}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
