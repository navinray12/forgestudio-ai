/**
 * ForgeStudio Execution Blueprint v2.1 — Point 03: Market Reality and Benchmark to Win
 * Ten Required Benchmark Tasks Registry
 *
 * Implements the 10 original required tasks with stable identifiers, preconditions,
 * explicit steps, expected outcomes, pass/fail/blocked rules, and hard-failure severity.
 */

export type BenchmarkTaskSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface BenchmarkTaskDefinition {
  id: string; // e.g. TASK-01-CREATE-WEBSITE
  taskNumber: number; // 1 to 10
  name: string;
  category: "CORE_AUTHORING" | "EXPERIENCE_A11Y" | "CMS_DYNAMIC" | "COMPONENTS" | "BUSINESS_CRM" | "RECOVERY_SAFETY" | "PORTABILITY" | "GOVERNANCE";
  description: string;
  isHardFailureTrigger: boolean; // If true, failure on this task causes the entire benchmark run to flag a CRITICAL_FAILURE
  preconditions: string[];
  fixturesRequired: string[];
  executionSteps: string[];
  expectedOutcomes: string[];
  passCriteria: string[];
  failCriteria: string[];
  blockedCriteria: string[];
  severityOnFailure: BenchmarkTaskSeverity;
  measurementFields: string[];
  evidenceArtifactTypes: string[];
  cleanupInstructions: string;
}

