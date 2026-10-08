import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError } from "../../utils/app-error.js";
import { validateDocumentTree, type JsonObject } from "../../services/websites/document-policy.js";

// Models propose only a small, renderer-supported vocabulary. IDs, styles and
// canonical editor structure are owned by the server, not by model output.
export const SITE_BLUEPRINT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["pages"],
  properties: {
    pages: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["name", "slug", "sections"],
      properties: {
        name: { type: "string" }, slug: { type: "string" },
        sections: { type: "array", items: {
          type: "object", additionalProperties: false,
          required: ["heading", "body", "ctaLabel", "ctaHref"],
          properties: {
            heading: { type: "string" }, body: { type: "string" },
            ctaLabel: { type: "string" }, ctaHref: { type: "string" },
          },
        } },
      },
    } },
  },
} as const;

export const SITE_BLUEPRINT_INSTRUCTIONS = [
  "Return JSON for an editable multi-page website. Use only the supplied schema.",
  "The first page is Home with slug '/'. Other slugs are unique lowercase paths such as '/about'.",
  "Create a distinctive, useful site with 4 to 6 pages when the brief supports them. Give the home page 5 to 7 sections: a compelling hero, concrete benefits or offerings, a process or story, an FAQ or practical details, and a clear final call to action.",
  "Write specific, varied headings and concise, credible copy. Avoid repeating generic welcome, why choose us, and contact sections on every page. Make each page useful on its own.",
  "Each section needs a concise heading and useful plain-text body. CTA links must be same-site paths or anchors; use empty strings when no CTA is needed.",
  "Do not invent testimonials, customers, certifications, addresses, prices or statistics. Do not include HTML, scripts, CSS or external image URLs.",
  "A blog page may be a layout proposal, but do not claim a CMS collection was created.",
].join(" ");

const sectionSchema = z.object({
  heading: z.string().trim().min(1).max(140),
  body: z.string().trim().min(1).max(1200),
  ctaLabel: z.string().trim().max(80),
  ctaHref: z.string().trim().max(160),
}).strict().refine(section => !section.ctaLabel || section.ctaHref === "#" || /^\/(?:[a-z0-9-]+\/?)*$/.test(section.ctaHref) || /^#[a-z0-9-]+$/.test(section.ctaHref));
const pageSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().max(120).regex(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/?)*$/),
  sections: z.array(sectionSchema).min(1).max(10),
}).strict();
const blueprintSchema = z.object({ pages: z.array(pageSchema).min(1).max(8) }).strict();

function normalizeInternalPath(value: string): string | null {
  const path = value.trim().split("#", 1)[0]!.replace(/^\/+|\/+$/g, "").toLowerCase()
    .replace(/[\s_]+/g, "-");
  if (!path) return "/";
  return /^(?:[a-z0-9]+(?:-[a-z0-9]+)*)(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(path) ? `/${path}` : null;
}

function normalizeBlueprint(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { pages?: unknown }).pages)) return raw;
  const pages = (raw as { pages: unknown[] }).pages;
  return { ...(raw as Record<string, unknown>), pages: pages.map((page, pageIndex) => {
    if (!page || typeof page !== "object") return page;
    const candidate = page as Record<string, unknown>;
    const slug = typeof candidate.slug === "string" ? normalizeInternalPath(candidate.slug) : null;
    return { ...candidate, slug: pageIndex === 0 && slug !== null ? "/" : slug ?? candidate.slug,
      sections: Array.isArray(candidate.sections) ? candidate.sections.map(section => {
        if (!section || typeof section !== "object") return section;
        const item = section as Record<string, unknown>;
        if (typeof item.ctaLabel !== "string" || typeof item.ctaHref !== "string") return item;
        const label = item.ctaLabel.trim();
        const href = item.ctaHref.trim();
        if (!label || !href) return { ...item, ctaLabel: "", ctaHref: "" };
        if (href === "#" || /^#[a-z0-9-]+$/.test(href)) return { ...item, ctaHref: href };
        const normalizedHref = normalizeInternalPath(href);
        return { ...item, ctaHref: normalizedHref ?? href };
      }) : candidate.sections };
  }) };
}

