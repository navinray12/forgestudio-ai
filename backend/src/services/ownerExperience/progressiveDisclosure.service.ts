import { evaluateEffectivePermissions } from "./dynamicPermissionEngine.service.js";

export type ExperienceLevel = "SIMPLE_OWNER" | "DESIGN_DEVELOPER" | "AGENCY_PLATFORM";

export type WorkspaceArea =
  | "overview_tasks"
  | "design_pages"
  | "content_media"
  | "leads_conversations"
  | "growth_campaigns"
  | "search_measurement"
  | "publish_operations"
  | "governance";

export interface NavigationItem {
  id: string;
  label: string;
  area: WorkspaceArea;
  route: string;
  requiredPermission: string;
  isAuthorized: boolean;
  isDisabled: boolean;
  prerequisiteNotice?: string;
  minExperienceLevel: ExperienceLevel;
  badgeCount?: number;
}

export interface WorkspaceOverviewData {
  newLeadsCount: number;
  overdueLeadsCount: number;
  pendingReviewsCount: number;
  publicationFailuresCount: number;
  integrationHealth: {
    totalConfigured: number;
    activeCount: number;
    degradedCount: number;
    failingCount: number;
  };
  spendingSummary: {
    currentSpendUnits: number;
    budgetLimitUnits: number;
    alertThresholdReached: boolean;
  };
  prioritizedTasks: Array<{
    id: string;
    title: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
    nextAction: string;
    route: string;
  }>;
}

export interface WorkspaceViewManifest {
  experienceLevel: ExperienceLevel;
  availableExperienceLevels: ExperienceLevel[];
  activeWebsiteId?: string;
  navigation: Record<WorkspaceArea, NavigationItem[]>;
  overview: WorkspaceOverviewData;
  features: {
    canEditSourceCode: boolean;
    canViewReconciliationConflicts: boolean;
    canManageRoles: boolean;
    canPublishDirectly: boolean;
    canExportPii: boolean;
    canPurge: boolean;
  };
}

