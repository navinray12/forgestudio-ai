import { useState, useEffect, useCallback } from "react";
import { forumService } from "../services/forumService";
import type { ForumTopic } from "../types/forum.types";

export function useForumTopicDetail(idOrSlug: string) {
  const [topic, setTopic] = useState<ForumTopic | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTopic = useCallback(async () => {
    if (!idOrSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await forumService.getTopic(idOrSlug);
      setTopic(res.topic);
    } catch (err: any) {
      setError(err.message || "Failed to load topic");
    } finally {
      setIsLoading(false);
    }
  }, [idOrSlug]);

  useEffect(() => {
    fetchTopic();
  }, [fetchTopic]);

  const addReply = async (content: string, parentPostId?: string) => {
    if (!topic) return;
    const res = await forumService.createPost(topic.id, content, parentPostId);
    await fetchTopic();
    return res.post;
  };

  const toggleBookmark = async () => {
    if (!topic) return;
    const res = await forumService.toggleBookmark(topic.id);
    setTopic((prev) => prev ? { ...prev, isBookmarked: res.bookmarked } : prev);
  };

  const toggleFollow = async () => {
    if (!topic) return;
    const res = await forumService.toggleFollow(topic.id);
    setTopic((prev) => prev ? { ...prev, isFollowed: res.followed } : prev);
  };

  const toggleAcceptedAnswer = async (postId: string) => {
    if (!topic) return;
    await forumService.toggleAcceptedAnswer(postId);
    await fetchTopic();
  };

  const toggleReaction = async (postId: string, type: string = "LIKE") => {
    await forumService.toggleReaction(postId, type);
    await fetchTopic();
  };

  return {
    topic,
    isLoading,
    error,
    refetch: fetchTopic,
    addReply,
    toggleBookmark,
    toggleFollow,
    toggleAcceptedAnswer,
    toggleReaction,
  };
}
