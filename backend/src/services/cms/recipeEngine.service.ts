/**
 * Point 09: Automatic CMS and Blog Provisioning — Recipe Engine
 * 
 * Produces a coherent, executable, and versioned provisioning manifest for eligible
 * content-led and lead-generation websites:
 * - Recipe identity and versioning
 * - Automatic CMS and blog defaults (posts, authors, categories, tags)
 * - Industry-specific informational collections (services, case studies, team, courses, etc.)
 * - Stable collection and field identities
 * - Page regions, public route reservations (/blog, /blog/:slug)
 * - Owner screens, field controls, validation, draft/review/publish actions
 * - Safe demo/production content separation (never manufactures fake business claims)
 * - Inactive integration safeguards (outbound email/CRM remain inactive until configured)
 * - Deterministic manifest hash for reproducible execution
 */

import { createHash } from "crypto";
import { type FieldDataType } from "../authoritative/record4-content-schema.service.js";

export interface ProvisioningFieldSchema {
  fieldId: string;
  name: string;
  key: string;
  type: FieldDataType;
  required: boolean;
  defaultValue?: unknown;
  options?: string[];
  helpText?: string;
}

export interface ProvisioningCollectionSchema {
  collectionId: string;
  name: string;
  singularName: string;
  slug: string;
  description: string;
  fields: ProvisioningFieldSchema[];
  supportsDrafts: boolean;
  supportsCategories: boolean;
  supportsTags: boolean;
  publicRoutePrefix?: string;
  detailRoutePattern?: string;
}

export interface ProvisioningRouteBinding {
  route: string;
  pageTitle: string;
  templateType: "LIST" | "DETAIL" | "STATIC";
  collectionId?: string;
  targetSlot: string;
}

export interface ProvisioningManifest {
  manifestId: string;
  recipeId: string;
  recipeVersion: string;
  websiteId: string;
  tenantId: string;
  siteProfile: string;
  manifestHash: string;
  collections: ProvisioningCollectionSchema[];
  routes: ProvisioningRouteBinding[];
  menus: {
    menuLocation: string;
    items: { label: string; url: string; order: number }[];
  }[];
  ownerScreens: {
    screenId: string;
    title: string;
    collectionId: string;
    allowedActions: string[];
  }[];
  outboundIntegrations: {
    type: "EMAIL_NOTIFICATION" | "CRM_LEAD_WEBHOOK";
    isActive: boolean; // Must remain FALSE until credentials configured
    reason: string;
  }[];
  demoContentAllowed: boolean;
  generatedAt: string;
}

export class RecipeEngineService {
  private static instance: RecipeEngineService;

  private constructor() {}

  public static getInstance(): RecipeEngineService {
    if (!RecipeEngineService.instance) {
      RecipeEngineService.instance = new RecipeEngineService();
    }
    return RecipeEngineService.instance;
  }

