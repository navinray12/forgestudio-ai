import React, { useState } from "react";
import type { ForumTopic, ForumCategory, ForumTopicFilters } from "../types/forum.types";
import { TopicCard } from "./TopicCard";
import { ForumCategoryList } from "./ForumCategoryList";
import { CheckCircle2, Clock, Flame, MessageSquareOff } from "lucide-react";

interface TopicListProps {
  topics: ForumTopic[];
  categories: ForumCategory[];
  onSelectTopic: (topic: ForumTopic) => void;
  onFilterChange: (filters: Partial<ForumTopicFilters>) => void;
  isLoading?: boolean;
}

export const TopicList: React.FC<TopicListProps> = ({
  topics,
  categories,
  onSelectTopic,
  onFilterChange,
  isLoading = false,
}) => {
  const [activeSubTab, setActiveSubTab] = useState("latest");
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | undefined>(undefined);

  const handleSubTabChange = (tab: string) => {
    setActiveSubTab(tab);
    switch (tab) {
      case "popular":
        onFilterChange({ sortBy: "popular", solved: undefined, unanswered: undefined });
        break;
      case "unanswered":
        onFilterChange({ unanswered: true, solved: undefined });
        break;
      case "solved":
        onFilterChange({ solved: true, unanswered: undefined });
        break;
      case "latest":
      default:
        onFilterChange({ sortBy: "latest", solved: undefined, unanswered: undefined });
        break;
    }
  };

  const handleCategorySelect = (category: ForumCategory) => {
    if (selectedCategorySlug === category.slug) {
      setSelectedCategorySlug(undefined);
      onFilterChange({ categorySlug: undefined });
    } else {
      setSelectedCategorySlug(category.slug);
      onFilterChange({ categorySlug: category.slug });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Category Pills Header */}
      <div className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Browse Categories</h2>
        <ForumCategoryList
          categories={categories}
          onSelectCategory={handleCategorySelect}
          selectedCategorySlug={selectedCategorySlug}
        />
      </div>

      {/* Feed Filter Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-6">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleSubTabChange("latest")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
              activeSubTab === "latest"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Latest</span>
          </button>

          <button
            onClick={() => handleSubTabChange("popular")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
              activeSubTab === "popular"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Popular</span>
          </button>

          <button
            onClick={() => handleSubTabChange("unanswered")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
              activeSubTab === "unanswered"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <MessageSquareOff className="w-3.5 h-3.5" />
            <span>Unanswered</span>
          </button>

          <button
            onClick={() => handleSubTabChange("solved")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
              activeSubTab === "solved"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Solved</span>
          </button>
        </div>

        <span className="text-xs text-slate-400 font-semibold">{topics.length} topics found</span>
      </div>

      {/* Topic Cards Container */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-900/40 border border-slate-800/80 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : topics.length > 0 ? (
        <div className="space-y-3">
          {topics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} onSelect={onSelectTopic} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-900/40 border border-slate-800/80 rounded-3xl">
          <p className="text-base font-bold text-slate-300">No discussion topics found</p>
          <p className="text-xs text-slate-500 mt-1">Try adjusting your category filter or start a new topic!</p>
        </div>
      )}
    </div>
  );
};
