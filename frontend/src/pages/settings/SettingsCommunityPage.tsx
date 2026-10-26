import React, { useState } from "react";
import {
  Bookmark,
  Check,
  Clock,
  Download,
  Flame,
  Heart,
  Layout,
  MessageSquare,
  MoreVertical,
  Package,
  Plus,
  Search,
  Share2,
  Sparkles,
  SquarePen,
  Users,
  Video,
  X,
} from "lucide-react";
import { SettingsLayout } from "./SettingsLayout";
import { useAuth } from "../../context/AuthContext";
import "./Settings.css";

interface PostItem {
  id: string;
  author: {
    name: string;
    avatarLetter: string;
    avatarBg: string;
    badge: string;
    badgeType: "pro" | "teal" | "amber";
    roleAndTime: string;
  };
  category: {
    label: string;
    type: "showcase" | "discussion" | "plugin";
  };
  title: string;
  body: string;
  likes: number;
  commentsCount: number;
  commentsList?: string[];
  mediaPreview?: {
    filename: string;
    dimensions: string;
  };
  pluginAttachment?: {
    filename: string;
    compat: string;
  };
}

export default function SettingsCommunityPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "showcase" | "discussions">("all");
  const [sortOrder, setSortOrder] = useState<"trending" | "recent">("trending");

  // Interactive state
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Record<string, boolean>>({});
  const [installedPlugins, setInstalledPlugins] = useState<Record<string, boolean>>({});
  const [followedCreators, setFollowedCreators] = useState<Record<string, boolean>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  // Modals
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCategory, setNewCategory] = useState<"showcase" | "discussion" | "plugin">("showcase");

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const initialPosts: PostItem[] = [
    {
      id: "post-1",
      author: {
        name: "Sarthi",
        avatarLetter: "S",
        avatarBg: "#9333ea",
        badge: "PRO",
        badgeType: "pro",
        roleAndTime: "Product Designer • 2 hours ago",
      },
      category: {
        label: "✨ Showcase",
        type: "showcase",
      },
      title: "Redesigned the Dark Studio Settings Navigation & UI Layout! 🚀",
      body: "Hey web creators! Just updated our multi-panel dashboard dark mode concept with seamless gradient highlights, unified sidebar icons, and customizable component cards. Let me know what you think of the new contrast balance!",
      likes: 142,
      commentsCount: 18,
      mediaPreview: {
        filename: "Web_Studio_Dashboard_Dark_System.fig",
        dimensions: "1920×1080",
      },
    },
    {
      id: "post-2",
      author: {
        name: "Marcus Vance",
        avatarLetter: "M",
        avatarBg: "#0d9488",
        badge: "PLUGIN DEV",
        badgeType: "teal",
        roleAndTime: "Software Architect • 5 hours ago",
      },
      category: {
        label: "💬 Discussion",
        type: "discussion",
      },
      title: "What is your primary choice for Web Studio State Management in 2026?",
      body: "We are building complex UI canvas widgets with interactive real-time syncing. Are you guys preferring local signal stores or centralized global state wrappers? Share your architectural preferences below!",
      likes: 89,
      commentsCount: 41,
    },
    {
      id: "post-3",
      author: {
        name: "Kenta Tanaka",
        avatarLetter: "K",
        avatarBg: "#ea580c",
        badge: "FEATURED CREATOR",
        badgeType: "amber",
        roleAndTime: "3D Web Developer • Yesterday",
      },
      category: {
        label: "🔌 Plugins",
        type: "plugin",
      },
      title: "Released: 3D Viewport Generator Plugin v2.1 for Web Studio 🎨",
      body: "Easily embed lighting-fast GLTF 3D interactive models into your canvas layouts directly from the Web Studio sidebar! Features include custom HDR environment lights, ambient shadows, and auto-rotation toggles.",
      likes: 310,
      commentsCount: 19,
      pluginAttachment: {
        filename: "3D-Viewport-Generator-v2.1.wstudio",
        compat: "Compatible with Web Studio Engine 4.2+",
      },
    },
  ];

  const [posts, setPosts] = useState<PostItem[]>(initialPosts);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleLike = (postId: string) => {
    setLikedPosts((prev) => {
      const next = !prev[postId];
      setPosts((pList) =>
        pList.map((p) =>
          p.id === postId ? { ...p, likes: p.likes + (next ? 1 : -1) } : p
        )
      );
      return { ...prev, [postId]: next };
    });
  };

  const handleBookmark = (postId: string) => {
    setBookmarkedPosts((prev) => {
      const next = !prev[postId];
      showToast(next ? "Saved to your bookmarks" : "Removed from bookmarks");
      return { ...prev, [postId]: next };
    });
  };

  const handleShare = (postTitle: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(window.location.href);
      showToast("Link copied to clipboard!");
    } else {
      showToast(`Shared "${postTitle.slice(0, 30)}..."`);
    }
  };

  const handleInstall = (filename: string) => {
    setInstalledPlugins((prev) => {
      const next = !prev[filename];
      showToast(next ? `Installed ${filename} into Web Studio!` : `Uninstalled ${filename}`);
      return { ...prev, [filename]: next };
    });
  };

  const handleFollow = (name: string) => {
    setFollowedCreators((prev) => {
      const next = !prev[name];
      showToast(next ? `Following ${name}` : `Unfollowed ${name}`);
      return { ...prev, [name]: next };
    });
  };

  const { user } = useAuth();

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;

    const authorName = user?.fullName?.trim() || user?.email?.split("@")[0] || "Web Studio Creator";
    const authorInitial = (authorName.charAt(0) || "W").toUpperCase();

    const newPost: PostItem = {
      id: `post-${Date.now()}`,
      author: {
        name: authorName,
        avatarLetter: authorInitial,
        avatarBg: "#9333ea",
        badge: "PRO",
        badgeType: "pro",
        roleAndTime: "Web Studio Creator • Just now",
      },
      category: {
        label:
          newCategory === "showcase"
            ? "✨ Showcase"
            : newCategory === "discussion"
            ? "💬 Discussion"
            : "🔌 Plugins",
        type: newCategory,
      },
      title: newTitle.trim(),
      body: newBody.trim(),
      likes: 1,
      commentsCount: 0,
    };

    setPosts([newPost, ...posts]);
    setNewTitle("");
    setNewBody("");
    setCreatePostOpen(false);
    showToast("Post published to community!");
  };

  // Filter posts
  const filteredPosts = posts.filter((post) => {
    if (activeFilter === "showcase" && post.category.type !== "showcase") return false;
    if (activeFilter === "discussions" && post.category.type !== "discussion") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = post.title.toLowerCase().includes(q);
      const matchBody = post.body.toLowerCase().includes(q);
      const matchAuthor = post.author.name.toLowerCase().includes(q);
      const matchPlugin = post.pluginAttachment?.filename.toLowerCase().includes(q);
      return matchTitle || matchBody || matchAuthor || matchPlugin;
    }
    return true;
  });

  return (
    <SettingsLayout activeTab="community">
      <div className="ws-community-container">
        {/* HERO BANNER */}
        <section className="ws-comm-hero" aria-label="Creators Network">
          <div className="ws-comm-hero-content">
            <div>
              <div className="ws-comm-eyebrow">Web Studio Creators Network</div>
              <h1 className="ws-comm-title">
                Connect, Share &amp; Build{"\n"}Together
              </h1>
              <p className="ws-comm-desc">
                Explore UI layouts, discuss components, share web plugins, and get instant feedback from over 14,000+ designers and developers.
              </p>
            </div>

            <button
              className="ws-create-post-btn"
              onClick={() => setCreatePostOpen(true)}
            >
              <SquarePen size={15} />
              <span>Create Post</span>
            </button>
          </div>

          {/* Stats Counters */}
          <div className="ws-comm-stats-row">
            <div className="ws-comm-stat">
              <span className="ws-stat-number">14.8k</span>
              <span className="ws-stat-label">Active Creators</span>
            </div>
            <div className="ws-comm-stat">
              <span className="ws-stat-number">3.2k</span>
              <span className="ws-stat-label">UI Blocks Shared</span>
            </div>
            <div className="ws-comm-stat">
              <span className="ws-stat-number">24/7</span>
              <span className="ws-stat-label">Live Support</span>
            </div>
          </div>
        </section>

        {/* SEARCH BAR */}
        <div className="ws-search-bar">
          <Search size={16} className="ws-search-icon" />
          <input
            className="ws-search-input"
            placeholder="Search topics, plugins, show-cases or members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* FILTER & SORT ROW */}
        <div className="ws-filter-row">
          <div className="ws-filter-pills">
            <button
              className={`ws-filter-pill ${activeFilter === "all" ? "active" : ""}`}
              onClick={() => setActiveFilter("all")}
            >
              All Posts
            </button>
            <button
              className={`ws-filter-pill ${activeFilter === "showcase" ? "active" : ""}`}
              onClick={() => setActiveFilter("showcase")}
            >
              ✨ Showcase
            </button>
            <button
              className={`ws-filter-pill ${activeFilter === "discussions" ? "active" : ""}`}
              onClick={() => setActiveFilter("discussions")}
            >
              💬 Discussions
            </button>
          </div>

          <button
            className="ws-sort-btn"
            onClick={() =>
              setSortOrder((prev) => (prev === "trending" ? "recent" : "trending"))
            }
          >
            <Flame size={14} color="#f97316" />
            <span>{sortOrder === "trending" ? "🔥 Trending First" : "⚡ Newest First"}</span>
            <span style={{ fontSize: 10, marginLeft: 2 }}>▾</span>
          </button>
        </div>

        {/* TWO COLUMNS LAYOUT */}
        <div className="ws-comm-cols">
          {/* Main Feed Column */}
          <div className="ws-feed-col">
            {filteredPosts.map((post) => {
              const isLiked = !!likedPosts[post.id];
              const isBookmarked = !!bookmarkedPosts[post.id];
              const isCommentsOpen = !!expandedComments[post.id];
              const isInstalled = post.pluginAttachment
                ? !!installedPlugins[post.pluginAttachment.filename]
                : false;

              return (
                <article key={post.id} className="ws-post-card">
                  {/* Post Header */}
                  <div className="ws-post-header">
                    <div className="ws-post-author-box">
                      <div
                        className="ws-post-avatar"
                        style={{ backgroundColor: post.author.avatarBg }}
                      >
                        {post.author.avatarLetter}
                      </div>

                      <div className="ws-post-meta">
                        <div className="ws-author-name-row">
                          <span className="ws-post-author-name">{post.author.name}</span>
                          {post.author.badgeType === "pro" && (
                            <span className="ws-badge-pro">{post.author.badge}</span>
                          )}
                          {post.author.badgeType === "teal" && (
                            <span className="ws-badge-teal">{post.author.badge}</span>
                          )}
                          {post.author.badgeType === "amber" && (
                            <span className="ws-badge-amber">{post.author.badge}</span>
                          )}
                        </div>
                        <span className="ws-post-time">{post.author.roleAndTime}</span>
                      </div>
                    </div>

                    <div className="ws-post-header-right">
                      <span
                        className={`ws-category-tag ${
                          post.category.type === "showcase"
                            ? "ws-cat-showcase"
                            : post.category.type === "discussion"
                            ? "ws-cat-discussion"
                            : "ws-cat-plugin"
                        }`}
                      >
                        {post.category.label}
                      </span>
                      <button
                        className="ws-header-icon-btn"
                        style={{ padding: 4 }}
                        aria-label="More options"
                        onClick={() => showToast("Options menu")}
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Post Title & Body */}
                  <h2 className="ws-post-title">{post.title}</h2>
                  <p className="ws-post-body">{post.body}</p>

                  {/* Media Preview Box (Post 1 Showcase) */}
                  {post.mediaPreview && (
                    <div
                      className="ws-media-container"
                      onClick={() => setPreviewModalOpen(true)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="ws-media-icon">
                        <Layout size={22} />
                      </div>
                      <span className="ws-media-filename">
                        {post.mediaPreview.filename}
                      </span>
                      <span className="ws-media-sub">
                        Click to inspect component interactive preview ({post.mediaPreview.dimensions})
                      </span>
                    </div>
                  )}

                  {/* Plugin Attachment Box (Post 3 Plugin) */}
                  {post.pluginAttachment && (
                    <div className="ws-plugin-box">
                      <div className="ws-plugin-left">
                        <div className="ws-plugin-icon-wrap">
                          <Package size={20} />
                        </div>
                        <div>
                          <div className="ws-plugin-title">
                            {post.pluginAttachment.filename}
                          </div>
                          <div className="ws-plugin-compat">
                            {post.pluginAttachment.compat}
                          </div>
                        </div>
                      </div>

                      <button
                        className={`ws-install-plugin-btn ${isInstalled ? "installed" : ""}`}
                        onClick={() => handleInstall(post.pluginAttachment!.filename)}
                      >
                        {isInstalled ? (
                          <>
                            <Check size={14} />
                            <span>Installed ✓</span>
                          </>
                        ) : (
                          <>
                            <Download size={14} />
                            <span>Install Plugin</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Post Footer Actions */}
                  <div className="ws-post-footer">
                    <div className="ws-post-actions-left">
                      <button
                        className={`ws-action-btn ${isLiked ? "liked" : ""}`}
                        onClick={() => handleLike(post.id)}
                      >
                        <Heart
                          size={15}
                          fill={isLiked ? "#ec4899" : "none"}
                          color={isLiked ? "#ec4899" : "currentColor"}
                        />
                        <span>{post.likes}</span>
                      </button>

                      <button
                        className="ws-action-btn"
                        onClick={() =>
                          setExpandedComments((prev) => ({
                            ...prev,
                            [post.id]: !prev[post.id],
                          }))
                        }
                      >
                        <MessageSquare size={15} />
                        <span>{post.commentsCount} Comments</span>
                      </button>

                      <button
                        className="ws-action-btn"
                        onClick={() => handleShare(post.title)}
                      >
                        <Share2 size={15} />
                        <span>Share</span>
                      </button>
                    </div>

                    <button
                      className={`ws-action-btn ${isBookmarked ? "bookmarked" : ""}`}
                      onClick={() => handleBookmark(post.id)}
                      aria-label="Bookmark"
                    >
                      <Bookmark
                        size={16}
                        fill={isBookmarked ? "#a855f7" : "none"}
                        color={isBookmarked ? "#a855f7" : "currentColor"}
                      />
                    </button>
                  </div>

                  {/* Interactive Comments Drawer */}
                  {isCommentsOpen && (
                    <div
                      style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: "1px solid #1f1c35",
                      }}
                    >
                      <div style={{ fontSize: 12, color: "#8b85af", marginBottom: 8 }}>
                        Top community comments:
                      </div>
                      <div
                        style={{
                          backgroundColor: "#0d0c1b",
                          padding: "10px 14px",
                          borderRadius: 10,
                          fontSize: 12.5,
                          color: "#d1cde0",
                          lineHeight: 1.4,
                          marginBottom: 8,
                        }}
                      >
                        <strong style={{ color: "#ffffff" }}>Alex Rivera:</strong> Loving the contrast of this dark theme! The purple accents feel extremely premium and easy on the eyes.
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* Right Sidebar Widgets */}
          <aside className="ws-side-col" aria-label="Community highlights">
            {/* WIDGET 1: Trending Discussions */}
            <section className="ws-widget" aria-label="Trending Discussions">
              <div className="ws-widget-header">
                <h3 className="ws-widget-title">
                  <Flame size={14} color="#f97316" />
                  <span>TRENDING DISCUSSIONS</span>
                </h3>
                <span
                  className="ws-widget-link"
                  onClick={() => showToast("Showing all discussions")}
                >
                  View All
                </span>
              </div>

              <div className="ws-trending-item">
                <span
                  className="ws-trending-title"
                  onClick={() => showToast("Opening discussion: Responsive auto-layouts")}
                >
                  Best practices for responsive auto-layouts in Web Studio?
                </span>
                <span className="ws-trending-meta">84 replies • UI/UX Category</span>
              </div>

              <div className="ws-trending-item">
                <span
                  className="ws-trending-title"
                  onClick={() => showToast("Opening discussion: Tailwind v4 alpha")}
                >
                  Tailwind v4 alpha compatibility status with plugins
                </span>
                <span className="ws-trending-meta">52 replies • Development</span>
              </div>

              <div className="ws-trending-item">
                <span
                  className="ws-trending-title"
                  onClick={() => showToast("Opening discussion: Dark mode color palettes")}
                >
                  Show off your dark mode color palettes for 2026!
                </span>
                <span className="ws-trending-meta">129 replies • Showcase</span>
              </div>
            </section>

            {/* WIDGET 2: Suggested Creators */}
            <section className="ws-widget" aria-label="Suggested Creators">
              <div className="ws-widget-header">
                <h3 className="ws-widget-title">
                  <Users size={14} color="#3b82f6" />
                  <span>SUGGESTED CREATORS</span>
                </h3>
              </div>

              <div className="ws-creators-list">
                {/* Creator 1 */}
                <div className="ws-creator-row">
                  <div className="ws-creator-info">
                    <div
                      className="ws-creator-avatar"
                      style={{ backgroundColor: "#2563eb" }}
                    >
                      D
                    </div>
                    <div>
                      <div className="ws-creator-name">David Miller</div>
                      <div className="ws-creator-role">Lead UI Architect</div>
                    </div>
                  </div>
                  <button
                    className={`ws-follow-btn ${
                      followedCreators["David Miller"] ? "following" : ""
                    }`}
                    onClick={() => handleFollow("David Miller")}
                  >
                    {followedCreators["David Miller"] ? "Following" : "Follow"}
                  </button>
                </div>

                {/* Creator 2 */}
                <div className="ws-creator-row">
                  <div className="ws-creator-info">
                    <div
                      className="ws-creator-avatar"
                      style={{ backgroundColor: "#e11d48" }}
                    >
                      Z
                    </div>
                    <div>
                      <div className="ws-creator-name">Zara Chen</div>
                      <div className="ws-creator-role">Design Systems Lead</div>
                    </div>
                  </div>
                  <button
                    className={`ws-follow-btn ${
                      followedCreators["Zara Chen"] ? "following" : ""
                    }`}
                    onClick={() => handleFollow("Zara Chen")}
                  >
                    {followedCreators["Zara Chen"] ? "Following" : "Follow"}
                  </button>
                </div>

                {/* Creator 3 */}
                <div className="ws-creator-row">
                  <div className="ws-creator-info">
                    <div
                      className="ws-creator-avatar"
                      style={{ backgroundColor: "#7c3aed" }}
                    >
                      R
                    </div>
                    <div>
                      <div className="ws-creator-name">Rohan Verma</div>
                      <div className="ws-creator-role">Fullstack Creator</div>
                    </div>
                  </div>
                  <button
                    className={`ws-follow-btn ${
                      followedCreators["Rohan Verma"] ? "following" : ""
                    }`}
                    onClick={() => handleFollow("Rohan Verma")}
                  >
                    {followedCreators["Rohan Verma"] ? "Following" : "Follow"}
                  </button>
                </div>
              </div>
            </section>

            {/* WIDGET 3: Upcoming Events */}
            <section className="ws-widget" aria-label="Upcoming Events">
              <div className="ws-widget-header">
                <h3 className="ws-widget-title">
                  <span>📅 UPCOMING EVENTS</span>
                </h3>
              </div>

              <div className="ws-event-card">
                <div className="ws-event-tag">
                  <Video size={13} />
                  <span>Live Stream Workshop</span>
                </div>
                <h4 className="ws-event-title">
                  Building High Performance Web Studio Plugins
                </h4>
                <div className="ws-event-time">
                  <Clock size={13} />
                  <span>Thursday, Oct 2 • 6:00 PM GMT</span>
                </div>
              </div>
            </section>
          </aside>
        </div>

        {/* MODAL: Create Post */}
        {createPostOpen && (
          <div
            className="ws-modal-overlay"
            onClick={() => setCreatePostOpen(false)}
          >
            <div
              className="ws-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 18,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 17, color: "#ffffff", fontWeight: 700 }}>
                  Create Community Post
                </h3>
                <button
                  className="ws-header-icon-btn"
                  onClick={() => setCreatePostOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreatePost}>
                <div className="ws-field-group" style={{ marginBottom: 14 }}>
                  <label className="ws-label">Category</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      className={`ws-filter-pill ${
                        newCategory === "showcase" ? "active" : ""
                      }`}
                      onClick={() => setNewCategory("showcase")}
                    >
                      ✨ Showcase
                    </button>
                    <button
                      type="button"
                      className={`ws-filter-pill ${
                        newCategory === "discussion" ? "active" : ""
                      }`}
                      onClick={() => setNewCategory("discussion")}
                    >
                      💬 Discussion
                    </button>
                    <button
                      type="button"
                      className={`ws-filter-pill ${
                        newCategory === "plugin" ? "active" : ""
                      }`}
                      onClick={() => setNewCategory("plugin")}
                    >
                      🔌 Plugins
                    </button>
                  </div>
                </div>

                <div className="ws-field-group" style={{ marginBottom: 14 }}>
                  <label className="ws-label" htmlFor="post-title">
                    Title
                  </label>
                  <input
                    id="post-title"
                    className="ws-input"
                    placeholder="Enter discussion or showcase headline..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="ws-field-group" style={{ marginBottom: 20 }}>
                  <label className="ws-label" htmlFor="post-body">
                    Content
                  </label>
                  <textarea
                    id="post-body"
                    className="ws-input"
                    rows={4}
                    placeholder="Share your thoughts, workflow details, or instructions..."
                    value={newBody}
                    onChange={(e) => setNewBody(e.target.value)}
                    required
                    style={{ resize: "vertical" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    className="ws-btn-pill"
                    onClick={() => setCreatePostOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="ws-create-post-btn">
                    Publish Post
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Component Preview */}
        {previewModalOpen && (
          <div
            className="ws-modal-overlay"
            onClick={() => setPreviewModalOpen(false)}
          >
            <div
              className="ws-modal-card"
              style={{ maxWidth: 720 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, color: "#ffffff", fontWeight: 700 }}>
                    Web_Studio_Dashboard_Dark_System.fig
                  </h3>
                  <span style={{ fontSize: 11, color: "#7e799c" }}>
                    Interactive Vector Component Preview (1920×1080 Viewport)
                  </span>
                </div>
                <button
                  className="ws-header-icon-btn"
                  onClick={() => setPreviewModalOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div
                style={{
                  height: 320,
                  backgroundColor: "#07060f",
                  borderRadius: 12,
                  border: "1px solid #231f42",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <Layout size={40} color="#a855f7" />
                <span style={{ color: "#d8b4fe", fontSize: 14, fontWeight: 600 }}>
                  Web Studio Dashboard Multi-Panel System
                </span>
                <span style={{ color: "#7b759c", fontSize: 12 }}>
                  Inspected live: 4 sidebar rail items, 5 sub-nav items, dark contrast token matrix
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TOAST FEEDBACK */}
        {toastMsg && (
          <div className="ws-toast">
            <Check size={16} color="#c084fc" />
            <span>{toastMsg}</span>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}