  /**
   * Generates a complete, deterministic provisioning manifest for a website based on profile.
   */
  public generateManifest(params: {
    websiteId: string;
    tenantId: string;
    siteProfile: string;
    recipeVersion?: string;
    includeDemoContent?: boolean;
  }): ProvisioningManifest {
    const recipeId = `cms-recipe-${params.siteProfile.toLowerCase()}`;
    const recipeVersion = params.recipeVersion || "1.0.0";
    const collections: ProvisioningCollectionSchema[] = [];
    const routes: ProvisioningRouteBinding[] = [];

    // 1. Core Default: Blog Posts Collection
    collections.push({
      collectionId: "col-posts",
      name: "Blog Posts",
      singularName: "Post",
      slug: "posts",
      description: "Editorial blog articles and news updates",
      supportsDrafts: true,
      supportsCategories: true,
      supportsTags: true,
      publicRoutePrefix: "/blog",
      detailRoutePattern: "/blog/:slug",
      fields: [
        { fieldId: "fld-post-title", name: "Title", key: "title", type: "TEXT", required: true, helpText: "Article headline" },
        { fieldId: "fld-post-slug", name: "Slug", key: "slug", type: "TEXT", required: true, helpText: "URL slug" },
        { fieldId: "fld-post-excerpt", name: "Excerpt", key: "excerpt", type: "TEXT", required: false, helpText: "Short summary for listing" },
        { fieldId: "fld-post-content", name: "Content", key: "content", type: "RICH_TEXT", required: true, helpText: "Main body text" },
        { fieldId: "fld-post-image", name: "Featured Image", key: "featuredImage", type: "MEDIA_ASSET", required: false },
        { fieldId: "fld-post-author", name: "Author", key: "authorId", type: "REFERENCE", required: true },
        { fieldId: "fld-post-category", name: "Category", key: "categoryId", type: "REFERENCE", required: false },
        { fieldId: "fld-post-tags", name: "Tags", key: "tags", type: "TEXT", required: false },
        { fieldId: "fld-post-seotitle", name: "SEO Title", key: "seoTitle", type: "TEXT", required: false },
        { fieldId: "fld-post-seodesc", name: "SEO Description", key: "seoDescription", type: "TEXT", required: false }
      ]
    });

    // 2. Core Default: Authors Collection
    collections.push({
      collectionId: "col-authors",
      name: "Authors",
      singularName: "Author",
      slug: "authors",
      description: "Content creators and editorial reviewers",
      supportsDrafts: false,
      supportsCategories: false,
      supportsTags: false,
      publicRoutePrefix: "/authors",
      detailRoutePattern: "/authors/:slug",
      fields: [
        { fieldId: "fld-author-name", name: "Full Name", key: "name", type: "TEXT", required: true },
        { fieldId: "fld-author-slug", name: "Slug", key: "slug", type: "TEXT", required: true },
        { fieldId: "fld-author-bio", name: "Biography", key: "bio", type: "TEXT", required: false },
        { fieldId: "fld-author-avatar", name: "Avatar Image", key: "avatar", type: "MEDIA_ASSET", required: false },
        { fieldId: "fld-author-role", name: "Role / Title", key: "role", type: "TEXT", required: false }
      ]
    });

    // 3. Core Default: Taxonomies (Categories)
    collections.push({
      collectionId: "col-categories",
      name: "Categories",
      singularName: "Category",
      slug: "categories",
      description: "Taxonomy categories for content classification",
      supportsDrafts: false,
      supportsCategories: false,
      supportsTags: false,
      publicRoutePrefix: "/categories",
      detailRoutePattern: "/categories/:slug",
      fields: [
        { fieldId: "fld-cat-name", name: "Category Name", key: "name", type: "TEXT", required: true },
        { fieldId: "fld-cat-slug", name: "Slug", key: "slug", type: "TEXT", required: true },
        { fieldId: "fld-cat-desc", name: "Description", key: "description", type: "TEXT", required: false }
      ]
    });

    // 4. Industry-Specific Informational Collections based on Site Profile
    if (params.siteProfile === "PROFESSIONAL_SERVICES" || params.siteProfile === "LOCAL_BUSINESS") {
      collections.push({
        collectionId: "col-services",
        name: "Services",
        singularName: "Service",
        slug: "services",
        description: "Informational business services and practice areas",
        supportsDrafts: true,
        supportsCategories: false,
        supportsTags: false,
        publicRoutePrefix: "/services",
        detailRoutePattern: "/services/:slug",
        fields: [
          { fieldId: "fld-srv-title", name: "Service Name", key: "title", type: "TEXT", required: true },
          { fieldId: "fld-srv-slug", name: "Slug", key: "slug", type: "TEXT", required: true },
          { fieldId: "fld-srv-summary", name: "Summary", key: "summary", type: "TEXT", required: true },
          { fieldId: "fld-srv-content", name: "Details", key: "content", type: "RICH_TEXT", required: false },
          { fieldId: "fld-srv-icon", name: "Icon", key: "icon", type: "MEDIA_ASSET", required: false }
        ]
      });

      collections.push({
        collectionId: "col-case-studies",
        name: "Case Studies",
        singularName: "Case Study",
        slug: "case-studies",
        description: "Client results, outcomes, and project overviews",
        supportsDrafts: true,
        supportsCategories: false,
        supportsTags: false,
        publicRoutePrefix: "/case-studies",
        detailRoutePattern: "/case-studies/:slug",
        fields: [
          { fieldId: "fld-cs-title", name: "Title", key: "title", type: "TEXT", required: true },
          { fieldId: "fld-cs-slug", name: "Slug", key: "slug", type: "TEXT", required: true },
          { fieldId: "fld-cs-client", name: "Client Name", key: "clientName", type: "TEXT", required: true },
          { fieldId: "fld-cs-outcome", name: "Outcome Summary", key: "outcome", type: "TEXT", required: true },
          { fieldId: "fld-cs-content", name: "Story", key: "content", type: "RICH_TEXT", required: false }
        ]
      });
    } else if (params.siteProfile === "MEMBERSHIP_ACADEMY") {
      collections.push({
        collectionId: "col-courses-info",
        name: "Course Catalog",
        singularName: "Course",
        slug: "courses",
        description: "Informational curriculum catalog (non-transactional)",
        supportsDrafts: true,
        supportsCategories: true,
        supportsTags: false,
        publicRoutePrefix: "/courses",
        detailRoutePattern: "/courses/:slug",
        fields: [
          { fieldId: "fld-crs-title", name: "Course Title", key: "title", type: "TEXT", required: true },
          { fieldId: "fld-crs-slug", name: "Slug", key: "slug", type: "TEXT", required: true },
          { fieldId: "fld-crs-summary", name: "Overview", key: "summary", type: "TEXT", required: true },
          { fieldId: "fld-crs-duration", name: "Duration", key: "duration", type: "TEXT", required: false }
        ]
      });
    }

    // 5. Public Route Reservations & Bindings
    routes.push({
      route: "/blog",
      pageTitle: "Blog & Editorial Articles",
      templateType: "LIST",
      collectionId: "col-posts",
      targetSlot: "mainContent"
    });
    routes.push({
      route: "/blog/:slug",
      pageTitle: "Article Detail",
      templateType: "DETAIL",
      collectionId: "col-posts",
      targetSlot: "mainContent"
    });

    // 6. Owner Navigation Screens
    const ownerScreens = collections.map(col => ({
      screenId: `scr-${col.slug}`,
      title: `${col.name} Manager`,
      collectionId: col.collectionId,
      allowedActions: ["CREATE", "READ", "UPDATE", "PUBLISH", "TRASH"]
    }));

    // 7. Deterministic Hashing
    const hashPayload = JSON.stringify({
      recipeId,
      recipeVersion,
      websiteId: params.websiteId,
      tenantId: params.tenantId,
      siteProfile: params.siteProfile,
      collectionIds: collections.map(c => c.collectionId),
      fieldCounts: collections.map(c => c.fields.length),
      routePaths: routes.map(r => r.route)
    });
    const manifestHash = createHash("sha256").update(hashPayload).digest("hex");

    const manifest: ProvisioningManifest = {
      manifestId: `man-${params.websiteId}-${Date.now()}`,
      recipeId,
      recipeVersion,
      websiteId: params.websiteId,
      tenantId: params.tenantId,
      siteProfile: params.siteProfile,
      manifestHash,
      collections,
      routes,
      menus: [
        {
          menuLocation: "header",
          items: [
            { label: "Home", url: "/", order: 1 },
            { label: "Blog", url: "/blog", order: 2 },
            { label: "Contact", url: "/contact", order: 3 }
          ]
        }
      ],
      ownerScreens,
      outboundIntegrations: [
        {
          type: "EMAIL_NOTIFICATION",
          isActive: false, // Inactive safeguard until credentials verified
          reason: "Email notifications require verified SMTP configuration."
        },
        {
          type: "CRM_LEAD_WEBHOOK",
          isActive: false, // Inactive safeguard until credentials verified
          reason: "CRM webhook requires verified webhook URL destination."
        }
      ],
      demoContentAllowed: Boolean(params.includeDemoContent),
      generatedAt: new Date().toISOString()
    };

    return manifest;
  }
}

export const recipeEngineService = RecipeEngineService.getInstance();
