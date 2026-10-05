import React, { useState, useEffect } from "react";
import type { ForumAnalyticsMetrics } from "../types/forum.types";
import { forumService } from "../services/forumService";
import { MessageSquare, CheckCircle2, Layers, Users, Tag, TrendingUp } from "lucide-react";

export const ForumAnalyticsView: React.FC = () => {
  const [data, setData] = useState<ForumAnalyticsMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    forumService.getAnalytics().then(setData).finally(() => setIsLoading(false));
  }, []);

  if (isLoading || !data) {
    return <div className="max-w-7xl mx-auto px-6 py-6 h-60 bg-slate-900 rounded-3xl animate-pulse" />;
  }

  const { metrics, topTags } = data;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-white">Forum Engagement & Analytics</h1>
          <p className="text-xs text-slate-400">Real-time engagement metrics across discussions and solutions</p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Total Topics</span>
            <MessageSquare className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">{metrics.totalTopics}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Total Replies</span>
            <Layers className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">{metrics.totalPosts}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Solved Solutions</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">{metrics.solvedTopics}</p>
          <span className="text-xs text-emerald-400 font-bold">{metrics.solvedPercentage}% Resolution Rate</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase">Active Categories</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">{metrics.totalCategories}</p>
        </div>
      </div>

      {/* Top Tags */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center space-x-2">
          <Tag className="w-4 h-4 text-indigo-400" />
          <span>Trending Discussion Tags</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {topTags.map((t) => (
            <span key={t.id} className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200">
              #{t.name} <span className="text-indigo-400 font-bold ml-1">({t.usageCount})</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
