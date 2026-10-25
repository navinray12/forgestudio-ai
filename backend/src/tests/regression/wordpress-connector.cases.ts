/**
 * Static inputs for wordpress-connector-characterization.test.ts: fake credentials and rows, the scripted
 * WordPress responses, every exported connector function call, and the URL / helper tables.
 * All credentials are fakes; no live site is contacted (safeEgressRequest is mocked).
 */
export const FIXED_NOW = new Date("2026-01-15T12:00:00.000Z");
export const W = "site-1";
export const U = "user-1";
export const FAKE_API_KEY = "fake-api-key-123";
export const FAKE_KEY_HASH = "fake-api-key-hash-0001";
const T = "2026-01-10T08:30:00.000Z";

export const EDITOR = {
  pages: [
    { id: "home", name: "Home", slug: "/", isHome: true, elements: [{ id: "h1", type: "heading", content: "Hello <&> \"q\"", styles: { color: "red" } }, { id: "t1", type: "text", content: "Body text" }, { id: "i1", type: "image", src: "https://cdn.example.test/a.png", alt: "A" }] },
    { id: "about", name: "About", slug: "/about", elements: [{ id: "c1", type: "container", children: [{ id: "b1", type: "button", content: "Go", href: "/x" }] }] },
  ],
  pageSettings: { title: "Fixture" },
  globalStyles: { colors: { primary: "#123456" } },
};

export const ROWS = {
  connection: { id: "conn-1", websiteId: W, userId: U, siteUrl: "https://wp.example.test", apiKeyHash: FAKE_KEY_HASH, wpSiteName: "WP Fixture", status: "CONNECTED", capabilities: ["pages", "media"], pluginVersion: "2.0.0", apiVersion: "v1", lastVerifiedAt: T, createdAt: T, updatedAt: T, failureReason: null, revokedAt: null, lastSyncedAt: T },
  mapping: { id: "map-1", websiteId: W, forgePageId: "home", wpPostId: 42, wpPageId: 42, wpPostSlug: "home", wpPostUrl: "https://wp.example.test/home", lastPublishedHash: "hash-abc", contentHash: "hash-abc", lastPublishedAt: T, status: "PUBLISHED", format: "html", createdAt: T, updatedAt: T },
  revision: { id: "rev-1", websiteId: W, editorData: EDITOR, snapshot: EDITOR, createdAt: T, versionNumber: 3, version: 3, label: "Published v3", type: "PUBLISH", metadata: { wpPostId: 42, format: "html", publishId: "pub-1" } },
  audit: { id: "audit-1", userId: U, action: "WORDPRESS_PAGE_PUBLISHED", targetResource: `website:${W}`, details: { wpPostId: 42, pageId: "home", status: "publish" }, createdAt: T },
  website: { id: W, userId: U, name: "Fixture Site", slug: "fixture", status: "DRAFT", editorData: EDITOR, publishedSnapshot: EDITOR, userPermission: "OWNER", workspaceStatus: "ACTIVE", documentVersion: 3 },
  job: { id: "job-1", type: "WORDPRESS_PUBLISH", status: "QUEUED", websiteId: W, payload: { websiteId: W, forgePageId: "home", userId: U }, attempts: 0, createdAt: T, updatedAt: T, error: null, result: null },
};

const remotePage = (id: number, slug: string) => ({ id, title: { rendered: `Remote ${slug} <&>` }, slug, status: "publish", link: `https://wp.example.test/${slug}`, modified: T, date: T, parent: 0, menu_order: id, content: { rendered: "<p>Remote <b>content</b></p>" }, excerpt: { rendered: "Excerpt" }, template: "", author: 1 });
const remoteMedia = (id: number) => ({ id, title: { rendered: `Media ${id}` }, source_url: `https://wp.example.test/uploads/m${id}.png`, mime_type: "image/png", media_type: "image", alt_text: "alt", caption: { rendered: "cap" }, description: { rendered: "desc" }, date: T, modified: T, media_details: { width: 10, height: 20, filesize: 1234, file: `m${id}.png` }, slug: `m${id}` });
/** One deterministic body with the fields the connector reads from the plugin's endpoints. */
export const WP_BODY = {
  success: true, ok: true, message: "ok <&>", verified: true, healthy: true,
  site_name: "WP Fixture", name: "WP Fixture", siteName: "WP Fixture", url: "https://wp.example.test", site_url: "https://wp.example.test", home_url: "https://wp.example.test",
  wp_version: "6.5.2", wordpress_version: "6.5.2", wpVersion: "6.5.2", php_version: "8.2.10", phpVersion: "8.2.10", plugin_version: "2.0.0", pluginVersion: "2.0.0", version: "2.0.0", api_version: "v1", apiVersion: "v1",
  capabilities: ["pages", "media", "gutenberg"], permissions: { publish_pages: true, upload_files: true, edit_posts: true }, user: { id: 1, roles: ["administrator"] },
  theme: { name: "Twenty", version: "1.0" }, active_theme: { name: "Twenty", version: "1.0" }, plugins: [{ name: "Akismet", version: "5.0", active: true }],
  is_multisite: false, multisite: false, sites: [{ id: 1, blog_id: 1, url: "https://wp.example.test", name: "Main" }, { id: 2, blog_id: 2, url: "https://wp.example.test/two", name: "Two" }],
  timezone: "UTC", language: "en_US", permalink_structure: "/%postname%/", https: true, ssl: true,
  ...remotePage(42, "remote"), wpPostId: 42, post_id: 42, page: remotePage(42, "remote"), pages: [remotePage(42, "remote"), remotePage(43, "second")], total: 2, total_pages: 2, totalPages: 2,
  items: [remoteMedia(7), remoteMedia(8)], media: remoteMedia(7), ...remoteMedia(7), id_media: 7,
  fields: [{ name: "subtitle", label: "Subtitle", type: "text", value: "Sub <&>" }], acf: { subtitle: "Sub" }, toolset: { field: "v" }, pods: { field: "v" },
  blocks: [{ blockName: "core/paragraph", innerHTML: "<p>x</p>" }], synced: 2, data: { id: 42, status: "publish" },
};

