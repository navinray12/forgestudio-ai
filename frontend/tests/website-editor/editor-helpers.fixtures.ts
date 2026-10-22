/**
 * Input matrix for the pure WebsiteEditor helpers (editor-helpers.golden.json). Builders return fresh
 * objects on every call so reference-identity results are meaningful. Changing anything here
 * invalidates the golden file.
 */
export const makeTree = (): any[] => [
  { id: "root1", type: "container", content: "", children: [
    { id: "childA", type: "heading", content: "Hello World", styles: {} },
    { id: "childB", type: "container", children: [
      { id: "deep1", type: "image", content: "", alt: "Mountain view" },
      { id: "deep2", type: "text", content: "Pricing details" },
    ] },
    { id: "childC", type: "button", content: "Buy now", children: [] },
  ] },
  { id: "root2", type: "text", content: "Footer note" },
  { id: "childA", type: "heading", content: "Duplicate id later in the tree" },
];

/** Each entry: [label, () => tree]. */
export const TREES: Array<[string, () => any]> = [
  ["empty", () => []],
  ["nested", makeTree],
  ["flat", () => [{ id: "one", type: "text" }, { id: "two", type: "text" }]],
  ["missingType", () => [{ id: "noType", content: "Typeless" }]],
  ["missingId", () => [{ type: "text", content: "No id" }, { id: "after", type: "text" }]],
  ["nullItem", () => [null, { id: "after", type: "text" }]],
  ["childrenString", () => [{ id: "odd", type: "container", children: "xy" }]],
  ["childrenNull", () => [{ id: "nullKids", type: "container", children: null }]],
  ["numericContent", () => [{ id: "num", type: "text", content: 42 }]],
  ["notArray", () => ({ id: "single", type: "text" })],
  ["undefined", () => undefined],
];

export const FIND_TARGETS = ["root1", "childA", "deep2", "childC", "missing", "", "after", "noType", "odd", "num", "single"];

export const SEARCH_QUERIES: any[] = ["", "  ", "head", "HEAD", "  Pricing ", "mountain", "deep", "container", "zzz", "›", "typeless", undefined];

export const VIDEO_URLS: any[] = [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
  "https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
  "https://youtu.be/dQw4w9WgXcQ",
  "https://youtu.be/dQw4w9WgXcQ?si=abc",
  "https://www.youtube.com/embed/dQw4w9WgXcQ",
  "https://www.youtube.com/v/dQw4w9WgXcQ",
  "https://www.youtube.com/u/w/dQw4w9WgXcQ",
  "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  "https://www.youtube.com/watch?v=short",
  "https://www.youtube.com/watch?v=dQw4w9WgXcQX",
  "   https://youtu.be/dQw4w9WgXcQ   ",
  "https://vimeo.com/76979871",
  "https://player.vimeo.com/video/76979871?h=abc",
  "https://vimeo.com/channels/staffpicks/76979871",
  "https://vimeo.com/abc",
  "https://example.com/movie.mp4",
  "not a url",
  "",
  null,
  undefined,
  0,
  123,
  { href: "https://youtu.be/dQw4w9WgXcQ" },
];

export const BACKGROUND_STYLES: any[] = [
  {},
  { backgroundColor: "#112233" },
  { backgroundImage: "url(\"https://cdn.example.test/a.png\")" },
  { backgroundImage: "/uploads/bg.png" },
  { backgroundImage: "uploads/bg.png" },
  { backgroundImage: "https://cdn.example.test/b.png" },
  { backgroundImage: "data:image/png;base64,AAAA" },
  { backgroundImage: "", backgroundColor: "" },
  { backgroundPosition: "center", backgroundSize: "cover", backgroundRepeat: "no-repeat" },
  { borderStyle: "none", borderWidth: "3px", borderColor: "red" },
  { borderStyle: "solid" },
  { borderStyle: "dashed", borderWidth: "2px", borderColor: "#000" },
  { borderRadius: "8px" },
  { borderTopLeftRadius: "4px" },
  { borderTopLeftRadius: "4px", borderBottomRightRadius: "6px", borderRadius: "9px" },
  { boxShadow: "0 1px 2px rgba(0,0,0,0.2)" },
  { background: "linear-gradient(red, blue)", border: "1px solid red", borderTop: "", borderLeft: null },
  { borderRight: "2px dotted green", borderBottom: "0" },
  { backgroundColor: "#fff", backgroundImage: "/x.png", borderStyle: "solid", borderRadius: "2px", boxShadow: "none", background: "red" },
];

export const POSITION_STYLES: any[] = [
  {},
  { position: "static", top: "1px" },
  { position: "relative", top: "0", left: 0 },
  { position: "absolute", top: "10px", right: "", bottom: "5%", left: "auto" },
  { position: "fixed", zIndex: "7" },
  { position: "sticky", zIndex: 0 },
  { zIndex: "" },
  { zIndex: null },
  { zIndex: "abc" },
  { transformRotate: "45deg" },
  { transformScale: "1.5" },
  { transformTranslateX: "10px" },
  { transformTranslateY: "-4px" },
  { transformRotate: "10deg", transformScale: "2", transformTranslateX: "1px", transformTranslateY: "2px" },
  { transformRotate: "", transformScale: 0 },
  { opacity: "0" },
  { opacity: 0.5 },
  { opacity: "" },
  { opacity: null },
  { overflowX: "hidden", overflowY: "auto" },
  { overflowX: "" },
];

export const API_URLS = ["http://localhost:5000", "https://api.example.test"];