/** Safe diagnostic paths only; never include model-provided values in telemetry. */
export function siteBlueprintIssuePaths(raw: unknown): string[] {
  const result = blueprintSchema.safeParse(normalizeBlueprint(raw));
  return result.success ? [] : result.error.issues.map(issue => issue.path.map(String).join(".") || "root");
}

const palette = {
  ink: "#142334", paper: "#f7f4ed", white: "#ffffff", muted: "#4b6070",
  accent: "#d96b4c", soft: "#e8ede8", deep: "#102c32", line: "#d5ddd7",
};

function heading(content: string, level: "h1" | "h2", light = false): JsonObject {
  return { id: randomUUID(), type: "heading", content, headingLevel: level,
    styles: { fontSize: level === "h1" ? "clamp(2.75rem, 6vw, 5.5rem)" : "clamp(2rem, 4vw, 3.5rem)",
      lineHeight: "1.08", letterSpacing: "-0.035em", fontWeight: "700", color: light ? palette.white : palette.ink,
      maxWidth: "850px", marginBottom: "20px" } };
}

function paragraph(content: string, light = false): JsonObject {
  return { id: randomUUID(), type: "text", content,
    styles: { fontSize: "1.125rem", lineHeight: "1.7", color: light ? "#d9e4df" : palette.muted,
      maxWidth: "680px", marginBottom: "22px" } };
}

function linkButton(label: string, href: string, light = false): JsonObject {
  return { id: randomUUID(), type: "button", content: label, href,
    styles: { backgroundColor: light ? palette.accent : palette.deep, color: palette.white,
      padding: "14px 24px", borderRadius: "8px", fontWeight: "700", width: "auto" } };
}

function sectionElement(section: z.infer<typeof sectionSchema>, index: number, total: number, home: boolean): JsonObject {
  const hero = index === 0;
  const finalCall = index === total - 1 && total > 1;
  const dark = hero || finalCall;
  const eyebrow: JsonObject = { id: randomUUID(), type: "text", content: hero ? "EXPLORE WHAT IS POSSIBLE" : finalCall ? "TAKE THE NEXT STEP" : `0${index + 1} / ${String(total).padStart(2, "0")}`,
      styles: { fontSize: "0.78rem", letterSpacing: "0.16em", fontWeight: "700", color: dark ? "#efb19d" : palette.accent,
        marginBottom: "16px" } };
  const content: JsonObject[] = [
    heading(section.heading, home && hero ? "h1" : "h2", dark),
    paragraph(section.body, dark),
  ];
  if (section.ctaLabel) content.push(linkButton(section.ctaLabel, section.ctaHref, dark));
  const split = !dark && index % 2 === 1;
  const children: JsonObject[] = split
    ? [eyebrow, { id: randomUUID(), type: "container", content: section.heading,
      styles: { flex: "1 1 560px", minWidth: "240px", backgroundColor: "transparent" }, children: content }]
    : [eyebrow, ...content];
  return { id: randomUUID(), type: "container", content: section.heading,
    ...(split ? { layout: { layoutType: "flex", direction: "row", flexWrap: "wrap", gap: "44px", alignItems: "flex-start" } } : {}),
    styles: { width: "100%", padding: hero ? "96px 7%" : "76px 7%",
      backgroundColor: dark ? palette.deep : index % 2 === 0 ? palette.soft : palette.paper,
      borderBottom: `1px solid ${dark ? palette.deep : palette.line}` }, children };
}

