export type ForumTopicStatus = "OPEN" | "LOCKED" | "SOLVED" | "ARCHIVED" | "HIDDEN";
export type ForumTopicVisibility = "PUBLIC" | "WORKSPACE" | "PRIVATE";
export type ForumReactionType = "LIKE" | "HEART" | "HELPFUL" | "CELEBRATE";
export type ForumReportStatus = "PENDING" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";

export interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  displayOrder: number;
  isActive: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    topics: number;
  };
}

export interface ForumUser {
  id: string;
  fullName?: string;
  email?: string;
  role?: string;
  avatarUrl?: string;
}

export interface ForumReaction {
  id: string;
  postId: string;
  userId: string;
  type: ForumReactionType;
  createdAt: string;
  user?: {
    id: string;
    fullName?: string;
  };
}

export interface ForumPostAttachment {
  id: string;
  topicId: string;
  postId?: string;
  uploadedById: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface ForumPost {
  id: string;
  topicId: string;
  authorId: string;
  parentPostId?: string;
  content: string;
  isAcceptedAnswer: boolean;
  isHidden: boolean;
  editedAt?: string;
  editedById?: string;
  createdAt: string;
  updatedAt: string;
  author?: ForumUser;
  reactions?: ForumReaction[];
  attachments?: ForumPostAttachment[];
  replies?: ForumPost[];
}

export interface ForumTopic {
  id: string;
  topicNumber: string;
  title: string;
  slug: string;
  content: string;
  categoryId: string;
  authorId: string;
  workspaceId?: string;
  websiteId?: string;
  status: ForumTopicStatus;
  visibility: ForumTopicVisibility;
  isPinned: boolean;
  isLocked: boolean;
  isFeatured: boolean;
  isSolved: boolean;
  acceptedAnswerId?: string;
  viewCount: number;
  replyCount: number;
  lastActivityAt: string;
  tags: string[];
  contextData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  author?: ForumUser;
  category?: ForumCategory;
  workspace?: { id: string; name: string; slug: string };
  website?: { id: string; name: string; slug: string };
  posts?: ForumPost[];
  attachments?: ForumPostAttachment[];
  isBookmarked?: boolean;
  isFollowed?: boolean;
}

export interface ForumTag {
  id: string;
  name: string;
  slug: string;
  usageCount: number;
}

export interface ForumReport {
  id: string;
  topicId?: string;
  postId?: string;
  reporterId: string;
  reason: string;
  details?: string;
  status: ForumReportStatus;
  resolutionNotes?: string;
  resolvedById?: string;
  createdAt: string;
  reporter?: ForumUser;
  topic?: { id: string; title: string; topicNumber: string };
  post?: { id: string; content: string };
}

export interface ForumTopicFilters {
  query?: string;
  categoryId?: string;
  categorySlug?: string;
  tag?: string;
  status?: string;
  solved?: boolean;
  unanswered?: boolean;
  featured?: boolean;
  workspaceId?: string;
  authorId?: string;
  page?: number;
  limit?: number;
  sortBy?: "latest" | "popular" | "activity" | "views" | "replies";
}

export interface ForumAnalyticsMetrics {
  metrics: {
    totalTopics: number;
    totalPosts: number;
    solvedTopics: number;
    solvedPercentage: number;
    totalCategories: number;
  };
  topTags: ForumTag[];
  topContributorsCount: number;
}
