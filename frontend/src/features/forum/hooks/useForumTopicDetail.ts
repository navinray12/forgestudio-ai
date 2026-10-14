import { useState, useEffect, useCallback, useRef } from "react";
import { forumService } from "../services/forumService";
import type { ForumTopic } from "../types/forum.types";

export function useForumTopicDetail(idOrSlug: string) {
  const [topic, setTopic] = useState<ForumTopic | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const mounted = useRef(false);

  const fetchTopic = useCallback(async () => {
    const request = ++requestId.current;
    if (!idOrSlug) {
      if (mounted.current) {
        setTopic(null);
        setError("No discussion topic was selected.");
        setIsLoading(false);
      }
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await forumService.getTopic(idOrSlug);
      if (mounted.current && request === requestId.current) {
        setTopic(res.topic);
      }
    } catch (err: unknown) {
      if (mounted.current && request === requestId.current) {
        setError(err instanceof Error ? err.message : "Failed to load topic");
      }
    } finally {
      if (mounted.current && request === requestId.current) {
        setIsLoading(false);
      }
    }
  }, [idOrSlug]);

  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(() => {
      if (mounted.current) void fetchTopic();
    });
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
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
    setTopic((prev) => prev && prev.id === topic.id ? { ...prev, isBookmarked: res.bookmarked } : prev);
  };

  const toggleFollow = async () => {
    if (!topic) return;
    const res = await forumService.toggleFollow(topic.id);
    setTopic((prev) => prev && prev.id === topic.id ? { ...prev, isFollowed: res.followed } : prev);
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
