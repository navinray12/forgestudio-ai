/**
 * ForgeStudio Execution Blueprint v2.1 — Point 05: Executable Capability Contract
 * Executable Capability Manifest Engine (CAP-116)
 *
 * Implements the versioned, declarative runtime manifest:
 * - Maps capabilities to admin navigation, route guards, entities, jobs, and export systems.
 * - Drives dynamic Admin Navigation derived from authoritative server capability states.
 * - Enforces Recipe & Website Profile selection:
 *   - Universal Foundation (F) is mandatory for ALL profiles.
 *   - Growth Platform (G) remains in engineering scope.
 *   - Business Modules (B) are provisioned conditionally based on the approved profile.
 * - Enforces API route access boundaries: disabled capabilities cannot be reached via direct API requests.
 */

import {
  CAPABILITY_REGISTRY,
  CapabilityRecord,
  getCapabilityById,
} from "./capabilityRegistry.js";

export const CAPABILITY_MANIFEST_VERSION = "2.1.0";

export interface AdminNavigationItem {
  id: string;
  label: string;
  route: string;
  icon?: string;
  category: "CORE" | "DESIGN" | "CONTENT" | "GROWTH" | "BUSINESS" | "SETTINGS";
  requiredCapId: string;
  status:
    | "AVAILABLE"
    | "NOT_CONFIGURED"
    | "PENDING_ACTIVATION"
    | "DISABLED"
    | "DEGRADED"
    | "BLOCKED"
    | "UNSUPPORTED";
  statusReason?: string;
  isBadgeVisible?: boolean;
}

export interface WebsiteProfileRecipe {
  profileId: string;
  name: string;
  description: string;
  requiredFoundationCaps: string[]; // Always includes all 64 F capabilities
  growthPlatformCaps: string[]; // Active G capabilities
  conditionalBusinessCaps: string[]; // Activated B capabilities
  prohibitedOrOmittedCaps: string[]; // Explicitly omitted B capabilities
}

// Canonical Website Profile Recipes
export const PROFILE_RECIPES: Record<string, WebsiteProfileRecipe> = {
  PROFESSIONAL_SERVICES: {
    profileId: "PROFESSIONAL_SERVICES",
    name: "Professional & Corporate Services",
    description: "Standard business website with offerings, about/trust, durable contact intake, and policy surfaces.",
    requiredFoundationCaps: CAPABILITY_REGISTRY.filter((c) => c.classification === "F").map((c) => c.id),
    growthPlatformCaps: ["CAP-032", "CAP-033", "CAP-059", "CAP-060"],
    conditionalBusinessCaps: [], // No commerce, LMS, or booking required
    prohibitedOrOmittedCaps: ["CAP-101", "CAP-102", "CAP-103", "CAP-105", "CAP-106", "CAP-107", "CAP-108", "CAP-110"],
  },
  EDITORIAL_PUBLISHER: {
    profileId: "EDITORIAL_PUBLISHER",
    name: "Editorial & Resource Publisher",
    description: "Content-rich publishing property with dynamic CMS articles, taxonomies, and search.",
    requiredFoundationCaps: CAPABILITY_REGISTRY.filter((c) => c.classification === "F").map((c) => c.id),
    growthPlatformCaps: ["CAP-051", "CAP-052", "CAP-053", "CAP-054", "CAP-059", "CAP-060", "CAP-075"],
    conditionalBusinessCaps: ["CAP-108"], // Community discussions active
    prohibitedOrOmittedCaps: ["CAP-101", "CAP-102", "CAP-103", "CAP-104", "CAP-106", "CAP-107"],
  },
  COMMERCE_CATALOGUE: {
    profileId: "COMMERCE_CATALOGUE",
    name: "Commerce & Digital Products",
    description: "Transactional catalog with shopping cart, Stripe payment intake, and order management.",
    requiredFoundationCaps: CAPABILITY_REGISTRY.filter((c) => c.classification === "F").map((c) => c.id),
    growthPlatformCaps: ["CAP-032", "CAP-051", "CAP-052", "CAP-053", "CAP-054", "CAP-059", "CAP-060"],
    conditionalBusinessCaps: ["CAP-101", "CAP-102", "CAP-103", "CAP-105"],
    prohibitedOrOmittedCaps: ["CAP-106", "CAP-107", "CAP-108", "CAP-110"],
  },
  MEMBERSHIP_ACADEMY: {
    profileId: "MEMBERSHIP_ACADEMY",
    name: "Membership & Learning Academy",
    description: "Gated education portal with student enrollments, lessons, and community discussion forums.",
    requiredFoundationCaps: CAPABILITY_REGISTRY.filter((c) => c.classification === "F").map((c) => c.id),
    growthPlatformCaps: ["CAP-051", "CAP-052", "CAP-053", "CAP-054", "CAP-059", "CAP-060"],
    conditionalBusinessCaps: ["CAP-106", "CAP-107", "CAP-108", "CAP-109", "CAP-110"],
    prohibitedOrOmittedCaps: ["CAP-101", "CAP-102", "CAP-104"],
  },
};