// ---------------------------------------------------------------------------
// 1. Authoritative Navigation Definitions for all 8 Areas
// ---------------------------------------------------------------------------
const ALL_NAVIGATION_ITEMS: Omit<NavigationItem, "isAuthorized" | "isDisabled" | "prerequisiteNotice" | "badgeCount">[] = [
  // 1. Overview and tasks
  {
    id: "nav:overview:tasks",
    label: "Overview & Actionable Tasks",
    area: "overview_tasks",
    route: "/workspace/overview",
    requiredPermission: "perm:overview:view",
    minExperienceLevel: "SIMPLE_OWNER",
  },

  // 2. Design and pages
  {
    id: "nav:design:pages",
    label: "Pages & Sections",
    area: "design_pages",
    route: "/workspace/pages",
    requiredPermission: "perm:pages:edit",
    minExperienceLevel: "SIMPLE_OWNER",
  },
  {
    id: "nav:design:brand",
    label: "Brand & Colors",
    area: "design_pages",
    route: "/workspace/design/brand",
    requiredPermission: "perm:design:edit",
    minExperienceLevel: "SIMPLE_OWNER",
  },
  {
    id: "nav:design:contracts",
    label: "Component Contracts & Parity",
    area: "design_pages",
    route: "/workspace/design/contracts",
    requiredPermission: "perm:design:edit",
    minExperienceLevel: "DESIGN_DEVELOPER",
  },
  {
    id: "nav:design:source_conflicts",
    label: "Source Ownership & Conflicts",
    area: "design_pages",
    route: "/workspace/design/conflicts",
    requiredPermission: "perm:code:approve",
    minExperienceLevel: "DESIGN_DEVELOPER",
  },

  // 3. Content and media
  {
    id: "nav:content:blog",
    label: "Blog & Editorial Posts",
    area: "content_media",
    route: "/workspace/content/posts",
    requiredPermission: "perm:content:edit",
    minExperienceLevel: "SIMPLE_OWNER",
  },
  {
    id: "nav:content:collections",
    label: "Collections & Fields",
    area: "content_media",
    route: "/workspace/content/collections",
    requiredPermission: "perm:content:edit",
    minExperienceLevel: "DESIGN_DEVELOPER",
  },
  {
    id: "nav:content:media",
    label: "Media & Asset Rights",
    area: "content_media",
    route: "/workspace/media",
    requiredPermission: "perm:media:manage",
    minExperienceLevel: "SIMPLE_OWNER",
  },
  {
    id: "nav:content:trash",
    label: "Trash & Historical Retention",
    area: "content_media",
    route: "/workspace/content/trash",
    requiredPermission: "perm:content:edit",
    minExperienceLevel: "SIMPLE_OWNER",
  },

  // 4. Leads and conversations
  {
    id: "nav:leads:inbox",
    label: "Inbound Leads & Messages",
    area: "leads_conversations",
    route: "/workspace/leads",
    requiredPermission: "perm:leads:view",
    minExperienceLevel: "SIMPLE_OWNER",
  },
  {
    id: "nav:leads:forms",
    label: "Form Configuration & Webhooks",
    area: "leads_conversations",
    route: "/workspace/forms",
    requiredPermission: "perm:forms:manage",
    minExperienceLevel: "SIMPLE_OWNER",
  },
  {
    id: "nav:leads:export",
    label: "Audited PII Export",
    area: "leads_conversations",
    route: "/workspace/leads/export",
    requiredPermission: "perm:pii:export",
    minExperienceLevel: "DESIGN_DEVELOPER",
  },

  // 5. Growth and campaigns
  {
    id: "nav:growth:campaigns",
    label: "Campaign Links & UTM Tags",
    area: "growth_campaigns",
    route: "/workspace/campaigns",
    requiredPermission: "perm:campaigns:manage",
    minExperienceLevel: "SIMPLE_OWNER",
  },
  {
    id: "nav:growth:workflows",
    label: "Automation Workflows",
    area: "growth_campaigns",
    route: "/workspace/growth/workflows",
    requiredPermission: "perm:campaigns:manage",
    minExperienceLevel: "DESIGN_DEVELOPER",
  },

  // 6. Search and measurement
  {
    id: "nav:seo:meta",
    label: "Search & SEO Settings",
    area: "search_measurement",
    route: "/workspace/seo",
    requiredPermission: "perm:seo:manage",
    minExperienceLevel: "SIMPLE_OWNER",
  },
  {
    id: "nav:seo:health",
    label: "Crawl Health & Source Coverage",
    area: "search_measurement",
    route: "/workspace/seo/health",
    requiredPermission: "perm:seo:manage",
    minExperienceLevel: "DESIGN_DEVELOPER",
  },

  // 7. Publish and operations
  {
    id: "nav:publish:status",
    label: "Publishing & Live Status",
    area: "publish_operations",
    route: "/workspace/publish",
    requiredPermission: "perm:release:view",
    minExperienceLevel: "SIMPLE_OWNER",
  },
  {
    id: "nav:publish:domains",
    label: "Custom Domains & DNS",
    area: "publish_operations",
    route: "/workspace/domains",
    requiredPermission: "perm:domain:transfer",
    minExperienceLevel: "DESIGN_DEVELOPER",
  },
  {
    id: "nav:publish:diagnostics",
    label: "Release Gates & Diagnostics",
    area: "publish_operations",
    route: "/workspace/publish/diagnostics",
    requiredPermission: "perm:release:view",
    minExperienceLevel: "DESIGN_DEVELOPER",
  },

  // 8. Governance
  {
    id: "nav:governance:members",
    label: "Workspace Members & Access",
    area: "governance",
    route: "/workspace/governance/members",
    requiredPermission: "perm:governance:view",
    minExperienceLevel: "SIMPLE_OWNER",
  },
  {
    id: "nav:governance:roles",
    label: "Dynamic Custom Roles",
    area: "governance",
    route: "/workspace/governance/roles",
    requiredPermission: "perm:roles:admin",
    minExperienceLevel: "AGENCY_PLATFORM",
  },
  {
    id: "nav:governance:audit",
    label: "Immutable Audit History",
    area: "governance",
    route: "/workspace/governance/audit",
    requiredPermission: "perm:audit:view",
    minExperienceLevel: "DESIGN_DEVELOPER",
  },
  {
    id: "nav:governance:support",
    label: "Delegated Support Access",
    area: "governance",
    route: "/workspace/governance/support",
    requiredPermission: "perm:support:delegate",
    minExperienceLevel: "AGENCY_PLATFORM",
  },
];

// Experience level priority hierarchy
const EXPERIENCE_PRIORITY: Record<ExperienceLevel, number> = {
  SIMPLE_OWNER: 1,
  DESIGN_DEVELOPER: 2,
  AGENCY_PLATFORM: 3,
};

// ---------------------------------------------------------------------------
// 2. View Resolution Service
// ---------------------------------------------------------------------------

