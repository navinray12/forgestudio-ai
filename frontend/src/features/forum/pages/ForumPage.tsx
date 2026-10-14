import React, { useState } from "react";
import { ForumHeader } from "../components/ForumHeader";
import { TopicList } from "../components/TopicList";
import { TopicDetailView } from "../components/TopicDetailView";
import { TopicComposerModal } from "../components/TopicComposerModal";
import { ForumModerationQueue } from "../components/ForumModerationQueue";
import { ForumAnalyticsView } from "../components/ForumAnalyticsView";
import { useForumTopics } from "../hooks/useForumTopics";
import { useForumCategories } from "../hooks/useForumCategories";
import { useForumTopicDetail } from "../hooks/useForumTopicDetail";
import { forumService } from "../services/forumService";

export const ForumPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("feed");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const { categories } = useForumCategories();
  const { topics, isLoading, updateFilters, refetch: refetchTopics } = useForumTopics();
  const {
    topic: selectedTopic,
    refetch: refetchDetail,
    addReply,
    toggleBookmark,
    toggleFollow,
    toggleAcceptedAnswer,
    toggleReaction,
  } = useForumTopicDetail(selectedTopicId || "");

  const handleCreateTopic = async (payload: {
    title: string;
    content: string;
    categoryId: string;
    tags: string[];
    visibility: string;
  }) => {
    await forumService.createTopic(payload);
    await refetchTopics();
  };

  const handleModerateTopic = async (action: string) => {
    if (!selectedTopicId) return;
    await forumService.moderateTopic(selectedTopicId, action);
    await refetchDetail();
    await refetchTopics();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Forum Global Header */}
      <ForumHeader
        activeTab={activeTab}
        onTabChange={(tab) => {
          setSelectedTopicId(null);
          setActiveTab(tab);
        }}
        onSearch={(query) => updateFilters({ query })}
        onOpenComposer={() => setIsComposerOpen(true)}
      />

      {/* Main View Area */}
      <main className="pb-16">
        {selectedTopicId && selectedTopic ? (
          <TopicDetailView
            topic={selectedTopic}
            onBack={() => setSelectedTopicId(null)}
            onAddReply={addReply}
            onToggleBookmark={toggleBookmark}
            onToggleFollow={toggleFollow}
            onToggleAcceptedAnswer={toggleAcceptedAnswer}
            onToggleReaction={toggleReaction}
            onModerateAction={handleModerateTopic}
          />
        ) : activeTab === "moderation" ? (
          <ForumModerationQueue />
        ) : activeTab === "analytics" ? (
          <ForumAnalyticsView />
        ) : activeTab === "bookmarks" ? (
          <TopicList
            topics={topics.filter((t) => t.isBookmarked)}
            categories={categories}
            onSelectTopic={(t) => setSelectedTopicId(t.id)}
            onFilterChange={updateFilters}
            isLoading={isLoading}
          />
        ) : (
          <TopicList
            topics={topics}
            categories={categories}
            onSelectTopic={(t) => setSelectedTopicId(t.id)}
            onFilterChange={updateFilters}
            isLoading={isLoading}
          />
        )}
      </main>

      {/* New Topic Composer Modal */}
      <TopicComposerModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        categories={categories}
        onSubmit={handleCreateTopic}
      />
    </div>
  );
};

export default ForumPage;
