/**
 * Rich website for website-editor-integration.golden.json: styled/positioned elements and both
 * video providers (exercising the extracted style compilers and embed-id helpers through the real
 * canvas), and site parts using both flag spellings. Changing anything here invalidates the golden.
 */
import { siteFixture } from "./editor-harness";

export const RICH_RENDER_IDS = ["box1", "styled1", "vid1", "vid2", "vid3"];

export function richSite() {
  return {
    ...siteFixture(),
    editorData: {
      pages: [
        {
          id: "home", name: "Home", slug: "/", isHome: true,
          pageSettings: { title: "Home", path: "/", description: "Landing" },
          elements: [
            { id: "elA", type: "heading", content: "Alpha heading", styles: {} },
            {
              id: "box1", type: "container", content: "", layout: {},
              styles: { position: "absolute", top: "4px", left: "", zIndex: "7", backgroundColor: "#112233", backgroundImage: "/uploads/bg.png", borderStyle: "dashed", borderTopLeftRadius: "4px", transformRotate: "5deg", transformTranslateX: "3px", opacity: "0.9" },
              children: [{ id: "inner1", type: "heading", content: "Inner heading", styles: {} }],
            },
            { id: "styled1", type: "text", content: "Styled text", styles: { position: "relative", zIndex: 0, backgroundImage: "url(\"https://cdn.example.test/t.png\")", borderStyle: "solid", borderRadius: "6px", boxShadow: "0 1px 2px #000", background: "linear-gradient(#fff, #000)", overflowX: "hidden" } },
            { id: "vid1", type: "video", content: "", src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", styles: {} },
            { id: "vid2", type: "video", content: "", src: "https://player.vimeo.com/video/76979871", styles: {} },
            { id: "vid3", type: "video", content: "", src: "https://www.youtube.com/watch?v=short", styles: {} },
          ],
        },
        { id: "about", name: "About", slug: "/about", elements: [{ id: "elC", type: "heading", content: "Charlie heading", styles: {} }] },
      ],
      homePageId: "home",
      siteParts: {
        header: { enabled: false, isEnabled: true, elements: [{ id: "hdrEl", type: "heading", content: "Header", styles: {} }] },
        footer: { enabled: true, isEnabled: false, elements: [{ id: "ftrEl", type: "text", content: "Footer", styles: {} }] },
      },
      publishing: { status: "DRAFT", version: 2 },
      deployment: { provider: "none" },
      breakpoints: [{ id: "desktop", label: "Desktop", width: 1200 }, { id: "mobile", label: "Mobile", width: 375 }],
      globalSettings: { fontFamily: "Inter", globalStyles: { primaryColor: "#123456" } },
      globalVariables: [{ id: "var1", name: "space", value: "8px" }],
      globalClasses: [{ id: "cls1", name: "card", styles: {} }],
      pageCss: ".hero { color: red; }",
      publishedData: { version: 5, note: "previous publish" },
    },
  };
}
