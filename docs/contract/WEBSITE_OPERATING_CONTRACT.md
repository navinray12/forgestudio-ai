# ForgeStudio Website Operating Contract Specification
**Document Version:** 2.1.0  
**Blueprint Controlling Point:** Point 04 — What Every Generated Website Must Contain  
**Status:** Canonical Platform Standard  

---

## 1. Controlling Principle

The normal-site baseline is an **operating contract**, not an arbitrary menu of generic website templates.

Every generated website produced by ForgeStudio must be a usable, maintainable, truthful website with explicit ownership, content integrity, working actions, correct operational states, safe publishing, and documented deployment behavior.

ForgeStudio strictly provisions capabilities based on approved business facts. Unused collections (such as e-commerce checkout, LMS portals, or simulated third-party CRMs) are omitted rather than filled with dummy records or placeholder links.

---

## 2. Page Contract Model

Every page in a generated ForgeStudio website adheres to the `PageContract` domain specification:

| Field | Type | Requirement | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | **Mandatory** | Stable, unique identifier for the page across revisions. |
| `route` | `string` | **Mandatory** | Canonical URL route (e.g., `/`, `/about`, `/contact`). Must be globally unique within the website. |
| `purpose` | `PagePurpose` | **Mandatory** | Explicit page role: `HOME`, `OFFERING_DETAIL`, `ABOUT_TRUST`, `CONTACT_CONVERSION`, `BLOG_INDEX`, `ARTICLE_DETAIL`, `POLICY_LEGAL`, `UTILITY_404`, `CAMPAIGN_LANDING`. |
| `title` | `string` | **Mandatory** | Semantic page title for accessibility and navigation. |
| `templateRef` | `string` | **Mandatory** | Reference to the underlying page layout template. |
| `reviewState` | `ContentReviewState`| **Mandatory** | Editorial review status: `DRAFT`, `IN_REVIEW`, `APPROVED`, `REJECTED`. |
| `primaryAction` | `PageAction` | **Mandatory on Home** | Clear next action. Must resolve to a valid internal route, authorized command, or explicit unavailable state. Dead links (`#`) are strictly prohibited. |
| `actions` | `PageAction[]` | Optional | Visible interactive actions on the page. All must resolve cleanly. |
| `claims` | `BusinessClaim[]` | Optional | Material business statements tagged with verification status and evidence references. |
| `seoPolicy` | `PageSeoPolicy` | **Mandatory** | Explicit indexing rules (`noIndex`, `canonicalUrl`, `metaDescription`). |
| `revision` | `string` | **Mandatory** | Pointer to current immutable content version. |

---

## 3. Working-Action Contract

Every visible button, link, or CTA on a generated website must resolve to exactly one of three truthful outcomes:

1. **A Working Route (`ROUTE`):** Resolves to an existing route on the website or an external URL (`https://`, `mailto:`, `tel:`). Internal anchors (`#section`) are allowed only if the anchor exists.
2. **An Authorized Command (`COMMAND`):** Resolves to an approved platform action (`submit_lead`, `search_site`, `switch_locale`, `update_consent`, `paginate_content`). Inputs are validated client- and server-side.
3. **An Explicit Unavailable State (`UNAVAILABLE`):** When an optional capability (e.g., live chat or live booking) is not activated, the UI truthfully explains the limitation and configuration path.

> [!CAUTION]
> **Defect Invariant:** Any decorative button, inert submit action, dead link (`#`, `javascript:void(0)`), or misleading universal success response is treated as a critical contract defect and will block pre-publish verification.

---

## 4. Operational State Coverage

Generated components that interact with asynchronous operations or server endpoints must support relevant operational states:

- **`LOADING`:** Communicates pending operation without falsely claiming completion.
- **`EMPTY`:** Explains absence of content or omits optional section cleanly.
- **`VALIDATION_FAILURE`:** Highlights specific actionable errors; preserves valid user input.
- **`REFUSAL`:** Prevents unauthorized execution without leaking internal tenant data.
- **`EXPIRATION`:** Safely handles expired sessions, links, or tokens.
- **`OUTAGE`:** Shows an honest unavailable notice; ensures leads are persisted locally/durably before notifying staff.
- **`RETRY`:** Retries idempotent operations with exponential backoff and rate-limit awareness.
- **`SUCCESS`:** Displays confirmation **only after** durable backend persistence has occurred.

---

## 5. Public Rendering vs. Protected Data Boundary

1. Public visitors have read-only access to published snapshot routes.
2. Draft revisions, internal reviewer notes, customer lead records, CRM connection credentials, and audit logs are strictly isolated behind tenant authorization policies.
3. No server secrets, API tokens, or privileged administration scripts are ever embedded in generated frontend bundles.