function siteHeader(name: string, pages: Array<{ name: string; slug: string }>): JsonObject {
  const links = pages.slice(0, 5).map(page => ({ id: randomUUID(), type: "button", content: page.name, href: page.slug,
    styles: { backgroundColor: palette.white, color: palette.ink, padding: "8px 10px", width: "auto", fontWeight: "600" } }));
  return { id: randomUUID(), type: "container", content: "Site navigation", layout: { layoutType: "flex", direction: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" },
    styles: { width: "100%", padding: "18px 7%", backgroundColor: palette.white, borderBottom: `1px solid ${palette.line}` },
    children: [{ id: randomUUID(), type: "heading", content: name, headingLevel: "h2",
      styles: { fontSize: "1.35rem", fontWeight: "800", color: palette.ink, marginBottom: "0" } }, ...links] };
}

function siteFooter(name: string, pages: Array<{ name: string; slug: string }>): JsonObject {
  return { id: randomUUID(), type: "container", content: "Site footer",
    styles: { width: "100%", padding: "56px 7%", backgroundColor: palette.ink },
    children: [
      { id: randomUUID(), type: "heading", content: name, headingLevel: "h2",
        styles: { fontSize: "1.5rem", color: palette.white, fontWeight: "700" } },
      { id: randomUUID(), type: "text", content: pages.map(page => page.name).join("  ·  "),
        styles: { fontSize: "0.95rem", color: "#c4d1d1", marginTop: "18px" } },
    ] };
}

export function canonicalSiteFromBlueprint(raw: unknown, websiteName?: string): { editorData: JsonObject; pageNames: string[]; sectionCount: number } {
  const parsed = blueprintSchema.safeParse(normalizeBlueprint(raw));
  if (!parsed.success || parsed.data.pages[0]?.slug !== "/" ||
      new Set(parsed.data.pages.map(page => page.slug)).size !== parsed.data.pages.length) {
    throw new AppError("AI provider returned an invalid website draft", 502, "AI_INVALID_OUTPUT");
  }
  const navigation = parsed.data.pages.map(page => ({ name: page.name, slug: page.slug }));
  const siteName = websiteName?.trim().slice(0, 100) || parsed.data.pages[0]!.sections[0]!.heading;
  const pages = parsed.data.pages.map((page, pageIndex) => {
    const elements = [siteHeader(siteName, navigation),
      ...page.sections.map((section, sectionIndex) => sectionElement(section, sectionIndex, page.sections.length, pageIndex === 0)),
      siteFooter(siteName, navigation)];
    return { id: randomUUID(), name: page.name, slug: page.slug, isHome: pageIndex === 0,
      elements, pageSettings: { title: page.name, path: page.slug, backgroundColor: palette.paper } };
  });
  const editorData: JsonObject = { version: 1, homePageId: pages[0]!.id, pages,
    elements: pages[0]!.elements, pageSettings: pages[0]!.pageSettings };
  validateDocumentTree(editorData);
  return { editorData, pageNames: pages.map(page => page.name),
    sectionCount: parsed.data.pages.reduce((count, page) => count + page.sections.length, 0) };
}

export interface SiteBlueprintDraft {
  pages: Array<{
    name: string;
    slug: string;
    sections: Array<{
      heading: string;
      body: string;
      ctaLabel: string;
      ctaHref: string;
    }>;
  }>;
}

export function synthesizeSiteBlueprint(prompt: string, websiteName?: string): SiteBlueprintDraft {
  const p = prompt.toLowerCase();
  const title = (websiteName || "ForgeStudio").trim();

  const isAccounting = /accounting|cpa|cma|acca|finance|financial|ledger|audit/.test(p);
  const isRealEstate = /real estate|property|realtor|villa|apartment|leasing|estate/.test(p);

  if (isAccounting) {
    return {
      pages: [
        {
          name: "Home",
          slug: "/",
          sections: [
            {
              heading: "Professional Financial & Accounting Leadership",
              body: "Advance your financial career through world-class accreditation training, practical case study mastery, and industry-recognized executive curricula.",
              ctaLabel: "Explore Programs",
              ctaHref: "/programs"
            },
            {
              heading: "Accredited Global Certifications",
              body: "Comprehensive exam preparation curricula specifically tailored for CPA, CMA, and ACCA professional designations with benchmark pass rates.",
              ctaLabel: "View Curriculum",
              ctaHref: "/programs"
            },
            {
              heading: "Distinguished Practitioner Faculty",
              body: "Instruction led by practicing financial controllers, senior audit partners, and corporate strategy leaders bringing applied expertise directly to the classroom.",
              ctaLabel: "Faculty Directory",
              ctaHref: "/about"
            },
            {
              heading: "Structured Academic Pathway",
              body: "Our accelerated cohorts combine rigorous theoretical foundations with weekly financial modeling labs and audit simulations.",
              ctaLabel: "Admission Inquiries",
              ctaHref: "/contact"
            }
          ]
        },
        {
          name: "Programs",
          slug: "/programs",
          sections: [
            {
              heading: "Specialized Accounting & Finance Credentials",
              body: "Structured pathways designed to guide candidates through rigorous certification milestones with dedicated academic advisors.",
              ctaLabel: "Download Syllabus",
              ctaHref: "/contact"
            },
            {
              heading: "CMA & Management Accounting",
              body: "Deep dive into financial planning, performance analysis, cost accounting, and strategic decision making for corporate leaders.",
              ctaLabel: "Program Details",
              ctaHref: "/contact"
            },
            {
              heading: "CPA Auditing & Attestation",
              body: "Master rigorous statutory auditing procedures, regulatory frameworks, financial reporting standards, and corporate taxation.",
              ctaLabel: "Enroll Today",
              ctaHref: "/contact"
            }
          ]
        },
        {
          name: "About",
          slug: "/about",
          sections: [
            {
              heading: "Our Commitment to Academic Excellence",
              body: "Founded with the mission to elevate professional financial standards and empower ambitious finance leaders across global markets.",
              ctaLabel: "Connect With Us",
              ctaHref: "/contact"
            },
            {
              heading: "Executive Mentorship & Community",
              body: "Our alumni network spans top-tier audit firms, Fortune 500 treasuries, and leading private equity organizations worldwide.",
              ctaLabel: "",
              ctaHref: ""
            }
          ]
        },
        {
          name: "Contact",
          slug: "/contact",
          sections: [
            {
              heading: "Begin Your Professional Journey",
              body: "Speak with an academic admissions advisor to determine which professional accounting pathway aligns with your career trajectory.",
              ctaLabel: "Return to Home",
              ctaHref: "/"
            },
            {
              heading: "Admissions & Campus Inquiries",
              body: "Our administrative team provides comprehensive support regarding cohort schedules, examination windows, and enrollment requirements.",
              ctaLabel: "",
              ctaHref: ""
            }
          ]
        }
      ]
    };
  }

  if (isRealEstate) {
    return {
      pages: [
        {
          name: "Home",
          slug: "/",
          sections: [
            {
              heading: "Premier Commercial & Residential Real Estate",
              body: "Discover curated luxury developments, private residential estates, and strategic commercial properties in prime global metropolitan centers.",
              ctaLabel: "View Properties",
              ctaHref: "/properties"
            },
            {
              heading: "Institutional Real Estate Advisory",
              body: "Delivering bespoke asset valuation, investment analysis, and transaction management for private clients and institutional funds.",
              ctaLabel: "Our Services",
              ctaHref: "/about"
            },
            {
              heading: "Exclusive Architectural Highlights",
              body: "Each featured residence offers exceptional craftsmanship, sustainable materials, and uncompromising standards of interior architectural design.",
              ctaLabel: "Schedule Private Tour",
              ctaHref: "/contact"
            }
          ]
        },
        {
          name: "Properties",
          slug: "/properties",
          sections: [
            {
              heading: "Curated Global Property Portfolio",
              body: "Explore a distinguished catalog of prime penthouses, waterfront villas, and prime commercial headquarters across premier locations.",
              ctaLabel: "Request Portfolio",
              ctaHref: "/contact"
            },
            {
              heading: "Private Residences & Estates",
              body: "Exceptional living spaces that balance sophisticated privacy with immediate access to premier cultural and financial hubs.",
              ctaLabel: "Inquire Now",
              ctaHref: "/contact"
            }
          ]
        },
        {
          name: "About",
          slug: "/about",
          sections: [
            {
              heading: "Dedicated to Real Estate Distinction",
              body: "With decades of combined real estate advisory experience, our partners bring unparalleled market intelligence to every transaction.",
              ctaLabel: "Connect With Us",
              ctaHref: "/contact"
            }
          ]
        },
        {
          name: "Contact",
          slug: "/contact",
          sections: [
            {
              heading: "Arrange a Confidential Consultation",
              body: "Our advisory directors are available for private property tours, portfolio reviews, and acquisition consultations.",
              ctaLabel: "Back to Home",
              ctaHref: "/"
            }
          ]
        }
      ]
    };
  }

  // Default / Serious Commercial Product / Modular Platform
  return {
    pages: [
      {
        name: "Home",
        slug: "/",
        sections: [
          {
            heading: `${title} — Production-Grade Commercial Platform`,
            body: "Engineered from the ground up with modular architecture, strict boundary enforcement, and enterprise-grade reliability for demanding environments.",
            ctaLabel: "Explore Solutions",
            ctaHref: "/solutions"
          },
          {
            heading: "Modular System Architecture",
            body: "Decoupled domain models and robust integration layers ensure frictionless evolution, maintainability, and zero unexpected dependencies.",
            ctaLabel: "Platform Overview",
            ctaHref: "/about"
          },
          {
            heading: "Uncompromising Reliability & Speed",
            body: "High-throughput execution pipelines and comprehensive state validation guarantee deterministic system outcomes across all operational stages.",
            ctaLabel: "Get Started",
            ctaHref: "/contact"
          },
          {
            heading: "Production Ready Out of the Box",
            body: "Built to commercial production standards with end-to-end telemetry, secure storage, and strict backward-compatible state policies.",
            ctaLabel: "Contact Solutions Team",
            ctaHref: "/contact"
          }
        ]
      },
      {
        name: "Solutions",
        slug: "/solutions",
        sections: [
          {
            heading: "Engineered for Enterprise Scale",
            body: "Our capabilities deliver deep platform integration, seamless multi-tenant isolation, and continuous operational visibility for complex teams.",
            ctaLabel: "Request Architecture Review",
            ctaHref: "/contact"
          },
          {
            heading: "High-Throughput Processing Engine",
            body: "Streamlined background job workers, durable state recovery, and distributed concurrency controls built for sustained commercial workloads.",
            ctaLabel: "Learn More",
            ctaHref: "/about"
          }
        ]
      },
      {
        name: "About",
        slug: "/about",
        sections: [
          {
            heading: "Our Architectural Principles",
            body: "We prioritize clean abstraction layers, explicit contracts, and zero hidden assumptions to ensure applications behave reliably in production.",
            ctaLabel: "Get in Touch",
            ctaHref: "/contact"
          },
          {
            heading: "Quality & Resilience by Design",
            body: "Every module undergoes continuous verification, regression audits, and performance tuning to sustain peak performance under real-world load.",
            ctaLabel: "",
            ctaHref: ""
          }
        ]
      },
      {
        name: "Contact",
        slug: "/contact",
        sections: [
          {
            heading: "Connect with Our Technical Architects",
            body: "Discuss project specifications, migration pathways, or custom integration strategies directly with our engineering team.",
            ctaLabel: "Return to Home",
            ctaHref: "/"
          },
          {
            heading: "Enterprise Support & Documentation",
            body: "Comprehensive developer guidance, integration playbooks, and dedicated technical advisory available around the clock.",
            ctaLabel: "",
            ctaHref: ""
          }
        ]
      }
    ]
  };
}
