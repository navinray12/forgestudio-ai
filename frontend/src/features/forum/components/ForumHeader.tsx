import React from "react";
import { MessageSquare, Plus, Search, Shield, BarChart2, Bookmark, Home } from "lucide-react";

interface ForumHeaderProps {
  onSearch?: (query: string) => void;
  onOpenComposer?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  isModerator?: boolean;
}

export const ForumHeader: React.FC<ForumHeaderProps> = ({
  onSearch,
  onOpenComposer,
  activeTab = "feed",
  onTabChange,
  isModerator = true,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white py-3.5 px-6 shadow-xl">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Domain Title */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onTabChange?.("feed")}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
              ForgeStudio Forum
            </h1>
            <p className="text-xs text-slate-400 font-medium">Community Discussions & Solutions</p>
          </div>
        </div>

        {/* Global Search */}
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search topics, questions, tags..."
            onChange={(e) => onSearch?.(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Navigation Tabs & Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onTabChange?.("feed")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              activeTab === "feed" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Discussions</span>
          </button>

          <button
            onClick={() => onTabChange?.("categories")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              activeTab === "categories" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <span>Categories</span>
          </button>

          <button
            onClick={() => onTabChange?.("bookmarks")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              activeTab === "bookmarks" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Bookmarks</span>
          </button>

          {isModerator && (
            <>
              <button
                onClick={() => onTabChange?.("moderation")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  activeTab === "moderation" ? "bg-amber-600 text-white shadow-md shadow-amber-600/30" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Moderation</span>
              </button>

              <button
                onClick={() => onTabChange?.("analytics")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  activeTab === "analytics" ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Analytics</span>
              </button>
            </>
          )}

          <button
            onClick={onOpenComposer}
            className="ml-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 flex items-center space-x-1.5 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Topic</span>
          </button>
        </div>
      </div>
    </header>
  );
};
