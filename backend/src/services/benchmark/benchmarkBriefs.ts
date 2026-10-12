/**
 * ForgeStudio Execution Blueprint v2.1 — Point 03: Market Reality and Benchmark to Win
 * Ten Heterogeneous Synthetic Business Briefs
 *
 * Implements 10 materially distinct, reproducible synthetic business scenarios covering:
 * 1. BRIEF-01-SOLARIS-CONSULTING: Content-Led Business Website
 * 2. BRIEF-02-VANGUARD-LEGAL: Professional Services Firm
 * 3. BRIEF-03-APEX-ACADEMY: Training Program Catalogue (Non-LMS)
 * 4. BRIEF-04-CHRONICLE-DIGITAL: Editorial & Resource Publication
 * 5. BRIEF-05-NEXUS-TALENT: Collection-Driven Talent & Agency Directory
 * 6. BRIEF-06-PULSE-FITNESS: High-Conversion Lead Generation Site
 * 7. BRIEF-07-CALC-FINANCIAL: Interactive Tool with Stateful Custom Components
 * 8. BRIEF-08-AURA-PROPERTIES: Dynamic Inventory with Schema Evolution
 * 9. BRIEF-09-BEACON-NONPROFIT: Portable Self-Hosted Community Site
 * 10. BRIEF-10-HORIZON-HEALTH: Multi-Operator Governance & Safe Release Site
 */

export interface SyntheticBusinessBrief {
  id: string; // e.g. BRIEF-01-SOLARIS-CONSULTING
  briefNumber: number; // 1 to 10
  name: string;
  archetype: string;
  industry: string;
  businessContext: string;
  targetAudience: string;
  requiredPages: Array<{
    title: string;
    slug: string;
    pageType: "STANDARD" | "COLLECTION_LIST" | "COLLECTION_DETAIL" | "FORM_LANDING" | "TOOL_CALCULATOR";
    keySections: string[];
  }>;
  collectionRequirements: Array<{
    collectionName: string;
    schemaFields: Array<{ name: string; type: "string" | "text" | "number" | "image" | "date" | "boolean"; required: boolean }>;
    initialRecordCount: number;
  }>;
  requiredInteractions: string[];
  requiredWorkflows: string[];
  assetFixtures: string[];
  mobileAndA11yCriteria: string[];
  releaseSafetyRequirements: string[];
  portabilityRequirements: string[];
  explicitExclusions: string[]; // Prevents scope creep into full LMS, banking, etc.
  acceptanceCriteria: string[];
  criticalFailureConditions: string[];
}