const PUBLISH_OPTS = { pageId: "home", status: "publish", format: "html", title: "Home <&>", slug: "home", includeStyles: true, includeResponsiveStyles: true, publishId: "pub-1", sourceVersion: "3" };
export type Call = { name: string; args: () => unknown[] };
export const CALLS: Call[] = [
  { name: "sendSignedWordPressRequest", args: () => ["https://wp.example.test/", "/status", "POST", FAKE_KEY_HASH, { a: 1, nested: { b: "<&>" } }] },
  { name: "sendSignedWordPressRequest", args: () => ["wp.example.test", "/pages?per_page=5", "GET", FAKE_KEY_HASH] },
  { name: "connectWordPress", args: () => [W, U, "https://wp.example.test/", FAKE_API_KEY, "My WP <&>"] },
  { name: "getWordPressStatus", args: () => [W, U] },
  { name: "verifyWordPressConnection", args: () => [W, U] },
  { name: "verifyWordPressConnection", args: () => [W, U] }, // second call inside the rate-limit window
  { name: "getPageMapping", args: () => [W, "home"] },
  { name: "getWebsitePageMappings", args: () => [W] },
  { name: "getConnectionState", args: () => [W, U] },
  { name: "getConnectionByWebsiteId", args: () => [W] },
  { name: "getWordPressConnection", args: () => [W] },
  { name: "getWordPressSiteInformation", args: () => [W, U] },
  { name: "getWordPressSiteHealth", args: () => [W, U] },
  { name: "publishToWordPress", args: () => [W, U, "dep-1", EDITOR] },
  { name: "syncWordPressPages", args: () => [W, U, EDITOR] },
  { name: "getWordPressPublishStatus", args: () => [W, "home", U] },
  { name: "reconcileUnmappedWordPressPage", args: () => [ROWS.connection, W, "home", { publishId: "pub-1", htmlHash: "hash-abc", slug: "home", title: "Home", sourceVersion: "3" }] },
  { name: "publishWordPressPage", args: () => [W, U, PUBLISH_OPTS] },
  { name: "publishWordPressPage", args: () => [W, U, { ...PUBLISH_OPTS, format: "gutenberg", status: "draft", wordpressPageId: 42 }] },
  { name: "previewWordPressHtml", args: () => [W, U, "home"] },
  { name: "previewWordPressGutenberg", args: () => [W, U, "about"] },
  { name: "getAcfFields", args: () => [W, U, 42, "1"] },
  { name: "getToolsetFields", args: () => [W, U, 42] },
  { name: "getPodsFields", args: () => [W, U] },
  { name: "getWordPressAcfFields", args: () => [W, U, 43, "2"] },
  { name: "getWordPressPodsFields", args: () => [W, U, 43] },
  { name: "getWordPressToolsetFields", args: () => [W, U] },
  { name: "syncGutenbergBlocks", args: () => [W, U, { id: "home", blocks: [{ name: "core/heading", content: "H" }] }, "1"] },
  { name: "getMultisiteSites", args: () => [W, U, "2"] },
  { name: "getWordPressMultisiteSites", args: () => [W, U] },
  { name: "listWordPressPages", args: () => [W, U, { search: "re <&>", status: "publish", parent: 0, author: 1, page: 2, perPage: 5 }] },
  { name: "listWordPressPages", args: () => [W, U] },
  { name: "getWordPressPage", args: () => [W, 42, U] },
  { name: "importWordPressPageToForge", args: () => [W, 42, U] },
  { name: "createWordPressPage", args: () => [W, U, { title: "New <&>", slug: "new", content: "<p>x</p>", status: "draft", parent: 0, menuOrder: 1, template: "default", excerpt: "e", forgePageId: "about" }] },
  { name: "createWordPressPage", args: () => [W, U, { title: "   " }] },
  { name: "updateWordPressPage", args: () => [W, 42, U, { title: "Updated", slug: "updated", status: "private", content: "<p>u</p>" }] },
  { name: "deleteWordPressPage", args: () => [W, 42, U, false] },
  { name: "deleteWordPressPage", args: () => [W, 42, U, true] },
  { name: "duplicateWordPressPage", args: () => [W, 42, U, { customTitle: "Copy <&>", customSlug: "copy" }] },
  { name: "duplicateWordPressPage", args: () => [W, 42, U] },
  { name: "reorderWordPressPage", args: () => [W, 42, U, { targetPageId: 43, position: "AFTER" }] },
  { name: "reorderWordPressPage", args: () => [W, 42, U, { position: "FIRST", parentId: 0 }] },
  { name: "uploadWordPressMedia", args: () => [W, U, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]), "photo <&>.png", "image/png", { title: "Photo", altText: "alt", caption: "cap", description: "desc" }] },
  { name: "uploadWordPressMedia", args: () => [W, U, Buffer.from("<?php echo 1; ?>"), "shell.php", "image/png"] },
  { name: "uploadWordPressMedia", args: () => [W, U, Buffer.alloc(0), "empty.png", "image/png"] },
  { name: "listWordPressMedia", args: () => [W, U, { page: 2, perPage: 6, search: "m", mediaType: "image", order: "ASC", orderby: "title" }] },
  { name: "listWordPressMedia", args: () => [W, U] },
  { name: "getWordPressMedia", args: () => [W, U, 7] },
  { name: "updateWordPressMedia", args: () => [W, U, 7, { title: "T", altText: "A", caption: "C", description: "D" }] },
  { name: "deleteWordPressMedia", args: () => [W, U, 7, { force: true }] },
  { name: "deleteWordPressMedia", args: () => [W, U, 8] },
  { name: "getWordPressRollbackTargets", args: () => [W, "home", U] },
  { name: "rollbackWordPressPage", args: () => [W, "home", U, { snapshotId: "rev-1" }] },
  { name: "createWordPressPublishJob", args: () => [W, "home", U, { status: "publish", format: "html", mode: "publish", title: "Home", slug: "home", targetWpPostId: 42 }] },
  { name: "getWordPressPublishJobStatus", args: () => [W, "job-1", U] },
  { name: "listWordPressPublishJobs", args: () => [W, U, { pageId: "home", status: "QUEUED", limit: 5 }] },
  { name: "cancelWordPressPublishJob", args: () => [W, "job-1", U, "No longer needed <&>"] },
  { name: "retryWordPressPublishJob", args: () => [W, "job-1", U] },
  { name: "disconnectWordPress", args: () => [W, U] },
  { name: "revokeWordPressConnection", args: () => [W, U] },
  { name: "generateWordPressPluginZip", args: () => [] },
];