/**
 * Returns complete executable manifest snapshot.
 */
export function getCapabilityManifest(): {
  manifestVersion: string;
  totalCapabilities: number;
  universalFoundationCount: number;
  growthPlatformCount: number;
  conditionalBusinessCount: number;
  availableRecipes: string[];
  capabilities: CapabilityRecord[];
} {
  const fCount = CAPABILITY_REGISTRY.filter((c) => c.classification === "F").length;
  const gCount = CAPABILITY_REGISTRY.filter((c) => c.classification === "G").length;
  const bCount = CAPABILITY_REGISTRY.filter((c) => c.classification === "B").length;

  return {
    manifestVersion: CAPABILITY_MANIFEST_VERSION,
    totalCapabilities: CAPABILITY_REGISTRY.length,
    universalFoundationCount: fCount,
    growthPlatformCount: gCount,
    conditionalBusinessCount: bCount,
    availableRecipes: Object.keys(PROFILE_RECIPES),
    capabilities: [...CAPABILITY_REGISTRY],
  };
}

/**
 * Resolves capability inclusions and omissions for a chosen website profile.
 * - Foundation (F) capabilities are unconditionally required.
 * - Growth (G) capabilities are retained in platform engineering scope.
 * - Business (B) capabilities are evaluated strictly against the approved recipe.
 */
export function resolveProfileCapabilities(profileId: string): {
  profile: WebsiteProfileRecipe;
  mandatoryCaps: string[];
  activeCaps: string[];
  omittedCaps: string[];
} {
  const recipe = PROFILE_RECIPES[profileId] || PROFILE_RECIPES.PROFESSIONAL_SERVICES;

  // Foundation caps are always mandatory
  const mandatoryCaps = [...recipe.requiredFoundationCaps];
  const activeCaps = Array.from(
    new Set([...mandatoryCaps, ...recipe.growthPlatformCaps, ...recipe.conditionalBusinessCaps])
  );
  const omittedCaps = [...recipe.prohibitedOrOmittedCaps];

  return {
    profile: recipe,
    mandatoryCaps,
    activeCaps,
    omittedCaps,
  };
}

/**
 * Generates authoritative Admin Navigation based on active server capability states.
 * Guarantees that hidden or disabled capabilities are truthfully represented in UI.
 */