export function resolveWorkspaceView(params: {
  userRole: string;
  customRoleId?: string;
  requestedLevel?: ExperienceLevel;
  overrides?: Array<{ permissionId: string; effect: "ALLOW" | "DENY"; resourceScope?: string }>;
  enabledCapabilities?: string[];
  overviewStats?: Partial<WorkspaceOverviewData>;
  websiteId?: string;
}): WorkspaceViewManifest {
  const {
    userRole,
    customRoleId,
    requestedLevel = "SIMPLE_OWNER",
    overrides = [],
    enabledCapabilities = ["CAP-101", "CAP-102"],
    overviewStats = {},
    websiteId,
  } = params;

  // 1. Evaluate user's authoritative permissions
  const { allowedPermissions } = evaluateEffectivePermissions({
    role: userRole,
    customRoleId,
    overrides,
  });

  // 2. Determine eligible experience levels based on role
  const eligibleLevels: ExperienceLevel[] = ["SIMPLE_OWNER"];
  if (
    userRole === "DEVELOPER" ||
    userRole === "DESIGNER" ||
    userRole === "ADMIN" ||
    userRole === "OWNER"
  ) {
    eligibleLevels.push("DESIGN_DEVELOPER");
  }
  if (userRole === "ADMIN" || userRole === "OWNER") {
    eligibleLevels.push("AGENCY_PLATFORM");
  }

  // Active view level defaults to highest permitted or user's requested level if eligible
  const activeLevel: ExperienceLevel = eligibleLevels.includes(requestedLevel)
    ? requestedLevel
    : eligibleLevels[0];

  const activePriority = EXPERIENCE_PRIORITY[activeLevel];

  // 3. Filter and annotate navigation items
  const navigation: Record<WorkspaceArea, NavigationItem[]> = {
    overview_tasks: [],
    design_pages: [],
    content_media: [],
    leads_conversations: [],
    growth_campaigns: [],
    search_measurement: [],
    publish_operations: [],
    governance: [],
  };

  for (const item of ALL_NAVIGATION_ITEMS) {
    const itemPriority = EXPERIENCE_PRIORITY[item.minExperienceLevel];

    // In SIMPLE_OWNER mode, hide items that require DESIGN_DEVELOPER or AGENCY_PLATFORM
    if (activeLevel === "SIMPLE_OWNER" && itemPriority > activePriority) {
      continue;
    }

    const hasPermission = allowedPermissions.has(item.requiredPermission);

    let prerequisiteNotice: string | undefined;
    let isDisabled = false;

    if (!hasPermission) {
      isDisabled = true;
      prerequisiteNotice = `Requires permission: ${item.requiredPermission}`;
    }

    navigation[item.area].push({
      ...item,
      isAuthorized: hasPermission,
      isDisabled,
      prerequisiteNotice,
    });
  }

  // 4. Assemble realistic, non-fabricated overview data
  const overview: WorkspaceOverviewData = {
    newLeadsCount: overviewStats.newLeadsCount ?? 0,
    overdueLeadsCount: overviewStats.overdueLeadsCount ?? 0,
    pendingReviewsCount: overviewStats.pendingReviewsCount ?? 0,
    publicationFailuresCount: overviewStats.publicationFailuresCount ?? 0,
    integrationHealth: overviewStats.integrationHealth ?? {
      totalConfigured: 0,
      activeCount: 0,
      degradedCount: 0,
      failingCount: 0,
    },
    spendingSummary: overviewStats.spendingSummary ?? {
      currentSpendUnits: 0,
      budgetLimitUnits: 1000,
      alertThresholdReached: false,
    },
    prioritizedTasks: overviewStats.prioritizedTasks ?? [],
  };

  // If there are publication failures, add prioritized action item
  if (overview.publicationFailuresCount > 0) {
    overview.prioritizedTasks.push({
      id: "task:pub_failure",
      title: "Resolve Failed Publication Release",
      severity: "CRITICAL",
      nextAction: "Inspect release diagnostics and repair compiler errors",
      route: "/workspace/publish/diagnostics",
    });
  }

  // If there are overdue leads, add warning task
  if (overview.overdueLeadsCount > 0) {
    overview.prioritizedTasks.push({
      id: "task:overdue_leads",
      title: `${overview.overdueLeadsCount} Customer Inquiry Awaiting Response`,
      severity: "WARNING",
      nextAction: "Open inbox and respond to pending customer questions",
      route: "/workspace/leads",
    });
  }

  return {
    experienceLevel: activeLevel,
    availableExperienceLevels: eligibleLevels,
    activeWebsiteId: websiteId,
    navigation,
    overview,
    features: {
      canEditSourceCode: allowedPermissions.has("perm:code:approve"),
      canViewReconciliationConflicts: allowedPermissions.has("perm:code:approve"),
      canManageRoles: allowedPermissions.has("perm:roles:admin"),
      canPublishDirectly: allowedPermissions.has("perm:content:publish"),
      canExportPii: allowedPermissions.has("perm:pii:export"),
      canPurge: allowedPermissions.has("perm:purge:execute"),
    },
  };
}