export const BENCHMARK_TASKS: BenchmarkTaskDefinition[] = [
  {
    id: "TASK-01-CREATE-WEBSITE",
    taskNumber: 1,
    name: "Create a Website",
    category: "CORE_AUTHORING",
    description: "Create a complete multi-page business website from a standardized brief, content corpus, and assets.",
    isHardFailureTrigger: false,
    preconditions: [
      "Standard business brief assigned with defined page tree (Home, About, Services, Contact).",
      "Asset bundle prepared (SVG logos, optimized photography, brand tokens).",
      "Clean operator workspace without pre-cached site layouts.",
    ],
    fixturesRequired: ["brief-assets-bundle.zip", "brand-style-tokens.json"],
    executionSteps: [
      "Initialize new website project with target name and slug.",
      "Apply global typography, color palette, and container layouts matching brief.",
      "Construct all 4 required pages with visual hierarchy, text copy, and imagery.",
      "Configure global navigation header, interactive mobile drawer, and footer.",
      "Save working draft and record active operator elapsed time.",
    ],
    expectedOutcomes: [
      "All 4 pages fully rendered with structured semantic tags.",
      "Zero orphan links or missing image assets.",
      "Visual style matches brand tokens accurately.",
    ],
    passCriteria: [
      "All 4 pages created and accessible.",
      "Navigation links resolve correctly without 404s.",
      "Active elapsed time under 45 minutes for standard brief.",
      "No critical visual layout clipping.",
    ],
    failCriteria: [
      "One or more required pages missing or blank.",
      "Broken asset links or corrupt layout hierarchy.",
      "Time exceeded budget (> 60 minutes) or operator abandonment.",
    ],
    blockedCriteria: ["API server down or asset upload pipeline failing with 500 error."],
    severityOnFailure: "HIGH",
    measurementFields: ["activeElapsedSeconds", "totalElapsedSeconds", "layoutDefectsCount", "assistanceInterventionsCount"],
    evidenceArtifactTypes: ["DOM_INVENTORY", "PAGE_SCREENSHOTS", "CANVAS_SNAPSHOT"],
    cleanupInstructions: "Soft-delete test website and purge uploaded test assets.",
  },
  {
    id: "TASK-02-MOBILE-A11Y",
    taskNumber: 2,
    name: "Mobile Accessibility",
    category: "EXPERIENCE_A11Y",
    description: "Evaluate the generated website across mobile viewports (375px, 414px) and WCAG 2.1 AA accessibility standards.",
    isHardFailureTrigger: false,
    preconditions: ["Website pages created and accessible in staging viewport."],
    fixturesRequired: ["mobile-viewport-matrix.json", "wcag-aa-contrast-rules.json"],
    executionSteps: [
      "Inspect layout responsiveness at 375px (iPhone SE) and 414px (standard mobile) viewports.",
      "Verify touch target sizes (minimum 44x44px for buttons, links, inputs).",
      "Check semantic heading hierarchy (single H1, sequential H2-H4).",
      "Verify color contrast ratios meet WCAG AA (minimum 4.5:1 for body text, 3:1 for large text).",
      "Test keyboard navigability and focus indicators across all interactive elements.",
    ],
    expectedOutcomes: [
      "Zero horizontal page scrolling on mobile viewports.",
      "Touch targets comfortably tappable without overlapping tap zones.",
      "Contrast ratios pass automated validation.",
    ],
    passCriteria: [
      "No horizontal overflow at 375px viewport.",
      "Zero critical WCAG 2.1 AA violations.",
      "All interactive elements reachable via keyboard Tab order.",
    ],
    failCriteria: [
      "Horizontal scroll overflow > 20px on mobile screen.",
      "Contrast ratio < 3.0:1 on essential interactive elements.",
      "Missing focus indicator or focus trapped in modal.",
    ],
    blockedCriteria: ["Viewport emulation engine unavailable."],
    severityOnFailure: "MEDIUM",
    measurementFields: ["overflowDefectsCount", "wcagViolationsCount", "minTouchTargetSizePx"],
    evidenceArtifactTypes: ["A11Y_AUDIT_REPORT", "VIEWPORT_RESIZE_LOG"],
    cleanupInstructions: "None required (read-only audit).",
  },
  {
    id: "TASK-03-PUBLISH-ARTICLE",
    taskNumber: 3,
    name: "Add and Publish an Article",
    category: "CMS_DYNAMIC",
    description: "Create an editorial article, save draft state, publish, and verify public route availability.",
    isHardFailureTrigger: false,
    preconditions: [
      "Website is in active DRAFT or PUBLISHED state.",
      "Blog/article dynamic post type or page template exists.",
    ],
    fixturesRequired: ["sample-article-payload.json"],
    executionSteps: [
      "Create new article with title, slug, excerpt, hero image, and formatted body text.",
      "Save draft and verify draft revision snapshot exists.",
      "Trigger publication pipeline to production destination.",
      "Verify public route returns HTTP 200 with matching canonical content.",
      "Verify atomic deployment audit record created.",
    ],
    expectedOutcomes: [
      "Article rendered accurately at public URL.",
      "Correct SEO metadata and OpenGraph tags in page head.",
      "Publication status recorded authoritatively.",
    ],
    passCriteria: [
      "Public route renders complete article body with 200 OK.",
      "Deployment record status is PUBLISHED with durable snapshot pointer.",
    ],
    failCriteria: [
      "Published route returns 404, 500, or stale previous content.",
      "Image assets missing or corrupted.",
      "Publication process fails silently without deployment entry.",
    ],
    blockedCriteria: ["Publishing destination credentials unavailable."],
    severityOnFailure: "HIGH",
    measurementFields: ["publishDurationMs", "publicRouteStatusCode", "contentIntegrityMatchPercent"],
    evidenceArtifactTypes: ["DEPLOYMENT_AUDIT_RECORD", "PUBLIC_HTTP_RESPONSE"],
    cleanupInstructions: "Unpublish or delete test article.",
  },
  {
    id: "TASK-04-SCHEMA-EVOLUTION",
    taskNumber: 4,
    name: "Change a Used Collection Field",
    category: "CMS_DYNAMIC",
    description: "Modify a collection schema field already utilized by published dynamic templates and custom code.",
    isHardFailureTrigger: true, // Data loss or silent schema corruption is a critical failure!
    preconditions: [
      "Collection populated with >= 10 published records.",
      "At least 2 visual templates and 1 custom snippet query the target field.",
    ],
    fixturesRequired: ["collection-records-fixture.json"],
    executionSteps: [
      "Select an active schema field (e.g. rename 'client_budget' to 'project_budget_usd' or change type).",
      "Apply schema modification in collection settings.",
      "Execute database migration / schema update.",
      "Verify existing records retain data without silent truncation or deletion.",
      "Verify template bindings update or warn gracefully rather than crashing rendering.",
    ],
    expectedOutcomes: [
      "Schema change succeeds with backward compatibility or automated column migration.",
      "Zero customer data loss across pre-existing collection items.",
      "Templates display data accurately without runtime white-screen crash.",
    ],
    passCriteria: [
      "All pre-existing collection items retain field values.",
      "Templates render successfully without uncaught exceptions.",
      "Schema evolution event recorded in audit log.",
    ],
    failCriteria: [
      "Pre-existing field data lost or nullified across records.",
      "Visual template crashes with unhandled TypeError.",
      "Silent breaking change committed without warning.",
    ],
    blockedCriteria: ["Database schema migrations locked by active migration lock."],
    severityOnFailure: "CRITICAL",
    measurementFields: ["recordsPreservedCount", "schemaMigrationDurationMs", "dataLossOccurred"],
    evidenceArtifactTypes: ["SCHEMA_DIFF_LOG", "DATABASE_INTEGRITY_SNAPSHOT"],
    cleanupInstructions: "Revert schema to baseline fixture state.",
  },
  {
    id: "TASK-05-STATEFUL-COMPONENT",
    taskNumber: 5,
    name: "Reuse a Stateful Uploaded Component",
    category: "COMPONENTS",
    description: "Upload and register an interactive stateful component (e.g. mortgage calculator / interactive pricing matrix) and reuse it safely.",
    isHardFailureTrigger: true, // Sandbox breakout or privileged execution is critical!
    preconditions: ["Component upload endpoint available with sandboxed compilation."],
    fixturesRequired: ["stateful-calculator-component.tsx"],
    executionSteps: [
      "Upload stateful interactive React/TypeScript component bundle.",
      "Validate AST and verify no privileged node/host APIs are imported.",
      "Instantiate component into canvas element tree with configurable props.",
      "Test component interactivity in browser preview (state toggles, input calculation).",
      "Verify source code is preserved verbatim in developer project sync.",
    ],
    expectedOutcomes: [
      "Component renders cleanly on visual canvas.",
      "Interactive state changes (e.g. slider drag, state calculation) work as expected.",
      "Zero execution in privileged host runtime; zero host secret exposure.",
    ],
    passCriteria: [
      "Component functions interactively in client runtime.",
      "Source code preserved in bridged developer workspace.",
      "Component sandboxed safely without unauthorized server execution.",
    ],
    failCriteria: [
      "Component fails to compile or crashes editor canvas.",
      "Component source modified or stripped by visual editor.",
      "Arbitrary code executes in privileged API process.",
    ],
    blockedCriteria: ["Component compiler infrastructure unavailable."],
    severityOnFailure: "CRITICAL",
    measurementFields: ["compileDurationMs", "interactiveStateSuccess", "sourcePreservationMatch"],
    evidenceArtifactTypes: ["COMPONENT_AST_AUDIT", "STATE_INTERACTION_TELEMETRY"],
    cleanupInstructions: "Remove test component from workspace registry.",
  },
  {
    id: "TASK-06-CRM-OUTAGE-LEAD",
    taskNumber: 6,
    name: "Collect a Synthetic Lead During CRM Failure",
    category: "BUSINESS_CRM",
    description: "Simulate a controlled third-party CRM outage and verify that visitor leads are durably preserved, queued, and retried rather than lost.",
    isHardFailureTrigger: true, // Silent lead loss is a CRITICAL business failure!
    preconditions: [
      "Published website with active contact / lead generation form.",
      "CRM webhook / integration endpoint configured to target simulated outage route (HTTP 503/timeout).",
    ],
    fixturesRequired: ["synthetic-lead-payload.json"],
    executionSteps: [
      "Configure CRM integration with mock destination endpoint returning HTTP 503 Service Unavailable.",
      "Submit synthetic visitor lead through published form (name, email, phone, message).",
      "Verify form submission provides clear feedback to visitor without exposing raw infrastructure errors.",
      "Inspect local database / job queue to verify lead record is preserved durably in FormSubmission table.",
      "Verify background delivery job enters retry backoff state (RETRY_PENDING) rather than discarding the lead.",
      "Simulate CRM endpoint recovery (HTTP 200) and execute job retry.",
      "Verify lead successfully marks DELIVERED with complete audit trail.",
    ],
    expectedOutcomes: [
      "Zero lead data loss during third-party outage.",
      "Lead durably persisted locally in PostgreSQL before external dispatch.",
      "Retry queue handles transient outage and recovers automatically upon destination recovery.",
    ],
    passCriteria: [
      "Lead stored in local database with status QUEUED or RETRY_PENDING.",
      "Retry successfully delivers lead when endpoint recovers.",
      "Zero real external customer CRM data impacted.",
    ],
    failCriteria: [
      "CRITICAL: Lead discarded or lost silently during CRM failure.",
      "Form hangs indefinitely on client with uncaught promise rejection.",
      "CRM outage causes entire website to fail.",
    ],
    blockedCriteria: ["Form submission database unavailable."],
    severityOnFailure: "CRITICAL",
    measurementFields: ["leadStoredLocally", "retryAttemptsCount", "recoveryDeliverySuccess"],
    evidenceArtifactTypes: ["FORM_SUBMISSION_ROW", "QUEUE_JOB_AUDIT_LOG"],
    cleanupInstructions: "Purge synthetic lead and restore default integration status.",
  },
  {
    id: "TASK-07-INTERRUPTED-EDIT-RECOVERY",
    taskNumber: 7,
    name: "Recover an Interrupted Edit",
    category: "RECOVERY_SAFETY",
    description: "Simulate an abrupt editor session interruption (browser crash / network disconnect) and verify recovery of draft work.",
    isHardFailureTrigger: false,
    preconditions: [
      "Active editor session with unsaved modifications on a designated test site.",
    ],
    fixturesRequired: ["draft-edit-checkpoint.json"],
    executionSteps: [
      "Make complex layout modifications (add 3 components, change copy, adjust styling).",
      "Simulate abrupt session termination (abrupt client disconnect / kill process before manual save).",
      "Re-open website editor as the same operator.",
      "Verify presence of autosave / draft recovery checkpoint.",
      "Confirm prompt/mechanism restores uncommitted work accurately.",
    ],
    expectedOutcomes: [
      "Operator work preserved via local draft storage or server autosave journal.",
      "No corruption of the canonical baseline document.",
    ],
    passCriteria: [
      "At least 90% of uncommitted edits recoverable upon reload.",
      "Canonical published version remains completely uncorrupted.",
      "Recovery process completes in < 30 seconds.",
    ],
    failCriteria: [
      "Total work loss (reverts to stale state without draft checkpoint).",
      "Document JSON corrupted resulting in load failure.",
    ],
    blockedCriteria: ["Autosave service offline."],
    severityOnFailure: "HIGH",
    measurementFields: ["recoveredElementsPercent", "recoveryElapsedSeconds", "documentIntegrityCheck"],
    evidenceArtifactTypes: ["AUTOSAVE_JOURNAL_DIFF", "RECOVERED_CANVAS_SNAPSHOT"],
    cleanupInstructions: "Reset website to baseline revision snapshot.",
  },
  {
    id: "TASK-08-REJECT-DANGEROUS-RELEASE",
    taskNumber: 8,
    name: "Reject a Dangerous Release",
    category: "RECOVERY_SAFETY",
    description: "Introduce a release candidate violating a critical safety policy and verify that the release is rejected without disrupting the live site.",
    isHardFailureTrigger: true, // Silently publishing an invalid/corrupt candidate is critical!
    preconditions: [
      "Website is currently live and PUBLISHED with a known working release.",
    ],
    fixturesRequired: ["malformed-release-candidate.json"],
    executionSteps: [
      "Prepare release candidate containing intentional critical flaws (e.g. empty component tree, corrupt JSON, or unapproved changes).",
      "Attempt to trigger production publication via API / UI.",
      "Verify validateWebsiteForPublish intercepts the candidate and rejects with specific validation errors.",
      "Verify live production website continues serving the previous valid release with zero downtime.",
      "Verify deployment is marked FAILED or REJECTED with actionable error telemetry.",
    ],
    expectedOutcomes: [
      "Dangerous release completely blocked from live edge.",
      "Live website remains 100% operational on previous release.",
      "Clear rejection message returned to operator.",
    ],
    passCriteria: [
      "Publication safely rejected with HTTP 400/409 validation error.",
      "Live destination URL continues serving verified baseline snapshot.",
      "Rejection recorded in deployment audit history.",
    ],
    failCriteria: [
      "CRITICAL: Broken candidate deployed to live production site.",
      "Live site white-screens or displays 500 error.",
      "Deployment marked PUBLISHED despite critical validation failures.",
    ],
    blockedCriteria: ["Publishing validator disabled."],
    severityOnFailure: "CRITICAL",
    measurementFields: ["rejectionIntercepted", "liveSiteAvailabilityDowntimeMs", "validationErrorCodes"],
    evidenceArtifactTypes: ["VALIDATION_ERROR_RESPONSE", "LIVE_ENDPOINT_PROBE_LOG"],
    cleanupInstructions: "None required (live site unaffected).",
  },
  {
    id: "TASK-09-PORTABLE-HOSTING-PUBLISH",
    taskNumber: 9,
    name: "Move to Fresh Hosting and Publish Another Article",
    category: "PORTABILITY",
    description: "Export the website, deploy it to a fresh isolated environment, and verify independent operation and ongoing publishing.",
    isHardFailureTrigger: false,
    preconditions: [
      "Website export bundle created using standard export profile.",
      "Clean isolated test container / server with Node.js/Docker installed.",
    ],
    fixturesRequired: ["fresh-environment-config.json"],
    executionSteps: [
      "Generate export bundle from ForgeStudio (Static or Fullstack Developer Workspace).",
      "Deploy export bundle into fresh isolated target environment.",
      "Start web server and verify public pages render with styles, routes, and assets intact.",
      "If self-hosted CMS capability is claimed: perform independent article publication in the target environment.",
      "Record any missing dependencies, manual configuration steps, or platform lock-ins.",
    ],
    expectedOutcomes: [
      "Exported site runs independently outside ForgeStudio SaaS infrastructure.",
      "All declared features for the portability profile function in the target environment.",
    ],
    passCriteria: [
      "Public pages render with 200 OK in target environment.",
      "Assets and client routing functional without broken URLs.",
      "All prerequisites and manual steps clearly documented.",
    ],
    failCriteria: [
      "Export bundle cannot be installed or started in clean environment.",
      "Missing critical assets or CSS resulting in unstyled content.",
      "Hidden proprietary cloud dependency prevents standalone operation.",
    ],
    blockedCriteria: ["Target container host unavailable."],
    severityOnFailure: "HIGH",
    measurementFields: ["installDurationMs", "unresolvedDependenciesCount", "targetPageStatusOk"],
    evidenceArtifactTypes: ["EXPORT_MANIFEST", "TARGET_RUNTIME_STDOUT"],
    cleanupInstructions: "Terminate test container and delete temporary bundle.",
  },
  {
    id: "TASK-10-OPERATOR-ACCOUNT-RECOVERY",
    taskNumber: 10,
    name: "Recover After Operator-Account Loss",
    category: "GOVERNANCE",
    description: "Simulate loss of access to primary operator account and verify documented emergency recovery and ownership succession.",
    isHardFailureTrigger: true, // Permanent lockout or unauthorized account takeover is critical!
    preconditions: [
      "Website owned by designated operator account with secondary administrator or verified recovery route.",
    ],
    fixturesRequired: ["emergency-recovery-credentials.json"],
    executionSteps: [
      "Simulate primary operator lockout (credential loss / MFA device loss).",
      "Initiate authorized account recovery succession workflow.",
      "Verify security checks (identity verification, email confirmation, security challenge).",
      "Transfer ownership / reassign administrator access to verified successor.",
      "Verify new operator has full management permissions.",
      "Verify locked account access is revoked securely without backdoors.",
    ],
    expectedOutcomes: [
      "Successor gains legitimate control of website project.",
      "Tenant isolation and security controls preserved without weakening production auth.",
      "Complete auditable security log of ownership succession.",
    ],
    passCriteria: [
      "Ownership transferred successfully to verified successor.",
      "Full audit trail generated with security timestamps.",
      "Authentication integrity strictly maintained.",
    ],
    failCriteria: [
      "CRITICAL: Website orphaned with no recovery possible.",
      "CRITICAL: Recovery bypasses security controls allowing unauthorized takeover.",
      "Audit trail missing or altered.",
    ],
    blockedCriteria: ["Security audit logging offline."],
    severityOnFailure: "CRITICAL",
    measurementFields: ["recoveryElapsedSeconds", "securityIntegrityPreserved", "auditLogGenerated"],
    evidenceArtifactTypes: ["SECURITY_AUDIT_LOG", "OWNERSHIP_TRANSFER_RECORD"],
    cleanupInstructions: "Restore original test user ownership.",
  },
];

/**
 * Helper to retrieve a benchmark task by ID
 */
export function getBenchmarkTaskById(id: string): BenchmarkTaskDefinition | undefined {
  return BENCHMARK_TASKS.find((t) => t.id === id);
}

/**
 * Retrieve all tasks that trigger hard critical failures on failure
 */
export function getHardFailureTriggerTasks(): BenchmarkTaskDefinition[] {
  return BENCHMARK_TASKS.filter((t) => t.isHardFailureTrigger);
}
