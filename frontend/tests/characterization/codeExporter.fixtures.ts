/**
 * Deterministic inputs for the codeExporter characterization tests.
 * Shared by the test and by the one-off script that captured codeExporter.golden.json.
 * Changing anything here invalidates the golden output.
 */

/** Fixed clock for code paths that default to "now" (countdown target date). */
export const FIXED_NOW = "2026-01-15T12:00:00.000Z";

const heading = {
  id: "el-heading",
  type: "heading",
  content: "Build faster with ForgeStudio",
  name: "Hero Heading",
  styles: { fontSize: "48px", fontWeight: 800, color: "#0f172a", textAlign: "center" },
};

const button = {
  id: "el-button",
  type: "button",
  content: "Get started",
  href: "/signup",
  styles: { backgroundColor: "#4f46e5", color: "#ffffff", padding: "12px 24px", borderRadius: "8px" },
};

const container = {
  id: "el-container",
  type: "container",
  content: "",
  name: "Hero Section",
  styles: { display: "flex", flexDirection: "column", gap: "16px", padding: "64px 24px" },
  children: [
    heading,
    { id: "el-text", type: "text", content: "Visual editing with clean code output.", styles: { fontSize: "18px" } },
    button,
  ],
};

const priceTable = {
  id: "el-price",
  type: "price-table",
  content: "",
  name: "Pricing",
  pricingPlans: [
    {
      id: "p1", name: "Starter", price: "9", period: "month", description: "For individuals",
      features: [{ id: "f1", text: "1 site", included: true }, { id: "f2", text: "Priority support", included: false }],
      buttonText: "Choose Starter", buttonUrl: "/signup?plan=starter", isPopular: false,
    },
    {
      id: "p2", name: "Pro", price: "29", period: "month", description: "For teams", badgeText: "Popular",
      features: [{ id: "f3", text: "10 sites", included: true }, { id: "f4", text: "Priority support", included: true }],
      buttonText: "Choose Pro", buttonUrl: "/signup?plan=pro", isPopular: true,
    },
  ],
  styles: {},
};

const form = {
  id: "el-form",
  type: "form",
  content: "",
  name: "Contact Form",
  formTitle: "Contact us",
  formFields: [
    { id: "f1", type: "text", label: "Name", required: true, placeholder: "Your name" },
    { id: "f2", type: "email", label: "Email", required: true, placeholder: "you@example.com" },
    { id: "f3", type: "textarea", label: "Message", required: false },
  ],
  formSubmitText: "Send",
  styles: {},
};

const navMenu = {
  id: "el-nav",
  type: "nav-menu",
  content: "",
  name: "Main Nav",
  navMenuItems: [
    { id: "n1", label: "Home", url: "/" },
    { id: "n2", label: "About", url: "/about" },
  ],
  styles: {},
};

const countdown = {
  id: "el-countdown",
  type: "countdown",
  content: "",
  name: "Launch Countdown",
  countdownTargetDate: "2026-03-01T00:00:00.000Z",
  styles: {},
};

/** Same widget without a target date: exercises the Date.now() default under a fixed clock. */
const countdownDefaultDate = { ...countdown, id: "el-countdown-default", countdownTargetDate: undefined };

const slides = {
  id: "el-slides",
  type: "slides",
  content: "",
  name: "Hero Slides",
  slidesItems: [
    { id: "s1", title: "Fast", description: "Ship in minutes", bgImage: "/img/1.png", buttonText: "Start", buttonUrl: "/start" },
    { id: "s2", title: "Flexible", description: "Any framework", bgColor: "#111827" },
  ],
  slidesAutoplay: true,
  slidesAutoplayInterval: 4000,
  slidesShowArrows: true,
  slidesShowDots: true,
  styles: {},
};

/** Element-level cases: every one is rendered in all four formats. */
export const ELEMENT_CASES: Record<string, any> = {
  container,
  heading,
  button,
  priceTable,
  form,
  navMenu,
  countdown,
  slides,
};

/** Cases that depend on the clock; rendered with FIXED_NOW in effect. */
export const CLOCK_CASES: Record<string, any> = { countdownDefaultDate };

export const FORMATS = ["jsx", "tsx", "js", "ts"] as const;

/** A two-page site with header/footer parts and global styles, for exportEntireWebsite. */
export const WEBSITE: any = {
  id: "site-1",
  name: "Acme Studio",
  slug: "Acme Studio!",
  version: 3,
  homePageId: "page-home",
  pages: [
    { id: "page-home", name: "Home", slug: "/", isHome: true, elements: [container] },
    { id: "page-about", name: "About Us", slug: "about", elements: [heading, priceTable] },
    { id: "page-empty", name: "Empty", slug: "/empty", elements: [] },
  ],
  siteSettings: { siteName: "Acme Studio", title: "Acme Studio", language: "en" },
  globalStyles: {
    variables: { "brand-primary": "#4f46e5", "radius-md": "8px" },
    globalClasses: { "btn-primary": { backgroundColor: "var(--brand-primary)", borderRadius: "var(--radius-md)" } },
  },
  siteParts: {
    header: { elements: [navMenu] },
    footer: { elements: [{ id: "el-footer-text", type: "text", content: "© Acme", styles: {} }] },
  },
  navigation: [],
  publishing: { version: 7 },
  deployment: {},
  elements: [],
};

/** Pure helper inputs. */
export const HELPER_CASES = {
  toPascalCase: ["hero section", "about-us page", "price_table", "", undefined, "123 start"],
  styles: { fontSize: "16px", backgroundColor: "#fff", zIndex: 10, WebkitTransition: "all 1s", marginTop: 0 },
};