export function generateAdminNavigation(activeCapabilityIds: string[]): AdminNavigationItem[] {
  const activeSet = new Set(activeCapabilityIds.map((id) => id.toUpperCase()));

  const navigationTemplates: Array<Omit<AdminNavigationItem, "status" | "statusReason">> = [
    {
      id: "nav-overview",
      label: "Website Overview",
      route: "/dashboard/sites/:id",
      category: "CORE",
      requiredCapId: "CAP-011",
    },
    {
      id: "nav-editor",
      label: "Visual Canvas Editor",
      route: "/editor/:id",
      category: "DESIGN",
      requiredCapId: "CAP-016",
    },
    {
      id: "nav-design-system",
      label: "Design Tokens & Styles",
      route: "/dashboard/sites/:id/tokens",
      category: "DESIGN",
      requiredCapId: "CAP-021",
    },
    {
      id: "nav-leads",
      label: "Form Submissions & Leads",
      route: "/dashboard/sites/:id/leads",
      category: "CONTENT",
      requiredCapId: "CAP-043",
    },
    {
      id: "nav-claims",
      label: "Truthful Claims & Proof",
      route: "/dashboard/sites/:id/claims",
      category: "CONTENT",
      requiredCapId: "CAP-046",
    },
    {
      id: "nav-cms",
      label: "Dynamic Collections (CMS)",
      route: "/dashboard/sites/:id/cms",
      category: "CONTENT",
      requiredCapId: "CAP-051",
    },
    {
      id: "nav-seo",
      label: "SEO & Social Sharing",
      route: "/dashboard/sites/:id/seo",
      category: "GROWTH",
      requiredCapId: "CAP-056",
    },
    {
      id: "nav-wordpress",
      label: "WordPress Bridge",
      route: "/dashboard/sites/:id/wordpress",
      category: "GROWTH",
      requiredCapId: "CAP-086",
    },
    {
      id: "nav-commerce",
      label: "Commerce & Products",
      route: "/dashboard/sites/:id/commerce",
      category: "BUSINESS",
      requiredCapId: "CAP-101",
    },
    {
      id: "nav-bookings",
      label: "Appointments & Schedule",
      route: "/dashboard/sites/:id/bookings",
      category: "BUSINESS",
      requiredCapId: "CAP-104",
    },
    {
      id: "nav-lms",
      label: "Courses & Academy",
      route: "/dashboard/sites/:id/courses",
      category: "BUSINESS",
      requiredCapId: "CAP-106",
    },
    {
      id: "nav-forum",
      label: "Community Forum",
      route: "/dashboard/sites/:id/forum",
      category: "BUSINESS",
      requiredCapId: "CAP-108",
    },
    {
      id: "nav-publishing",
      label: "Releases & Publishing",
      route: "/dashboard/sites/:id/publishing",
      category: "SETTINGS",
      requiredCapId: "CAP-093",
    },
    {
      id: "nav-revisions",
      label: "Revisions & Rollbacks",
      route: "/dashboard/sites/:id/revisions",
      category: "SETTINGS",
      requiredCapId: "CAP-013",
    },
    {
      id: "nav-capabilities",
      label: "Capability Governance",
      route: "/dashboard/sites/:id/capabilities",
      category: "SETTINGS",
      requiredCapId: "CAP-116",
    },
  ];

  return navigationTemplates.map((template) => {
    const cap = getCapabilityById(template.requiredCapId);
    if (!cap) {
      return {
        ...template,
        status: "UNSUPPORTED",
        statusReason: "Required capability definition not found in registry.",
      };
    }

    const isActive = activeSet.has(cap.id);

    if (isActive) {
      if (cap.activationStatus === "DEGRADED") {
        return {
          ...template,
          status: "DEGRADED",
          statusReason: "Capability is operating with degraded dependencies.",
          isBadgeVisible: true,
        };
      }
      return {
        ...template,
        status: "AVAILABLE",
      };
    }

    if (cap.classification === "B") {
      return {
        ...template,
        status: "DISABLED",
        statusReason: "Optional business module not activated in current website brief.",
      };
    }

    return {
      ...template,
      status: "NOT_CONFIGURED",
      statusReason: `Capability '${cap.name}' is inactive or missing required configuration.`,
      isBadgeVisible: true,
    };
  });
}

/**
 * Checks whether an incoming API request to a capability-governed endpoint
 * is permitted by the website's active capability state.
 */
export function isCapabilityApiAllowed(
  capId: string,
  activeCapabilityIds: string[]
): { allowed: boolean; reason?: string } {
  const cap = getCapabilityById(capId);
  if (!cap) {
    return { allowed: false, reason: `Unknown capability '${capId}'.` };
  }

  // Foundation capabilities are universally permitted unless explicitly locked/degraded
  if (cap.classification === "F") {
    return { allowed: true };
  }

  // Non-foundation capabilities require explicit activation
  const activeSet = new Set(activeCapabilityIds.map((id) => id.toUpperCase()));
  if (!activeSet.has(cap.id)) {
    return {
      allowed: false,
      reason: `Capability '${cap.id}' (${cap.name}) is not activated for this website profile.`,
    };
  }

  return { allowed: true };
}
