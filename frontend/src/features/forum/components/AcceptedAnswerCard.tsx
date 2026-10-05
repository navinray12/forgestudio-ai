import React from "react";
import type { ForumPost } from "../types/forum.types";
import { CheckCircle2, Award } from "lucide-react";

interface AcceptedAnswerCardProps {
  post: ForumPost;
}

export const AcceptedAnswerCard: React.FC<AcceptedAnswerCardProps> = ({ post }) => {
  const authorName = post.author?.fullName || post.author?.email?.split("@")[0] || "Community Member";

  return (
    <div className="my-4 p-5 rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/50 shadow-lg shadow-emerald-500/10">
      <div className="flex items-center space-x-2 text-emerald-400 mb-3 font-bold text-sm">
        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        <span className="uppercase tracking-wider text-xs">Verified Solution</span>
        <span className="text-slate-400 text-xs font-normal">by {authorName}</span>
      </div>
      <div className="text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
        {post.content}
      </div>
    </div>
  );
};