export const SYNTHETIC_BUSINESS_BRIEFS: SyntheticBusinessBrief[] = [
  {
    id: "BRIEF-01-SOLARIS-CONSULTING",
    briefNumber: 1,
    name: "Solaris Strategic Advisory",
    archetype: "Content-Led Business Website",
    industry: "Management Consulting & Enterprise Strategy",
    businessContext: "B2B boutique consulting firm delivering whitepapers, executive briefs, leadership team profiles, and case studies to Fortune 500 executives.",
    targetAudience: "Chief Strategy Officers, Enterprise VP Executives, Board Members.",
    requiredPages: [
      { title: "Home", slug: "/", pageType: "STANDARD", keySections: ["Hero with Video Modal", "Strategic Pillars", "Featured Insight", "Client Logos", "Contact CTA"] },
      { title: "Practices", slug: "/practices", pageType: "STANDARD", keySections: ["Industry Sectors Grid", "Methodology Overview", "Partner Leadership"] },
      { title: "Insights & Whitepapers", slug: "/insights", pageType: "COLLECTION_LIST", keySections: ["Category Filter Bar", "Insights Grid", "Newsletter Subscription"] },
      { title: "Case Studies", slug: "/case-studies", pageType: "COLLECTION_LIST", keySections: ["Impact Metrics", "Case Study Cards", "Executive Testimonials"] },
      { title: "Contact & RFP", slug: "/contact", pageType: "FORM_LANDING", keySections: ["Direct Inquiry Form", "Global Office Coordinates", "Press Contact"] },
    ],
    collectionRequirements: [
      {
        collectionName: "insights",
        schemaFields: [
          { name: "title", type: "string", required: true },
          { name: "slug", type: "string", required: true },
          { name: "author", type: "string", required: true },
          { name: "readTimeMinutes", type: "number", required: true },
          { name: "publishedAt", type: "date", required: true },
          { name: "summary", type: "text", required: true },
          { name: "bodyHtml", type: "text", required: true },
          { name: "heroImage", type: "image", required: true },
        ],
        initialRecordCount: 6,
      },
    ],
    requiredInteractions: ["Category tabs filtering insights without page reload", "Expandable methodology accordion", "Mobile navigation menu"],
    requiredWorkflows: ["Newsletter subscription lead capture", "Direct executive RFP form submission with validation"],
    assetFixtures: ["solaris-brand-kit.zip", "insights-mock-articles.json", "executive-headshots.zip"],
    mobileAndA11yCriteria: ["WCAG 2.1 AA contrast on dark navy headers", "No horizontal overflow at 375px", "Keyboard tab navigation on insight cards"],
    releaseSafetyRequirements: ["Zero publish of draft insights without author and hero image", "Atomic deployment with immediate rollback target"],
    portabilityRequirements: ["Static HTML/JS export capable of running on AWS S3 / CloudFront"],
    explicitExclusions: ["No e-commerce checkout", "No gated member paywall or subscription billing"],
    acceptanceCriteria: ["All 5 pages fully populated", "Insights collection correctly renders cards and detail views", "Form submits valid inquiries to database"],
    criticalFailureConditions: ["RFP submission fails silently", "Insights collection loses author mappings upon publish"],
  },
  {
    id: "BRIEF-02-VANGUARD-LEGAL",
    briefNumber: 2,
    name: "Vanguard Partners LLP",
    archetype: "Professional Services Firm",
    industry: "Corporate & M&A Law",
    businessContext: "Mid-sized law firm presenting attorney bio directories, specialized practice areas, legal disclaimers, and consultation scheduling requests.",
    targetAudience: "General Counsels, M&A Dealmakers, Corporate Founders.",
    requiredPages: [
      { title: "Home", slug: "/", pageType: "STANDARD", keySections: ["Hero Statement", "Key Accreditations", "Practice Highlights", "Representative Deals"] },
      { title: "Attorneys", slug: "/attorneys", pageType: "COLLECTION_LIST", keySections: ["Practice Area Filter", "Jurisdiction Search", "Attorney Bio Cards"] },
      { title: "Attorney Detail", slug: "/attorneys/:slug", pageType: "COLLECTION_DETAIL", keySections: ["Bio Header", "Education & Bar Admissions", "Key Matters", "Direct Contact"] },
      { title: "Practices", slug: "/practices", pageType: "STANDARD", keySections: ["Practice Descriptions", "Lead Partners"] },
      { title: "Consultation Request", slug: "/request-consultation", pageType: "FORM_LANDING", keySections: ["Conflict-of-Interest Notice", "Secure Intake Form"] },
    ],
    collectionRequirements: [
      {
        collectionName: "attorneys",
        schemaFields: [
          { name: "name", type: "string", required: true },
          { name: "title", type: "string", required: true },
          { name: "barAdmissions", type: "string", required: true },
          { name: "practices", type: "string", required: true },
          { name: "bio", type: "text", required: true },
          { name: "photo", type: "image", required: true },
        ],
        initialRecordCount: 8,
      },
    ],
    requiredInteractions: ["Practice area multi-select filtering", "Dynamic attorney profile page generation from collection"],
    requiredWorkflows: ["Secure legal intake form with mandatory disclaimer checkbox and durable persistence"],
    assetFixtures: ["vanguard-attorney-photos.zip", "firm-legal-disclaimers.json"],
    mobileAndA11yCriteria: ["Attorney cards stack cleanly on 375px viewports", "Accessible ARIA labels on all modal disclaimers"],
    releaseSafetyRequirements: ["Mandatory disclaimer presence on all forms before publishing is permitted"],
    portabilityRequirements: ["Export to standard Node.js server with intact form handling"],
    explicitExclusions: ["No client trust-accounting or retainer payment portal", "No confidential document vault"],
    acceptanceCriteria: ["Attorney collection generates working detail pages", "Intake form persists leads with disclaimer timestamp"],
    criticalFailureConditions: ["Intake form loses submission during CRM downtime", "Attorney slug conflict overrides existing bio"],
  },
  {
    id: "BRIEF-03-APEX-ACADEMY",
    briefNumber: 3,
    name: "Apex Executive Institute",
    archetype: "Training Program Catalogue (Non-LMS)",
    industry: "Executive Education & Professional Certifications",
    businessContext: "Executive institute offering structured training program brochures, syllabus downloads, cohort schedules, and enrollment applications. Strictly an informational catalogue, not an LMS.",
    targetAudience: "Corporate HR Directors, Engineering Managers, Mid-Career Professionals.",
    requiredPages: [
      { title: "Home", slug: "/", pageType: "STANDARD", keySections: ["Value Proposition", "Flagship Programs", "Corporate Partners", "Alumni Outcomes"] },
      { title: "Program Catalogue", slug: "/programs", pageType: "COLLECTION_LIST", keySections: ["Search Bar", "Duration & Level Filters", "Program Cards"] },
      { title: "Program Detail", slug: "/programs/:slug", pageType: "COLLECTION_DETAIL", keySections: ["Syllabus Modules", "Faculty Bio", "Upcoming Cohort Dates", "Tuition & Apply CTA"] },
      { title: "Corporate Solutions", slug: "/corporate", pageType: "STANDARD", keySections: ["Custom Curriculum Info", "Team Training Inquiry Form"] },
    ],
    collectionRequirements: [
      {
        collectionName: "programs",
        schemaFields: [
          { name: "title", type: "string", required: true },
          { name: "track", type: "string", required: true },
          { name: "durationWeeks", type: "number", required: true },
          { name: "tuitionUsd", type: "number", required: true },
          { name: "nextCohortDate", type: "date", required: true },
          { name: "syllabusSummary", type: "text", required: true },
        ],
        initialRecordCount: 5,
      },
    ],
    requiredInteractions: ["Expandable syllabus curriculum tree", "Cohort date dropdown selector", "Brochure download trigger modal"],
    requiredWorkflows: ["Program syllabus PDF download with email capture", "Corporate cohort inquiry form"],
    assetFixtures: ["apex-curriculum-fixtures.json", "program-cover-photos.zip"],
    mobileAndA11yCriteria: ["Program pricing and dates legible without pinch-zoom", "Focus visible on all syllabus accordions"],
    releaseSafetyRequirements: ["All program cards must have valid next cohort dates prior to publish"],
    portabilityRequirements: ["Export to static host with Netlify form handler"],
    explicitExclusions: ["No video learning player, quizzes, student login, or LMS grading"],
    acceptanceCriteria: ["Catalogue displays filtered programs", "Program detail page dynamically renders syllabus modules"],
    criticalFailureConditions: ["Syllabus email capture drops lead silently", "Tuition values display NaN or undefined"],
  },
  {
    id: "BRIEF-04-CHRONICLE-DIGITAL",
    briefNumber: 4,
    name: "The Urbanist Chronicle",
    archetype: "Editorial & Resource Publication",
    industry: "Civic Architecture & Urban Planning Journal",
    businessContext: "High-volume digital publication featuring editorial long-form articles, issue archives, photo essays, and research report downloads.",
    targetAudience: "Architects, Urban Planners, Municipal Leaders, Design Enthusiasts.",
    requiredPages: [
      { title: "Home", slug: "/", pageType: "STANDARD", keySections: ["Lead Story", "Editor's Picks", "Latest Dispatch Feed", "Archive Navigation"] },
      { title: "Articles Archive", slug: "/articles", pageType: "COLLECTION_LIST", keySections: ["Taxonomy Filter (Topic/Year)", "Infinite/Paginated Article List"] },
      { title: "Article Template", slug: "/articles/:slug", pageType: "COLLECTION_DETAIL", keySections: ["Hero Photo Essay", "Pull Quotes", "Footnotes", "Related Articles"] },
      { title: "Research Reports", slug: "/reports", pageType: "STANDARD", keySections: ["Whitepaper Downloads", "Lead Gate"] },
    ],
    collectionRequirements: [
      {
        collectionName: "articles",
        schemaFields: [
          { name: "title", type: "string", required: true },
          { name: "category", type: "string", required: true },
          { name: "author", type: "string", required: true },
          { name: "publishedAt", type: "date", required: true },
          { name: "featuredImage", type: "image", required: true },
          { name: "contentMarkdown", type: "text", required: true },
        ],
        initialRecordCount: 12,
      },
    ],
    requiredInteractions: ["Topic taxonomy badge filtering", "Social share floating bar", "Reading progress bar indicator"],
    requiredWorkflows: ["Research report download gate with consent tracking", "Newsletter digest subscription"],
    assetFixtures: ["urbanist-photo-essays.zip", "chronicle-editorial-corpus.json"],
    mobileAndA11yCriteria: ["Typography optimized for 60-75 character line lengths on mobile", "Alt text required on all photo essay images"],
    releaseSafetyRequirements: ["Strict OpenGraph and canonical URL verification prior to release"],
    portabilityRequirements: ["WordPress REST API / WXR cross-compatibility export"],
    explicitExclusions: ["No user comment moderation system or paid paywall paygate"],
    acceptanceCriteria: ["Articles render clean typography and pull-quotes", "Pagination across 12 items functions smoothly"],
    criticalFailureConditions: ["Article publishing creates broken canonical routes", "Photo essay images fail to load due to absolute URL lock-in"],
  },
  {
    id: "BRIEF-05-NEXUS-TALENT",
    briefNumber: 5,
    name: "Nexus Creative Collective",
    archetype: "Collection-Driven Directory",
    industry: "Design & Creative Talent Representation",
    businessContext: "Curated talent directory showcasing agency rosters, director portfolios, skill tags, and booking inquiry routing.",
    targetAudience: "Creative Directors, Brand Producers, Advertising Agencies.",
    requiredPages: [
      { title: "Home", slug: "/", pageType: "STANDARD", keySections: ["Roster Reel", "Discipline Grid", "Featured Creators", "Booking Callout"] },
      { title: "Talent Roster", slug: "/talent", pageType: "COLLECTION_LIST", keySections: ["Discipline & Location Filters", "Visual Grid of Talent Cards"] },
      { title: "Creator Portfolio", slug: "/talent/:slug", pageType: "COLLECTION_DETAIL", keySections: ["Hero Reel", "Bio & Awards", "Selected Works Gallery", "Book Talent CTA"] },
      { title: "Booking Request", slug: "/book", pageType: "FORM_LANDING", keySections: ["Talent Pre-select", "Budget Range", "Production Timeline Form"] },
    ],
    collectionRequirements: [
      {
        collectionName: "creators",
        schemaFields: [
          { name: "name", type: "string", required: true },
          { name: "discipline", type: "string", required: true },
          { name: "location", type: "string", required: true },
          { name: "bio", type: "text", required: true },
          { name: "portfolioImages", type: "image", required: true },
          { name: "availableForBooking", type: "boolean", required: true },
        ],
        initialRecordCount: 10,
      },
    ],
    requiredInteractions: ["Visual hover image preview on roster items", "Dynamic portfolio lightbox gallery", "Pre-fill booking form with selected creator"],
    requiredWorkflows: ["Production booking inquiry routed to talent management team"],
    assetFixtures: ["nexus-portfolio-images.zip", "talent-roster-records.json"],
    mobileAndA11yCriteria: ["2-column responsive grid gracefully down-scaling to 1-column on mobile", "Accessible modal gallery with escape key dismiss"],
    releaseSafetyRequirements: ["All portfolio detail views must render without undefined prop crashes"],
    portabilityRequirements: ["Full Next.js project export with image optimization intact"],
    explicitExclusions: ["No direct escrow payment processing or contract digital signature workflow"],
    acceptanceCriteria: ["Directory filters update instantly", "Creator detail pages showcase portfolio galleries"],
    criticalFailureConditions: ["Talent booking form loses selected creator ID", "Image gallery causes memory leak or unhandled exception"],
  },
  {
    id: "BRIEF-06-PULSE-FITNESS",
    briefNumber: 6,
    name: "Pulse Performance Lab",
    archetype: "Lead-Generation Website",
    industry: "High-Performance Athletic Training",
    businessContext: "Performance athletic facility driving local trial passes, membership inquiries, training schedules, and synthetic CRM lead capture.",
    targetAudience: "Endurance athletes, fitness enthusiasts, corporate wellness coordinators.",
    requiredPages: [
      { title: "Home", slug: "/", pageType: "STANDARD", keySections: ["High-Energy Hero", "Training Pillars", "Facility Tour", "Free Trial Pass CTA"] },
      { title: "Free Trial Pass", slug: "/free-trial", pageType: "FORM_LANDING", keySections: ["Trial Benefit Highlights", "Time-Slot Picker", "Multi-Step Lead Form"] },
      { title: "Schedule & Rates", slug: "/schedule", pageType: "STANDARD", keySections: ["Weekly Schedule Matrix", "Membership Tiers Comparison Table"] },
      { title: "Coaches", slug: "/coaches", pageType: "COLLECTION_LIST", keySections: ["Coach Bios", "Certifications"] },
    ],
    collectionRequirements: [
      {
        collectionName: "coaches",
        schemaFields: [
          { name: "name", type: "string", required: true },
          { name: "specialty", type: "string", required: true },
          { name: "certifications", type: "string", required: true },
          { name: "photo", type: "image", required: true },
        ],
        initialRecordCount: 4,
      },
    ],
    requiredInteractions: ["Multi-step form progression with step validation", "Interactive weekly schedule day selector tabs"],
    requiredWorkflows: ["High-priority synthetic lead capture tested under simulated CRM failure (TASK-06)"],
    assetFixtures: ["pulse-fitness-imagery.zip", "schedule-data.json"],
    mobileAndA11yCriteria: ["Multi-step form inputs sized >= 48px height on mobile", "Error messages announce via aria-live regions"],
    releaseSafetyRequirements: ["Validation rules must enforce valid email and phone before submission"],
    portabilityRequirements: ["Self-contained Docker container with SQLite / PostgreSQL fallback"],
    explicitExclusions: ["No recurring Stripe subscription charging or access barcode generation"],
    acceptanceCriteria: ["Multi-step lead form completes cleanly", "Synthetic lead resiliently persisted during CRM outage"],
    criticalFailureConditions: ["Lead submission lost during CRM endpoint outage", "Schedule table overflows mobile viewport"],
  },
  {
    id: "BRIEF-07-CALC-FINANCIAL",
    briefNumber: 7,
    name: "Meridian Mortgage Advisory",
    archetype: "Stateful Custom Component Tool",
    industry: "Residential Lending & Wealth Advisory",
    businessContext: "Mortgage advisory firm featuring interactive mortgage calculation widgets, amortization schedules, loan comparison tools, and pre-qualification leads.",
    targetAudience: "Homebuyers, refinancing homeowners, real estate agents.",
    requiredPages: [
      { title: "Home", slug: "/", pageType: "STANDARD", keySections: ["Trust Value Proposition", "Embedded Quick Calculator", "Loan Options", "Reviews"] },
      { title: "Interactive Calculator", slug: "/calculator", pageType: "TOOL_CALCULATOR", keySections: ["Full Mortgage Calculator Component", "Amortization Breakdown", "Apply for Rate CTA"] },
      { title: "Loan Programs", slug: "/programs", pageType: "STANDARD", keySections: ["Conventional, FHA, VA Comparison Grid"] },
      { title: "Pre-Approval Application", slug: "/pre-approval", pageType: "FORM_LANDING", keySections: ["Intake Questionnaire Form"] },
    ],
    collectionRequirements: [],
    requiredInteractions: [
      "Stateful interactive mortgage calculator with live monthly payment recalculation on slider drag (TASK-05)",
      "Dynamic principal vs interest breakdown chart visualization",
    ],
    requiredWorkflows: ["Pre-qualification inquiry passing calculator state (loan amount, term, rate) into lead record"],
    assetFixtures: ["stateful-mortgage-calculator.tsx", "meridian-brand-tokens.json"],
    mobileAndA11yCriteria: ["Slider inputs support keyboard ArrowLeft/ArrowRight controls", "Live calculations announce updates to screen readers"],
    releaseSafetyRequirements: ["Client state calculation cannot execute in privileged backend sandbox"],
    portabilityRequirements: ["React component source preserved intact in developer bridge export"],
    explicitExclusions: ["No credit bureau hard-pull API integration or bank account linking"],
    acceptanceCriteria: ["Calculator updates outputs in realtime without reloads", "Component source code preserved in project export"],
    criticalFailureConditions: ["Calculator component stripped or corrupted during visual canvas save", "Arbitrary code execution on host process"],
  },
  {
    id: "BRIEF-08-AURA-PROPERTIES",
    briefNumber: 8,
    name: "Aura Luxury Real Estate",
    archetype: "Dynamic Inventory with Schema Evolution",
    industry: "High-End Residential Real Estate",
    businessContext: "Luxury property brokerage featuring property listings, dynamic architectural specs, virtual tour links, and ongoing schema evolution requirements.",
    targetAudience: "High-net-worth buyers, property sellers, luxury agents.",
    requiredPages: [
      { title: "Home", slug: "/", pageType: "STANDARD", keySections: ["Cinematic Video Hero", "Featured Estates", "Neighborhood Guides", "Private Office CTA"] },
      { title: "Property Collection", slug: "/properties", pageType: "COLLECTION_LIST", keySections: ["Bed/Bath/Price Filter Bar", "Listing Cards with Status Badges"] },
      { title: "Property Detail", slug: "/properties/:slug", pageType: "COLLECTION_DETAIL", keySections: ["Hero Gallery", "Key Specs Matrix", "Floorplans", "Inquire Private Showing"] },
    ],
    collectionRequirements: [
      {
        collectionName: "properties",
        schemaFields: [
          { name: "title", type: "string", required: true },
          { name: "priceUsd", type: "number", required: true },
          { name: "bedrooms", type: "number", required: true },
          { name: "bathrooms", type: "number", required: true },
          { name: "squareFeet", type: "number", required: true },
          { name: "address", type: "string", required: true },
          { name: "description", type: "text", required: true },
          { name: "heroPhoto", type: "image", required: true },
        ],
        initialRecordCount: 8,
      },
    ],
    requiredInteractions: [
      "Dynamic filtering by price and bedroom count",
      "Schema Evolution Scenario (TASK-04): Add 'architectural_style' field and evolve 'priceUsd' to 'list_price_formatted' without data loss",
    ],
    requiredWorkflows: ["Private showing request form linked to active property ID"],
    assetFixtures: ["aura-property-photos.zip", "property-initial-records.json"],
    mobileAndA11yCriteria: ["Image galleries navigable via swipe touch gestures", "Price filter range accessible via keyboard"],
    releaseSafetyRequirements: ["Schema migrations must verify zero nullified records prior to publishing evolved schema"],
    portabilityRequirements: ["Full SQLite/Postgres export with media paths intact"],
    explicitExclusions: ["No MLS IDX live sync protocol or escrow wiring instructions"],
    acceptanceCriteria: ["All property records survive schema evolution without data loss", "Listing detail views update correctly"],
    criticalFailureConditions: ["Existing property price values wiped during schema field change", "Property detail route crashes on missing field"],
  },
  {
    id: "BRIEF-09-BEACON-NONPROFIT",
    briefNumber: 9,
    name: "Beacon Environmental Trust",
    archetype: "Portable Self-Hosted Community Site",
    industry: "Environmental Conservation & Community Forestry",
    businessContext: "Non-profit organization requiring complete digital sovereignty, zero proprietary SaaS lock-in, independent self-hosting on municipal servers, and ongoing publication outside original cloud.",
    targetAudience: "Community volunteers, grant foundations, municipal partners.",
    requiredPages: [
      { title: "Home", slug: "/", pageType: "STANDARD", keySections: ["Mission Banner", "Impact Metrics Counter", "Conservation Projects", "Volunteer Callout"] },
      { title: "Projects", slug: "/projects", pageType: "COLLECTION_LIST", keySections: ["Active Watershed Initiatives", "Community Forestry Projects"] },
      { title: "Project Detail", slug: "/projects/:slug", pageType: "COLLECTION_DETAIL", keySections: ["Project Timeline", "Volunteer Needs", "Partner Logos"] },
      { title: "News & Dispatch", slug: "/news", pageType: "COLLECTION_LIST", keySections: ["Community News Items", "Publish Article Workflow"] },
      { title: "Volunteer Signup", slug: "/volunteer", pageType: "FORM_LANDING", keySections: ["Volunteer Application Form", "Safety Waiver Checkbox"] },
    ],
    collectionRequirements: [
      {
        collectionName: "projects",
        schemaFields: [
          { name: "title", type: "string", required: true },
          { name: "location", type: "string", required: true },
          { name: "treesPlanted", type: "number", required: true },
          { name: "status", type: "string", required: true },
        ],
        initialRecordCount: 4,
      },
    ],
    requiredInteractions: ["Impact counter animation", "Project status tag filtering"],
    requiredWorkflows: [
      "Portability Qualification Workflow (TASK-09): Export site, deploy to isolated clean environment, verify independent article publication",
      "Volunteer intake form persistence",
    ],
    assetFixtures: ["beacon-nonprofit-assets.zip", "project-data-corpus.json"],
    mobileAndA11yCriteria: ["Screen-reader accessible impact counter", "High contrast mode support across volunteer form"],
    releaseSafetyRequirements: ["Export package must contain all assets without reliance on origin CDN"],
    portabilityRequirements: ["Strict zero-cloud-lock-in: site must install and publish in clean offline/isolated target server"],
    explicitExclusions: ["No 501(c)(3) tax deductible payment processing or donor management CRM"],
    acceptanceCriteria: ["Export installs cleanly in fresh target environment", "New article can be published independently on target host"],
    criticalFailureConditions: ["Export contains hardcoded origin URLs causing broken images on target host", "Standalone publishing fails outside cloud control plane"],
  },
  {
    id: "BRIEF-10-HORIZON-HEALTH",
    briefNumber: 10,
    name: "Horizon Regional Healthcare",
    archetype: "Multi-Operator Governance & Safe Release Site",
    industry: "Healthcare Systems & Outpatient Clinics",
    businessContext: "Regional healthcare provider with strict regulatory governance, multi-editor role permissions, emergency notification banners, release validation gating, and operator succession protocols.",
    targetAudience: "Patients, referring physicians, hospital staff, community health boards.",
    requiredPages: [
      { title: "Home", slug: "/", pageType: "STANDARD", keySections: ["Emergency Alert Banner", "Find Care Quick-Search", "Clinical Services", "Locations"] },
      { title: "Locations & Hours", slug: "/locations", pageType: "COLLECTION_LIST", keySections: ["Clinic Map Grid", "Walk-in Urgent Care Wait Times"] },
      { title: "Clinical Services", slug: "/services", pageType: "STANDARD", keySections: ["Cardiology, Oncology, Pediatrics, Orthopedics"] },
      { title: "Patient Appointment Request", slug: "/appointments", pageType: "FORM_LANDING", keySections: ["HIPAA-Aware Intake Disclaimer", "Appointment Scheduling Request Form"] },
    ],
    collectionRequirements: [
      {
        collectionName: "locations",
        schemaFields: [
          { name: "name", type: "string", required: true },
          { name: "address", type: "string", required: true },
          { name: "phone", type: "string", required: true },
          { name: "urgentCareAvailable", type: "boolean", required: true },
        ],
        initialRecordCount: 6,
      },
    ],
    requiredInteractions: [
      "Emergency alert dismissible banner with localStorage persistence",
      "Dangerous Release Rejection (TASK-08): Attempt to publish candidate with broken location data; verify rejection",
      "Operator Succession Recovery (TASK-10): Simulate admin lockout and verify succession protocol",
    ],
    requiredWorkflows: ["Appointment inquiry intake with HIPAA disclaimer compliance check", "Two-person publish approval workflow"],
    assetFixtures: ["horizon-health-branding.zip", "clinic-locations.json"],
    mobileAndA11yCriteria: ["Emergency banner readable with screen reader immediately upon landing", "WCAG 2.1 AAA contrast on urgent care alerts"],
    releaseSafetyRequirements: ["Dangerous candidate strictly blocked by validateWebsiteForPublish; live hospital site stays 100% online"],
    portabilityRequirements: ["Docker container export with hardened healthcheck endpoint"],
    explicitExclusions: ["No live electronic health record (EHR) sync or prescription refill engine"],
    acceptanceCriteria: ["Dangerous release safely blocked without live downtime", "Operator loss successfully recovered via audited protocol"],
    criticalFailureConditions: ["Dangerous release replaces live hospital website", "Account recovery grants access to unverified party"],
  },
];

/**
 * Retrieve synthetic brief by ID
 */
export function getSyntheticBusinessBriefById(id: string): SyntheticBusinessBrief | undefined {
  return SYNTHETIC_BUSINESS_BRIEFS.find((b) => b.id === id);
}

/**
 * List all brief summaries
 */
export function listSyntheticBusinessBriefs() {
  return SYNTHETIC_BUSINESS_BRIEFS.map((b) => ({
    id: b.id,
    briefNumber: b.briefNumber,
    name: b.name,
    archetype: b.archetype,
    industry: b.industry,
    pageCount: b.requiredPages.length,
    collectionCount: b.collectionRequirements.length,
  }));
}