export const SCENARIOS = ["ok", "accessDenied", "websiteNotFound", "notConnected", "http500", "networkError", "malformedJson"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const URLS = [
  "", "   ", "wp.example.test", "https://wp.example.test/", "http://wp.example.test/blog///", "HTTPS://WP.Example.Test:8443/path/?q=1#h", "ftp://wp.example.test", "javascript:alert(1)", "https://",
  "localhost", "http://127.0.0.1", "https://127.8.9.10", "http://10.1.2.3", "http://172.16.0.1", "http://172.31.255.255", "http://172.32.0.1", "http://192.168.1.10", "http://169.254.169.254/latest", "http://[::1]/", "http://0.0.0.0",
  "https://metadata.google.internal", "https://printer.local", "https://box.internal", "https://nas.lan", "https://8.8.8.8", "https://user:pass@wp.example.test/x",
];
export const ENVS: Array<Record<string, string | undefined>> = [
  { NODE_ENV: "production" }, { NODE_ENV: "test" }, { NODE_ENV: "development" }, { NODE_ENV: "production", ALLOW_LOCAL_WORDPRESS: "true" }, { NODE_ENV: "production", ALLOW_LOCAL_WEBHOOKS: "true" },
];
export const AMBIGUOUS = [null, undefined, {}, { code: "ETIMEDOUT" }, { code: "ECONNRESET" }, { code: "ECONNREFUSED" }, { code: "ENOTFOUND" }, { name: "AbortError" }, { message: "socket hang up" }, { message: "Request timed out" }, { status: 500 }, { statusCode: 502 }, { status: 400 }, new Error("fetch failed")];
export const TITLES = ["About", "About (Copy)", "About (Copy 2)", "About (Copy 9)", "", "  Spaced  ", "Copy"];
export const SLUGS: Array<[string, string[] | undefined]> = [["about", undefined], ["about", ["about-copy"]], ["about", ["about-copy", "about-copy-2", "about-copy-3"]], ["", []], ["about-copy", ["about-copy-copy"]], ["Mixed Case", ["mixed-case-copy"]]];
